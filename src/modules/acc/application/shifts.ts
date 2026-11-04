import { businessDate } from '@/platform/format/date';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import { hasPermission, resolveScope, type Actor } from '@/platform/rbac/rbac';
import { approvalLevelFor, openApprovalInTx } from '@/modules/sys';
import {
  checkVariance,
  dayCloseBlockers,
  dayWindow,
  signedAmount,
  VARIANCE_CAUSES,
  type CashDrawer,
  type CashEntry,
  type CashShift,
  type DayBlock,
  type DayClose,
} from '../domain/cash';
import type { AccDeps } from '../ports/deps';
import {
  accPolicyOf,
  AppError,
  assertDayOpen,
  assertWritable,
  auditEntry,
  idemOf,
  loadMoneyCtx,
  moneyBranch,
  notFound,
  parseInput,
  stageCash,
  validationFailed,
  versionConflict,
  z,
  type RequestCtx,
} from './support';

/**
 * Cash shifts (FR-ACC-004). One shift is open at a time on a branch's counter; every payment line is posted into it.
 * Closing the shift counts the drawer: counted minus book is the variance. A variance needs a cause and an
 * explanation; above the (configurable) tolerance it also needs a manager's approval, and the DAY cannot close
 * until that approval is given. The count difference itself is a cash book `variance` entry, so the book equals the
 * count after the close and nothing is ever edited (RULE-010).
 */

export const openShiftSchema = z.object({});

export async function openShift(
  deps: AccDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'cash-shift:create');
  const branchId = moneyBranch(actor, scope);
  parseInput(openShiftSchema, input ?? {});
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: 'POST /api/v1/acc/shifts',
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ branchId }),
    },
    async (tx) => {
      const now = deps.sys.clock.now();
      const date = businessDate(now);
      const m = await loadMoneyCtx(deps, tx, scope, actor.companyId, branchId, date);
      await assertWritable(deps, tx, actor, scope, branchId);
      assertDayOpen(m.dayClose);
      if (m.drawer.openShiftId) throw new AppError('shift_already_open', 409);
      const id = `sh_${deps.sys.newId()}`;
      const s: CashShift = {
        id,
        companyId: actor.companyId,
        branchId,
        businessDate: date,
        status: 'open',
        openedBy: actor.userId,
        openedByName: actor.displayName,
        openedAt: now,
        openingVnd: m.drawer.balanceVnd,
        varianceStatus: 'none',
        createdAt: now,
        createdBy: actor.userId,
        updatedAt: now,
        updatedBy: actor.userId,
        version: 1,
      };
      deps.cash.createShift(tx, s);
      deps.cash.saveDrawer(tx, { ...m.drawer, openShiftId: id, updatedAt: now });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId,
          entityType: 'cashShift',
          entityId: id,
          action: 'cash.shift_open',
          after: { openingVnd: s.openingVnd, businessDate: date },
        }),
      );
      return { status: 201, body: { id, openingVnd: s.openingVnd, businessDate: date } };
    },
  );
}

export const closeShiftSchema = z.object({
  version: z.number().int().min(1),
  /** what the drawer really holds, counted without looking at the book */
  countedVnd: z.number().int().min(0).max(1_000_000_000_000),
  causeCode: z.enum(VARIANCE_CAUSES).optional(),
  explanation: z.string().trim().max(300).optional(),
  /** the cashier read the list of open orders and hands them to the next shift (G4-ACC-08 step 1) */
  openOrdersAcknowledged: z.boolean().default(false),
});

