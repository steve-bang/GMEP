import { createHash, randomInt, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * One-time code on the customer's approval (QUO-04/05, R27). Pure rules, no I/O, unit tested.
 * The levels are config (`quote-approval.otpMode`); the threshold and the numbers are NOT fixed by the client yet
 * [Cần xác nhận: Chủ dự án].
 */
export type OtpMode = 'off' | 'above_threshold' | 'always';
export const OTP_MODES: readonly OtpMode[] = ['off', 'above_threshold', 'always'];

export interface OtpSettings {
  /** code length is fixed at 6 digits */
  ttlMs: number;
  /** wrong tries before the code is locked */
  maxAttempts: number;
  /** a new code cannot be asked for sooner than this */
  resendCooldownMs: number;
  /** soft lock after `maxAttempts` wrong tries: no new code until it has passed (developer proposal) */
  lockMs: number;
  /** wrong tries over all codes of one link before the link is hard locked (staff must send a new link) */
  maxFailedTotal: number;
  /** how long the failure counter is kept past the code expiry (TTL of the record) */
  failureMemoryMs: number;
}

/**
 * Does this approved total need a code? `above_threshold` is strictly above the configured value; a missing threshold
 * (should not happen, config validation requires it) fails closed and asks for the code.
 */
export function otpRequired(mode: OtpMode, thresholdVnd: number | undefined, totalVnd: number) {
  if (mode === 'off') return false;
  if (mode === 'always') return true;
  return thresholdVnd === undefined ? true : totalVnd > thresholdVnd;
}

export const generateOtpCode = (rand: (max: number) => number = (m) => randomInt(0, m)): string =>
  String(rand(1_000_000)).padStart(6, '0');

export const newOtpSalt = (): string => randomBytes(16).toString('hex');

/** Salted hash bound to the link, so a stolen record cannot be replayed on another link. Only this is stored. */
export const hashOtp = (salt: string, linkId: string, code: string): string =>
  createHash('sha256').update(`${salt}:${linkId}:${code}`).digest('hex');

/** Constant-time comparison of two hex digests. */
export function sameDigest(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

/** What the approval needs to remember about the code; one record per link (a new code replaces the old one). */
export interface OtpState {
  /** approved selection the code was issued for: a code for one selection never approves another */
  selectionHash: string;
  n: number;
  salt: string;
  codeHash: string;
  codeExpiresAt: Date;
  attempts: number;
  maxAttempts: number;
  lockedAt?: Date;
  /** wrong tries over every code of this link; survives a new code (missing = 0 on old records) */
  failedTotal?: number;
  /** hard lock: no code and no approval on this link until staff create a new one */
  hardLockedAt?: Date;
  verifiedAt?: Date;
  consumedAt?: Date;
}

export type OtpCheck =
  | { kind: 'ok' }
  /** nothing usable: no code was asked for this selection (or it was already used) */
  | { kind: 'required' }
  | { kind: 'expired' }
  | { kind: 'locked' }
  | { kind: 'hard_locked' }
  | {
      kind: 'invalid';
      attempts: number;
      lock: boolean;
      failedTotal: number;
      /** the total reached `maxFailedTotal`: the link is hard locked */
      hard: boolean;
    };

/**
 * Checks a submitted code against the stored state. It does not change anything: the caller persists `attempts`
 * and the lock in its own transaction (a failed check must survive the request that fails).
 */
export function checkOtp(
  st: OtpState | null,
  now: Date,
  input: { linkId: string; n: number; selectionHash: string; code: string; maxFailedTotal: number },
): OtpCheck {
  if (st?.hardLockedAt) return { kind: 'hard_locked' };
  if (!st || st.n !== input.n || st.selectionHash !== input.selectionHash || st.consumedAt)
    return { kind: 'required' };
  if (st.lockedAt || st.attempts >= st.maxAttempts) return { kind: 'locked' };
  if (st.codeExpiresAt <= now) return { kind: 'expired' };
  if (sameDigest(hashOtp(st.salt, input.linkId, input.code), st.codeHash)) return { kind: 'ok' };
  const attempts = st.attempts + 1;
  const failedTotal = (st.failedTotal ?? 0) + 1;
  const hard = failedTotal >= input.maxFailedTotal;
  return { kind: 'invalid', attempts, lock: hard || attempts >= st.maxAttempts, failedTotal, hard };
}

export type OtpIssueDecision =
  | { kind: 'locked'; hard: boolean }
  /** a code for this very attempt was sent a moment ago and is still valid: nothing new is sent */
  | { kind: 'same' }
  | { kind: 'cooldown'; retryAfterSeconds: number }
  | { kind: 'issue' };

/**
 * Whether a new code may be issued now. Pure; run once before the cheap checks and again inside the write transaction
 * (a concurrent request may have won the race). Hard lock and the soft lock (`lockMs` after `lockedAt`, a value of its
 * own, not the limiter window) come first, then the double-tap rule, then the cooldown of another selection.
 */
export function decideOtpIssue(
  cur: (OtpState & { resendAfter: Date }) | null,
  now: Date,
  input: { n: number; selectionHash: string; lockMs: number },
): OtpIssueDecision {
  if (!cur) return { kind: 'issue' };
  if (cur.hardLockedAt) return { kind: 'locked', hard: true };
  if (cur.lockedAt && now.getTime() < cur.lockedAt.getTime() + input.lockMs)
    return { kind: 'locked', hard: false };
  const same = cur.n === input.n && cur.selectionHash === input.selectionHash && !cur.consumedAt;
  if (same && !cur.lockedAt && cur.codeExpiresAt > now && cur.resendAfter > now)
    return { kind: 'same' };
  if (cur.resendAfter > now)
    return {
      kind: 'cooldown',
      retryAfterSeconds: Math.ceil((cur.resendAfter.getTime() - now.getTime()) / 1000),
    };
  return { kind: 'issue' };
}

/**
 * Firestore TTL of the record: a day after the code expires; while wrong tries are remembered, never earlier than
 * `failureMemoryMs` from now (and never earlier than before), so the counter outlives the code.
 */
export function otpRecordExpiry(p: {
  codeExpiresAt: Date;
  now: Date;
  failedTotal: number;
  previous?: Date;
  failureMemoryMs: number;
}): Date {
  const base = p.codeExpiresAt.getTime() + 24 * 3_600_000;
  if (p.failedTotal <= 0) return new Date(base);
  return new Date(Math.max(base, p.previous?.getTime() ?? 0, p.now.getTime() + p.failureMemoryMs));
}
