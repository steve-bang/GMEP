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
  verifiedAt?: Date;
  consumedAt?: Date;
}

export type OtpCheck =
  | { kind: 'ok' }
  /** nothing usable: no code was asked for this selection (or it was already used) */
  | { kind: 'required' }
  | { kind: 'expired' }
  | { kind: 'locked' }
  | { kind: 'invalid'; attempts: number; lock: boolean };

/**
 * Checks a submitted code against the stored state. It does not change anything: the caller persists `attempts`
 * and the lock in its own transaction (a failed check must survive the request that fails).
 */
export function checkOtp(
  st: OtpState | null,
  now: Date,
  input: { linkId: string; n: number; selectionHash: string; code: string },
): OtpCheck {
  if (!st || st.n !== input.n || st.selectionHash !== input.selectionHash || st.consumedAt)
    return { kind: 'required' };
  if (st.lockedAt || st.attempts >= st.maxAttempts) return { kind: 'locked' };
  if (st.codeExpiresAt <= now) return { kind: 'expired' };
  if (sameDigest(hashOtp(st.salt, input.linkId, input.code), st.codeHash)) return { kind: 'ok' };
  const attempts = st.attempts + 1;
  return { kind: 'invalid', attempts, lock: attempts >= st.maxAttempts };
}
