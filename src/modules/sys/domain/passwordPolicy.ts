import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { FieldError } from '@/platform/errors/errors';

/**
 * Password policy (ba-answers-for-dev §1.3). ONLY the two rules in the documents are enforced:
 * minimum length and "not one of the last N" (ADR §6.3, D-03). Anything else (character classes,
 * common-password lists, identity containment) is [Cần xác nhận] and deliberately NOT implemented.
 */
export interface PasswordPolicy {
  minLength: number;
  historyDepth: number;
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = { minLength: 10, historyDepth: 5 };

export interface HashedPassword {
  salt: string;
  hash: string;
}

/** scrypt hash for the history list only; the live credential is stored by the identity provider. */
export function hashForHistory(password: string): HashedPassword {
  const salt = randomBytes(16).toString('hex');
  return { salt, hash: scryptSync(password.normalize('NFC'), salt, 32).toString('hex') };
}

export function matchesHistoryEntry(password: string, entry: HashedPassword): boolean {
  const h = scryptSync(password.normalize('NFC'), entry.salt, 32);
  const e = Buffer.from(entry.hash, 'hex');
  return e.length === h.length && timingSafeEqual(e, h);
}

export type PasswordViolation = 'policy.password.min_length' | 'policy.password.reused';

export function checkPasswordPolicy(
  password: string,
  history: readonly HashedPassword[],
  policy: PasswordPolicy,
): PasswordViolation[] {
  const out: PasswordViolation[] = [];
  if ([...password].length < policy.minLength) out.push('policy.password.min_length');
  if (history.slice(0, policy.historyDepth).some((e) => matchesHistoryEntry(password, e)))
    out.push('policy.password.reused');
  return out;
}

export const violationsToFieldErrors = (
  v: PasswordViolation[],
  field: string,
  msg: (code: PasswordViolation) => string,
): FieldError[] => v.map((code) => ({ field, message: msg(code) }));

/** Opaque single-use token: 256-bit random, only its sha256 is stored. */
export function newOpaqueToken(): { raw: string; id: string } {
  const raw = randomBytes(32).toString('base64url');
  return { raw, id: hashToken(raw) };
}
export const hashToken = (raw: string): string => createHash('sha256').update(raw).digest('hex');
