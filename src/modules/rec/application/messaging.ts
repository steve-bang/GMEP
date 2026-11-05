import { createHash, randomBytes } from 'node:crypto';
import { businessDate } from '@/platform/format/date';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import { rootLogger } from '@/platform/logging/logger';
import { rateLimited } from '@/platform/ratelimit/ratelimit';
import { resolveScope, type Actor } from '@/platform/rbac/rbac';
import type { Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import { MESSAGE_CHANNELS, MessageDeliveryError } from '@/modules/sys';
import { versionId, type Quote, type QuoteVersion } from '../domain/entities';
import type {
  DeliveryDeadReason,
  MessageQueue,
  MessageQueueItem,
  QuoteDelivery,
} from '../domain/messaging';
import { isQuoteExpired } from '../domain/quoteState';
import type { RecDeps } from '../ports/deps';
import { replaceQuoteLink, tokenHashOf } from './approval';
import { serviceTargetOf, type MessageTarget } from './contact';
import {
  AppError,
  assertWritable,
  auditEntry,
  idemOf,
  notFound,
  parseInput,
  requireWorkingBranch,
  versionConflict,
  z,
  type RequestCtx,
} from './support';

/**
 * "Send the quote link to the customer" (FR-REC-008, FR-CRM-010 consent, PDPL). The link is created for the current
 * sent version (its raw token is never stored, so a send always makes a fresh link and the previous one stops working),
 * the delivery is recorded in the same transaction as the link, and the message goes out AFTER commit through the
 * `MessageGateway`. A delivery the gateway refused stays `pending` in the branch queue and the `messageRetry` cron job
 * sends it again (bounded attempts, backoff); the deterministic delivery id (from the Idempotency-Key) is also the
 * message id, so a repeat can never reach the customer twice. Phone and e-mail are never logged or audited in clear.
 */

export const sendLinkSchema = z.object({
  version: z.number().int().min(1),
  channel: z.enum(MESSAGE_CHANNELS),
});

const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

export interface SendLinkResult {
  id: string;
  channel: 'sms' | 'zalo' | 'email';
  /** masked destination, e.g. "09•• ••• 211" */
  recipient: string;
  status: 'pending' | 'sent' | 'dead';
}

/** Which channels the staff screen may offer (derived from configuration, no provider names). */
export function availableMessageChannels(deps: RecDeps) {
  return deps.sys.messages.availableChannels();
}

const queueOf = (q: MessageQueue | null, companyId: string, branchId: string): MessageQueue =>
  q ?? { id: branchId, companyId, branchId, items: {} };

function withItem(q: MessageQueue, id: string, item: MessageQueueItem | null): MessageQueue {
  const items = { ...q.items };
  if (item) items[id] = item;
  else delete items[id];
  return { ...q, items };
}

function backoffOf(deps: RecDeps, attempts: number): number {
  const d = deps.rec.delivery;
  return Math.min(d.backoffMaxMs, d.backoffBaseMs * 2 ** Math.max(0, attempts - 1));
}

/** The version can still be sent to the customer: current, `sent` and not past its validity. */
function stillOpen(q: Quote, cur: QuoteVersion, today: string): boolean {
  return (
    q.currentN === cur.n &&
    cur.status === 'sent' &&
    !cur.replacedByN &&
    !isQuoteExpired(cur.status, cur.validUntil, today)
  );
}

export async function sendQuoteLink(
  deps: RecDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
): Promise<{ status: number; body: SendLinkResult; replayed: boolean }> {
  const scope = resolveScope(actor, 'quote:update');
  const data = parseInput(sendLinkSchema, input);
  if (!deps.sys.messages.availableChannels().includes(data.channel))
    throw new AppError('message_channel_unavailable', 422);
  const q0 = await deps.quotes.get(scope, id);
  if (!q0) throw notFound();
  // PDPL: consent first, then a usable contact; both before anything is created or sent
  const target = await serviceTargetOf(deps, q0, data.channel);
  const deliveryId = sha256(`${actor.userId}|${id}|${ctx.idempotencyKey}`).slice(0, 32);
  const token = randomBytes(deps.rec.linkTokenBytes).toString('base64url');
  let created = false;

  const done = await runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: 'POST /api/v1/rec/quotes/{id}/send-link',
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ id, ...data }),
    },
    async (tx) => {
      const q = await deps.quotes.getInTx(tx, scope, id);
      if (!q) throw notFound();
      if (q.version !== data.version) throw versionConflict();
      await assertWritable(deps, tx, actor, scope, q.branchId, 'edit_open_order');
      const cur = await deps.versions.getInTx(tx, scope, versionId(id, q.currentN));
      if (!cur) throw notFound();
      const queue = await deps.deliveries.getQueueInTx(tx, scope, q.branchId);
      const now = deps.sys.clock.now();
      if (cur.status !== 'sent') throw new AppError('state_invalid', 409);
      if (isQuoteExpired(cur.status, cur.validUntil, businessDate(now)))
        throw new AppError('quote_expired', 409);
      if (Object.keys(queue?.items ?? {}).length >= deps.rec.delivery.queueMax)
        throw rateLimited(60);
      const { replaced } = await replaceQuoteLink(deps, tx, {
        q,
        cur,
        now,
        by: actor.userId,
        hash: tokenHashOf(token),
      });
      const delivery: QuoteDelivery = {
        id: deliveryId,
        companyId: q.companyId,
        branchId: q.branchId,
        quoteId: q.id,
        n: cur.n,
        customerId: q.customerId,
        channel: data.channel,
        recipientMasked: target.masked,
        status: 'pending',
        attempts: 0,
        maxAttempts: deps.rec.delivery.maxAttempts,
        // the inline attempt below owns it first; the retry job takes over only if that never finishes
        nextAttemptAt: new Date(now.getTime() + deps.rec.delivery.leaseMs),
        createdAt: now,
        createdBy: actor.userId,
        expiresAt: new Date(now.getTime() + 30 * 24 * 3_600_000),
      };
      deps.deliveries.create(tx, delivery);
      deps.deliveries.saveQueue(
        tx,
        withItem(queueOf(queue, q.companyId, q.branchId), deliveryId, {
          nextAttemptAt: delivery.nextAttemptAt,
          attempts: 0,
        }),
      );
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: q.branchId,
          entityType: 'quote',
          entityId: q.id,
          action: 'quote.link_issue',
          after: { n: cur.n, link: tokenHashOf(token).slice(0, 8), replaced, via: data.channel },
        }),
      );
      created = true;
      return {
        status: 202,
        body: { id: deliveryId, channel: data.channel, recipient: target.masked },
      };
    },
  );

  // outside any transaction: the gateway call. A replay never sends (the first call did, or the retry job will).
  if (created && !done.replayed)
    await attempt(deps, actor, scope, ctx, deliveryId, {
      target,
      link: `${deps.sys.config.appBaseUrl}/b/${token}`,
    });
  const d = await deps.deliveries.get(scope, deliveryId);
  const body: SendLinkResult = {
    id: deliveryId,
    channel: data.channel,
    recipient: target.masked,
    status: d?.status ?? 'pending',
  };
  return { status: body.status === 'sent' ? 200 : 202, body, replayed: done.replayed };
}

