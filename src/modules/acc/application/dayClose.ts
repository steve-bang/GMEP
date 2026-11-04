import { businessDate } from '@/platform/format/date';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import { hasPermission, resolveScope, type Actor } from '@/platform/rbac/rbac';
import {
  dayCloseBlockers,
  dayCloseId,
  dayWindow,
  type DayBlock,
  type DayClose,
} from '../domain/cash';
import { balanceOf, emptyAccount } from '../domain/payment';
import type { AccDeps } from '../ports/deps';
import { toShiftDto, type ShiftDto } from './shifts';
import {
  AppError,
  assertWritable,
  auditEntry,
  idemOf,
  moneyBranch,
  parseInput,
  validationFailed,
  z,
  type RequestCtx,
} from './support';

/**
 * Day close (FR-ACC-004, UAT-07): lists the open orders and the orders not yet paid, the count differences, then
 * locks the business date of the branch. It cannot close while a shift is open or a count difference is
 * unexplained, pending or rejected; once closed, no payment, voucher, shift or cash entry can be dated that day.
 * A mistake found later is corrected by a reversal posted in the open day (RULE-010), never by reopening in this slice.
 */

export interface DayStatusDto {
  date: string;
  closed: boolean;
  closedByName: string | null;
  closedAt: string | null;
  closingBalanceVnd: number | null;
  shifts: ShiftDto[];
  /** conditions that stop the close */
  blockers: DayBlock[];
  /** things to look at that do not stop the close */
  warnings: {
    openOrders: {
      id: string;
      number: string;
      plate: string;
      status: string;
      outstandingVnd: number;
    }[];
    unpaidOrders: number;
    expensesWithoutSource: number;
  };
  cashInVnd: number;
  cashOutVnd: number;
  actions: Record<'close', { allowed: boolean; reasonCode?: string }>;
}

export async function getDayStatus(
  deps: AccDeps,
  actor: Actor,
  date?: string,
): Promise<DayStatusDto> {
  const scope = resolveScope(actor, 'cash-day:view');
  const branchId = moneyBranch(actor, scope);
  const today = businessDate(deps.sys.clock.now());
  const d = date ?? today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d > today)
    throw validationFailed([{ field: 'date', message: 'Ngày không hợp lệ.' }]);
  const win = dayWindow(d);
  const [close, shifts, entries, payments, open] = await Promise.all([
    deps.cash.getDayClose(scope, branchId, d),
    deps.cash.listShifts(scope, branchId, win, 50),
    deps.cash.entriesOfDay(scope, branchId, d, deps.acc.entriesMax),
    hasPermission(actor, 'payment:view')
      ? deps.payments.listByBranch(scope, branchId, win, deps.acc.listMax)
      : Promise.resolve([]),
    deps.orders.listOpen(scope, deps.acc.openOrdersMax),
  ]);
  const accounts = await deps.accounts.getMany(
    scope,
    open.map((o) => o.id),
  );
  const byId = new Map(accounts.map((a) => [a.orderId, a]));
  const openRows = open
    .filter((o) => o.branchId === branchId)
    .map((o) => {
      const a = byId.get(o.id) ?? emptyAccount({ ...o, orderId: o.id, orderNumber: o.number });
      return {
        id: o.id,
        number: o.number,
        plate: o.plate,
        status: o.status,
        outstandingVnd: balanceOf(o.totalVnd, a).outstandingVnd,
        qcPassed: o.qcPassed,
        hasDebt: !!balanceOf(o.totalVnd, a).debt,
      };
    });
  const blockers = dayCloseBlockers(shifts);
  const mayClose = hasPermission(actor, 'cash-day:update');
  return {
    date: d,
    closed: !!close,
    closedByName: close?.closedByName ?? null,
    closedAt: close?.closedAt.toISOString() ?? null,
    closingBalanceVnd: close?.closingBalanceVnd ?? null,
    shifts: shifts.sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime()).map(toShiftDto),
    blockers,
    warnings: {
      openOrders: openRows.map(({ id, number, plate, status, outstandingVnd }) => ({
        id,
        number,
        plate,
        status,
        outstandingVnd,
      })),
      unpaidOrders: openRows.filter((o) => o.qcPassed && o.outstandingVnd > 0 && !o.hasDebt).length,
      expensesWithoutSource: payments.filter((p) => p.kind === 'expense' && p.sourceMissing).length,
    },
    cashInVnd: entries.filter((e) => e.direction === 'in').reduce((s, e) => s + e.amountVnd, 0),
    cashOutVnd: entries.filter((e) => e.direction === 'out').reduce((s, e) => s + e.amountVnd, 0),
    actions: {
      close: !mayClose
        ? { allowed: false, reasonCode: 'no_permission' }
        : close
          ? { allowed: false, reasonCode: 'day_closed' }
          : blockers.length
            ? { allowed: false, reasonCode: blockers[0]!.code }
            : { allowed: true },
    },
  };
}

