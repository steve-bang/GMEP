import type { Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import type { CashDrawer, CashEntry, CashShift, Debt, DayClose } from '../domain/cash';
import type { OrderAccount, Payment } from '../domain/payment';

/**
 * The order as ACC sees it (RULE-007: a payment hangs on a repair order). REC owns the order and supplies the
 * receivable (`totalVnd`: base plus approved supplements, tax included); ACC never recomputes it (R44 item 1).
 */
export interface PayableOrder {
  id: string;
  companyId: string;
  branchId: string;
  number: string;
  /** REC order status code, informational */
  status: string;
  open: boolean;
  cancelled: boolean;
  /** the quality check passed (ready for delivery or completed) */
  qcPassed: boolean;
  totalVnd: number;
  customerId: string;
  /** name only */
  customerName: string;
  plate: string;
}

export interface OrderSource {
  get(scope: Scope, orderId: string): Promise<PayableOrder | null>;
  getInTx(tx: Tx, scope: Scope, orderId: string): Promise<PayableOrder | null>;
  getMany(companyId: string, ids: readonly string[]): Promise<PayableOrder[]>;
  /** open orders of the scope (day close, cash handover list) */
  listOpen(scope: Scope, limit: number): Promise<PayableOrder[]>;
}

/** Every read takes a Scope (NFR-ISO-01). Posted payments have no update method (RULE-010). */
export interface PaymentRepository {
  get(scope: Scope, id: string): Promise<Payment | null>;
  getInTx(tx: Tx, scope: Scope, id: string): Promise<Payment | null>;
  listByOrder(scope: Scope, orderId: string, limit: number): Promise<Payment[]>;
  /** newest first inside [from, to) of the branch */
  listByBranch(
    scope: Scope,
    branchId: string,
    window: { from: Date; to: Date },
    limit: number,
  ): Promise<Payment[]>;
  /** one slot per reversed payment: the id of its reversal; `create` is the uniqueness guard */
  reversalOfInTx(tx: Tx, paymentId: string): Promise<string | null>;
  reversalsOf(paymentIds: readonly string[]): Promise<Map<string, string>>;
  post(tx: Tx, p: Payment): void;
  markReversed(
    tx: Tx,
    paymentId: string,
    v: { reversalId: string; companyId: string; branchId: string; at: Date },
  ): void;
}

export interface OrderAccountRepository {
  get(scope: Scope, orderId: string): Promise<OrderAccount | null>;
  getInTx(tx: Tx, scope: Scope, orderId: string): Promise<OrderAccount | null>;
  getMany(scope: Scope, orderIds: readonly string[]): Promise<OrderAccount[]>;
  save(tx: Tx, a: OrderAccount): void;
}

export interface CashRepository {
  getDrawerInTx(tx: Tx, scope: Scope, branchId: string): Promise<CashDrawer | null>;
  getDrawer(scope: Scope, branchId: string): Promise<CashDrawer | null>;
  saveDrawer(tx: Tx, d: CashDrawer): void;
  appendEntry(tx: Tx, e: CashEntry): void;
  entriesOfDay(scope: Scope, branchId: string, date: string, limit: number): Promise<CashEntry[]>;
  getShift(scope: Scope, id: string): Promise<CashShift | null>;
  getShiftInTx(tx: Tx, scope: Scope, id: string): Promise<CashShift | null>;
  listShifts(
    scope: Scope,
    branchId: string,
    window: { from: Date; to: Date } | null,
    limit: number,
  ): Promise<CashShift[]>;
  createShift(tx: Tx, s: CashShift): void;
  updateShift(tx: Tx, id: string, patch: Record<string, unknown>): void;
  getDayClose(scope: Scope, branchId: string, date: string): Promise<DayClose | null>;
  getDayCloseInTx(tx: Tx, scope: Scope, branchId: string, date: string): Promise<DayClose | null>;
  createDayClose(tx: Tx, d: DayClose): void;
  updateDayClose(tx: Tx, id: string, patch: Record<string, unknown>): void;
}

export interface DebtRepository {
  get(scope: Scope, id: string): Promise<Debt | null>;
  getInTx(tx: Tx, scope: Scope, id: string): Promise<Debt | null>;
  listByStatus(
    scope: Scope,
    branchId: string,
    status: Debt['status'],
    limit: number,
  ): Promise<Debt[]>;
  create(tx: Tx, d: Debt): void;
  update(tx: Tx, id: string, patch: Record<string, unknown>): void;
}
