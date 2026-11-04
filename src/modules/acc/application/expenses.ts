import { businessDate } from '@/platform/format/date';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import { resolveScope, type Actor } from '@/platform/rbac/rbac';
import type { ApprovalRequest } from '@/modules/sys';
import type { Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import {
  allocateDocumentNumber,
  approvalLevelFor,
  consumeApprovalInTx,
  loadApprovalForUse,
  openApprovalInTx,
  resolveCatalogAt,
} from '@/modules/sys';
import {
  applyRefund,
  depositHeld,
  emptyAccount,
  validateLines,
  type Payment,
} from '../domain/payment';
import type { AccDeps } from '../ports/deps';
import {
  accPolicyOf,
  AppError,
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
 * Expense vouchers (phiếu chi, FR-ACC-003, RULE-011, RULE-007). Spend over the limit of the effective-dated
 * `approval-limit` needs approval BEFORE the money moves: the proposal is an approval request carrying the whole
 * voucher, and a person with the cash right pays it once it is approved (the approval is consumed exactly once).
 * A voucher without a source document is allowed but flagged and listed at day close (G4-ACC-04). A deposit
 * refund is an expense that points at the deposit it returns (FR-ACC-002).
 */

export const expenseSchema = z.object({
  categoryCode: z.string().regex(/^[a-z][a-z0-9_-]{0,29}$/),
  amountVnd: z.number().int().min(1).max(1_000_000_000_000),
  method: z.enum(['cash', 'transfer']),
  reference: z.string().trim().max(80).optional(),
  payee: z.string().trim().min(2).max(120),
  description: z.string().trim().min(5).max(300),
  /** invoice number, request code or any reference to the source document */
  sourceRef: z.string().trim().max(80).optional(),
  orderId: z.string().trim().min(1).max(128).optional(),
  depositId: z.string().trim().min(1).max(128).optional(),
});
type ExpenseInput = z.infer<typeof expenseSchema>;

export async function expenseCategories(
  deps: AccDeps,
  companyId: string,
  date: string,
): Promise<{ code: string; name: string; depositRefund: boolean }[]> {
  const rows = await resolveCatalogAt(deps.sys, { companyId, type: 'expense-category', date });
  return rows
    .filter((r) => r.payload.status === 'active')
    .map((r) => ({
      code: r.code,
      name: String(r.payload.name),
      depositRefund: r.payload.depositRefund === true,
    }));
}

/** Posts the voucher inside the caller's transaction. Reads first, then the writes. */
async function postExpense(
  deps: AccDeps,
  tx: Tx,
  actor: Actor,
  scope: Scope,
  branchId: string,
  ctx: RequestCtx & { idempotencyKey: string },
  e: ExpenseInput,
  approval: ApprovalRequest | null,
  paymentId: string,
) {
  const now = deps.sys.clock.now();
  const date = businessDate(now);
  const cats = await expenseCategories(deps, actor.companyId, date);
  const cat = cats.find((c) => c.code === e.categoryCode);
  if (!cat) throw new AppError('expense_category_unknown', 422);
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
  const m = await loadMoneyCtx(deps, tx, scope, actor.companyId, branchId, date);
  const shiftId = requireOpenShift(m);
  const branch = await assertWritable(deps, tx, actor, scope, branchId);
  let orderNumber: string | null = null;
  let customerId: string | null = null;
  let customerName: string | null = null;
  let account = null as ReturnType<typeof emptyAccount> | null;
  if (e.orderId) {
    const order = await deps.orders.getInTx(tx, scope, e.orderId);
    if (!order || order.branchId !== branchId) throw notFound();
    orderNumber = order.number;
    customerId = order.customerId;
    customerName = order.customerName;
    account =
      (await deps.accounts.getInTx(tx, scope, order.id)) ??
      emptyAccount({ ...order, orderId: order.id, orderNumber: order.number });
  }
  if (cat.depositRefund && !(e.depositId && account)) throw new AppError('deposit_required', 422);
  if (e.depositId) {
    if (!cat.depositRefund) throw new AppError('deposit_category_required', 422);
    const dep = account!.deposits.find((d) => d.id === e.depositId);
    if (!dep) throw notFound();
    if (e.amountVnd > depositHeld(dep)) throw new AppError('refund_exceeds_deposit', 422);
  }
  const num = await allocateDocumentNumber(deps.sys, tx, {
    branch,
    docType: 'payment-voucher',
    businessDate: date,
    stage: 'post',
    documentId: paymentId,
    requestKey: `${ctx.idempotencyKey}:exp`,
  });
  const p: Payment = {
    id: paymentId,
    companyId: actor.companyId,
    branchId,
    number: num.number!,
    kind: 'expense',
    direction: 'out',
    orderId: e.orderId ?? null,
    orderNumber,
    customerId,
    customerName,
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
    categoryCode: e.categoryCode,
    payee: e.payee,
    description: e.description,
    ...(e.sourceRef ? { sourceRef: e.sourceRef } : {}),
    sourceMissing: !e.sourceRef && !e.depositId,
    ...(e.depositId ? { depositId: e.depositId } : {}),
    ...(approval ? { approvalId: approval.id } : {}),
    shiftId,
    businessDate: date,
    createdAt: now,
    createdBy: actor.userId,
    createdByName: actor.displayName,
  };
  if (approval) consumeApprovalInTx(deps.sys, tx, actor, ctx, approval, paymentId);
  deps.payments.post(tx, p);
  if (e.depositId && account)
    deps.accounts.save(tx, applyRefund(account, e.depositId, e.amountVnd, now));
  if (e.method === 'cash')
    deps.cash.saveDrawer(
      tx,
      stageCash(deps, tx, m.drawer, {
        kind: 'expense',
        direction: 'out',
        amountVnd: e.amountVnd,
        shiftId,
        date,
        paymentId,
        documentNumber: p.number,
        description: `${e.payee}: ${e.description}`.slice(0, 200),
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
      action: 'payment.expense',
      after: {
        number: p.number,
        category: e.categoryCode,
        totalVnd: e.amountVnd,
        method: e.method,
        approval: approval?.number ?? null,
        sourceMissing: p.sourceMissing,
      },
    }),
  );
  return {
    status: 201,
    body: {
      status: 'paid',
      id: paymentId,
      number: p.number,
      sourceMissing: p.sourceMissing === true,
    },
  };
}

/**
 * Creates the voucher. Within the limit it is paid at once; over the limit (or any amount if the limit is zero) it
 * becomes an approval request and answers 202 with the request, nothing moves yet.
 */
export async function createExpense(
  deps: AccDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'cash-expense:create');
  const branchId = moneyBranch(actor, scope);
  const data = parseInput(expenseSchema, input);
  const { level, limits } = await approvalLevelFor(
    deps.sys,
    actor.companyId,
    'expense',
    data.amountVnd,
  );
  const key = ctx.idempotencyKey;
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: 'POST /api/v1/acc/expenses',
      key,
      fingerprint: fingerprintOf(data),
    },
    async (tx) => {
      if (level === 0)
        return postExpense(
          deps,
          tx,
          actor,
          scope,
          branchId,
          ctx,
          data,
          null,
          `pay_${deps.sys.newId()}`,
        );
      // validate what can be validated now so the approver is not asked about an impossible voucher
      const date = businessDate(deps.sys.clock.now());
      const cats = await expenseCategories(deps, actor.companyId, date);
      if (!cats.some((c) => c.code === data.categoryCode))
        throw new AppError('expense_category_unknown', 422);
      const branch = await assertWritable(deps, tx, actor, scope, branchId);
      const req = await openApprovalInTx(deps.sys, tx, actor, ctx, {
        kind: 'expense',
        level,
        limits,
        branch,
        subjectType: 'expense',
        subjectId: `exp_${key}`,
        subjectLabel: `${data.payee}`.slice(0, 60),
        valueVnd: data.amountVnd,
        reason: data.description,
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

export const payApprovedSchema = z.object({ approvalId: z.string().trim().min(1).max(128) });

/** Pays an approved expense proposal. The approval is consumed in the same transaction (once). */
export async function payApprovedExpense(
  deps: AccDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'cash-expense:create');
  const branchId = moneyBranch(actor, scope);
  const data = parseInput(payApprovedSchema, input);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: 'POST /api/v1/acc/expenses/pay',
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf(data),
    },
    async (tx) => {
      const paymentId = `pay_${deps.sys.newId()}`;
      const req = await loadApprovalForUse(deps.sys, tx, scope, {
        id: data.approvalId,
        kind: 'expense',
        branchId,
      });
      const parsed = expenseSchema.safeParse(req.payload);
      if (!parsed.success) throw new AppError('approval_payload_invalid', 409);
      return postExpense(deps, tx, actor, scope, branchId, ctx, parsed.data, req, paymentId);
    },
  );
}