export const closeDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(300).optional(),
});

export async function closeDay(
  deps: AccDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'cash-day:update');
  const branchId = moneyBranch(actor, scope);
  const data = parseInput(closeDaySchema, input);
  const today = businessDate(deps.sys.clock.now());
  if (data.date > today) throw validationFailed([{ field: 'date', message: 'Chưa tới ngày này.' }]);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: 'POST /api/v1/acc/day-close',
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ branchId, ...data }),
    },
    async (tx) => {
      const now = deps.sys.clock.now();
      // the drawer and the close record are read in the transaction: a payment landing at the same moment
      // touches the same documents, so one of the two retries and sees the other
      const [existing, drawer] = await Promise.all([
        deps.cash.getDayCloseInTx(tx, scope, branchId, data.date),
        deps.cash.getDrawerInTx(tx, scope, branchId),
      ]);
      if (existing) throw new AppError('day_already_closed', 409);
      await assertWritable(deps, tx, actor, scope, branchId);
      const win = dayWindow(data.date);
      const [shifts, entries] = await Promise.all([
        deps.cash.listShifts(scope, branchId, win, 50),
        deps.cash.entriesOfDay(scope, branchId, data.date, deps.acc.entriesMax),
      ]);
      const blockers = dayCloseBlockers(shifts);
      if (blockers.length)
        throw new AppError('day_close_blocked', 409, [
          { field: 'blockers', message: blockers.map((b) => b.code).join(',') },
        ]);
      if (drawer?.openShiftId) throw new AppError('shift_open', 409);
      const payments = await deps.payments.listByBranch(scope, branchId, win, deps.acc.listMax);
      const open = await deps.orders.listOpen(scope, deps.acc.openOrdersMax);
      const last = entries.at(-1);
      const row: DayClose = {
        id: dayCloseId(branchId, data.date),
        companyId: actor.companyId,
        branchId,
        businessDate: data.date,
        status: 'closed',
        closedBy: actor.userId,
        closedByName: actor.displayName,
        closedAt: now,
        closingBalanceVnd: last
          ? last.balanceAfterVnd
          : data.date === today
            ? (drawer?.balanceVnd ?? 0)
            : null,
        cashInVnd: entries.filter((e) => e.direction === 'in').reduce((s, e) => s + e.amountVnd, 0),
        cashOutVnd: entries
          .filter((e) => e.direction === 'out')
          .reduce((s, e) => s + e.amountVnd, 0),
        shiftIds: shifts.map((s) => s.id),
        ...(data.note ? { note: data.note } : {}),
        warnings: {
          openOrders: open.filter((o) => o.branchId === branchId).length,
          expensesWithoutSource: payments.filter((p) => p.kind === 'expense' && p.sourceMissing)
            .length,
        },
      };
      deps.cash.createDayClose(tx, row);
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId,
          entityType: 'dayClose',
          entityId: row.id,
          action: 'cash.day_close',
          after: {
            date: data.date,
            closingBalanceVnd: row.closingBalanceVnd,
            cashInVnd: row.cashInVnd,
            cashOutVnd: row.cashOutVnd,
            shifts: shifts.length,
          },
          ...(data.note ? { reason: data.note } : {}),
        }),
      );
      return {
        status: 201,
        body: { id: row.id, date: data.date, closingBalanceVnd: row.closingBalanceVnd },
      };
    },
  );
}
