import { createHash } from 'node:crypto';
import type { AuditEntry } from '@/platform/audit/audit';
import { rootLogger } from '@/platform/logging/logger';
import { rateLimited } from '@/platform/ratelimit/ratelimit';
import type { Tx } from '@/platform/tx/unitOfWork';
import { MessageDeliveryError } from '@/modules/sys';
import type { QuoteOtpRecord } from '../domain/messaging';
import {
  checkOtp,
  generateOtpCode,
  hashOtp,
  newOtpSalt,
  type OtpCheck,
  type OtpSettings,
} from '../domain/otp';
import type { RecDeps } from '../ports/deps';
import { contactOf, otpTargetOf } from './contact';
import { AppError, type RequestCtx } from './support';

/**
 * One-time code on the customer's online approval (QUO-04/05, R27). Only a salted hash of the 6-digit code is
 * stored; the code never reaches a log or an audit entry. The code goes to the contact on file (CRM), never to a
 * number typed on the public page. One record per link: a new code replaces the old one ("one code per approval
 * attempt"). Wrong tries are persisted in their own transaction so the failing request cannot roll them back.
 */

/** the link as the public flow resolved it */
interface LinkRef {
  id: string;
  companyId: string;
  branchId: string;
  quoteId: string;
}

/** a code is bound to the approved selection: one for another selection never approves this one */
export const selectionHashOf = (n: number, selectedItemNos: readonly number[]): string =>
  createHash('sha256')
    .update(`${n}:${[...new Set(selectedItemNos)].sort((a, b) => a - b).join(',')}`)
    .digest('hex');

/** Effective settings: the config values over the documented defaults. */
export function otpSettingsOf(deps: RecDeps, ttlSeconds?: number): OtpSettings {
  const d = deps.rec.otp;
  return {
    ttlMs: ttlSeconds ? ttlSeconds * 1000 : d.ttlMs,
    maxAttempts: d.maxAttempts,
    resendCooldownMs: d.resendCooldownMs,
  };
}

/** The customer acts through the link and has no account: the actor of the audit entry is the link. */
function linkAudit(
  deps: RecDeps,
  link: LinkRef,
  ctx: RequestCtx,
  action: string,
  after: Record<string, unknown>,
): AuditEntry {
  return {
    id: deps.sys.newId(),
    at: deps.sys.clock.now(),
    companyId: link.companyId,
    branchId: link.branchId,
    actorId: `customer-link:${link.id.slice(0, 16)}`,
    actorRoles: ['customer-link'],
    actorType: 'customer-link',
    entityType: 'quote',
    entityId: link.quoteId,
    action,
    before: null,
    // never the code, never the phone or e-mail: channel and a masked destination only
    after,
    requestId: ctx.requestId,
  };
}

export interface OtpIssued {
  /** false = a code for this selection was sent a moment ago and is still valid (a double tap), nothing new was sent */
  sent: boolean;
  channel: 'sms' | 'zalo' | 'email';
  /** masked destination the customer recognises, e.g. "09•• ••• 211" */
  destination: string;
  codeExpiresAt: Date;
  resendAfter: Date;
}

/**
 * Sends a new code for the approval attempt (the caller already checked the link, the selection and that a code is
 * required). Limits: resend cooldown, codes per link per window, requests per address, lock after too many wrong tries.
 */