/** One gateway attempt, then the outcome in its own transaction. Never throws on a delivery failure. */
async function attempt(
  deps: RecDeps,
  actor: Actor,
  scope: Scope,
  ctx: RequestCtx,
  deliveryId: string,
  p: { target: MessageTarget; link: string },
): Promise<void> {
  let ok = false;
  let error = 'delivery_failed';
  try {
    await deps.sys.messages.send({
      id: deliveryId,
      channel: p.target.channel,
      to: p.target.to,
      template: 'quote-link',
      vars: { link: p.link },
    });
    ok = true;
  } catch (e) {
    if (!(e instanceof MessageDeliveryError)) error = 'unexpected';
    rootLogger[error === 'unexpected' ? 'error' : 'warn'](
      { channel: p.target.channel, deliveryId, requestId: ctx.requestId },
      'quote link delivery failed',
    );
  }
  await finish(deps, actor, scope, ctx, deliveryId, ok ? null : error);
}

/** Records the outcome: sent (sentVia, audit), retry later with backoff, or dead after the last attempt. */
async function finish(
  deps: RecDeps,
  actor: Actor,
  scope: Scope,
  ctx: RequestCtx,
  deliveryId: string,
  error: string | null,
): Promise<void> {
  await deps.sys.uow.run(async (tx) => {
    const d = await deps.deliveries.getInTx(tx, scope, deliveryId);
    if (!d || d.status !== 'pending') return;
    const queue = await deps.deliveries.getQueueInTx(tx, scope, d.branchId);
    const cur = await deps.versions.getInTx(tx, scope, versionId(d.quoteId, d.n));
    const now = deps.sys.clock.now();
    const attempts = d.attempts + 1;
    const base = queueOf(queue, d.companyId, d.branchId);
    if (!error) {
      deps.deliveries.update(tx, d.id, { status: 'sent', sentAt: now, attempts });
      deps.deliveries.saveQueue(tx, withItem(base, d.id, null));
      // R10: `sentVia` says how the customer was told, set only once the gateway accepted the message
      if (cur && (!cur.sentVia || cur.sentVia === 'none' || cur.sentVia === 'link'))
        deps.versions.update(tx, cur.id, {
          sentVia: d.channel,
          version: cur.version + 1,
          updatedAt: now,
          updatedBy: actor.userId,
        });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: d.branchId,
          entityType: 'quote',
          entityId: d.quoteId,
          action: 'quote.link_sent',
          after: { n: d.n, channel: d.channel, to: d.recipientMasked, deliveryId: d.id, attempts },
        }),
      );
      return;
    }
    if (attempts >= d.maxAttempts) {
      kill(deps, tx, actor, ctx, d, base, 'attempts_exhausted', { attempts, lastError: error });
      return;
    }
    const nextAttemptAt = new Date(now.getTime() + backoffOf(deps, attempts));
    deps.deliveries.update(tx, d.id, { attempts, lastError: error, nextAttemptAt });
    deps.deliveries.saveQueue(tx, withItem(base, d.id, { nextAttemptAt, attempts }));
  });
}

