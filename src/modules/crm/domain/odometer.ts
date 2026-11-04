/**
 * ONE odometer rule for the whole system (R9, C5, C18, FR-CRM-002, FR-REC-003). CRM owns it; REC's
 * intake and CRM's vehicle edit both call it so there is a single threshold and a single meaning of
 * "Số km bất thường". A reading below the last known one is a warning, not a block: the user must
 * give a reason ('other' needs a note of at least 5 characters).
 */
export type OdometerReason = 'typo' | 'odometer_replaced' | 'other';

export type OdometerCheck =
  | { ok: true; below: boolean; abnormal: boolean }
  | { ok: false; field: 'kmReason' | 'kmNote'; code: 'reason_required' | 'note_required' };

export function checkOdometer(p: {
  km: number;
  lastKm: number | null;
  reason?: OdometerReason | undefined;
  note?: string | undefined;
  /** drop (km) above which the manager is flagged; the single configured threshold (`abnormalKmDrop`) */
  abnormalDrop: number;
}): OdometerCheck {
  const below = p.lastKm !== null && p.km < p.lastKm;
  if (!below) return { ok: true, below: false, abnormal: false };
  if (!p.reason) return { ok: false, field: 'kmReason', code: 'reason_required' };
  if (p.reason === 'other' && (p.note ?? '').trim().length < 5)
    return { ok: false, field: 'kmNote', code: 'note_required' };
  // a replaced odometer explains a drop by itself; it is not reported as abnormal
  const abnormal = p.reason !== 'odometer_replaced' && p.lastKm! - p.km > p.abnormalDrop;
  return { ok: true, below: true, abnormal };
}