export async function closeShift(
  deps: AccDeps,
  actor: Actor,
  shiftId: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'cash-shift:update');
  const branchId = moneyBranch(actor, scope);
  const data = parseInput(closeShiftSchema, input);
  const now0 = deps.sys.clock.now();
  const policy = await accPolicyOf(deps, actor.companyId, branchId, businessDate(now0));
  const s0 = await deps.cash.getShift(scope, shiftId);
  if (!s0 || s0.branchId !== branchId) throw notFound();
  const v0 = checkVariance(
    (await deps.cash.getDrawer(scope, branchId))?.balanceVnd ?? 0,
    data.countedVnd,
    policy.varianceToleranceVnd,
  );
  const errors: { field: string; message: string }[] = [];
  if (v0.needsExplanation) {
    if (!data.causeCode)
      errors.push({ field: 'causeCode', message: 'Chọn nguyên nhân chênh lệch.' });
    if ((data.explanation ?? '').length < 5)
      errors.push({ field: 'explanation', message: 'Giải trình tối thiểu 5 ký tự.' });
  }
  if (errors.length) throw validationFailed(errors);
  const limit = v0.needsApproval
    ? await approvalLevelFor(deps.sys, actor.companyId, 'cash_variance', Math.abs(v0.varianceVnd))
    : null;
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/acc/shifts/${shiftId}/close`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ shiftId, ...data }),
    },
    async (tx) => {
      const now = deps.sys.clock.now();
      const date = businessDate(now);
      const s = await deps.cash.getShiftInTx(tx, scope, shiftId);
      if (!s || s.branchId !== branchId) throw notFound();
      if (s.version !== data.version) throw versionConflict();
      if (s.status !== 'open') throw new AppError('shift_not_open', 409);
      const m = await loadMoneyCtx(deps, tx, scope, actor.companyId, branchId, date);
      if (m.drawer.openShiftId !== s.id) throw new AppError('shift_not_open', 409);
      const branch = await assertWritable(deps, tx, actor, scope, branchId);
      // re-evaluate against the book as it is NOW (a payment may have landed since the screen was drawn)
      const v = checkVariance(m.drawer.balanceVnd, data.countedVnd, policy.varianceToleranceVnd);
      if (v.needsExplanation && (!data.causeCode || (data.explanation ?? '').length < 5))
        throw validationFailed([{ field: 'explanation', message: 'Giải trình chênh lệch.' }]);
      const bookBefore = m.drawer.balanceVnd;
      let varianceStatus: CashShift['varianceStatus'] = v.varianceVnd === 0 ? 'none' : 'explained';
      let approvalId: string | undefined;
      let approvalNumber: string | undefined;
      if (v.needsApproval && limit && limit.level !== 0) {
        const req = await openApprovalInTx(deps.sys, tx, actor, ctx, {
          kind: 'cash_variance',
          level: limit.level,
          limits: limit.limits,
          branch,
          subjectType: 'shift',
          subjectId: s.id,
          subjectLabel: `Ca ${s.businessDate}`,
          valueVnd: Math.abs(v.varianceVnd),
          reason: data.explanation ?? '',
          payload: { shiftId: s.id, varianceVnd: v.varianceVnd, causeCode: data.causeCode ?? null },
        });
        varianceStatus = 'pending_approval';
        approvalId = req.id;
        approvalNumber = req.number;
      }
      // writes only from here on (a Firestore transaction finishes its reads, including the approval slot, first)
      let drawer: CashDrawer = { ...m.drawer, openShiftId: null, updatedAt: now };
      if (v.varianceVnd !== 0) {
        // the count difference is an entry of the book of the shift's own day
        drawer = stageCash(deps, tx, m.drawer, {
          kind: 'variance',
          direction: v.varianceVnd > 0 ? 'in' : 'out',
          amountVnd: Math.abs(v.varianceVnd),
          shiftId: s.id,
          date,
          paymentId: null,
          documentNumber: null,
          description: `Chênh lệch kiểm đếm ca: ${data.explanation ?? ''}`.slice(0, 200),
          actorId: actor.userId,
          at: now,
        });
        drawer = { ...drawer, openShiftId: null };
      }
      // cash movement of this shift, for the summary
      const entries = (
        await deps.cash.entriesOfDay(scope, branchId, s.businessDate, deps.acc.entriesMax)
      ).filter((e) => e.shiftId === s.id && e.kind !== 'variance');
      const cashIn = entries
        .filter((e) => e.direction === 'in')
        .reduce((x, e) => x + e.amountVnd, 0);
      const cashOut = entries
        .filter((e) => e.direction === 'out')
        .reduce((x, e) => x + e.amountVnd, 0);
      const open = await deps.orders.listOpen(scope, deps.acc.openOrdersMax);
      deps.cash.updateShift(tx, s.id, {
        status: 'closed',
        closedBy: actor.userId,
        closedByName: actor.displayName,
        closedAt: now,
        countedVnd: data.countedVnd,
        bookVnd: bookBefore,
        varianceVnd: v.varianceVnd,
        ...(data.causeCode ? { causeCode: data.causeCode } : {}),
        ...(data.explanation ? { explanation: data.explanation } : {}),
        varianceStatus,
        ...(approvalId ? { varianceApprovalId: approvalId } : {}),
        cashInVnd: cashIn,
        cashOutVnd: cashOut,
        openOrders: open.length,
        updatedAt: now,
        updatedBy: actor.userId,
        version: s.version + 1,
      });
      deps.cash.saveDrawer(tx, drawer);
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId,
          entityType: 'cashShift',
          entityId: s.id,
          action: 'cash.shift_close',
          before: { status: 'open' },
          after: {
            status: 'closed',
            bookVnd: bookBefore,
            countedVnd: data.countedVnd,
            varianceVnd: v.varianceVnd,
            varianceStatus,
            approval: approvalNumber ?? null,
          },
          ...(data.explanation ? { reason: data.explanation } : {}),
        }),
      );
      return {
        status: 200,
        body: {
          id: s.id,
          varianceVnd: v.varianceVnd,
          varianceStatus,
          approvalId: approvalId ?? null,
          bookVnd: bookBefore,
        },
      };
    },
  );
}

/** After a rejection the cashier explains again; a new request goes to the manager. */
export const explainSchema = z.object({
  causeCode: z.enum(VARIANCE_CAUSES),
  explanation: z.string().trim().min(5).max(300),
});

export async function resubmitVariance(
  deps: AccDeps,
  actor: Actor,
  shiftId: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'cash-shift:update');
  const branchId = moneyBranch(actor, scope);
  const data = parseInput(explainSchema, input);
  const s0 = await deps.cash.getShift(scope, shiftId);
  if (!s0 || s0.branchId !== branchId) throw notFound();
  const limit = await approvalLevelFor(
    deps.sys,
    actor.companyId,
    'cash_variance',
    Math.abs(s0.varianceVnd ?? 0),
  );
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/acc/shifts/${shiftId}/explain`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ shiftId, ...data }),
    },
    async (tx) => {
      const s = await deps.cash.getShiftInTx(tx, scope, shiftId);
      if (!s || s.branchId !== branchId) throw notFound();
      if (s.varianceStatus !== 'rejected') throw new AppError('variance_not_rejected', 409);
      const branch = await assertWritable(deps, tx, actor, scope, branchId);
      const now = deps.sys.clock.now();
      const req = await openApprovalInTx(deps.sys, tx, actor, ctx, {
        kind: 'cash_variance',
        level: limit.level === 0 ? 1 : limit.level,
        limits: limit.limits,
        branch,
        subjectType: 'shift',
        subjectId: s.id,
        subjectLabel: `Ca ${s.businessDate}`,
        valueVnd: Math.abs(s.varianceVnd ?? 0),
        reason: data.explanation,
        payload: { shiftId: s.id, varianceVnd: s.varianceVnd ?? 0, causeCode: data.causeCode },
      });
      deps.cash.updateShift(tx, s.id, {
        varianceStatus: 'pending_approval',
        varianceApprovalId: req.id,
        causeCode: data.causeCode,
        explanation: data.explanation,
        updatedAt: now,
        updatedBy: actor.userId,
        version: s.version + 1,
      });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId,
          entityType: 'cashShift',
          entityId: s.id,
          action: 'cash.variance_resubmit',
          after: { varianceStatus: 'pending_approval', approval: req.number },
          reason: data.explanation,
        }),
      );
      return { status: 200, body: { id: s.id, approvalId: req.id } };
    },
  );
}

