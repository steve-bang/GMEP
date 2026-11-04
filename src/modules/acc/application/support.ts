import { z } from 'zod';
import { AppError, forbidden, notFound, validationFailed } from '@/platform/errors/errors';
import { requireWorkingBranch, type Actor } from '@/platform/rbac/rbac';
import { scopeAllows, type Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import {
  assertBranchWritable,
  auditEntry,
  parseInput,
  resolveConfigAt,
  roleCodesOf,
  type Branch,
  type RequestCtx,
  type WriteKind,
} from '@/modules/sys';
import {
  cashEntryId,
  seqKeyOf,
  type CashDrawer,
  type CashEntry,
  type CashEntryKind,
  type DayClose,
} from '../domain/cash';
import { DEFAULT_ACC_POLICY, type AccPolicy } from '../domain/payment';
import type { AccDeps } from '../ports/deps';

export {
  auditEntry,
  parseInput,
  roleCodesOf,
  notFound,
  forbidden,
  AppError,
  validationFailed,
  requireWorkingBranch,
  z,
};
export type { RequestCtx };

export const idemOf = (deps: AccDeps) => ({
  uow: deps.sys.uow,
  store: deps.sys.idempotency,
  now: () => deps.sys.clock.now(),
  ttlMs: deps.sys.config.idempotencyTtlMs,
});

export const versionConflict = (): AppError => new AppError('version_conflict', 409);

/** The branch the money screens work in: the session's working branch, which the scope must cover (NFR-ISO-01). */
export function moneyBranch(actor: Actor, scope: Scope): string {
  const branchId = requireWorkingBranch(actor);
  if (!scopeAllows(scope, actor.companyId, branchId)) throw forbidden();
  return branchId;
}

/** Effective-dated money policy of the branch (branch override, then company, then the documented fallback). */
export async function accPolicyOf(
  deps: AccDeps,
  companyId: string,
  branchId: string,
  date: string,
): Promise<AccPolicy> {
  const snap = await resolveConfigAt(deps.sys, {
    companyId,
    type: 'acc-policy',
    scopeKey: 'company',
    date,
    branchId,
  });
  return snap
    ? { ...DEFAULT_ACC_POLICY, ...(snap.payload as Partial<AccPolicy>) }
    : DEFAULT_ACC_POLICY;
}

/** Writes in a branch follow its state (FR-SYS-011): a payment on an open order is `edit_open_order`. */
export async function assertWritable(
  deps: AccDeps,
  tx: Tx,
  actor: Actor,
  scope: Scope,
  branchId: string,
  kind: WriteKind = 'edit_open_order',
): Promise<Branch> {
  if (!scopeAllows(scope, actor.companyId, branchId)) throw forbidden();
  const branch = await deps.sys.branches.getInTx(tx, scope, branchId);
  if (!branch) throw notFound();
  assertBranchWritable(branch.status, kind, roleCodesOf(actor), deps.sys.config.branchStateRules);
  return branch;
}

/** A day that was closed takes no more money documents (FR-ACC-004 "ngày đã khóa chặn sửa trực tiếp"). */
export function assertDayOpen(close: DayClose | null): void {
  if (close) throw new AppError('day_closed', 409);
}

export interface MoneyCtx {
  drawer: CashDrawer;
  dayClose: DayClose | null;
}

/** Reads the drawer and the day-close record of the business date (call before the first write). */
export async function loadMoneyCtx(
  deps: AccDeps,
  tx: Tx,
  scope: Scope,
  companyId: string,
  branchId: string,
  date: string,
): Promise<MoneyCtx> {
  const [drawer, dayClose] = await Promise.all([
    deps.cash.getDrawerInTx(tx, scope, branchId),
    deps.cash.getDayCloseInTx(tx, scope, branchId, date),
  ]);
  return {
    drawer: drawer ?? {
      id: branchId,
      companyId,
      branchId,
      balanceVnd: 0,
      seq: 0,
      openShiftId: null,
      updatedAt: new Date(0),
    },
    dayClose,
  };
}

/** Money lines need an open day and an open shift on the counter. Returns the shift id. */
export function requireOpenShift(m: MoneyCtx): string {
  assertDayOpen(m.dayClose);
  if (!m.drawer.openShiftId) throw new AppError('no_open_shift', 409);
  return m.drawer.openShiftId;
}

/**
 * Stages one cash book entry and returns the drawer after it (RULE-009: every movement recorded, append-only).
 * Cash going out cannot exceed the book balance. The caller saves the final drawer once.
 */
export function stageCash(
  deps: AccDeps,
  tx: Tx,
  drawer: CashDrawer,
  e: {
    kind: CashEntryKind;
    direction: 'in' | 'out';
    amountVnd: number;
    shiftId: string;
    date: string;
    paymentId: string | null;
    documentNumber: string | null;
    description: string;
    actorId: string;
    at: Date;
  },
): CashDrawer {
  if (!Number.isSafeInteger(e.amountVnd) || e.amountVnd <= 0) throw new RangeError('cash amount');
  const next = drawer.balanceVnd + (e.direction === 'in' ? e.amountVnd : -e.amountVnd);
  if (next < 0) throw new AppError('cash_insufficient', 409);
  const seq = drawer.seq + 1;
  const entry: CashEntry = {
    id: cashEntryId(drawer.branchId, seq),
    companyId: drawer.companyId,
    branchId: drawer.branchId,
    businessDate: e.date,
    seq,
    seqKey: seqKeyOf(seq),
    shiftId: e.shiftId,
    kind: e.kind,
    direction: e.direction,
    amountVnd: e.amountVnd,
    balanceAfterVnd: next,
    paymentId: e.paymentId,
    documentNumber: e.documentNumber,
    description: e.description,
    createdAt: e.at,
    createdBy: e.actorId,
  };
  deps.cash.appendEntry(tx, entry);
  return { ...drawer, balanceVnd: next, seq, updatedAt: e.at };
}
