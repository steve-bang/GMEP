import { randomInt } from 'node:crypto';

/**
 * Tenant code (owner decision 07/11/2026): the "Mã công ty" typed at the employee-code sign-in (P2-C). Exactly six
 * decimal digits, kept as a string so leading zeros survive ('048213'), unique across the platform. It is NOT the tenant
 * id: it is drawn from a cryptographic random source, so it cannot be derived from the tenant id or from the order of
 * creation, and a platform role can reissue it when it leaks (the tenant id, and with it every key built on it, never
 * changes). Uniqueness is held by the create-only lock document `tenantCodes/<code>`.
 *
 * Excluded because they are the first ones anybody tries (rule kept deliberately simple, about 1,100 of 1,000,000):
 *  - six identical digits (000000, 111111, ... 999999);
 *  - a run of consecutive digits, ascending or descending, without wrap-around (012345, 123456, ... 987654, 543210);
 *  - a block of two or three digits repeated (121212, 909090, 123123, 007007).
 */
export const TENANT_CODE_PATTERN = /^\d{6}$/;

/** At most this many draws per assignment before giving up with `tenant_code_unavailable` (503). */
export const TENANT_CODE_MAX_ATTEMPTS = 12;

export function isGuessableTenantCode(code: string): boolean {
  if (!TENANT_CODE_PATTERN.test(code)) return true;
  const d = [...code].map(Number);
  const steps = d.slice(1).map((x, i) => x - d[i]!);
  if (steps.every((s) => s === 0)) return true;
  if (steps.every((s) => s === 1) || steps.every((s) => s === -1)) return true;
  if (code === code.slice(0, 2).repeat(3) || code === code.slice(0, 3).repeat(2)) return true;
  return false;
}

/** One draw from the cryptographic random source, retried until the code is not a guessable one. */
export function randomTenantCode(draw: (maxExclusive: number) => number = randomInt): string {
  for (;;) {
    const code = String(draw(1_000_000)).padStart(6, '0');
    if (!isGuessableTenantCode(code)) return code;
  }
}

/**
 * What the sign-in form sent, normalised: white space removed ("048 213" -> "048213"). Anything that is not then exactly
 * six digits returns null; the caller still walks the neutral path with a decoy (UAT-TEN-21 a), it never answers early.
 */
export function normalizeTenantCodeInput(raw: string): string | null {
  const s = raw.replace(/\s+/g, '');
  return TENANT_CODE_PATTERN.test(s) ? s : null;
}

/**
 * Lock document `tenantCodes/<code>`: `active` = the current code of `tenantId`; `retired` = a reissued code kept out of
 * circulation until `releaseAfter` (never handed to another tenant right away), after which a new draw may take it over.
 */
export interface TenantCodeSlot {
  code: string;
  tenantId: string;
  state: 'active' | 'retired';
  assignedAt: Date;
  retiredAt?: Date;
  releaseAfter?: Date;
}

/** A slot that a new assignment may take: none at all, or a retired one whose holding period is over. */
export const tenantCodeSlotFree = (slot: TenantCodeSlot | null, now: Date): boolean =>
  slot === null ||
  (slot.state === 'retired' && !!slot.releaseAfter && slot.releaseAfter.getTime() <= now.getTime());

/**
 * Draws codes until `isFree` accepts one, at most {@link TENANT_CODE_MAX_ATTEMPTS} times. Returns null when every draw
 * hit a taken code (the caller answers with a clear error). The lock document still guards the race at commit.
 */
export async function pickTenantCode(
  source: () => string,
  isFree: (code: string) => Promise<boolean>,
  maxAttempts = TENANT_CODE_MAX_ATTEMPTS,
): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = source();
    if (!TENANT_CODE_PATTERN.test(code) || isGuessableTenantCode(code)) continue;
    if (await isFree(code)) return code;
  }
  return null;
}
