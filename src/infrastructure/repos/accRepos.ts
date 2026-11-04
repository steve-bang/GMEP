import { scopeAllows, type Scope } from '@/platform/scope/scope';
import type { DocData, DocStore, StoredDoc } from '@/platform/store/docStore';
import type { Tx } from '@/platform/tx/unitOfWork';
import type {
  CashDrawer,
  CashEntry,
  CashRepository,
  CashShift,
  DayClose,
  Debt,
  DebtRepository,
  OrderAccount,
  OrderAccountRepository,
  Payment,
  PaymentRepository,
} from '@/modules/acc';
import { dayCloseId } from '@/modules/acc';
import { COL, Q } from './queries';

const without = <T extends object>(o: T, ...keys: (keyof T)[]) => {
  const c = { ...o } as Record<string, unknown>;
  for (const k of keys) delete c[k as string];
  return c as DocData;
};
const inScope = (scope: Scope, x: { companyId: string; branchId: string }) =>
  scopeAllows(scope, x.companyId, x.branchId);
const asEntity = <T>({ id, data }: StoredDoc): T => ({ id, ...data }) as T;

// ---- payments (immutable once posted: there is no update method) ------------------------------------

export class DocPaymentRepository implements PaymentRepository {
  constructor(private readonly store: DocStore) {}
  async get(scope: Scope, id: string) {
    const d = await this.store.get(COL.payments, id);
    const x = d ? asEntity<Payment>(d) : null;
    return x && inScope(scope, x) ? x : null;
  }
  async getInTx(tx: Tx, scope: Scope, id: string) {
    const d = await this.store.getInTx(tx, COL.payments, id);
    const x = d ? asEntity<Payment>(d) : null;
    return x && inScope(scope, x) ? x : null;
  }
  async listByOrder(scope: Scope, orderId: string, limit: number) {
    const rows = await this.store.query(Q.paymentsByOrder.pick([], false), {
      eq: { companyId: scope.companyId, orderId },
      limit,
    });
    return rows.map((r) => asEntity<Payment>(r)).filter((x) => inScope(scope, x));
  }
  async listByBranch(
    scope: Scope,
    branchId: string,
    window: { from: Date; to: Date },
    limit: number,
  ) {
    if (!scopeAllows(scope, scope.companyId, branchId)) return [];
    const rows = await this.store.query(Q.paymentsByBranch.pick([], false), {
      eq: { companyId: scope.companyId, branchId },
      range: { gte: window.from, lt: window.to },
      limit,
    });
    return rows.map((r) => asEntity<Payment>(r));
  }
  async reversalOfInTx(tx: Tx, paymentId: string) {
    const d = await this.store.getInTx(tx, COL.paymentReversals, paymentId);
    return d ? (d.data.reversalId as string) : null;
  }
  async reversalsOf(paymentIds: readonly string[]) {
    const docs = await this.store.getMany(COL.paymentReversals, paymentIds);
    return new Map(docs.map((d) => [d.id, d.data.reversalId as string]));
  }
  post(tx: Tx, p: Payment) {
    this.store.create(tx, COL.payments, p.id, without(p, 'id'));
  }
  markReversed(
    tx: Tx,
    paymentId: string,
    v: { reversalId: string; companyId: string; branchId: string; at: Date },
  ) {
    // create(), not set(): a second reversal of the same payment fails at commit (uniqueness guard)
    this.store.create(tx, COL.paymentReversals, paymentId, v);
  }
}

// ---- order account (derived aggregate) -------------------------------------------------------------

export class DocOrderAccountRepository implements OrderAccountRepository {
  constructor(private readonly store: DocStore) {}
  async get(scope: Scope, orderId: string) {
    const d = await this.store.get(COL.orderAccounts, orderId);
    const x = d ? asEntity<OrderAccount>(d) : null;
    return x && inScope(scope, x) ? x : null;
  }
  async getInTx(tx: Tx, scope: Scope, orderId: string) {
    const d = await this.store.getInTx(tx, COL.orderAccounts, orderId);
    const x = d ? asEntity<OrderAccount>(d) : null;
    return x && inScope(scope, x) ? x : null;
  }
  async getMany(scope: Scope, orderIds: readonly string[]) {
    const docs = await this.store.getMany(COL.orderAccounts, orderIds);
    return docs.map((d) => asEntity<OrderAccount>(d)).filter((x) => inScope(scope, x));
  }
  save(tx: Tx, a: OrderAccount) {
    this.store.set(tx, COL.orderAccounts, a.id, without(a, 'id'));
  }
}

// ---- cash book, shifts, day close ------------------------------------------------------------------