export async function issueOtp(
  deps: RecDeps,
  p: {
    link: LinkRef;
    customerId: string;
    n: number;
    selectionHash: string;
    address: string;
    ttlSeconds?: number;
  },
  ctx: RequestCtx,
): Promise<OtpIssued> {
  const now = deps.sys.clock.now();
  const cfg = otpSettingsOf(deps, p.ttlSeconds);
  const cur = await deps.otps.get(p.link.id);
  const sameAttempt =
    !!cur && cur.n === p.n && cur.selectionHash === p.selectionHash && !cur.consumedAt;
  if (cur?.lockedAt && now.getTime() < cur.lockedAt.getTime() + deps.rec.otp.sendWindowMs)
    throw new AppError('otp_locked', 423);
  if (cur && sameAttempt && !cur.lockedAt && cur.codeExpiresAt > now && cur.resendAfter > now)
    return {
      sent: false,
      channel: cur.channel,
      destination: await maskedDestination(deps, p, cur.channel),
      codeExpiresAt: cur.codeExpiresAt,
      resendAfter: cur.resendAfter,
    };
  if (cur && cur.resendAfter > now)
    throw rateLimited(
      Math.ceil((cur.resendAfter.getTime() - now.getTime()) / 1000),
      'otp_cooldown',
    );

  const target = await otpTargetOf(deps, { companyId: p.link.companyId, customerId: p.customerId });
  if (!target) throw new AppError('otp_unavailable', 409);

  const win = deps.rec.otp.sendWindowMs;
  await deps.sys.limiter.hit('quote-otp-send', `tok:${p.link.id.slice(0, 24)}`, {
    limit: deps.rec.otp.sendLimit,
    windowMs: win,
  });
  await deps.sys.limiter.hit('quote-otp-send-ip', `ip:${p.address}`, {
    limit: deps.rec.otp.addressLimit,
    windowMs: win,
  });

  const code = generateOtpCode();
  const salt = newOtpSalt();
  const codeExpiresAt = new Date(now.getTime() + cfg.ttlMs);
  const record: QuoteOtpRecord = {
    id: p.link.id,
    companyId: p.link.companyId,
    branchId: p.link.branchId,
    quoteId: p.link.quoteId,
    n: p.n,
    selectionHash: p.selectionHash,
    salt,
    codeHash: hashOtp(salt, p.link.id, code),
    channel: target.channel,
    sentAt: now,
    codeExpiresAt,
    resendAfter: new Date(now.getTime() + cfg.resendCooldownMs),
    attempts: 0,
    maxAttempts: cfg.maxAttempts,
    createdAt: now,
    expiresAt: new Date(codeExpiresAt.getTime() + 24 * 3_600_000),
  };
  await deps.sys.uow.run(async (tx) => {
    deps.otps.set(tx, record);
    deps.sys.audit.record(
      tx,
      linkAudit(deps, p.link, ctx, 'quote.otp_sent', {
        n: p.n,
        channel: target.channel,
        to: target.masked,
      }),
    );
  });
  try {
    await deps.sys.messages.send({
      id: `otp-${p.link.id.slice(0, 16)}-${now.getTime()}`,
      channel: target.channel,
      to: target.to,
      template: 'approval-otp',
      vars: { code, expiresMinutes: String(Math.max(1, Math.round(cfg.ttlMs / 60_000))) },
    });
  } catch (e) {
    if (!(e instanceof MessageDeliveryError)) throw e;
    rootLogger.warn({ channel: target.channel, requestId: ctx.requestId }, 'otp delivery failed');
    // the code never reached the customer: drop it so the cooldown does not block the next request
    await deps.sys.uow.run(async (tx) => {
      deps.otps.delete(tx, p.link.id);
    });
    throw new AppError('otp_delivery_failed', 502);
  }
  return {
    sent: true,
    channel: target.channel,
    destination: target.masked,
    codeExpiresAt,
    resendAfter: record.resendAfter,
  };
}

async function maskedDestination(
  deps: RecDeps,
  p: { link: LinkRef; customerId: string },
  channel: 'sms' | 'zalo' | 'email',
): Promise<string> {
  return (
    (await contactOf(deps, { companyId: p.link.companyId, customerId: p.customerId }, channel))
      ?.masked ?? ''
  );
}

/**
 * Checks the code the customer typed (before the approval transaction). A wrong code increments the counter and
 * locks the code at the limit, in its own transaction so it survives the failing request. Constant-time compare.
 */
export async function verifyOtp(
  deps: RecDeps,
  p: { link: LinkRef; n: number; selectionHash: string; code: string },
  ctx: RequestCtx,
): Promise<void> {
  const res: OtpCheck = await deps.sys.uow.run(async (tx) => {
    const st = await deps.otps.getInTx(tx, p.link.id);
    const now = deps.sys.clock.now();
    const r = checkOtp(st, now, {
      linkId: p.link.id,
      n: p.n,
      selectionHash: p.selectionHash,
      code: p.code,
    });
    if (r.kind === 'invalid') {
      deps.otps.update(tx, p.link.id, {
        attempts: r.attempts,
        ...(r.lock ? { lockedAt: now } : {}),
      });
      if (r.lock)
        deps.sys.audit.record(
          tx,
          linkAudit(deps, p.link, ctx, 'quote.otp_locked', { n: p.n, attempts: r.attempts }),
        );
    } else if (r.kind === 'ok' && st && !st.verifiedAt) {
      deps.otps.update(tx, p.link.id, { verifiedAt: now });
    }
    return r;
  });
  if (res.kind === 'ok') return;
  if (res.kind === 'invalid')
    throw new AppError(res.lock ? 'otp_locked' : 'otp_invalid', res.lock ? 423 : 422);
  if (res.kind === 'locked') throw new AppError('otp_locked', 423);
  if (res.kind === 'expired') throw new AppError('otp_expired', 422);
  throw new AppError('otp_required', 428);
}

/**
 * Inside the approval transaction (read before the first write): the code must have been verified for exactly this
 * selection and not used yet, and still be within its validity. Marks it used and returns what the evidence records.
 */
export async function consumeOtp(
  deps: RecDeps,
  tx: Tx,
  p: { linkId: string; n: number; selectionHash: string; now: Date },
): Promise<{ verifiedAt: Date; channel: 'sms' | 'zalo' | 'email' }> {
  const st = await deps.otps.getInTx(tx, p.linkId);
  if (
    !st ||
    st.n !== p.n ||
    st.selectionHash !== p.selectionHash ||
    !st.verifiedAt ||
    st.consumedAt
  )
    throw new AppError('otp_required', 428);
  if (st.codeExpiresAt <= p.now) throw new AppError('otp_expired', 422);
  deps.otps.update(tx, p.linkId, { consumedAt: p.now });
  return { verifiedAt: st.verifiedAt, channel: st.channel };
}
