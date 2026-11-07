/**
 * Cash book, shifts and day close (FR-ACC-003, FR-ACC-004, BR-ACC-04/05). Pure rules, no I/O.
 * The cash book is append-only: a mistake is a reversal entry, a count difference is a `variance` entry (RULE-010).
 */

export type CashEntryKind = 'receipt' | 'expense' | 'reversal' | 'variance';

export interface CashEntry {
  id: string;
  tenantId: string;
  branchId: string;
  businessDate: string;
  /** position in the branch's drawer, 1.. */
  seq: number;
  /** zero padded `seq` so the day query sorts as text */
  seqKey: string;
  shiftId: string;
  kind: CashEntryKind;
  direction: 'in' | 'out';
  amountVnd: number;
  balanceAfterVnd: number;
  paymentId: string | null;
  documentNumber: string | null;
  description: string;
  createdAt: Date;
  createdBy: string;
}

/** One document per branch: the book balance and the shift on the counter. Contention point of cash writes. */
export interface CashDrawer {
  id: string;
  tenantId: string;
  branchId: string;
  balanceVnd: number;
  seq: number;
  openShiftId: string | null;
  /** R64: business date on which the manager was last told about stale "thiếu chứng từ" flags (one notice per day) */
  sourceFlagNoticeDate?: string;
  updatedAt: Date;
}

export const emptyDrawer = (tenantId: string, branchId: string): CashDrawer => ({
  id: branchId,
  tenantId,
  branchId,
  balanceVnd: 0,
  seq: 0,
  openShiftId: null,
  updatedAt: new Date(0),
});

export const seqKeyOf = (seq: number): string => String(seq).padStart(9, '0');
export const cashEntryId = (branchId: string, seq: number): string =>
  `${branchId}__${seqKeyOf(seq)}`;
export const signedAmount = (e: Pick<CashEntry, 'direction' | 'amountVnd'>): number =>
  e.direction === 'in' ? e.amountVnd : -e.amountVnd;

export type VarianceStatus = 'none' | 'explained' | 'pending_approval' | 'approved' | 'rejected';

export const VARIANCE_CAUSES = [
  'change_short',
  'wrong_amount',
  'expense_unrecorded',
  'unknown',
] as const;
export type VarianceCause = (typeof VARIANCE_CAUSES)[number];

export interface CashShift {
  id: string;
  tenantId: string;
  branchId: string;
  businessDate: string;
  status: 'open' | 'closed';
  openedBy: string;
  openedByName: string;
  openedAt: Date;
  /** book balance when the shift opened */
  openingVnd: number;
  closedBy?: string;
  closedByName?: string;
  closedAt?: Date;
  countedVnd?: number;
  bookVnd?: number;
  /** counted minus book */
  varianceVnd?: number;
  causeCode?: VarianceCause;
  explanation?: string;
  varianceStatus: VarianceStatus;
  varianceApprovalId?: string;
  cashInVnd?: number;
  cashOutVnd?: number;
  /** R58: sum of the expense vouchers the requester decided alone in this shift (running cap of the self tier) */
  selfApprovedExpenseVnd?: number;
  /** orders still open when the shift closed, handed to the next shift */
  openOrders?: number;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

export interface VarianceCheck {
  varianceVnd: number;
  needsExplanation: boolean;
  needsApproval: boolean;
}

/** Counted minus book. Any difference needs a cause and an explanation; above the tolerance it also needs approval. */
export function checkVariance(
  bookVnd: number,
  countedVnd: number,
  toleranceVnd: number,
): VarianceCheck {
  const v = countedVnd - bookVnd;
  return {
    varianceVnd: v,
    needsExplanation: v !== 0,
    needsApproval: Math.abs(v) > toleranceVnd,
  };
}

export interface DayClose {
  id: string;
  tenantId: string;
  branchId: string;
  businessDate: string;
  /** `reopened` = the owner reopened it (FR-ACC-005); it reads as an open day until it is closed again */
  status: 'closed' | 'reopened';
  /** R106: how many times this day was reopened (the monthly count above the limit is an exception) */
  reopenCount?: number;
  reopenedAt?: Date;
  reopenedBy?: string;
  reopenApprovalId?: string;
  closedBy: string;
  closedByName: string;
  closedAt: Date;
  closingBalanceVnd: number | null;
  cashInVnd: number;
  cashOutVnd: number;
  shiftIds: string[];
  note?: string;
  warnings: Record<string, number>;
}

export const dayCloseId = (branchId: string, date: string): string => `${branchId}__${date}`;

export type DayBlocker = 'shift_open' | 'variance_pending' | 'variance_rejected';

export interface DayBlock {
  code: DayBlocker;
  shiftId: string;
}

/** FR-ACC-004: the day cannot close while a shift is open or a count difference is unexplained / unapproved. */
export function dayCloseBlockers(shifts: readonly CashShift[]): DayBlock[] {
  const out: DayBlock[] = [];
  for (const s of shifts) {
    if (s.status === 'open') out.push({ code: 'shift_open', shiftId: s.id });
    else if (s.varianceStatus === 'pending_approval')
      out.push({ code: 'variance_pending', shiftId: s.id });
    else if (s.varianceStatus === 'rejected')
      out.push({ code: 'variance_rejected', shiftId: s.id });
  }
  return out;
}

/** Day of the instant a shift or entry belongs to: the window of a business date in Asia/Ho_Chi_Minh (UTC+7). */
export const dayWindow = (date: string): { from: Date; to: Date } => ({
  from: new Date(`${date}T00:00:00+07:00`),
  to: new Date(new Date(`${date}T00:00:00+07:00`).getTime() + 86_400_000),
});

export interface AgingBuckets {
  notDue: number;
  d1_30: number;
  d31_60: number;
  over60: number;
}
export type AgingKey = keyof AgingBuckets;

/** Age of a debt past its due date (FR-ACC-006 tuổi nợ); the cut-offs are configuration. */
export function agingKey(
  dueDate: string,
  today: string,
  cuts: readonly [number, number] = [30, 60],
): AgingKey {
  const days = Math.floor(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`)) / 86_400_000,
  );
  if (days <= 0) return 'notDue';
  if (days <= cuts[0]) return 'd1_30';
  if (days <= cuts[1]) return 'd31_60';
  return 'over60';
}

export interface Debt {
  id: string;
  tenantId: string;
  branchId: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  amountVnd: number;
  dueDate: string;
  reason: string;
  status: 'open' | 'settled' | 'void';
  approvalId: string;
  approvedBy: string;
  approvedAt: Date;
  settledAt?: Date;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}
