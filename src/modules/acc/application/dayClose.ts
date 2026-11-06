import { businessDate } from '@/platform/format/date';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import { hasPermission, resolveScope, type Actor } from '@/platform/rbac/rbac';
import {
  approvalLimitsOf,
  consumeApprovalInTx,
  isApprovalExpired,
  loadApprovalForUse,
  notifyUsers,
  openApprovalInTx,
  usersWithRole,
} from '@/modules/sys';
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
 * A mistake found later is corrected by a reversal posted in the open day (RULE-010); reopening the current day needs the owner's approval (FR-ACC-005, below).
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
      const [previous, drawer] = await Promise.all([
        deps.cash.getDayCloseAnyInTx(tx, scope, branchId, data.date),
        deps.cash.getDrawerInTx(tx, scope, branchId),
      ]);
      if (previous?.status === 'closed') throw new AppError('day_already_closed', 409);
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
        tenantId: actor.tenantId,
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
        // R106: closing again keeps the reopen history (the monthly count must not reset)
        ...(previous?.reopenCount || previous?.reopenedAt
          ? {
              reopenCount: previous.reopenCount ?? 1,
              ...(previous.reopenedAt ? { reopenedAt: previous.reopenedAt } : {}),
              ...(previous.reopenedBy ? { reopenedBy: previous.reopenedBy } : {}),
              ...(previous.reopenApprovalId ? { reopenApprovalId: previous.reopenApprovalId } : {}),
            }
          : {}),
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

// ---- reopening a closed day (FR-ACC-005, R62) ----------------------------------------------------------------------------

export const reopenRequestSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(5).max(300),
});

/**
 * A closed day is reopened only with the owner's approval and a reason [Đề xuất dev - chờ xác nhận: Chủ dự án, Kế toán
 * khách]. Only the CURRENT business day can be reopened (money is always posted in the open day, so an older closed day
 * is never written to; corrections go in as reversal entries, RULE-010). The close record is kept (status `reopened`)
 * and a new close replaces it; the first close stays readable in the audit log.
 */
export async function requestDayReopen(
  deps: AccDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'cash-day:update');
  const branchId = moneyBranch(actor, scope);
  const data = parseInput(reopenRequestSchema, input);
  if (data.date !== businessDate(deps.sys.clock.now()))
    throw validationFailed([{ field: 'date', message: 'Chỉ mở lại được ngày làm việc hiện tại.' }]);
  const limits = await approvalLimitsOf(deps.sys, actor.tenantId, 'day_reopen', data.date);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: 'POST /api/v1/acc/day-close/reopen-request',
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ branchId, ...data }),
    },
    async (tx) => {
      const close = await deps.cash.getDayCloseInTx(tx, scope, branchId, data.date);
      if (!close) throw new AppError('day_not_closed', 409);
      const branch = await assertWritable(deps, tx, actor, scope, branchId);
      const req = await openApprovalInTx(deps.sys, tx, actor, ctx, {
        kind: 'day_reopen',
        level: 2,
        limits,
        branch,
        subjectType: 'dayClose',
        subjectId: close.id,
        subjectLabel: data.date,
        valueVnd: 0,
        reason: data.reason,
        payload: { date: data.date },
      });
      return {
        status: 202,
        body: {
          status: 'pending_approval',
          approvalId: req.id,
          number: req.number,
          level: req.level,
        },
      };
    },
  );
}

export const reopenSchema = z.object({ approvalId: z.string().trim().min(1).max(128) });

/** the business date after `d` (YYYY-MM-DD, calendar arithmetic in UTC: no time zone is involved) */
const nextDate = (d: string): string => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
};

