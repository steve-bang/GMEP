import type { KmReason } from './entities';

/**
 * FR-REC-003 with the CRM rules of C5 (FR-CRM-002): a reading below the last known one is a warning,
 * not a block; the advisor must give a reason ('other' needs a note of at least 5 characters).
 */
export type KmCheck =
  | { ok: true; below: boolean; abnormal: boolean }
  | { ok: false; field: 'kmReason' | 'kmNote'; code: 'reason_required' | 'note_required' };

export function checkKm(p: {
  km: number;
  lastKm: number | null;
  reason?: KmReason | undefined;
  note?: string | undefined;
  /** drop (km) above which the manager is flagged (FR-REC-003 note, configurable) */
  abnormalDrop: number;
}): KmCheck {
  const below = p.lastKm !== null && p.km < p.lastKm;
  if (!below) return { ok: true, below: false, abnormal: false };
  if (!p.reason) return { ok: false, field: 'kmReason', code: 'reason_required' };
  if (p.reason === 'other' && (p.note ?? '').trim().length < 5)
    return { ok: false, field: 'kmNote', code: 'note_required' };
  // a replaced odometer explains a drop by itself; it is not reported as abnormal
  const abnormal = p.reason !== 'odometer_replaced' && p.lastKm! - p.km > p.abnormalDrop;
  return { ok: true, below: true, abnormal };
}