/** Marks a delivery dead (no more tries), drops it from the queue and audits why. Stages writes only. */
function kill(
  deps: RecDeps,
  tx: Tx,
  actor: Actor,
  ctx: RequestCtx,
  d: QuoteDelivery,
  queue: MessageQueue,
  reason: DeliveryDeadReason,
  patch: Record<string, unknown> = {},
): void {
  deps.deliveries.update(tx, d.id, { status: 'dead', deadReason: reason, ...patch });
  deps.deliveries.saveQueue(tx, withItem(queue, d.id, null));
  deps.sys.audit.record(
    tx,
    auditEntry(deps.sys, actor, ctx, {
      branchId: d.branchId,
      entityType: 'quote',
      entityId: d.quoteId,
      action: 'quote.link_send_failed',
      after: { n: d.n, channel: d.channel, to: d.recipientMasked, deliveryId: d.id, reason },
    }),
  );
}

export interface MessageRetryResult {
  due: number;
  sent: number;
  retryLater: number;
  dead: number;
  skipped: number;
  failed: number;
}

/**
 * The `messageRetry` cron job, for ONE branch (the actor's working branch): sends again the pending quote-link
 * deliveries that are due. Idempotent: a delivery is claimed with a short lease (an overlapping run skips it), the
 * attempts are bounded and a sent or dead delivery is never touched. Reads the branch queue by key, no index.
 */
export async function runMessageRetry(
  deps: RecDeps,
  actor: Actor,
  ctx: RequestCtx,
): Promise<MessageRetryResult> {
  const scope = resolveScope(actor, 'quote:manage');
  const branchId = requireWorkingBranch(actor);
  const queue = await deps.deliveries.getQueue(scope, branchId);
  const now = deps.sys.clock.now();
  const due = Object.entries(queue?.items ?? {})
    .filter(([, i]) => i.nextAttemptAt <= now)
    .sort(([, a], [, b]) => a.nextAttemptAt.getTime() - b.nextAttemptAt.getTime())
    .slice(0, deps.rec.delivery.runBatch);
  const out: MessageRetryResult = {
    due: due.length,
    sent: 0,
    retryLater: 0,
    dead: 0,
    skipped: 0,
    failed: 0,
  };
  for (const [id] of due) {
    try {
      const r = await retryOne(deps, actor, scope, ctx, id);
      if (r === 'sent') out.sent++;
      else if (r === 'retry') out.retryLater++;
      else if (r === 'dead') out.dead++;
      else out.skipped++;
    } catch (err) {
      out.failed++;
      rootLogger.error({ err, deliveryId: id }, 'message retry failed');
    }
  }
  return out;
}

