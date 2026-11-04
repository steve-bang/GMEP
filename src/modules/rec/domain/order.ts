import type { ApprovedLine, Necessity, PhotoRef } from './entities';
import type { ItemStatus, OrderStatus, PauseReason } from './orderState';

/**
 * Repair order, repair item, part request, QC run and handover (slice 1.6). The order is the SOURCE
 * DOCUMENT of the visit (RULE-007): labor, parts, hours and, later, payment and invoice hang on it. Money is
 * integer VND. The order keeps its own copy of what was approved; the quote stays untouched.
 */

/** FR-REC-032 / R36: the step set of the service type, COPIED to the order when it is created. */
export interface WorkflowStepSnapshot {
  code: string;
  name: string;
  responsibleRole?: string;
  /** R36: expected duration of the step in days (body & paint); the date on the order is set by the advisor */
  expectedDays?: number;
  /** R36: the step counts toward the technician's labor (default false: labor comes from the labor lines) */
  countsTowardLabor?: boolean;
}

export interface OrderHistoryEntry {
  from: OrderStatus | null;
  to: OrderStatus;
  event: string;
  at: Date;
  by: string;
  reason?: string;
}

export interface SupplementRef {
  quoteId: string;
  number: string;
  versionN: number;
  approvedAt: Date;
  /** evidence hash of the supplementary approval */
  hash: string;
  totalVnd: number;
  itemNos: number[];
}

/** FR-REC-014: a technician's proposal for work outside the approved quote. It is NOT an item until a customer approves. */
export interface WorkProposal {
  id: string;
  title: string;
  note?: string;
  proposedBy: string;
  proposedAt: Date;
  status: 'open' | 'quoted' | 'dismissed';
  /** the supplementary quote the advisor made from it */
  quoteId?: string;
  dismissedReason?: string;
}

export interface QcCheckResult {
  code: string;
  name: string;
  ok: boolean;
  note?: string;
}
export interface QcRun {
  n: number;
  at: Date;
  by: string;
  result: 'pass' | 'fail';
  checks: QcCheckResult[];
  /** items sent back to the technician (fail) */
  returnedItemIds: string[];
  note?: string;
  /** checklist config version the run used (FR-REC-016) */
  checklistVersionId?: string;
  /** R47: extra approved work reopened the order after this run, so its result no longer counts; QC must run again */
  invalidatedAt?: Date;
  invalidatedReason?: string;
}

/** FR-REC-017: the record of giving the vehicle back; the customer's confirmation is a name and a time (print signature otherwise). */
export interface Handover {
  at: Date;
  by: string;
  /** who took the vehicle (name only, no phone or address) */
  receiverName: string;
  km?: number;
  /** how the customer confirmed: on screen or on the printed record */
  confirmation: 'screen' | 'paper';
  paperRef?: string;
  note?: string;
  /** belongings returned: free text list */
  belongingsReturned: boolean;
  /** the old parts were shown/returned to the customer */
  oldPartsReturned: boolean;
  printCount: number;
  lastPrintedAt?: Date;
  /** R44: the payment figures read from ACC in the handover transaction, kept for disputes */
  payment?: HandoverPayment;
}

/** R44 item 5: snapshot of the money of the order at the moment the vehicle left. */
export interface HandoverPayment {
  /** false = ACC could not answer and a manager handed the vehicle over on an exception (`exceptionReason`) */
  verified: boolean;
  receivableVnd: number | null;
  receivedVnd: number | null;
  outstandingVnd: number | null;
  /** approved debt that covered the outstanding amount (id and terms) */
  debtId?: string;
  debtAmountVnd?: number;
  debtDueDate?: string;
  exceptionReason?: string;
  /** policy flag `handoverRequiresPayment` was off: no check was made */
  skipped?: boolean;
}

