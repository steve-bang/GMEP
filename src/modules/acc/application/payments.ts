import { businessDate } from '@/platform/format/date';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import { hasPermission, resolveScope, type Actor } from '@/platform/rbac/rbac';
import type { Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import { allocateDocumentNumber, findActiveApprovalFor, type ApprovalDto } from '@/modules/sys';
import { dayWindow } from '../domain/cash';
import {
  applyDeposit,
  applyReceipt,
  balanceOf,
  cashOf,
  depositHeld,
  emptyAccount,
  MAX_LINES,
  PAYMENT_METHODS,
  planDepositApplication,
  sumLines,
  validateLines,
  type DebtSnapshot,
  type OrderAccount,
  type OrderBalance,
  type Payment,
  type PaymentLine,
} from '../domain/payment';
import type { AccDeps } from '../ports/deps';
import type { PayableOrder } from '../ports/ports';
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
 * Receipts and deposits (FR-ACC-001, FR-ACC-002; RULE-007, RULE-010; R44). A payment always hangs on a repair order.
 * One receipt may carry several payment methods and settle part of the order with deposits already held. Everything
 * of one collection (payment, order account, cash book, debt settlement, number, audit) commits in ONE transaction;
 * a repeated Idempotency-Key returns the first result. QR and e-wallet are recorded by hand: no gateway exists.
 */

const line = z.object({
  method: z.enum(PAYMENT_METHODS),
  amountVnd: z.number().int().min(1).max(1_000_000_000_000),
  reference: z.string().trim().max(80).optional(),
});

export const collectSchema = z.object({
  kind: z.enum(['receipt', 'deposit']),
  lines: z.array(line).max(MAX_LINES).default([]),
  /** receipt: settle with the deposits held, oldest first */
  applyDeposits: z.boolean().default(true),
  /** cash handed over by the customer; the difference is change, not a receipt */
  cashTenderedVnd: z.number().int().min(0).max(1_000_000_000_000).optional(),
  note: z.string().trim().max(300).optional(),
});

/** What REC (handover) and the screens read: the order's balance. Never trusts a figure from the browser. */
export interface OrderBalanceDto extends OrderBalance {
  orderId: string;
  orderNumber: string;
}

/** Inside the caller's transaction (R44: the handover calls this in the same transaction as the handover record). */
export async function getOrderBalanceInTx(
  deps: AccDeps,
  tx: Tx,
  scope: Scope,
  orderId: string,
): Promise<OrderBalanceDto> {
  const order = await deps.orders.getInTx(tx, scope, orderId);
  if (!order) throw notFound();
  const account = await deps.accounts.getInTx(tx, scope, orderId);
  return toBalanceDto(order, account);
}

function toBalanceDto(order: PayableOrder, account: OrderAccount | null): OrderBalanceDto {
  const a = account ?? emptyAccount({ ...order, orderId: order.id, orderNumber: order.number });
  return { orderId: order.id, orderNumber: order.number, ...balanceOf(order.totalVnd, a) };
}

export async function collectPayment(
  deps: AccDeps,
  actor: Actor,
  orderId: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'payment:create');
  const branchId = moneyBranch(actor, scope);
  const data = parseInput(collectSchema, input);
  const now0 = deps.sys.clock.now();
  const policy = await accPolicyOf(deps, actor.tenantId, branchId, businessDate(now0));
  const errors = validateLines(data.lines, policy, {
    allowEmpty: data.kind === 'receipt' && data.applyDeposits,
  });
  if (data.cashTenderedVnd !== undefined && data.cashTenderedVnd < cashOf(data.lines))
    errors.push({
      field: 'cashTenderedVnd',
      message: 'Tiền khách đưa nhỏ hơn số thu bằng tiền mặt.',
    });
  if (errors.length) throw validationFailed(errors);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/acc/orders/${orderId}/payments`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ orderId, ...data }),
    },
    async (tx) => {
      const now = deps.sys.clock.now();
      const date = businessDate(now);
      const order = await deps.orders.getInTx(tx, scope, orderId);
      if (!order || order.branchId !== branchId) throw notFound();
      const [account0, m] = await Promise.all([
        deps.accounts.getInTx(tx, scope, orderId),
        loadMoneyCtx(deps, tx, scope, actor.tenantId, branchId, date),
      ]);
      const branch = await assertWritable(deps, tx, actor, scope, branchId);
      if (order.cancelled) throw new AppError('order_cancelled', 409);
      if (data.kind === 'deposit' && !order.open) throw new AppError('order_closed', 409);
      if (data.kind === 'receipt' && policy.receiptRequiresQc && !order.qcPassed)
        throw new AppError('qc_required', 409);
      const shiftId = requireOpenShift(m);
      const account =
        account0 ?? emptyAccount({ ...order, orderId: order.id, orderNumber: order.number });
      const bal = balanceOf(order.totalVnd, account);
      const lineTotal = sumLines(data.lines);
      const applications =
        data.kind === 'receipt' && data.applyDeposits
          ? planDepositApplication(account.deposits, bal.outstandingVnd)
          : [];
      const applied = applications.reduce((s, x) => s + x.amountVnd, 0);
      if (data.kind === 'receipt') {
        if (lineTotal + applied <= 0) throw new AppError('nothing_to_collect', 422);
        if (lineTotal + applied > bal.outstandingVnd)
          throw new AppError('overpayment', 422, [
            { field: 'lines', message: `Số thu vượt số còn nợ (${bal.outstandingVnd}).` },
          ]);
      } else {
        // a deposit is taken in advance: it may not exceed what the order is worth minus what is already paid or held
        const room = Math.max(0, bal.receivableVnd - bal.receivedVnd - bal.depositHeldVnd);
        if (lineTotal > room) throw new AppError('deposit_exceeds', 422);
        if (account.deposits.length >= deps.acc.maxDepositsPerOrder)
          throw new AppError('too_many_deposits', 422);
      }
      const id = `pay_${deps.sys.newId()}`;
      const num = await allocateDocumentNumber(deps.sys, tx, {
        branch,
        docType: 'receipt-voucher',
        businessDate: date,
        stage: 'post',
        documentId: id,
        requestKey: `${ctx.idempotencyKey}:pay`,
      });
      const cash = cashOf(data.lines);
      const p: Payment = {
        id,
        tenantId: actor.tenantId,
        branchId,
        number: num.number!,
        kind: data.kind,
        direction: 'in',
        orderId: order.id,
        orderNumber: order.number,
        customerId: order.customerId,
        customerName: order.customerName,
        lines: data.lines.map((l) => ({
          method: l.method,
          amountVnd: l.amountVnd,
          ...(l.reference ? { reference: l.reference } : {}),
        })),
        totalVnd: lineTotal,
        applications,
        applicationVnd: applied,
        ...(data.cashTenderedVnd !== undefined && cash > 0
          ? { cashTenderedVnd: data.cashTenderedVnd, changeVnd: data.cashTenderedVnd - cash }
          : {}),
        ...(data.note ? { note: data.note } : {}),
        shiftId,
        businessDate: date,
        createdAt: now,
        createdBy: actor.userId,
        createdByName: actor.displayName,
      };
      deps.payments.post(tx, p);
      let next: OrderAccount =
        data.kind === 'deposit'
          ? applyDeposit(account, { id, number: p.number, totalVnd: lineTotal }, now)
          : applyReceipt(account, p, now);
      // paying the order in full settles an approved debt (FR-ACC-006)
      const after = balanceOf(order.totalVnd, next);
      if (after.outstandingVnd === 0 && next.debt && next.debt.status === 'open') {
        deps.debts.update(tx, next.debt.id, {
          status: 'settled',
          settledAt: now,
          updatedAt: now,
          updatedBy: actor.userId,
        });
        next = { ...next, debt: { ...next.debt, status: 'settled' } satisfies DebtSnapshot };
      }
      deps.accounts.save(tx, next);
      if (cash > 0)
        deps.cash.saveDrawer(
          tx,
          stageCash(deps, tx, m.drawer, {
            kind: 'receipt',
            direction: 'in',
            amountVnd: cash,
            shiftId,
            date,
            paymentId: id,
            documentNumber: p.number,
            description: `${data.kind === 'deposit' ? 'Cọc' : 'Thu'} lệnh ${order.number}`,
            actorId: actor.userId,
            at: now,
          }),
        );
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId,
          entityType: 'payment',
          entityId: id,
          action: data.kind === 'deposit' ? 'payment.deposit' : 'payment.receipt',
          after: {
            number: p.number,
            order: order.number,
            totalVnd: lineTotal,
            applicationVnd: applied,
            methods: data.lines.map((l) => l.method),
            outstandingVnd: after.outstandingVnd,
          },
        }),
      );
      return {
        status: 201,
        body: {
          id,
          number: p.number,
          kind: p.kind,
          totalVnd: lineTotal,
          applicationVnd: applied,
          changeVnd: p.changeVnd ?? 0,
          outstandingVnd: after.outstandingVnd,
          depositHeldVnd: after.depositHeldVnd,
        },
      };
    },
  );
}

// ---- reading -----------------------------------------------------------------------------------------

export interface PaymentDto {
  id: string;
  number: string;
  kind: Payment['kind'];
  direction: Payment['direction'];
  orderId: string | null;
  orderNumber: string | null;
  customerName: string | null;
  lines: PaymentLine[];
  totalVnd: number;
  applications: Payment['applications'];
  applicationVnd: number;
  cashTenderedVnd: number | null;
  changeVnd: number | null;
  note: string | null;
  categoryCode: string | null;
  payee: string | null;
  description: string | null;
  sourceRef: string | null;
  sourceMissing: boolean;
  depositId: string | null;
  reversesId: string | null;
  reversesNumber: string | null;
  reason: string | null;
  businessDate: string;
  createdAt: string;
  createdByName: string;
  /** the id of the reversal entry, when this payment was reversed */
  reversedBy: string | null;
  /** deposit: how much is still held */
  depositHeldVnd: number | null;
}

export function toPaymentDto(
  p: Payment,
  reversedBy: string | null,
  account?: OrderAccount | null,
): PaymentDto {
  const dep = p.kind === 'deposit' ? account?.deposits.find((d) => d.id === p.id) : undefined;
  return {
    id: p.id,
    number: p.number,
    kind: p.kind,
    direction: p.direction,
    orderId: p.orderId,
    orderNumber: p.orderNumber,
    customerName: p.customerName,
    lines: p.lines,
    totalVnd: p.totalVnd,
    applications: p.applications,
    applicationVnd: p.applicationVnd,
    cashTenderedVnd: p.cashTenderedVnd ?? null,
    changeVnd: p.changeVnd ?? null,
    note: p.note ?? null,
    categoryCode: p.categoryCode ?? null,
    payee: p.payee ?? null,
    description: p.description ?? null,
    sourceRef: p.sourceRef ?? null,
    sourceMissing: p.sourceMissing === true,
    depositId: p.depositId ?? null,
    reversesId: p.reversesId ?? null,
    reversesNumber: p.reversesNumber ?? null,
    reason: p.reason ?? null,
    businessDate: p.businessDate,
    createdAt: p.createdAt.toISOString(),
    createdByName: p.createdByName,
    reversedBy,
    depositHeldVnd: dep ? depositHeld(dep) : null,
  };
}

export interface OrderMoneyDto {
  balance: OrderBalanceDto;
  order: {
    id: string;
    number: string;
    status: string;
    qcPassed: boolean;
    customerName: string;
    plate: string;
  };
  payments: PaymentDto[];
  /** pending or approved-not-used debt request of the order */
  debtApproval: ApprovalDto | null;
  /** a cash shift is open on the counter of the order's branch (receipts need one) */
  shiftOpen: boolean;
  actions: Record<'collect' | 'deposit' | 'requestDebt', { allowed: boolean; reasonCode?: string }>;
}

/** The order's money page (G4-ACC-01): balance, payments with reversal marks, what the user may do. */
export async function getOrderMoney(
  deps: AccDeps,
  actor: Actor,
  orderId: string,
): Promise<OrderMoneyDto> {
  const scope = resolveScope(actor, 'order-balance:view');
  const order = await deps.orders.get(scope, orderId);
  if (!order) throw notFound();
  const account = await deps.accounts.get(scope, orderId);
  const canList = hasPermission(actor, 'payment:view');
  const rows = canList
    ? await deps.payments.listByOrder(scope, orderId, deps.acc.maxPaymentsPerOrder)
    : [];
  const reversed = await deps.payments.reversalsOf(rows.map((r) => r.id));
  const balance = toBalanceDto(order, account);
  const policy = await accPolicyOf(
    deps,
    order.tenantId,
    order.branchId,
    businessDate(deps.sys.clock.now()),
  );
  const drawer = await deps.cash.getDrawer(scope, order.branchId);
  const mayCollect = hasPermission(actor, 'payment:create');
  const why = (ok: boolean, code: string) =>
    ok ? { allowed: true } : { allowed: false, reasonCode: code };
  const debtApproval = hasPermission(actor, 'approval:view')
    ? await findActiveApprovalFor(deps.sys, actor, {
        kind: 'debt_handover',
        subjectId: orderId,
        branchId: order.branchId,
      }).catch(() => null)
    : null;
  return {
    balance,
    order: {
      id: order.id,
      number: order.number,
      status: order.status,
      qcPassed: order.qcPassed,
      customerName: order.customerName,
      plate: order.plate,
    },
    payments: rows.map((p) => toPaymentDto(p, reversed.get(p.id) ?? null, account)),
    debtApproval,
    shiftOpen: !!drawer?.openShiftId,
    actions: {
      collect: !mayCollect
        ? { allowed: false, reasonCode: 'no_permission' }
        : order.cancelled
          ? { allowed: false, reasonCode: 'order_cancelled' }
          : policy.receiptRequiresQc && !order.qcPassed
            ? { allowed: false, reasonCode: 'qc_required' }
            : why(balance.outstandingVnd > 0 || balance.depositHeldVnd > 0, 'nothing_to_collect'),
      deposit: !mayCollect
        ? { allowed: false, reasonCode: 'no_permission' }
        : why(order.open, 'order_closed'),
      requestDebt: !hasPermission(actor, 'debt:create')
        ? { allowed: false, reasonCode: 'no_permission' }
        : order.cancelled || !order.qcPassed
          ? { allowed: false, reasonCode: 'qc_required' }
          : why(balance.outstandingVnd > 0 && !balance.debt, 'nothing_to_collect'),
    },
  };
}

export async function getPayment(deps: AccDeps, actor: Actor, id: string): Promise<PaymentDto> {
  const scope = resolveScope(actor, 'payment:view');
  const p = await deps.payments.get(scope, id);
  if (!p) throw notFound();
  const [rev, acc] = await Promise.all([
    deps.payments.reversalsOf([id]),
    p.orderId ? deps.accounts.get(scope, p.orderId) : Promise.resolve(null),
  ]);
  return toPaymentDto(p, rev.get(id) ?? null, acc);
}

export interface PaymentListQuery {
  from?: string;
  to?: string;
  kind?: Payment['kind'];
  method?: Payment['lines'][number]['method'];
}

/** Payments of the working branch in a date window, newest first (G4-ACC-02). Reversals show as their own rows. */
export async function listPayments(
  deps: AccDeps,
  actor: Actor,
  q: PaymentListQuery,
): Promise<{ items: PaymentDto[]; netVnd: number; cashVnd: number; otherVnd: number }> {
  const scope = resolveScope(actor, 'payment:view');
  const branchId = moneyBranch(actor, scope);
  const today = businessDate(deps.sys.clock.now());
  const from = q.from ?? today;
  const to = q.to ?? from;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from)
    throw validationFailed([{ field: 'from', message: 'Khoảng ngày không hợp lệ.' }]);
  const window = { from: dayWindow(from).from, to: dayWindow(to).to };
  let rows = await deps.payments.listByBranch(scope, branchId, window, deps.acc.listMax);
  if (q.kind) rows = rows.filter((r) => r.kind === q.kind);
  if (q.method) rows = rows.filter((r) => r.lines.some((l) => l.method === q.method));
  const reversed = await deps.payments.reversalsOf(rows.map((r) => r.id));
  // net inflow: receipts and deposits count, their reversals subtract; expenses are outflow
  let cashVnd = 0;
  let otherVnd = 0;
  for (const r of rows) {
    if (r.kind === 'expense' || r.reversesKind === 'expense') continue;
    const sign = r.direction === 'in' ? 1 : -1;
    for (const l of r.lines) {
      if (l.method === 'cash') cashVnd += sign * l.amountVnd;
      else otherVnd += sign * l.amountVnd;
    }
  }
  return {
    items: rows.map((p) => toPaymentDto(p, reversed.get(p.id) ?? null)),
    netVnd: cashVnd + otherVnd,
    cashVnd,
    otherVnd,
  };
}