// ---- reading -----------------------------------------------------------------------------------------

export interface ShiftDto {
  id: string;
  businessDate: string;
  status: CashShift['status'];
  openedByName: string;
  openedAt: string;
  openingVnd: number;
  closedByName: string | null;
  closedAt: string | null;
  countedVnd: number | null;
  bookVnd: number | null;
  varianceVnd: number | null;
  causeCode: string | null;
  explanation: string | null;
  varianceStatus: CashShift['varianceStatus'];
  cashInVnd: number | null;
  cashOutVnd: number | null;
  version: number;
}

export const toShiftDto = (s: CashShift): ShiftDto => ({
  id: s.id,
  businessDate: s.businessDate,
  status: s.status,
  openedByName: s.openedByName,
  openedAt: s.openedAt.toISOString(),
  openingVnd: s.openingVnd,
  closedByName: s.closedByName ?? null,
  closedAt: s.closedAt?.toISOString() ?? null,
  countedVnd: s.countedVnd ?? null,
  bookVnd: s.bookVnd ?? null,
  varianceVnd: s.varianceVnd ?? null,
  causeCode: s.causeCode ?? null,
  explanation: s.explanation ?? null,
  varianceStatus: s.varianceStatus,
  cashInVnd: s.cashInVnd ?? null,
  cashOutVnd: s.cashOutVnd ?? null,
  version: s.version,
});

