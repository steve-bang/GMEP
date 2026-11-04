import { businessDate } from '@/platform/format/date';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import { resolveScope, type Actor } from '@/platform/rbac/rbac';
import { branchesScope } from '@/platform/scope/scope';
import type { ApprovalHandler } from '@/modules/sys';
import { approvalLevelFor, openApprovalInTx } from '@/modules/sys';
import { agingKey, type AgingBuckets, type CashShift, type Debt } from '../domain/cash';
import { balanceOf, emptyAccount, type DebtSnapshot } from '../domain/payment';
import type { AccDeps } from '../ports/deps';
import {
  accPolicyOf,
  AppError,
  assertWritable,
  auditEntry,
  idemOf,
  moneyBranch,
  notFound,
  parseInput,
  validationFailed,
  z,
  type RequestCtx,
} from './support';

/**
 * Approved debt at handover (FR-ACC-006 minimal, R44, BR-ACC-02, RULE-011). The vehicle may leave with money
 * still owed only when a manager other than the requester approved a debt that covers what is outstanding. The
 * request carries a reason, the amount and a due date; the approval creates the receivable (`debts`) and marks it on
 * the order account in the same transaction, so the handover (REC) finds it. Paying the order in full settles it.
 */

export const debtRequestSchema = z.object({
  amountVnd: z.number().int().min(1).max(1_000_000_000_000),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(5).max(300),
});

const addDays = (iso: string, days: number): string =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

