import { businessDate } from '@/platform/format/date';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import { resolveScope, type Actor } from '@/platform/rbac/rbac';
import {
  allocateDocumentNumber,
  approvalLevelFor,
  consumeApprovalInTx,
  loadApprovalForUse,
  openApprovalInTx,
} from '@/modules/sys';
import {
  applyReversal,
  balanceOf,
  canReverse,
  cashOf,
  oppositeOf,
  type OrderAccount,
  type Payment,
} from '../domain/payment';
import type { AccDeps } from '../ports/deps';
import {
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
  z,
  type RequestCtx,
} from './support';

/**
 * Reversal entries (RULE-010, FR-ACC-001..003). A posted receipt, deposit or voucher is never edited or deleted:
 * it is reversed by a new entry that points at it, in two steps. (1) `requestReversal` opens an approval request
 * (a reversal always needs a manager: SYS-004). (2) After a different person approved it, `executeReversal` consumes
 * the approval ONCE and posts the entry dated today in the open day, whatever the date of the original (a closed
 * day is never touched). The original stays as it was; its reversal is found through the one-per-payment slot.
 */

export const requestReversalSchema = z.object({ reason: z.string().trim().min(5).max(300) });

export async function requestReversal(
  deps: AccDeps,
  actor: Actor,
  paymentId: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'payment:archive');
  const branchId = moneyBranch(actor, scope);
  const data = parseInput(requestReversalSchema, input);
  const p0 = await deps.payments.get(scope, paymentId);
  if (!p0 || p0.branchId !== branchId) throw notFound();
  const value = p0.totalVnd + p0.applicationVnd;
  const { level, limits } = await approvalLevelFor(
    deps.sys,
    actor.companyId,
    'payment_reversal',
    value,
  );
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/acc/payments/${paymentId}/reversal-request`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ paymentId, ...data }),
    },
    async (tx) => {
      const p = await deps.payments.getInTx(tx, scope, paymentId);
      if (!p || p.branchId !== branchId) throw notFound();
      const [reversedBy, account] = await Promise.all([
        deps.payments.reversalOfInTx(tx, paymentId),
        p.orderId ? deps.accounts.getInTx(tx, scope, p.orderId) : Promise.resolve(null),
      ]);
      const ok = canReverse(p, account, reversedBy !== null);
      if (!ok.ok) throw new AppError(ok.reason, 409);
      const branch = await assertWritable(deps, tx, actor, scope, branchId);
      // `level` is >= 1 for a reversal (alwaysNeeded)
      const req = await openApprovalInTx(deps.sys, tx, actor, ctx, {
        kind: 'payment_reversal',
        level: level === 0 ? 1 : level,
        limits,
        branch,
        subjectType: 'payment',
        subjectId: paymentId,
        subjectLabel: p.number,
        valueVnd: value,
        reason: data.reason,
        payload: { paymentId, number: p.number },
      });
      return { status: 202, body: { approvalId: req.id, number: req.number, level: req.level } };
    },
  );
}

export const executeReversalSchema = z.object({ approvalId: z.string().trim().min(1).max(128) });

export async function executeReversal(
  deps: AccDeps,
  actor: Actor,
  paymentId: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'payment:archive');
  const branchId = moneyBranch(actor, scope);
  const data = parseInput(executeReversalSchema, input);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/acc/payments/${paymentId}/reverse`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ paymentId, ...data }),
    },
    async (tx) => {
      const now = deps.sys.clock.now();
      const date = businessDate(now);
      const reversalId = `pay_${deps.sys.newId()}`;
      const approval = await loadApprovalForUse(deps.sys, tx, scope, {
        id: data.approvalId,
        kind: 'payment_reversal',
        branchId,
        subjectId: paymentId,
      });
      const p = await deps.payments.getInTx(tx, scope, paymentId);
      if (!p || p.branchId !== branchId) throw notFound();
      const [reversedBy, account, m, order] = await Promise.all([
        deps.payments.reversalOfInTx(tx, paymentId),
        p.orderId ? deps.accounts.getInTx(tx, scope, p.orderId) : Promise.resolve(null),
        loadMoneyCtx(deps, tx, scope, actor.companyId, branchId, date),
        p.orderId ? deps.orders.getInTx(tx, scope, p.orderId) : Promise.resolve(null),
      ]);
      const ok = canReverse(p, account, reversedBy !== null);
      if (!ok.ok) throw new AppError(ok.reason, 409);
      assertDayOpen(m.dayClose);
      const branch = await assertWritable(deps, tx, actor, scope, branchId);
      const cash = cashOf(p.lines);
      if (cash > 0 && !m.drawer.openShiftId) throw new AppError('no_open_shift', 409);
      const num = await allocateDocumentNumber(deps.sys, tx, {
        branch,
        docType: p.kind === 'expense' ? 'payment-voucher' : 'receipt-voucher',
        businessDate: date,
        stage: 'post',
        documentId: reversalId,
        requestKey: `${ctx.idempotencyKey}:rev`,
      });
      const rev: Payment = {
        id: reversalId,
        companyId: p.companyId,
        branchId,
        number: num.number!,
        kind: 'reversal',
        direction: oppositeOf(p.direction),
        orderId: p.orderId,
        orderNumber: p.orderNumber,
        customerId: p.customerId,
        customerName: p.customerName,
        lines: p.lines,
        totalVnd: p.totalVnd,
        applications: p.applications,
        applicationVnd: p.applicationVnd,
        reversesId: p.id,
        reversesNumber: p.number,
        reversesKind: p.kind,
        reason: approval.reason,
        approvalId: approval.id,
        ...(p.depositId ? { depositId: p.depositId } : {}),
        shiftId: m.drawer.openShiftId,
        businessDate: date,
        createdAt: now,
        createdBy: actor.userId,
        createdByName: actor.displayName,
      };
      consumeApprovalInTx(deps.sys, tx, actor, ctx, approval, reversalId);
      deps.payments.post(tx, rev);
      deps.payments.markReversed(tx, p.id, {
        reversalId,
        companyId: p.companyId,
        branchId,
        at: now,
      });
      let outstanding: number | null = null;
      if (p.orderId && account) {
        let next: OrderAccount = applyReversal(account, p, now);
        if (order) {
          const after = balanceOf(order.totalVnd, next);
          outstanding = after.outstandingVnd;
          // a debt that was settled by the reversed payment is owed again
          if (after.outstandingVnd > 0 && next.debt?.status === 'settled') {
            deps.debts.update(tx, next.debt.id, {
              status: 'open',
              updatedAt: now,
              updatedBy: actor.userId,
            });
            next = { ...next, debt: { ...next.debt, status: 'open' } };
          }
        }
        deps.accounts.save(tx, next);
      }
      if (cash > 0)
        deps.cash.saveDrawer(
          tx,
          stageCash(deps, tx, m.drawer, {
            kind: 'reversal',
            direction: oppositeOf(p.direction),
            amountVnd: cash,
            shiftId: m.drawer.openShiftId!,
            date,
            paymentId: reversalId,
            documentNumber: rev.number,
            description: `Đảo ${p.number}: ${approval.reason}`.slice(0, 200),
            actorId: actor.userId,
            at: now,
          }),
        );
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId,
          entityType: 'payment',
          entityId: reversalId,
          action: 'payment.reverse',
          after: {
            number: rev.number,
            reverses: p.number,
            totalVnd: p.totalVnd,
            approval: approval.number,
            outstandingVnd: outstanding,
          },
          reason: approval.reason,
        }),
      );
      return { status: 201, body: { id: reversalId, number: rev.number, reverses: p.number } };
    },
  );
}