export class DocCashRepository implements CashRepository {
  constructor(private readonly store: DocStore) {}
  async getDrawer(scope: Scope, branchId: string) {
    const d = await this.store.get(COL.cashDrawers, branchId);
    const x = d ? asEntity<CashDrawer>(d) : null;
    return x && inScope(scope, x) ? x : null;
  }
  async getDrawerInTx(tx: Tx, scope: Scope, branchId: string) {
    const d = await this.store.getInTx(tx, COL.cashDrawers, branchId);
    const x = d ? asEntity<CashDrawer>(d) : null;
    return x && inScope(scope, x) ? x : null;
  }
  saveDrawer(tx: Tx, d: CashDrawer) {
    this.store.set(tx, COL.cashDrawers, d.id, without(d, 'id'));
  }
  appendEntry(tx: Tx, e: CashEntry) {
    this.store.create(tx, COL.cashEntries, e.id, without(e, 'id'));
  }
  async entriesOfDay(scope: Scope, branchId: string, date: string, limit: number) {
    if (!scopeAllows(scope, scope.companyId, branchId)) return [];
    const rows = await this.store.query(Q.cashEntriesByDay.pick([], false), {
      eq: { companyId: scope.companyId, branchId, businessDate: date },
      limit,
    });
    return rows.map((r) => asEntity<CashEntry>(r));
  }
  async getShift(scope: Scope, id: string) {
    const d = await this.store.get(COL.cashShifts, id);
    const x = d ? asEntity<CashShift>(d) : null;
    return x && inScope(scope, x) ? x : null;
  }
  async getShiftInTx(tx: Tx, scope: Scope, id: string) {
    const d = await this.store.getInTx(tx, COL.cashShifts, id);
    const x = d ? asEntity<CashShift>(d) : null;
    return x && inScope(scope, x) ? x : null;
  }
  async listShifts(
    scope: Scope,
    branchId: string,
    window: { from: Date; to: Date } | null,
    limit: number,
  ) {
    if (!scopeAllows(scope, scope.companyId, branchId)) return [];
    const rows = await this.store.query(Q.cashShiftsByBranch.pick([], false), {
      eq: { companyId: scope.companyId, branchId },
      ...(window ? { range: { gte: window.from, lt: window.to } } : {}),
      limit,
    });
    return rows.map((r) => asEntity<CashShift>(r));
  }
  createShift(tx: Tx, s: CashShift) {
    this.store.create(tx, COL.cashShifts, s.id, without(s, 'id'));
  }
  updateShift(tx: Tx, id: string, patch: Record<string, unknown>) {
    this.store.update(tx, COL.cashShifts, id, patch);
  }
  async getDayClose(scope: Scope, branchId: string, date: string) {
    const d = await this.store.get(COL.dayCloses, dayCloseId(branchId, date));
    const x = d ? asEntity<DayClose>(d) : null;
    return x && x.status === 'closed' && inScope(scope, x) ? x : null;
  }
  async getDayCloseInTx(tx: Tx, scope: Scope, branchId: string, date: string) {
    const d = await this.store.getInTx(tx, COL.dayCloses, dayCloseId(branchId, date));
    const x = d ? asEntity<DayClose>(d) : null;
    return x && x.status === 'closed' && inScope(scope, x) ? x : null;
  }
  /** a day closed again after a reopening replaces the reopened record (the history is in the audit log) */
  createDayClose(tx: Tx, d: DayClose) {
    this.store.set(tx, COL.dayCloses, d.id, without(d, 'id'));
  }
  updateDayClose(tx: Tx, id: string, patch: Record<string, unknown>) {
    this.store.update(tx, COL.dayCloses, id, patch);
  }
}

// ---- debts -------------------------------------------------------------------------------------------

export class DocDebtRepository implements DebtRepository {
  constructor(private readonly store: DocStore) {}
  async get(scope: Scope, id: string) {
    const d = await this.store.get(COL.debts, id);
    const x = d ? asEntity<Debt>(d) : null;
    return x && inScope(scope, x) ? x : null;
  }
  async getInTx(tx: Tx, scope: Scope, id: string) {
    const d = await this.store.getInTx(tx, COL.debts, id);
    const x = d ? asEntity<Debt>(d) : null;
    return x && inScope(scope, x) ? x : null;
  }
  async listByStatus(scope: Scope, branchId: string, status: Debt['status'], limit: number) {
    if (!scopeAllows(scope, scope.companyId, branchId)) return [];
    const rows = await this.store.query(Q.debtsByBranchStatus.pick([], false), {
      eq: { companyId: scope.companyId, branchId, status },
      limit,
    });
    return rows.map((r) => asEntity<Debt>(r));
  }
  create(tx: Tx, d: Debt) {
    this.store.create(tx, COL.debts, d.id, without(d, 'id'));
  }
  update(tx: Tx, id: string, patch: Record<string, unknown>) {
    this.store.update(tx, COL.debts, id, patch);
  }
}