export interface CashEntryDto {
  id: string;
  at: string;
  kind: CashEntry['kind'];
  direction: 'in' | 'out';
  amountVnd: number;
  balanceAfterVnd: number;
  documentNumber: string | null;
  paymentId: string | null;
  description: string;
  shiftId: string;
}

export interface CashbookDto {
  date: string;
  /** the book balance before the first entry of the day; null when the day has no entry and the date is past */
  openingVnd: number | null;
  inVnd: number;
  outVnd: number;
  /** opening + in - out (FR-ACC-003 acceptance) */
  closingVnd: number | null;
  entries: CashEntryDto[];
  shifts: ShiftDto[];
  closed: boolean;
  /** the drawer now (today's screen) */
  drawer: { balanceVnd: number; openShiftId: string | null };
  actions: Record<
    'openShift' | 'closeShift' | 'expense',
    { allowed: boolean; reasonCode?: string }
  >;
}

/** The cash book of one day (G4-ACC-04): entries in order with the running balance, totals that add up. */
export async function getCashbook(
  deps: AccDeps,
  actor: Actor,
  date?: string,
): Promise<CashbookDto> {
  const scope = resolveScope(actor, 'cashbook:view');
  const branchId = moneyBranch(actor, scope);
  const today = businessDate(deps.sys.clock.now());
  const d = date ?? today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d))
    throw validationFailed([{ field: 'date', message: 'Ngày không hợp lệ.' }]);
  const [entries, drawer, close, shifts] = await Promise.all([
    deps.cash.entriesOfDay(scope, branchId, d, deps.acc.entriesMax),
    deps.cash.getDrawer(scope, branchId),
    deps.cash.getDayClose(scope, branchId, d),
    deps.cash.listShifts(scope, branchId, dayWindow(d), 20),
  ]);
  const first = entries[0];
  const openingVnd = first
    ? first.balanceAfterVnd - signedAmount(first)
    : d === today
      ? (drawer?.balanceVnd ?? 0)
      : null;
  const inVnd = entries.filter((e) => e.direction === 'in').reduce((s, e) => s + e.amountVnd, 0);
  const outVnd = entries.filter((e) => e.direction === 'out').reduce((s, e) => s + e.amountVnd, 0);
  const openShiftId = drawer?.openShiftId ?? null;
  const may = (p: 'cash-shift:create' | 'cash-shift:update' | 'cash-expense:create') =>
    hasPermission(actor, p);
  return {
    date: d,
    openingVnd,
    inVnd,
    outVnd,
    closingVnd: openingVnd === null ? null : openingVnd + inVnd - outVnd,
    entries: entries.map((e) => ({
      id: e.id,
      at: e.createdAt.toISOString(),
      kind: e.kind,
      direction: e.direction,
      amountVnd: e.amountVnd,
      balanceAfterVnd: e.balanceAfterVnd,
      documentNumber: e.documentNumber,
      paymentId: e.paymentId,
      description: e.description,
      shiftId: e.shiftId,
    })),
    shifts: shifts.sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime()).map(toShiftDto),
    closed: !!close,
    drawer: { balanceVnd: drawer?.balanceVnd ?? 0, openShiftId },
    actions: {
      openShift: !may('cash-shift:create')
        ? { allowed: false, reasonCode: 'no_permission' }
        : d !== today
          ? { allowed: false, reasonCode: 'not_today' }
          : close
            ? { allowed: false, reasonCode: 'day_closed' }
            : openShiftId
              ? { allowed: false, reasonCode: 'shift_already_open' }
              : { allowed: true },
      closeShift: !may('cash-shift:update')
        ? { allowed: false, reasonCode: 'no_permission' }
        : openShiftId
          ? { allowed: true }
          : { allowed: false, reasonCode: 'no_open_shift' },
      expense: !may('cash-expense:create')
        ? { allowed: false, reasonCode: 'no_permission' }
        : close
          ? { allowed: false, reasonCode: 'day_closed' }
          : openShiftId
            ? { allowed: true }
            : { allowed: false, reasonCode: 'no_open_shift' },
    },
  };
}

export type { DayBlock, DayClose };
export { dayCloseBlockers };
