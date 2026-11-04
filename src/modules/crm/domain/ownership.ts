import { addDays } from './normalize';

/**
 * Effective-dated vehicle ownership (FR-CRM-014, BR-CRM-07, UAT-18). `from` and `to` are calendar
 * dates (yyyy-MM-dd, inclusive); the CURRENT owner is the record with `to === null`. A change closes
 * the open record the day before the new one starts, so history never overlaps and is never edited.
 */
export interface Ownership {
  id: string;
  companyId: string;
  vehicleId: string;
  customerId: string;
  from: string;
  to: string | null;
  /** branch where the change was recorded */
  branchId: string;
  note?: string;
  createdAt: Date;
  createdBy: string;
}

export type OwnerChangeError = 'same_owner' | 'before_current_start' | 'no_current_owner';

export interface OwnerChangePlan {
  closeId: string;
  /** last day of the previous owner */
  closeTo: string;
  openFrom: string;
}

export function planOwnerChange(
  history: readonly Ownership[],
  change: { newCustomerId: string; effectiveDate: string },
): { ok: true; plan: OwnerChangePlan } | { ok: false; error: OwnerChangeError } {
  const current = history.find((o) => o.to === null);
  if (!current) return { ok: false, error: 'no_current_owner' };
  if (current.customerId === change.newCustomerId) return { ok: false, error: 'same_owner' };
  // the previous owner must keep at least one day
  if (change.effectiveDate <= current.from) return { ok: false, error: 'before_current_start' };
  return {
    ok: true,
    plan: {
      closeId: current.id,
      closeTo: addDays(change.effectiveDate, -1),
      openFrom: change.effectiveDate,
    },
  };
}

/** Owner on a given date (history stays correct after an owner change, UAT-18). */
export function ownerOn(history: readonly Ownership[], date: string): Ownership | null {
  return history.find((o) => o.from <= date && (o.to === null || date <= o.to)) ?? null;
}

export const currentOwnership = (history: readonly Ownership[]): Ownership | null =>
  history.find((o) => o.to === null) ?? null;
