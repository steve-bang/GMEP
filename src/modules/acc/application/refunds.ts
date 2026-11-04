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
  applyCustomerRefund,
  emptyAccount,
  refundableVnd,
  validateLines,
  type Payment,
} from '../domain/payment';
import type { AccDeps } from '../ports/deps';
import {
  accPolicyOf,
  AppError,
  assertOrderNotInvoiced,
  assertWritable,
  auditEntry,
  idemOf,
  loadMoneyCtx,
  moneyBranch,
  notFound,
  parseInput,
  requireOpenShift,
  stageCash,
  validationFailed,
  z,
  type RequestCtx,
} from './support';

/**
 * Refund to the customer (FR-ACC-016, BR-ACC-11, RULE-010/011) [Đề xuất dev - chờ xác nhận: Kế toán khách].
 * Money received for an order goes back through a NEW payment voucher (kind expense, `customerRefund`) tied to the
 * order (RULE-007); the receipts are never touched. Two steps like a reversal: (1) `requestRefund` opens an approval
 * of kind `customer_refund` (always a manager, the owner above the limit; the requester can never decide it);
 * (2) after someone else approved it, `payApprovedRefund` consumes the approval ONCE and posts the voucher in the open
 * day and shift. The amount is re-checked at payment time against what the order can still give back.
 */
export const refundSchema = z.object({
  orderId: z.string().trim().min(1).max(128),
  amountVnd: z.number().int().min(1).max(1_000_000_000_000),
  method: z.enum(['cash', 'transfer']),
  reference: z.string().trim().max(80).optional(),
  reason: z.string().trim().min(5).max(300),
});
type RefundInput = z.infer<typeof refundSchema>;

async function judge(
  deps: AccDeps,
  tx: Parameters<AccDeps['accounts']['getInTx']>[0],
  actor: Actor,
  scope: Parameters<AccDeps['accounts']['getInTx']>[1],
  branchId: string,
  e: RefundInput,
) {
  const order = await deps.orders.getInTx(tx, scope, e.orderId);
  if (!order || order.branchId !== branchId) throw notFound();
  await assertOrderNotInvoiced(deps, scope, order.id);
  const account =
    (await deps.accounts.getInTx(tx, scope, order.id)) ??
    emptyAccount({ ...order, orderId: order.id, orderNumber: order.number });
  const date = businessDate(deps.sys.clock.now());
  const policy = await accPolicyOf(deps, actor.companyId, branchId, date);
  const errors = validateLines(
    [
      {
        method: e.method,
        amountVnd: e.amountVnd,
        ...(e.reference ? { reference: e.reference } : {}),
      },
    ],
    policy,
  );
  if (errors.length) throw validationFailed(errors);
  if (e.amountVnd > refundableVnd(order.totalVnd, account, order.cancelled))
    throw new AppError('refund_exceeds_received', 422);
  return { order, account, date };
}

export async function requestRefund(
  deps: AccDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'cash-expense:create');
  const branchId = moneyBranch(actor, scope);
  const data = parseInput(refundSchema, input);
  const { level, limits } = await approvalLevelFor(
    deps.sys,
    actor.companyId,
    'customer_refund',
    data.amountVnd,
  );
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: 'POST /api/v1/acc/refunds',
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf(data),
    },
    async (tx) => {
      const j = await judge(deps, tx, actor, scope, branchId, data);
      const branch = await assertWritable(deps, tx, actor, scope, branchId);
      // one open refund request per order; `level` is >= 1 (always needed)
      const req = await openApprovalInTx(deps.sys, tx, actor, ctx, {
        kind: 'customer_refund',
        level: level === 0 ? 1 : level,
        limits,
        branch,
        subjectType: 'order',
        subjectId: j.order.id,
        subjectLabel: j.order.number,
        valueVnd: data.amountVnd,
        reason: data.reason,
        payload: { ...data },
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

export const payRefundSchema = z.object({ approvalId: z.string().trim().min(1).max(128) });

export async function payApprovedRefund(
  deps: AccDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'cash-expense:create');
  const branchId = moneyBranch(actor, scope);
  const data = parseInput(payRefundSchema, input);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: 'POST /api/v1/acc/refunds/pay',
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf(data),
    },
    async (tx) => {
      const req = await loadApprovalForUse(deps.sys, tx, scope, {
        id: data.approvalId,
        kind: 'customer_refund',
        branchId,
      });
      const parsed = refundSchema.safeParse(req.payload);
      if (!parsed.success) throw new AppError('approval_payload_invalid', 409);
      const e = parsed.data;
      const j = await judge(deps, tx, actor, scope, branchId, e);
      const now = deps.sys.clock.now();
      const m = await loadMoneyCtx(deps, tx, scope, actor.companyId, branchId, j.date);
      const shiftId = requireOpenShift(m);
      const branch = await assertWritable(deps, tx, actor, scope, branchId);
      const paymentId = `pay_${deps.sys.newId()}`;
      const num = await allocateDocumentNumber(deps.sys, tx, {
        branch,
        docType: 'payment-voucher',
        businessDate: j.date,
        stage: 'post',
        documentId: paymentId,
        requestKey: `${ctx.idempotencyKey}:refund`,
      });
      const p: Payment = {
        id: paymentId,
        companyId: actor.companyId,
        branchId,
        number: num.number!,
        kind: 'expense',
        direction: 'out',
        orderId: j.order.id,
        orderNumber: j.order.number,
        customerId: j.order.customerId,
        customerName: j.order.customerName,
        lines: [
          {
            method: e.method,
            amountVnd: e.amountVnd,
            ...(e.reference ? { reference: e.reference } : {}),
          },
        ],
        totalVnd: e.amountVnd,
        applications: [],
        applicationVnd: 0,
        categoryCode: 'customer_refund',
        payee: j.order.customerName,
        description: `Hoàn tiền khách, lệnh ${j.order.number}: ${e.reason}`.slice(0, 300),
        customerRefund: true,
        // the repair order is the source document (RULE-007)
        sourceMissing: false,
        reason: e.reason,
        approvalId: req.id,
        shiftId,
        businessDate: j.date,
        createdAt: now,
        createdBy: actor.userId,
        createdByName: actor.displayName,
      };
      consumeApprovalInTx(deps.sys, tx, actor, ctx, req, paymentId);
      deps.payments.post(tx, p);
      deps.accounts.save(tx, applyCustomerRefund(j.account, e.amountVnd, now));
      if (e.method === 'cash')
        deps.cash.saveDrawer(
          tx,
          stageCash(deps, tx, m.drawer, {
            kind: 'expense',
            direction: 'out',
            amountVnd: e.amountVnd,
            shiftId,
            date: j.date,
            paymentId,
            documentNumber: p.number,
            description: `Hoàn tiền ${j.order.number}`.slice(0, 200),
            actorId: actor.userId,
            at: now,
          }),
        );
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId,
          entityType: 'payment',
          entityId: paymentId,
          action: 'payment.customer-refund',
          after: {
            number: p.number,
            order: j.order.number,
            totalVnd: e.amountVnd,
            method: e.method,
            approval: req.number,
          },
          reason: e.reason,
        }),
      );
      return { status: 201, body: { status: 'paid', id: paymentId, number: p.number } };
    },
  );
}
