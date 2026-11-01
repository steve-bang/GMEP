import { AppError } from '../errors/errors';

/**
 * Effective-dated configuration (NFR-MNT-01, plan §2.13). Pure rules; persistence is in the SYS
 * module. Dates are business dates `yyyy-MM-dd` (Asia/Ho_Chi_Minh) so they compare as strings.
 */
export type ConfigStatus = 'pending' | 'approved' | 'rejected';

export interface ConfigVersionLike<P = unknown> {
  id: string;
  effectiveFrom: string;
  status: ConfigStatus;
  payload: P;
}

/** The approved version with the greatest effectiveFrom <= date, or null. */
export function pickEffective<T extends ConfigVersionLike>(
  versions: readonly T[],
  date: string,
): T | null {
  let best: T | null = null;
  for (const v of versions) {
    if (v.status !== 'approved' || v.effectiveFrom > date) continue;
    if (!best || v.effectiveFrom > best.effectiveFrom) best = v;
  }
  return best;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Effective date may not be in the past and must be a real calendar date (plan §2.13). */
export function assertEffectiveFrom(effectiveFrom: string, today: string): void {
  const d = new Date(`${effectiveFrom}T00:00:00Z`);
  if (
    !DATE.test(effectiveFrom) ||
    Number.isNaN(d.getTime()) ||
    d.toISOString().slice(0, 10) !== effectiveFrom
  )
    throw new AppError('validation_failed', 422, [
      { field: 'effectiveFrom', message: 'yyyy-MM-dd' },
    ]);
  if (effectiveFrom < today) throw new AppError('config_effective_in_past', 422);
}

/** Snapshot stored on documents (quote, order, invoice) so later config changes never rewrite them. */
export interface ConfigSnapshot<P = unknown> {
  type: string;
  scopeKey: string;
  versionId: string;
  effectiveFrom: string;
  payload: P;
}

/** business date (yyyy-MM-dd) of an instant in Asia/Ho_Chi_Minh (DM-10). */
export function businessDateOf(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(at);
}
