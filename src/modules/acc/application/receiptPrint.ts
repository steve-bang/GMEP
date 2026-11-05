import { formatDateTime, isoToVi } from '@/platform/format/date';
import { formatVnd } from '@/platform/format/vnd';
import { translate as tr } from '@/platform/i18n/messages';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import { resolveScope, type Actor } from '@/platform/rbac/rbac';
import type { PrintLabelValue, PrintTotalRow, ReceiptPrintModel } from '@/platform/print/types';
import type { AccDeps } from '../ports/deps';
import type { PaymentDto } from './payments';
import { toPaymentDto } from './payments';
import { auditEntry, idemOf, notFound, type RequestCtx } from './support';

/**
 * Cash receipt print model (G4-ACC-03, FR-ACC-001, FR-REC-008 print rules). One object feeds the browser sheet and the
 * PDF. Format: A5 "bản lưu" is the design default; the `doc-template` configuration (kind `receipt`) is metadata only
 * today, so the paper is not read from it yet `[Cần xác nhận: khổ và mẫu phiếu thu theo chi nhánh]`.
 * Printing never changes the payment (RULE-010): the print is an audit entry only.
 */
export const isReceiptReprint = (priorPrints: number): boolean => priorPrints >= 1;

export interface ReceiptPrintContext {
  printedAt: Date;
  printedByName: string;
  branchName: string;
  priorPrints: number;
}

export function buildReceiptPrintModel(p: PaymentDto, ctx: ReceiptPrintContext): ReceiptPrintModel {
  const info: PrintLabelValue[] = [];
  if (p.customerName) info.push({ label: tr('acc.print.payer'), value: p.customerName });
  if (p.payee) info.push({ label: tr('acc.payment.payee'), value: p.payee });
  if (p.orderNumber)
    info.push({ label: tr('acc.payment.order'), value: p.orderNumber, strong: true });
  if (p.reversesNumber)
    info.push({ label: tr('acc.payment.reverses'), value: p.reversesNumber, strong: true });
  const why = p.description ?? p.reason ?? p.note;
  if (why) info.push({ label: tr('acc.print.reason'), value: why });
  info.push({ label: tr('acc.payment.at'), value: formatDateTime(new Date(p.createdAt)) });

  const totals: PrintTotalRow[] = [
    { label: tr('acc.payment.total'), text: formatVnd(p.totalVnd), emphasis: true },
  ];
  if (p.applicationVnd > 0)
    totals.push({ label: tr('acc.payment.applied'), text: formatVnd(p.applicationVnd) });
  if (p.cashTenderedVnd !== null) {
    totals.push({ label: tr('acc.print.tendered'), text: formatVnd(p.cashTenderedVnd) });
    totals.push({ label: tr('acc.print.change'), text: formatVnd(p.changeVnd ?? 0) });
  }
  return {
    kind: 'receipt',
    paper: 'A5',
    fileName: p.number,
    branchName: ctx.branchName,
    reprintLabel: isReceiptReprint(ctx.priorPrints) ? tr('acc.print.reprint') : null,
    title: tr(`acc.print.title_${p.kind}`),
    subtitle: `${tr('acc.print.number')} ${p.number} · ${tr('acc.print.date')} ${isoToVi(p.businessDate)}`,
    info,
    linesHeading: tr('acc.payment.lines'),
    lines: p.lines.map((x) => ({
      method: tr(`acc.common.method_${x.method}`),
      reference: x.reference ?? null,
      amountText: formatVnd(x.amountVnd),
    })),
    totals,
    note: tr('acc.print.note'),
    signatures: [
      { label: tr('acc.print.payerSign'), hint: tr('acc.print.payerSignHint') },
      { label: tr('acc.print.cashier'), hint: p.createdByName },
    ],
    footer: {
      printedAt: tr('rec.print.printedAt', { time: formatDateTime(ctx.printedAt) }),
      printedBy: ctx.printedByName,
    },
    amounts: { totalVnd: p.totalVnd, appliedVnd: p.applicationVnd },
  };
}

const PRINT_LOG_WINDOW = 100;

async function countPrints(deps: AccDeps, actor: Actor, id: string): Promise<number> {
  const scope = resolveScope(actor, 'payment:view');
  const page = await deps.sys.audit.list(
    scope,
    { entityType: 'payment', entityId: id },
    { limit: PRINT_LOG_WINDOW },
  );
  return page.items.filter((e) => e.action === 'payment.printed').length;
}

/** Read side (GET, no side effect): scope and permission of viewing the payment; another branch = 404 (NFR-ISO-01). */
export async function getReceiptPrintModel(
  deps: AccDeps,
  actor: Actor,
  id: string,
): Promise<ReceiptPrintModel> {
  const scope = resolveScope(actor, 'payment:view');
  const p = await deps.payments.get(scope, id);
  if (!p) throw notFound();
  const [rev, acc, branch, priorPrints] = await Promise.all([
    deps.payments.reversalsOf([id]),
    p.orderId ? deps.accounts.get(scope, p.orderId) : Promise.resolve(null),
    deps.sys.branches.get(scope, p.branchId),
    countPrints(deps, actor, id),
  ]);
  return buildReceiptPrintModel(toPaymentDto(p, rev.get(id) ?? null, acc), {
    printedAt: deps.sys.clock.now(),
    printedByName: actor.displayName,
    branchName: branch?.name ?? '',
    priorPrints,
  });
}

/**
 * "Ghi nhận đã in" for a receipt: an audit entry `payment.printed` with the running count; the posted payment is not
 * touched (RULE-010). Idempotent on the Idempotency-Key.
 */
export async function recordReceiptPrint(
  deps: AccDeps,
  actor: Actor,
  id: string,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'payment:view');
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/acc/payments/${id}/print-log`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ id }),
    },
    async (tx) => {
      const p = await deps.payments.getInTx(tx, scope, id);
      if (!p) throw notFound();
      const prior = await countPrints(deps, actor, id);
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: p.branchId,
          entityType: 'payment',
          entityId: id,
          action: 'payment.printed',
          after: { number: p.number, count: prior + 1, reprint: isReceiptReprint(prior) },
        }),
      );
      return { status: 200, body: { count: prior + 1, reprint: isReceiptReprint(prior) } };
    },
  );
}