async function retryOne(
  deps: RecDeps,
  actor: Actor,
  scope: Scope,
  ctx: RequestCtx,
  id: string,
): Promise<'sent' | 'retry' | 'dead' | 'skipped'> {
  // 1. claim with a lease: only a pending delivery that is due, and only one run at a time
  const claimed = await deps.sys.uow.run(async (tx) => {
    const d = await deps.deliveries.getInTx(tx, scope, id);
    const queue = await deps.deliveries.getQueueInTx(tx, scope, d?.branchId ?? '');
    const now = deps.sys.clock.now();
    if (!d || !queue) return null;
    if (d.status !== 'pending') {
      deps.deliveries.saveQueue(tx, withItem(queue, id, null));
      return null;
    }
    if (d.nextAttemptAt > now) {
      deps.deliveries.saveQueue(
        tx,
        withItem(queue, id, { nextAttemptAt: d.nextAttemptAt, attempts: d.attempts }),
      );
      return null;
    }
    const lease = new Date(now.getTime() + deps.rec.delivery.leaseMs);
    deps.deliveries.update(tx, id, { nextAttemptAt: lease });
    deps.deliveries.saveQueue(
      tx,
      withItem(queue, id, { nextAttemptAt: lease, attempts: d.attempts }),
    );
    return d;
  });
  if (!claimed) return 'skipped';
  const d = claimed;

  // 2. the reasons to stop: quote no longer open, channel off, consent withdrawn, contact gone
  const dead = (reason: DeliveryDeadReason) =>
    deps.sys.uow.run(async (tx) => {
      const cur = await deps.deliveries.getInTx(tx, scope, id);
      const queue = await deps.deliveries.getQueueInTx(tx, scope, d.branchId);
      if (!cur || cur.status !== 'pending') return;
      kill(deps, tx, actor, ctx, cur, queueOf(queue, d.companyId, d.branchId), reason);
    });
  const q = await deps.quotes.get(scope, d.quoteId);
  const v = q ? await deps.versions.get(scope, versionId(q.id, d.n)) : null;
  if (!q || !v || !stillOpen(q, v, businessDate(deps.sys.clock.now()))) {
    await dead('quote_not_open');
    return 'dead';
  }
  if (!deps.sys.messages.availableChannels().includes(d.channel)) {
    await dead('channel_unavailable');
    return 'dead';
  }
  let target: MessageTarget;
  try {
    target = await serviceTargetOf(deps, q, d.channel);
  } catch (e) {
    if (!(e instanceof AppError)) throw e;
    await dead(e.code === 'message_no_consent' ? 'no_consent' : 'no_contact');
    return 'dead';
  }

  // 3. a fresh link (the raw token of the first one was never stored); the failed one never reached the customer
  const token = randomBytes(deps.rec.linkTokenBytes).toString('base64url');
  await deps.sys.uow.run(async (tx) => {
    const q2 = await deps.quotes.getInTx(tx, scope, d.quoteId);
    const cur = q2 ? await deps.versions.getInTx(tx, scope, versionId(q2.id, d.n)) : null;
    if (!q2 || !cur || !stillOpen(q2, cur, businessDate(deps.sys.clock.now())))
      throw new AppError('state_invalid', 409);
    await replaceQuoteLink(deps, tx, {
      q: q2,
      cur,
      now: deps.sys.clock.now(),
      by: actor.userId,
      hash: tokenHashOf(token),
    });
  });

  // 4. send and record
  await attempt(deps, actor, scope, ctx, id, {
    target,
    link: `${deps.sys.config.appBaseUrl}/b/${token}`,
  });
  const after = await deps.deliveries.get(scope, id);
  return after?.status === 'sent' ? 'sent' : after?.status === 'dead' ? 'dead' : 'retry';
}
