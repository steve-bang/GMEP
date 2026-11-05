import { formatDate, formatDateTime, isoToVi } from '@/platform/format/date';
import { formatBp } from '@/platform/format/percent';
import { formatVnd } from '@/platform/format/vnd';
import { translate as tr } from '@/platform/i18n/messages';
import { splitTaxByItems } from '@/platform/money/splitTax';
import { resolveScope, type Actor } from '@/platform/rbac/rbac';
import type { PrintTotalRow, QuotePrintItem, QuotePrintModel } from '@/platform/print/types';
import type { RecDeps } from '../ports/deps';
import { getQuote, type QuoteDetailDto } from './quotes';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import { auditEntry, idemOf, notFound, parseInput, AppError, z, type RequestCtx } from './support';
import { versionId } from '../domain/entities';

/**
 * Quote print model (G2-PRT-01, FR-REC-008). The browser sheet and the PDF renderer both read this one object.
 * Prices come from the version snapshot in the DTO (never recomputed from today's price list); item prices include
 * their share of the tax and add up to the total (R1). Phone and address of the customer are never part of it (PDPL).
 */

const hoursText = (min: number): string =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(min / 60);

/** BA answer R28: the second and later printouts of a version carry "BẢN IN LẠI". */
export const isReprint = (priorPrints: number): boolean => priorPrints >= 1;

export interface QuotePrintContext {
  printedAt: Date;
  printedByName: string;
  /** printouts of this version already recorded (`quote.printed` audit entries) */
  priorPrints: number;
}

export function buildQuotePrintModel(q: QuoteDetailDto, ctx: QuotePrintContext): QuotePrintModel {
  const s = q.shown;
  const split = splitTaxByItems(s.items.map((i) => ({ no: i.no, lines: i.lines })));
  const gross = new Map(split.items.map((i) => [i.no, i.grossVnd]));
  const approval = s.approval;
  const items: QuotePrintItem[] = s.items.map((it) => {
    const decision = approval
      ? approval.approvedItemNos.includes(it.no)
        ? 'approved'
        : 'declined'
      : 'pending';
    return {
      no: it.no,
      heading: `${it.no}. ${it.name} (${tr(
        it.necessity === 'required' ? 'rec.print.necessityRequired' : 'rec.print.necessityOptional',
      )})`,
      decision,
      decisionLabel:
        decision === 'approved'
          ? tr('rec.quotes.itemApproved')
          : decision === 'declined'
            ? tr('rec.quotes.itemDeclined')
            : '',
      grossText: formatVnd(gross.get(it.no) ?? 0),
      lines: it.lines.map((l) => ({
        name: l.name,
        qtyText: l.kind === 'labor' ? hoursText(l.minutes ?? 0) : String(l.qty),
        unitText: formatVnd(l.unitVnd),
        amountText: formatVnd(l.amountVnd),
      })),
    };
  });
  const totals: PrintTotalRow[] = [
    { label: tr('rec.print.grand'), text: formatVnd(split.totalVnd), emphasis: true },
    {
      label: s.tax ? `${s.tax.name} ${formatBp(s.tax.rateBp)}` : tr('rec.print.taxLine'),
      text: formatVnd(split.taxVnd),
    },
    { label: tr('rec.print.subtotal'), text: formatVnd(split.netVnd) },
    ...(approval
      ? [{ label: tr('rec.quotes.approvedTotal'), text: formatVnd(approval.approvedTotalVnd) }]
      : []),
  ];
  const sentDate = s.sentAt ? ` · ${tr('rec.print.date')} ${formatDate(new Date(s.sentAt))}` : '';
  const valid = s.validUntil ? ` · ${tr('rec.print.validUntil')} ${isoToVi(s.validUntil)}` : '';
  return {
    kind: 'quote',
    paper: 'A4',
    version: s.n,
    fileName: `${q.number}-v${s.n}`,
    branchName: q.branchName,
    reprintLabel: isReprint(ctx.priorPrints) ? tr('rec.print.reprint') : null,
    title: tr('rec.print.title'),
    subtitle: `${tr('rec.print.number')} ${q.number}-v${s.n}${sentDate}${valid}`,
    info: [
      { label: tr('rec.print.plate'), value: q.plate, strong: true },
      { label: tr('rec.print.vehicle'), value: q.vehicleLabel },
      { label: tr('rec.print.customer'), value: q.customerName },
      { label: tr('rec.print.status'), value: tr(`rec.quotes.status_${s.status}`) },
    ],
    columns: {
      item: tr('rec.print.item'),
      qty: tr('rec.print.qty'),
      unit: tr('rec.print.unit'),
      amount: tr('rec.print.amount'),
    },
    agreeLabel: tr('rec.print.agree'),
    disagreeLabel: tr('rec.print.disagree'),
    items,
    totals,
    note: `${tr('rec.print.note')} ${tr('rec.print.priced', { date: isoToVi(s.pricedOn) })}`,
    evidence: approval ? `${tr('rec.quotes.approvalHash')}: ${approval.hash.slice(0, 16)}…` : null,
    signatures: [
      { label: tr('rec.print.customerSign'), hint: tr('rec.print.customerSignHint') },
      { label: tr('rec.print.advisorSign') },
    ],
    footer: {
      printedAt: tr('rec.print.printedAt', { time: formatDateTime(ctx.printedAt) }),
      printedBy: ctx.printedByName,
    },
    amounts: {
      totalVnd: split.totalVnd,
      taxVnd: split.taxVnd,
      netVnd: split.netVnd,
      approvedTotalVnd: approval ? approval.approvedTotalVnd : null,
    },
  };
}