export async function requestDebt(
  deps: AccDeps,
  actor: Actor,
  orderId: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'debt:create');
  const branchId = moneyBranch(actor, scope);
  const data = parseInput(debtRequestSchema, input);
  const today = businessDate(deps.sys.clock.now());
  const policy = await accPolicyOf(deps, actor.companyId, branchId, today);
  if (data.dueDate < today || data.dueDate > addDays(today, policy.debtMaxDays))
    throw validationFailed([
      { field: 'dueDate', message: `Hạn trả từ hôm nay đến tối đa ${policy.debtMaxDays} ngày.` },
    ]);
  const { level, limits } = await approvalLevelFor(
    deps.sys,
    actor.companyId,
    'debt_handover',
    data.amountVnd,
  );
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/acc/orders/${orderId}/debt-requests`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ orderId, ...data }),
    },
    async (tx) => {
      const order = await deps.orders.getInTx(tx, scope, orderId);
      if (!order || order.branchId !== branchId) throw notFound();
      const account = await deps.accounts.getInTx(tx, scope, orderId);
      const bal = balanceOf(
        order.totalVnd,
        account ?? emptyAccount({ ...order, orderId: order.id, orderNumber: order.number }),
      );
      if (order.cancelled || !order.qcPassed) throw new AppError('qc_required', 409);
      if (bal.outstandingVnd === 0) throw new AppError('nothing_outstanding', 409);
      // the debt must cover everything that is outstanding: a partial debt would not let the vehicle go (R44)
      if (data.amountVnd !== bal.outstandingVnd) throw new AppError('debt_amount_mismatch', 422);
      const branch = await assertWritable(deps, tx, actor, scope, branchId);
      const req = await openApprovalInTx(deps.sys, tx, actor, ctx, {
        kind: 'debt_handover',
        level: level === 0 ? 1 : level,
        limits,
        branch,
        subjectType: 'order',
        subjectId: orderId,
        subjectLabel: order.number,
        valueVnd: data.amountVnd,
        reason: data.reason,
        payload: { orderId, amountVnd: data.amountVnd, dueDate: data.dueDate },
        link: `/rec/orders/${orderId}`,
      });
      return { status: 202, body: { approvalId: req.id, number: req.number, level: req.level } };
    },
  );
}

/** Effects of a decided debt / cash variance request, run by SYS inside the decision's transaction. */
export function accApprovalHandlers(getDeps: () => AccDeps): Record<string, ApprovalHandler> {
  return {
    debt_handover: {
      async onDecided({ tx, request: r, decision, actor, ctx }) {
        if (decision !== 'approved') return;
        const deps = getDeps();
        const scope = branchesScope(r.companyId, [r.branchId]);
        const p = r.payload as { orderId: string; amountVnd: number; dueDate: string };
        const order = await deps.orders.getInTx(tx, scope, p.orderId);
        if (!order || order.cancelled) throw new AppError('approval_stale', 409);
        const account =
          (await deps.accounts.getInTx(tx, scope, p.orderId)) ??
          emptyAccount({ ...order, orderId: order.id, orderNumber: order.number });
        const bal = balanceOf(order.totalVnd, account);
        // the amount owed grew since the request (a supplement, a reversed receipt): the request no longer covers it
        if (bal.outstandingVnd > p.amountVnd) throw new AppError('approval_stale', 409);
        const now = deps.sys.clock.now();
        const id = `debt_${r.id}`;
        const debt: Debt = {
          id,
          companyId: r.companyId,
          branchId: r.branchId,
          orderId: order.id,
          orderNumber: order.number,
          customerId: order.customerId,
          customerName: order.customerName,
          amountVnd: p.amountVnd,
          dueDate: p.dueDate,
          reason: r.reason,
          status: bal.outstandingVnd === 0 ? 'settled' : 'open',
          approvalId: r.id,
          approvedBy: actor.userId,
          approvedAt: now,
          createdAt: now,
          createdBy: actor.userId,
          updatedAt: now,
          updatedBy: actor.userId,
          version: 1,
        };
        if (account.debt && account.debt.status === 'open')
          deps.debts.update(tx, account.debt.id, {
            status: 'void',
            updatedAt: now,
            updatedBy: actor.userId,
          });
        deps.debts.create(tx, debt);
        const snap: DebtSnapshot = {
          id,
          amountVnd: p.amountVnd,
          dueDate: p.dueDate,
          reason: r.reason,
          approvalId: r.id,
          approvedBy: actor.userId,
          approvedAt: now,
          status: debt.status === 'settled' ? 'settled' : 'open',
        };
        deps.accounts.save(tx, { ...account, debt: snap, seq: account.seq + 1, updatedAt: now });
        deps.sys.audit.record(
          tx,
          auditEntry(deps.sys, actor, ctx, {
            branchId: r.branchId,
            entityType: 'debt',
            entityId: id,
            action: 'debt.approve',
            after: {
              order: order.number,
              amountVnd: p.amountVnd,
              dueDate: p.dueDate,
              approval: r.number,
              requestedBy: r.requestedBy,
            },
            reason: r.reason,
          }),
        );
      },
    },
    cash_variance: {
      async onDecided({ tx, request: r, decision, actor }) {
        const deps = getDeps();
        const scope = branchesScope(r.companyId, [r.branchId]);
        const shift = await deps.cash.getShiftInTx(
          tx,
          scope,
          (r.payload as { shiftId: string }).shiftId,
        );
        if (!shift) throw new AppError('approval_stale', 409);
        const next: CashShift['varianceStatus'] = decision === 'approved' ? 'approved' : 'rejected';
        deps.cash.updateShift(tx, shift.id, {
          varianceStatus: next,
          updatedAt: deps.sys.clock.now(),
          updatedBy: actor.userId,
          version: shift.version + 1,
        });
      },
    },
  };
}

// ---- reading -----------------------------------------------------------------------------------------

export interface DebtDto {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  amountVnd: number;
  /** what is still owed on the order now */
  remainingVnd: number;
  dueDate: string;
  daysOverdue: number;
  aging: keyof AgingBuckets;
  reason: string;
  status: Debt['status'];
}

export interface DebtListDto {
  items: DebtDto[];
  totals: AgingBuckets & { totalVnd: number };
}

/** Receivable of the working branch by order with its age (FR-ACC-006). The total of the buckets equals the total owed. */
export async function listDebts(deps: AccDeps, actor: Actor): Promise<DebtListDto> {
  const scope = resolveScope(actor, 'debt:view');
  const branchId = moneyBranch(actor, scope);
  const today = businessDate(deps.sys.clock.now());
  const debts = await deps.debts.listByStatus(scope, branchId, 'open', deps.acc.listMax);
  const ids = debts.map((d) => d.orderId);
  const [orders, accounts] = await Promise.all([
    deps.orders.getMany(actor.companyId, ids),
    deps.accounts.getMany(scope, ids),
  ]);
  const oById = new Map(orders.map((o) => [o.id, o]));
  const aById = new Map(accounts.map((a) => [a.orderId, a]));
  const totals = { notDue: 0, d1_30: 0, d31_60: 0, over60: 0, totalVnd: 0 };
  const items: DebtDto[] = debts.map((d) => {
    const o = oById.get(d.orderId);
    const a = aById.get(d.orderId);
    const remaining = o && a ? balanceOf(o.totalVnd, a).outstandingVnd : d.amountVnd;
    const key = agingKey(d.dueDate, today, deps.acc.agingCuts);
    totals[key] += remaining;
    totals.totalVnd += remaining;
    const days = Math.max(
      0,
      Math.floor(
        (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${d.dueDate}T00:00:00Z`)) / 86_400_000,
      ),
    );
    return {
      id: d.id,
      orderId: d.orderId,
      orderNumber: d.orderNumber,
      customerName: d.customerName,
      amountVnd: d.amountVnd,
      remainingVnd: remaining,
      dueDate: d.dueDate,
      daysOverdue: days,
      aging: key,
      reason: d.reason,
      status: d.status,
    };
  });
  return { items, totals };
}