export async function reopenDay(
  deps: AccDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'cash-day:update');
  const branchId = moneyBranch(actor, scope);
  const data = parseInput(reopenSchema, input);
  const limits = await approvalLimitsOf(
    deps.sys,
    actor.tenantId,
    'day_reopen',
    businessDate(deps.sys.clock.now()),
  );
  // R106: reopenings of this branch earlier this month (no query: the close records are read by id, at most 31)
  const monthDates = Array.from(
    { length: Number(businessDate(deps.sys.clock.now()).slice(8, 10)) },
    (_, i) => `${businessDate(deps.sys.clock.now()).slice(0, 8)}${String(i + 1).padStart(2, '0')}`,
  );
  const monthCloses = await Promise.all(
    monthDates.map((d) => deps.cash.getDayCloseAny(scope, branchId, d)),
  );
  const monthReopens = monthCloses.reduce(
    (s, c) => s + (c?.reopenCount ?? (c?.reopenedAt ? 1 : 0)),
    0,
  );
  // recipients are read before the first write of the transaction (Firestore)
  const [managers, exceptionTo] = await Promise.all([
    usersWithRole(deps.sys, actor.tenantId, ['QL'], branchId),
    usersWithRole(deps.sys, actor.tenantId, ['CH', 'KT'], branchId),
  ]);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: 'POST /api/v1/acc/day-close/reopen',
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ branchId, ...data }),
    },
    async (tx) => {
      const today = businessDate(deps.sys.clock.now());
      const approval = await loadApprovalForUse(deps.sys, tx, scope, {
        id: data.approvalId,
        kind: 'day_reopen',
        branchId,
        subjectId: dayCloseId(branchId, today),
      });
      // R106: an approval is only good for a short time (config, 2 h at the start); after that it must be asked for again
      if (
        isApprovalExpired(
          approval.decidedAt ?? approval.requestedAt,
          deps.sys.clock.now(),
          limits.validHours,
        )
      )
        throw new AppError('approval_expired', 409);
      const [close, later] = await Promise.all([
        deps.cash.getDayCloseInTx(tx, scope, branchId, today),
        // R106: a day cannot be reopened when a later day is already closed (the later close counted this day's book)
        deps.cash.getDayCloseInTx(tx, scope, branchId, nextDate(today)),
      ]);
      if (!close) throw new AppError('day_not_closed', 409);
      if (later && later.status === 'closed') throw new AppError('later_day_closed', 409);
      await assertWritable(deps, tx, actor, scope, branchId);
      const now = deps.sys.clock.now();
      consumeApprovalInTx(deps.sys, tx, actor, ctx, approval, close.id);
      deps.cash.updateDayClose(tx, close.id, {
        status: 'reopened',
        reopenCount: (close.reopenCount ?? (close.reopenedAt ? 1 : 0)) + 1,
        reopenedAt: now,
        reopenedBy: actor.userId,
        reopenApprovalId: approval.id,
      });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId,
          entityType: 'dayClose',
          entityId: close.id,
          action: 'cash.day_reopen',
          before: { status: 'closed', closedAt: close.closedAt.toISOString() },
          after: { status: 'reopened', approval: approval.number },
          reason: approval.reason,
        }),
      );
      // R106: every reopening is an exception for the owner and the accountant, and a notice for the branch managers
      // (in-app only: no Zalo/SMS provider yet). No names or amounts: the reason is in the audit log.
      for (const [userIds, titleKey] of [
        [exceptionTo, 'notifications.dayReopenedException'],
        [managers.filter((u) => !exceptionTo.includes(u)), 'notifications.dayReopened'],
      ] as const)
        notifyUsers(deps.sys, tx, {
          tenantId: actor.tenantId,
          userIds,
          kind: 'acc.cash',
          titleKey,
          params: { date: today },
          link: '/acc/day-close',
          branchId,
        });
      // R106: more than the configured number of reopenings in one month = a repeated exception for the owner/accountant
      const maxPerMonth = limits.maxReopensPerMonth ?? 3;
      if (monthReopens + 1 > maxPerMonth)
        notifyUsers(deps.sys, tx, {
          tenantId: actor.tenantId,
          userIds: exceptionTo,
          kind: 'acc.cash',
          titleKey: 'notifications.dayReopenedRepeated',
          params: { count: String(monthReopens + 1), max: String(maxPerMonth) },
          link: '/acc/day-close',
          branchId,
        });
      return { status: 200, body: { id: close.id, date: today, status: 'reopened' } };
    },
  );
}