export interface RepairOrder {
  id: string;
  companyId: string;
  branchId: string;
  /** RO-<BRANCH>-<YYMM>-<seq5>, allocated when the order is created (R35) */
  number: string;
  status: OrderStatus;
  /** true while not completed or cancelled (board and retention queries) */
  open: boolean;
  quoteId: string;
  quoteNumber: string;
  quoteVersionN: number;
  /** evidence hash of the approval the order was opened from; the idempotency anchor (R35, R37) */
  evidenceHash: string;
  intakeId: string;
  vehicleId: string;
  customerId: string;
  plate: string;
  plateNorm: string;
  vehicleLabel: string;
  customerName: string;
  advisorId: string;
  serviceType?: string;
  /** step set copied at creation (R36): later config changes do not touch it */
  workflowVersionId?: string;
  steps: WorkflowStepSnapshot[];
  /** odometer reading at intake */
  km?: number;
  promisedDate?: string;
  /** tax-inclusive value of the approved items, base quote only */
  baseTotalVnd: number;
  /** base + approved supplements, tax included */
  totalVnd: number;
  supplements: SupplementRef[];
  /** R47: every supplementary quote made for this order; the open ones are closed when the order closes */
  supplementQuoteIds?: string[];
  /** warehouse the holds are taken from */
  warehouseId: string | null;
  /** number of approved part lines whose hold is short; > 0 = waiting for parts */
  unmetLines: number;
  itemCount: number;
  doneCount: number;
  pausedReason?: string;
  proposals: WorkProposal[];
  photos?: PhotoRef[];
  qcRuns: QcRun[];
  handover?: Handover;
  history: OrderHistoryEntry[];
  startedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

export type TimeEventType = 'start' | 'pause' | 'finish' | 'return' | 'parts_ready' | 'undo';
export interface TimeEvent {
  /** order of events on the item, 1.. */
  n: number;
  type: TimeEventType;
  from: ItemStatus;
  to: ItemStatus;
  at: Date;
  by: string;
  reason?: string;
  /** set when a later `undo` cancelled this event; kept for the record, ignored for hours */
  undone?: boolean;
  /** R41: free text, mandatory when the pause reason is `other` */
  note?: string;
}

export interface AssignmentEntry {
  technicianId: string | null;
  at: Date;
  by: string;
  reason?: string;
}

export interface RepairItem {
  id: string;
  companyId: string;
  branchId: string;
  orderId: string;
  /** shown number on the order, 1.. */
  no: number;
  /** zero padded `no` so the by-order query sorts as text */
  seqKey: string;
  /** from the base quote or a supplementary quote */
  origin: 'base' | 'supplement';
  sourceQuoteId: string;
  sourceItemNo: number;
  name: string;
  necessity: Necessity;
  lines: ApprovedLine[];
  /** before tax */
  subtotalVnd: number;
  status: ItemStatus;
  /** true while the item still needs work (technician list query) */
  active: boolean;
  pauseReason?: PauseReason | string;
  /** part lines of the item whose stock hold is short */
  waitingParts: boolean;
  technicianId: string | null;
  technicianName: string | null;
  assignments: AssignmentEntry[];
  events: TimeEvent[];
  /** worked milliseconds closed so far (open segment excluded) */
  workedMs: number;
  /** labor minutes approved for the item (standard for the customer) */
  approvedMinutes: number;
  /** snapshots for the technician's list: no customer data */
  orderNumber: string;
  plate: string;
  vehicleLabel: string;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

export type PartRequestStatus = 'requested' | 'issued' | 'rejected' | 'cancelled';
export interface PartRequest {
  id: string;
  companyId: string;
  branchId: string;
  orderId: string;
  orderNumber: string;
  itemId: string;
  /** the approved part line this draws on (RULE-005: nothing outside the approved lines) */
  lineKey: string;
  partId: string;
  partCode: string;
  partName: string;
  /** stored quantity, same scale as the quote line */
  qty: number;
  qtyScale: number;
  status: PartRequestStatus;
  requestedBy: string;
  requestedAt: Date;
  /** technician who receives the parts */
  receiverUserId: string;
  note?: string;
  decidedBy?: string;
  decidedAt?: Date;
  rejectReason?: string;
  /** the posted goods issue */
  issueDocumentId?: string;
  issueDocumentNo?: string;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

export const itemId = (orderId: string, no: number): string => `${orderId}__i${no}`;
export const seqKeyOf = (no: number): string => String(no).padStart(4, '0');
export const orderIdOfQuote = (quoteId: string): string => `ro_${quoteId}`;

/** Milliseconds worked: closed start..pause/finish segments of the events not undone. An open segment counts until `until`. */
export function workedMsOf(events: readonly TimeEvent[], until?: Date): number {
  let total = 0;
  let openAt: number | null = null;
  for (const e of events) {
    if (e.undone || e.type === 'undo') continue;
    if (e.type === 'start') openAt = e.at.getTime();
    else if ((e.type === 'pause' || e.type === 'finish') && openAt !== null) {
      total += Math.max(0, e.at.getTime() - openAt);
      openAt = null;
    }
  }
  if (openAt !== null && until) total += Math.max(0, until.getTime() - openAt);
  return total;
}

/** The event an `undo` would cancel: the last one not already undone (and not an undo). */
export function lastUndoable(events: readonly TimeEvent[]): TimeEvent | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!;
    if (e.type === 'undo') continue;
    if (!e.undone) return e;
  }
  return null;
}

export type UndoCheck =
  | { ok: true; event: TimeEvent }
  | { ok: false; reason: 'nothing_to_undo' | 'undo_window_passed' | 'undo_not_yours' };

/** Hoàn tác: only the person who pressed, only within the window (config), only the latest event. */
export function checkUndo(
  events: readonly TimeEvent[],
  now: Date,
  by: string,
  windowMs: number,
): UndoCheck {
  const e = lastUndoable(events);
  if (!e || e.type === 'return') return { ok: false, reason: 'nothing_to_undo' };
  if (e.by !== by) return { ok: false, reason: 'undo_not_yours' };
  if (now.getTime() - e.at.getTime() > windowMs) return { ok: false, reason: 'undo_window_passed' };
  return { ok: true, event: e };
}

export interface ItemSeed {
  sourceItemNo: number;
  name: string;
  necessity: Necessity;
  lines: ApprovedLine[];
  subtotalVnd: number;
  approvedMinutes: number;
}

/** Groups approved lines by quote item: one repair item per approved quote item (the unit of approval). */
export function itemSeedsOf(
  lines: readonly ApprovedLine[],
  necessityOf: (itemNo: number) => Necessity,
): ItemSeed[] {
  const by = new Map<number, ApprovedLine[]>();
  for (const l of lines) by.set(l.itemNo, [...(by.get(l.itemNo) ?? []), l]);
  return [...by.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([itemNo, ls]) => ({
      sourceItemNo: itemNo,
      name: ls[0]!.itemName,
      necessity: necessityOf(itemNo),
      lines: ls,
      subtotalVnd: ls.reduce((s, l) => s + l.amountVnd, 0),
      approvedMinutes: ls.reduce((s, l) => s + (l.kind === 'labor' ? (l.minutes ?? 0) : 0), 0),
    }));
}
