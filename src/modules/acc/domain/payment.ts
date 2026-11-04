/**
 * Payments of the garage (slice 1.7): receipts, deposits, expense vouchers and their reversals. Pure functions
 * and entities, no I/O. Money is integer VND (RULE-010: Number is safe up to 2^53 and every amount is checked to be
 * a safe integer). A posted payment is NEVER updated: a mistake is corrected by a reversal entry that points at it.
 * The per-order account (`OrderAccount`) is a derived aggregate kept in the same transaction as the payment; the
 * payments themselves stay the truth and `recomputeAccount` rebuilds the aggregate from them for reconciliation.
 */

export const PAYMENT_METHODS = ['cash', 'transfer', 'card', 'qr'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const isCash = (m: PaymentMethod): boolean => m === 'cash';

export type PaymentKind = 'receipt' | 'deposit' | 'expense' | 'reversal';
export type PaymentDirection = 'in' | 'out';

export interface PaymentLine {
  method: PaymentMethod;
  amountVnd: number;
  /** bank / POS / QR transaction reference, recorded by hand (no gateway exists) */
  reference?: string;
}

/** A receipt that settles part of an order with money already held as a deposit (FR-ACC-002). */
export interface DepositApplication {
  depositId: string;
  depositNumber: string;
  amountVnd: number;
}

/** Posted, immutable (RULE-010). */
export interface Payment {
  id: string;
  companyId: string;
  branchId: string;
  /** PT- (receipt, deposit, their reversals) or PC- (expense and its reversal), set when posted */
  number: string;
  kind: PaymentKind;
  direction: PaymentDirection;
  /** the source document (RULE-007); an expense may have none */
  orderId: string | null;
  orderNumber: string | null;
  customerId: string | null;
  /** name only, never phone or address */
  customerName: string | null;
  lines: PaymentLine[];
  /** sum of the lines (money that moved) */
  totalVnd: number;
  /** receipt: deposits used to settle the order */
  applications: DepositApplication[];
  applicationVnd: number;
  cashTenderedVnd?: number;
  changeVnd?: number;
  note?: string;
  // expense voucher
  categoryCode?: string;
  payee?: string;
  description?: string;
  /** reference of the source document of an expense (invoice number, request); absent = listed at day close */
  sourceRef?: string;
  sourceMissing?: boolean;
  /** R64: why a flagged voucher has no source document */
  sourceMissingReason?: string;
  /** an expense that refunds a customer deposit */
  depositId?: string;
  /** an expense that gives back money received for an order (FR-ACC-016, RULE-010: a new entry, receipts untouched) */
  customerRefund?: boolean;
  // reversal
  reversesId?: string;
  reversesNumber?: string;
  reversesKind?: PaymentKind;
  reason?: string;
  approvalId?: string;
  shiftId: string | null;
  businessDate: string;
  createdAt: Date;
  createdBy: string;
  createdByName: string;
}

export interface DepositEntry {
  id: string;
  number: string;
  totalVnd: number;
  appliedVnd: number;
  refundedVnd: number;
  reversed: boolean;
}
export const depositHeld = (d: DepositEntry): number =>
  d.reversed ? 0 : d.totalVnd - d.appliedVnd - d.refundedVnd;

export interface DebtSnapshot {
  id: string;
  amountVnd: number;
  dueDate: string;
  reason: string;
  approvalId: string;
  approvedBy: string;
  approvedAt: Date;
  status: 'open' | 'settled';
}

/** Aggregate per repair order, updated with every payment in the same transaction (the contention point). */
export interface OrderAccount {
  id: string;
  companyId: string;
  branchId: string;
  orderId: string;
  orderNumber: string;
  /** net money received by receipts (receipts minus reversed receipts), deposits excluded */
  receivedVnd: number;
  /** deposits applied to the order (counted as received) */
  depositAppliedVnd: number;
  /** deposits held and not yet applied or refunded */
  depositHeldVnd: number;
  deposits: DepositEntry[];
  debt: DebtSnapshot | null;
  seq: number;
  updatedAt: Date;
}

export function emptyAccount(o: {
  companyId: string;
  branchId: string;
  orderId: string;
  orderNumber: string;
}): OrderAccount {
  return {
    id: o.orderId,
    ...o,
    receivedVnd: 0,
    depositAppliedVnd: 0,
    depositHeldVnd: 0,
    deposits: [],
    debt: null,
    seq: 0,
    updatedAt: new Date(0),
  };
}

export interface OrderBalance {
  receivableVnd: number;
  /** receipts net of reversals + deposits applied (FR-ACC-001, R44) */
  receivedVnd: number;
  depositHeldVnd: number;
  /** what the customer still owes; never negative */
  outstandingVnd: number;
  /** received above the receivable (a reversal of a supplement, say); 0 in normal use */
  overpaidVnd: number;
  debt: DebtSnapshot | null;
}

export function balanceOf(receivableVnd: number, a: OrderAccount): OrderBalance {
  const received = a.receivedVnd + a.depositAppliedVnd;
  return {
    receivableVnd,
    receivedVnd: received,
    depositHeldVnd: a.depositHeldVnd,
    outstandingVnd: Math.max(0, receivableVnd - received),
    overpaidVnd: Math.max(0, received - receivableVnd),
    debt: a.debt && a.debt.status === 'open' ? a.debt : null,
  };
}

/** The approved debt covers what is outstanding (R44 item 3/4). Zero outstanding needs no debt. */
export const debtCovers = (b: OrderBalance): boolean =>
  b.outstandingVnd === 0 || (b.debt !== null && b.debt.amountVnd >= b.outstandingVnd);

export interface AccPolicy {
  methods: PaymentMethod[];
  nonCashReferenceRequired: boolean;
  receiptRequiresQc: boolean;
  /** a cash count within this many VND of the book needs an explanation but no approval */
  varianceToleranceVnd: number;
  /** longest term of an approved debt, in days */
  debtMaxDays: number;
  /** R64: a "thiếu chứng từ" flag still open after this many days is reported to the branch manager and the owner */
  sourceFlagNoticeDays: number;
}

/** Fallback when no `acc-policy` version is in force [Đề xuất dev - chờ xác nhận: Kế toán khách]. */
export const DEFAULT_ACC_POLICY: AccPolicy = {
  methods: ['cash', 'transfer', 'card', 'qr'],
  nonCashReferenceRequired: true,
  receiptRequiresQc: true,
  varianceToleranceVnd: 0,
  debtMaxDays: 60,
  sourceFlagNoticeDays: 3,
};

export const MAX_LINES = 6;

export interface LineError {
  field: string;
  message: string;
}

/** Checks the money lines of a receipt, deposit or expense. */
export function validateLines(
  lines: readonly PaymentLine[],
  policy: Pick<AccPolicy, 'methods' | 'nonCashReferenceRequired'>,
  opts: { allowEmpty?: boolean } = {},
): LineError[] {
  const errors: LineError[] = [];
  if (lines.length === 0 && !opts.allowEmpty)
    errors.push({ field: 'lines', message: 'Nhập ít nhất một hình thức thanh toán.' });
  if (lines.length > MAX_LINES)
    errors.push({ field: 'lines', message: `Tối đa ${MAX_LINES} hình thức trong một phiếu.` });
  lines.forEach((l, i) => {
    if (!Number.isSafeInteger(l.amountVnd) || l.amountVnd <= 0)
      errors.push({ field: `lines.${i}.amountVnd`, message: 'Số tiền phải là số nguyên dương.' });
    if (!policy.methods.includes(l.method))
      errors.push({ field: `lines.${i}.method`, message: 'Hình thức này chưa được bật.' });
    if (!isCash(l.method) && policy.nonCashReferenceRequired && !(l.reference ?? '').trim())
      errors.push({ field: `lines.${i}.reference`, message: 'Nhập mã giao dịch.' });
  });
  return errors;
}

export const sumLines = (lines: readonly PaymentLine[]): number =>
  lines.reduce((s, l) => s + l.amountVnd, 0);
export const cashOf = (lines: readonly PaymentLine[]): number =>
  lines.filter((l) => isCash(l.method)).reduce((s, l) => s + l.amountVnd, 0);

/** Applies held deposits, oldest first, up to `maxVnd`. Pure: returns the plan, changes nothing. */
export function planDepositApplication(
  deposits: readonly DepositEntry[],
  maxVnd: number,
): DepositApplication[] {
  const out: DepositApplication[] = [];
  let left = Math.max(0, maxVnd);
  for (const d of deposits) {
    if (left <= 0) break;
    const take = Math.min(depositHeld(d), left);
    if (take > 0) {
      out.push({ depositId: d.id, depositNumber: d.number, amountVnd: take });
      left -= take;
    }
  }
  return out;
}

const touch = (a: OrderAccount, at: Date): OrderAccount => ({
  ...a,
  seq: a.seq + 1,
  updatedAt: at,
});

/** Account after a posted receipt (money lines + deposits applied). */
export function applyReceipt(
  a: OrderAccount,
  p: Pick<Payment, 'totalVnd' | 'applications'>,
  at: Date,
): OrderAccount {
  const applied = p.applications.reduce((s, x) => s + x.amountVnd, 0);
  const by = new Map(p.applications.map((x) => [x.depositId, x.amountVnd]));
  return touch(
    {
      ...a,
      receivedVnd: a.receivedVnd + p.totalVnd,
      depositAppliedVnd: a.depositAppliedVnd + applied,
      depositHeldVnd: a.depositHeldVnd - applied,
      deposits: a.deposits.map((d) =>
        by.has(d.id) ? { ...d, appliedVnd: d.appliedVnd + by.get(d.id)! } : d,
      ),
    },
    at,
  );
}

export function applyDeposit(
  a: OrderAccount,
  d: { id: string; number: string; totalVnd: number },
  at: Date,
): OrderAccount {
  return touch(
    {
      ...a,
      depositHeldVnd: a.depositHeldVnd + d.totalVnd,
      deposits: [
        ...a.deposits,
        {
          id: d.id,
          number: d.number,
          totalVnd: d.totalVnd,
          appliedVnd: 0,
          refundedVnd: 0,
          reversed: false,
        },
      ],
    },
    at,
  );
}

/** A deposit refund (expense that points at a deposit): the refunded amount leaves the held part. */
export function applyRefund(
  a: OrderAccount,
  depositId: string,
  amountVnd: number,
  at: Date,
): OrderAccount {
  return touch(
    {
      ...a,
      depositHeldVnd: a.depositHeldVnd - amountVnd,
      deposits: a.deposits.map((d) =>
        d.id === depositId ? { ...d, refundedVnd: d.refundedVnd + amountVnd } : d,
      ),
    },
    at,
  );
}

export type ReverseCheck = { ok: true } | { ok: false; reason: string };

/** Whether a posted payment can be reversed given the order account (RULE-010). */
export function canReverse(
  p: Pick<Payment, 'kind' | 'depositId' | 'id'>,
  a: OrderAccount | null,
  alreadyReversed: boolean,
): ReverseCheck {
  if (p.kind === 'reversal') return { ok: false, reason: 'reversal_of_reversal' };
  if (alreadyReversed) return { ok: false, reason: 'payment_already_reversed' };
  if (p.kind === 'deposit') {
    const d = a?.deposits.find((x) => x.id === p.id);
    // a deposit that was used or refunded is reversed only after those are reversed
    if (!d || d.appliedVnd > 0 || d.refundedVnd > 0) return { ok: false, reason: 'deposit_in_use' };
  }
  return { ok: true };
}

/** Account after the reversal of `p` (the reversal entry itself is a separate Payment). */
export function applyReversal(
  a: OrderAccount,
  p: Pick<Payment, 'kind' | 'id' | 'totalVnd' | 'applications' | 'depositId' | 'customerRefund'>,
  at: Date,
): OrderAccount {
  if (p.kind === 'receipt') {
    const applied = p.applications.reduce((s, x) => s + x.amountVnd, 0);
    const by = new Map(p.applications.map((x) => [x.depositId, x.amountVnd]));
    return touch(
      {
        ...a,
        receivedVnd: a.receivedVnd - p.totalVnd,
        depositAppliedVnd: a.depositAppliedVnd - applied,
        depositHeldVnd: a.depositHeldVnd + applied,
        deposits: a.deposits.map((d) =>
          by.has(d.id) ? { ...d, appliedVnd: d.appliedVnd - by.get(d.id)! } : d,
        ),
      },
      at,
    );
  }
  if (p.kind === 'deposit')
    return touch(
      {
        ...a,
        depositHeldVnd: a.depositHeldVnd - p.totalVnd,
        deposits: a.deposits.map((d) => (d.id === p.id ? { ...d, reversed: true } : d)),
      },
      at,
    );
  if (p.kind === 'expense' && p.customerRefund)
    return touch({ ...a, receivedVnd: a.receivedVnd + p.totalVnd }, at);
  if (p.kind === 'expense' && p.depositId)
    return touch(
      {
        ...a,
        depositHeldVnd: a.depositHeldVnd + p.totalVnd,
        deposits: a.deposits.map((d) =>
          d.id === p.depositId ? { ...d, refundedVnd: d.refundedVnd - p.totalVnd } : d,
        ),
      },
      at,
    );
  return touch(a, at);
}

/**
 * Rebuilds the aggregate from the posted payments of one order (reconciliation, FR-ACC-001 "tổng các lần thu và
 * số còn nợ luôn khớp"). `reversedIds` are the payments that have a reversal entry.
 */
export function recomputeAccount(
  base: Pick<OrderAccount, 'companyId' | 'branchId' | 'orderId' | 'orderNumber'>,
  payments: readonly Payment[],
  reversedIds: ReadonlySet<string>,
): Pick<OrderAccount, 'receivedVnd' | 'depositAppliedVnd' | 'depositHeldVnd'> {
  let received = 0;
  let applied = 0;
  let held = 0;
  for (const p of payments) {
    if (p.kind === 'reversal' || reversedIds.has(p.id)) continue;
    if (p.kind === 'receipt') {
      received += p.totalVnd;
      applied += p.applicationVnd;
    } else if (p.kind === 'deposit') held += p.totalVnd;
    else if (p.kind === 'expense' && p.customerRefund) received -= p.totalVnd;
    else if (p.kind === 'expense' && p.depositId) held -= p.totalVnd;
  }
  return { receivedVnd: received, depositAppliedVnd: applied, depositHeldVnd: held - applied };
}

/** Reversal entry for `p`: same lines, opposite direction. */
export const oppositeOf = (d: PaymentDirection): PaymentDirection => (d === 'in' ? 'out' : 'in');

/** Account after a customer refund: the net money received goes down by the refunded amount (FR-ACC-016). */
export function applyCustomerRefund(a: OrderAccount, amountVnd: number, at: Date): OrderAccount {
  return touch({ ...a, receivedVnd: a.receivedVnd - amountVnd }, at);
}

/**
 * R105: the methods the order's money actually came in by (net receipts; reversed receipts and reversals do not count).
 * A refund by any other method is a way to move money out through the refund route and needs the owner.
 */
export function receiptMethodsOf(
  payments: readonly Payment[],
  reversedIds: ReadonlySet<string>,
): Set<PaymentMethod> {
  const out = new Set<PaymentMethod>();
  for (const p of payments)
    if (p.kind === 'receipt' && !reversedIds.has(p.id)) for (const l of p.lines) out.add(l.method);
  return out;
}

/**
 * How much of an order's money may go back to the customer (FR-ACC-016, BR-ACC-11) [Đề xuất dev - chờ xác nhận:
 * Kế toán khách]. Only money received by receipts can be refunded (held deposits have their own refund). A live order
 * can refund what exceeds the receivable (a removed supplement, an over-collection); a cancelled order can refund all
 * net receipts. Never negative.
 * R105 one ceiling for both refunds: this counts receipts only, net of customer refunds already paid (`receivedVnd`
 * falls with each); a deposit refund moves the deposit out of `depositHeldVnd` and is not in this pool, so the two
 * routes can never give back the same money twice. A cancelled order whose deposit was refunded has nothing else to refund.
 */
export function refundableVnd(receivableVnd: number, a: OrderAccount, cancelled: boolean): number {
  if (cancelled) return Math.max(0, a.receivedVnd);
  const over = balanceOf(receivableVnd, a).overpaidVnd;
  return Math.max(0, Math.min(a.receivedVnd, over));
}