const PRINT_LOG_WINDOW = 100;

/** `quote.printed` entries of one version, read from the audit trail (scope-limited; no extra collection or index). */
async function countPrints(deps: RecDeps, actor: Actor, id: string, n: number): Promise<number> {
  const scope = resolveScope(actor, 'quote:view');
  const page = await deps.sys.audit.list(
    scope,
    { entityType: 'quote', entityId: id },
    { limit: PRINT_LOG_WINDOW },
  );
  return page.items.filter((e) => e.action === 'quote.printed' && e.after?.n === n).length;
}

/**
 * Read side (GET, no side effect): the model of one version for the browser sheet and the PDF. Scope and permission
 * are those of viewing the quote (`quote:view`); a quote of another branch is "not found" (NFR-ISO-01).
 */
export async function getQuotePrintModel(
  deps: RecDeps,
  actor: Actor,
  id: string,
  n?: number,
): Promise<QuotePrintModel> {
  const q = await getQuote(deps, actor, id, n);
  const priorPrints = await countPrints(deps, actor, id, q.shown.n);
  return buildQuotePrintModel(q, {
    printedAt: deps.sys.clock.now(),
    printedByName: actor.displayName,
    priorPrints,
  });
}

export const recordQuotePrintSchema = z.object({ n: z.number().int().min(1).optional() });

/**
 * "Ghi nhận đã in" (BA answer, FR-REC-008): printing on paper is the event of handing the quote to the customer.
 * Appends `quote.printed` to the audit trail with the running count of the version, and sets `sentVia = print` when
 * the version has no delivery channel yet (`none`). A draft is not printed to a customer (409 `quote_not_sent`).
 * Idempotent on the Idempotency-Key: a retry never counts a second print.
 */
export async function recordQuotePrint(
  deps: RecDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'quote:view');
  const data = parseInput(recordQuotePrintSchema, input);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/rec/quotes/${id}/print-log`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ id, ...data }),
    },
    async (tx) => {
      // reads first: Firestore transactions allow no read after the first write
      const q = await deps.quotes.getInTx(tx, scope, id);
      if (!q) throw notFound();
      const n = data.n ?? q.currentN;
      const v = await deps.versions.getInTx(tx, scope, versionId(id, n));
      if (!v) throw notFound();
      if (!v.sentAt) throw new AppError('quote_not_sent', 409);
      const prior = await countPrints(deps, actor, id, n);
      const now = deps.sys.clock.now();
      const setVia = !v.sentVia || v.sentVia === 'none';
      if (setVia)
        deps.versions.update(tx, v.id, {
          sentVia: 'print',
          updatedAt: now,
          updatedBy: actor.userId,
          version: v.version + 1,
        });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: q.branchId,
          entityType: 'quote',
          entityId: id,
          action: 'quote.printed',
          before: setVia ? { n, sentVia: v.sentVia ?? 'none' } : null,
          after: {
            n,
            count: prior + 1,
            reprint: isReprint(prior),
            sentVia: setVia ? 'print' : v.sentVia,
          },
        }),
      );
      return { status: 200, body: { n, count: prior + 1, reprint: isReprint(prior) } };
    },
  );
}
