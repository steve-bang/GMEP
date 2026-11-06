import { businessDate } from '@/platform/format/date';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import {
  decodeCursor,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  type Page,
} from '@/platform/pagination/pagination';
import { hasPermission, resolveScope, resolveWorkingScope, type Actor } from '@/platform/rbac/rbac';
import { getAvailability } from '@/modules/inv';
import { normalizePlate, relateToWorkingBranch } from '@/modules/crm';
import { allocateDocumentNumber, approvedChangesBetween } from '@/modules/sys';
import {
  versionId,
  type Quote,
  type QuoteItem,
  type QuoteStatus,
  type QuoteVersion,
  type SentVia,
} from '../domain/entities';
import { computeTotals } from '../domain/pricing';
import {
  allowedQuoteActions,
  editMode,
  effectiveQuoteStatus,
  isQuoteExpired,
  transitionQuote,
} from '../domain/quoteState';
import type { RecDeps } from '../ports/deps';
import { assertSupplementOrderOpen } from './supplement';
import { approvalPolicyOf, toApprovalDto, type ApprovalPolicy } from './approval';
import { buildItems, itemInput } from './quoteBuild';
import {
  addDays,
  assertWritable,
  auditEntry,
  idemOf,
  notFound,
  parseInput,
  requireWorkingBranch,
  versionConflict,
  AppError,
  z,
  type RequestCtx,
} from './support';

/**
 * Quote (báo giá, G2-QUO-01..03; FR-REC-004, 005, 007; RULE-005/006/007). The quote is its own object
 * with its own states; it is versioned (an edit after it was sent becomes the next version) and
 * keeps the prices and the tax rate it was priced with. No stock is held here: a hold exists only
 * from the customer's approval, on the order line (ba-answers-for-dev §16.2.1 row 1).
 */
export interface QuoteDto {
  id: string;
  number: string;
  intakeId: string;
  vehicleId: string;
  customerId: string;
  plate: string;
  vehicleLabel: string;
  customerName: string;
  advisorId: string;
  currentN: number;
  status: QuoteStatus;
  validUntil: string | null;
  /** total of the current version including tax */
  totalVnd: number;
  /** FR-REC-009: tax-inclusive total of the approved items; null until approved */
  approvedTotalVnd: number | null;
  /** R37: the repair order opened by the approval; null on an approved quote = "đã duyệt, chưa có lệnh" */
  orderId: string | null;
  /** set on a supplementary quote: the order it extends */
  supplementOfOrderId: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface QuoteLineDto {
  lineNo: number;
  kind: 'labor' | 'part';
  code: string;
  name: string;
  /** hours as minutes for labor, quantity for parts */
  minutes: number | null;
  standardMinutes: number | null;
  /** R5: labor lines only; "khác giờ chuẩn" and the gap (minutes, basis points of the standard) */
  differsFromStandard: boolean | null;
  minutesDelta: number | null;
  minutesDeltaBp: number | null;
  qty: number | null;
  qtyScale: number | null;
  serviceId: string | null;
  partId: string | null;
  listUnitVnd: number;
  unitVnd: number;
  discountBp: number;
  amountVnd: number;
  taxRateBp: number;
  /** R2: the tax-rate key and version this line was priced with */
  taxKey: string;
  taxVersionId: string;
  /** FR-REC-006 (own branch only): the AVAILABLE quantity, never on-hand or reserved (BA-04 Câu 6) */
  available: number | null;
}

export interface QuoteItemDto extends Omit<QuoteItem, 'lines'> {
  lines: QuoteLineDto[];
}

export interface VersionSummaryDto {
  n: number;
  status: QuoteStatus;
  totalVnd: number;
  sentAt: string | null;
  replacedByN: number | null;
}

/** R2: validity runs past a known change of a tax rate the quote used; shown to the advisor, never blocks. */
export interface QuoteWarning {
  code: 'tax_change_within_validity';
  taxKey: string;
  validUntil: string;
  effectiveFrom: string;
  newRateBp: number | null;
}

export interface VersionDto {
  n: number;
  /** R10: derived: a sent version past its validity reads "expired" */
  status: QuoteStatus;
  /** the stored status, for diagnostics */
  storedStatus: QuoteStatus;
  items: QuoteItemDto[];
  totals: QuoteVersion['totals'];
  taxes: QuoteVersion['taxes'];
  /** the tax when there is exactly one rate in the quote (display convenience) */
  tax: QuoteVersion['taxes'][number] | null;
  warnings: QuoteWarning[];
  /** R10: how the customer was told; null until the version is sent. `none` means NOT delivered. */
  sentVia: SentVia | null;
  pricedOn: string;
  note: string | null;
  sentAt: string | null;
  validUntil: string | null;
  replacedByN: number | null;
  rejectReason: string | null;
  /** read-only when replaced or not the latest */
  current: boolean;
  /** FR-REC-009: the approval evidence once approved (no link or token) */
  approval: ReturnType<typeof toApprovalDto> | null;
  /** a customer link exists for this version (the token itself is never readable) */
  hasLink: boolean;
}

export interface QuoteDetailDto extends QuoteDto {
  /** for the printout header (FR-REC-008: print copy) */
  branchName: string;
  /** policy for the counter approval panel; null unless the actor may approve a live sent version */
  approvalPolicy: ApprovalPolicy | null;
  versions: VersionSummaryDto[];
  shown: VersionDto;
  allowed: string[];
}

const toQuoteDto = (q: Quote, today: string): QuoteDto => ({
  id: q.id,
  number: q.number,
  intakeId: q.intakeId,
  vehicleId: q.vehicleId,
  customerId: q.customerId,
  plate: q.plate,
  vehicleLabel: q.vehicleLabel,
  customerName: q.customerName,
  advisorId: q.advisorId,
  currentN: q.currentN,
  // R10: derived at read time, never waiting for a job
  status: effectiveQuoteStatus(q.status, q.validUntil, today),
  validUntil: q.validUntil ?? null,
  totalVnd: q.totalVnd,
  approvedTotalVnd: q.approvedTotalVnd ?? null,
  orderId: q.orderId ?? null,
  supplementOfOrderId: q.supplementOfOrderId ?? null,
  createdAt: q.createdAt.toISOString(),
  updatedAt: q.updatedAt.toISOString(),
  version: q.version,
});

async function availabilityOf(
  deps: RecDeps,
  actor: Actor,
  items: readonly QuoteItem[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const partIds = [
    ...new Set(items.flatMap((i) => i.lines.flatMap((l) => (l.kind === 'part' ? [l.partId] : [])))),
  ];
  if (partIds.length === 0 || !hasPermission(actor, 'stock-availability:view')) return out;
  try {
    for (const a of await getAvailability(deps.inv, actor, { partIds }))
      out.set(a.partId, a.available);
  } catch {
    /* availability is advisory: an unreadable scope shows no number instead of failing the quote */
  }
  return out;
}

/**
 * R2: the quote must say so when its validity reaches a day on which an approved tax-rate version of
 * one of the keys it used takes effect: price and tax are frozen at approval (RULE-005) but the invoice
 * takes the rate of the invoice date, and which one applies is the accountant's decision, not the code's.
 */
async function taxChangeWarnings(
  deps: RecDeps,
  actor: Actor,
  v: QuoteVersion,
  today: string,
): Promise<QuoteWarning[]> {
  if (v.status !== 'draft' && v.status !== 'sent') return [];
  const validUntil = v.validUntil ?? addDays(today, deps.rec.quoteValidityDays);
  const out: QuoteWarning[] = [];
  for (const t of v.taxes) {
    const changes = await approvedChangesBetween(deps.sys, {
      tenantId: actor.tenantId,
      type: 'tax-rate',
      scopeKey: t.key,
      after: v.pricedOn,
      upTo: validUntil,
    });
    for (const c of changes)
      out.push({
        code: 'tax_change_within_validity',
        taxKey: t.key,
        validUntil,
        effectiveFrom: c.effectiveFrom,
        newRateBp: (c.payload as { rateBp?: number }).rateBp ?? null,
      });
  }
  return out;
}

async function toVersionDto(
  deps: RecDeps,
  actor: Actor,
  v: QuoteVersion,
  currentN: number,
): Promise<VersionDto> {
  const today = businessDate(deps.sys.clock.now());
  // the available quantity is only useful while the quote can still change or be approved
  const live = v.n === currentN && (v.status === 'draft' || v.status === 'sent');
  const avail = live ? await availabilityOf(deps, actor, v.items) : new Map<string, number>();
  return {
    n: v.n,
    status: effectiveQuoteStatus(v.status, v.validUntil, today),
    storedStatus: v.status,
    taxes: v.taxes,
    tax: v.taxes.length === 1 ? v.taxes[0]! : null,
    warnings: await taxChangeWarnings(deps, actor, v, today),
    sentVia: v.sentAt ? (v.sentVia ?? 'none') : null,
    items: v.items.map((i) => ({
      ...i,
      lines: i.lines.map((l) => ({
        lineNo: l.lineNo,
        kind: l.kind,
        code: l.code,
        name: l.name,
        minutes: l.kind === 'labor' ? l.minutes : null,
        standardMinutes: l.kind === 'labor' ? l.standardMinutes : null,
        differsFromStandard: l.kind === 'labor' ? l.differsFromStandard : null,
        minutesDelta: l.kind === 'labor' ? l.minutesDelta : null,
        minutesDeltaBp: l.kind === 'labor' ? l.minutesDeltaBp : null,
        qty: l.kind === 'part' ? l.qty : null,
        qtyScale: l.kind === 'part' ? l.qtyScale : null,
        serviceId: l.kind === 'labor' ? l.serviceId : null,
        partId: l.kind === 'part' ? l.partId : null,
        listUnitVnd: l.listUnitVnd,
        unitVnd: l.unitVnd,
        discountBp: l.discountBp,
        amountVnd: l.amountVnd,
        taxRateBp: l.taxRateBp,
        taxKey: l.taxKey,
        taxVersionId: l.taxVersionId,
        available: l.kind === 'part' ? (avail.get(l.partId) ?? null) : null,
      })),
    })),
    totals: v.totals,
    pricedOn: v.pricedOn,
    note: v.note ?? null,
    sentAt: v.sentAt?.toISOString() ?? null,
    validUntil: v.validUntil ?? null,
    replacedByN: v.replacedByN ?? null,
    rejectReason: v.rejectReason ?? null,
    current: v.n === currentN && v.replacedByN === undefined,
    approval: v.approval
      ? toApprovalDto(
          v.approval,
          // staff display name only (no contact data) for "who recorded it"
          v.approval.recordedBy
            ? ((await deps.sys.users.getById(v.approval.recordedBy))?.displayName ?? null)
            : null,
        )
      : null,
    hasLink: !!v.linkHash,
  };
}

// ---- list / get ----------------------------------------------------------------------------

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  cursor: z.string().max(512).optional(),
  status: z
    .enum(['draft', 'sent', 'approved_full', 'approved_partial', 'rejected', 'expired'])
    .optional(),
  q: z.string().trim().max(40).optional(),
});

/** One row per quote = its current version (ba-answers-03 Câu 1). */
export async function listQuotes(
  deps: RecDeps,
  actor: Actor,
  raw: unknown,
): Promise<Page<QuoteDto>> {
  const scope = resolveWorkingScope(actor, 'quote:view');
  const q = parseInput(listSchema, raw);
  const text = q.q ?? '';
  const byNumber = /^bg/i.test(text);
  const page = await deps.quotes.list(scope, {
    limit: q.limit,
    ...(q.status ? { status: q.status } : {}),
    ...(text && byNumber ? { numberPrefix: text.toUpperCase() } : {}),
    ...(text && !byNumber ? { platePrefix: normalizePlate(text) } : {}),
    ...(q.cursor ? { cursor: decodeCursor(q.cursor)! } : {}),
  });
  const today = businessDate(deps.sys.clock.now());
  return { items: page.items.map((x) => toQuoteDto(x, today)), nextCursor: page.nextCursor };
}

export async function getQuote(
  deps: RecDeps,
  actor: Actor,
  id: string,
  n?: number,
): Promise<QuoteDetailDto> {
  const scope = resolveScope(actor, 'quote:view');
  const q = await deps.quotes.get(scope, id);
  if (!q) throw notFound();
  const versions = await deps.versions.listByQuote(scope, id, q.currentN);
  const shown = versions.find((v) => v.n === (n ?? q.currentN));
  if (!shown) throw notFound();
  const mayEdit = hasPermission(actor, 'quote:update');
  const mayApprove = hasPermission(actor, 'quote:approve');
  const today = businessDate(deps.sys.clock.now());
  const branch = await deps.sys.branches.get(scope, q.branchId);
  return {
    ...toQuoteDto(q, today),
    branchName: branch?.name ?? '',
    approvalPolicy:
      mayApprove && shown.n === q.currentN && q.status === 'sent'
        ? await approvalPolicyOf(deps, q.tenantId, q.branchId, today)
        : null,
    versions: versions.map((v) => ({
      n: v.n,
      status: v.status,
      totalVnd: v.totals.totalVnd,
      sentAt: v.sentAt?.toISOString() ?? null,
      replacedByN: v.replacedByN ?? null,
    })),
    shown: await toVersionDto(deps, actor, shown, q.currentN),
    allowed: [
      ...allowedQuoteActions(q.status, isQuoteExpired(q.status, q.validUntil, today)).filter((a) =>
        a === 'approve' ? mayApprove : mayEdit,
      ),
      // R37 fallback: approved but no order yet (a technical failure after the approval)
      ...((q.status === 'approved_full' || q.status === 'approved_partial') &&
      !q.orderId &&
      hasPermission(actor, 'repair-order:create')
        ? ['create_order']
        : []),
    ],
  };
}

// ---- create ----------------------------------------------------------------------------------

export const createQuoteSchema = z.object({ intakeId: z.string().trim().min(1).max(100) });

/** A quote starts from a COMPLETED intake of the same branch (RULE-007: source document). */
export async function createQuote(
  deps: RecDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'quote:create');
  const data = parseInput(createQuoteSchema, input);
  requireWorkingBranch(actor);
  // C24 (BA §17): creating the quote is the business event that relates the customer to the working
  // branch (source `quote`); idempotent, so a customer already related is a no-op
  const pre = await deps.intakes.get(scope, data.intakeId);
  if (pre && pre.branchId === requireWorkingBranch(actor))
    await relateToWorkingBranch(
      deps.crm,
      actor,
      pre.customerId,
      {},
      {
        source: 'quote',
        idempotencyKey: `rel-quote-${ctx.idempotencyKey}`,
        requestId: ctx.requestId,
      },
    );
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: 'POST /api/v1/rec/quotes',
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf(data),
    },
    async (tx) => {
      const intake = await deps.intakes.getInTx(tx, scope, data.intakeId);
      if (!intake || intake.branchId !== requireWorkingBranch(actor)) throw notFound();
      if (intake.status !== 'completed') throw new AppError('intake_not_completed', 409);
      if (intake.quoteId) throw new AppError('quote_exists', 409);
      const branch = await assertWritable(deps, tx, actor, scope, intake.branchId, 'new_order');
      const now = deps.sys.clock.now();
      const id = `qt_${deps.sys.newId()}`;
      const num = await allocateDocumentNumber(deps.sys, tx, {
        branch,
        docType: 'quote',
        businessDate: businessDate(now),
        stage: 'create',
        documentId: id,
        requestKey: ctx.idempotencyKey,
      });
      const q: Quote = {
        id,
        tenantId: actor.tenantId,
        branchId: branch.id,
        number: num.number!,
        intakeId: intake.id,
        vehicleId: intake.vehicleId,
        customerId: intake.customerId,
        plate: intake.plate,
        plateNorm: intake.plateNorm,
        vehicleLabel: intake.vehicleLabel,
        customerName: intake.customerName,
        advisorId: actor.userId,
        currentN: 1,
        status: 'draft',
        totalVnd: 0,
        createdAt: now,
        createdBy: actor.userId,
        updatedAt: now,
        updatedBy: actor.userId,
        version: 1,
      };
      const v: QuoteVersion = {
        id: versionId(id, 1),
        quoteId: id,
        tenantId: actor.tenantId,
        branchId: branch.id,
        n: 1,
        status: 'draft',
        items: [],
        totals: computeTotals([]),
        taxes: [],
        pricedOn: businessDate(now),
        createdAt: now,
        createdBy: actor.userId,
        updatedAt: now,
        updatedBy: actor.userId,
        version: 1,
      };
      deps.quotes.create(tx, q);
      deps.versions.create(tx, v);
      deps.intakes.update(tx, intake.id, { quoteId: id });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: branch.id,
          entityType: 'quote',
          entityId: id,
          action: 'quote.create',
          after: { number: q.number, intakeId: intake.id },
        }),
      );
      return { status: 201, body: toQuoteDto(q, businessDate(now)) };
    },
  );
}

// ---- edit (in place for a draft, next version otherwise) -----------------------------------------

export const updateQuoteSchema = z.object({
  version: z.number().int().min(1),
  items: z.array(itemInput).max(100),
  note: z.string().trim().max(500).optional(),
});

export async function updateQuote(
  deps: RecDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx,
): Promise<QuoteDetailDto> {
  const scope = resolveScope(actor, 'quote:update');
  const data = parseInput(updateQuoteSchema, input);
  const head = await deps.quotes.get(scope, id);
  if (!head) throw notFound();
  const now = deps.sys.clock.now();
  const today = businessDate(now);
  // pricing reads configuration only, so it happens before the transaction (fewer retries)
  const built = await buildItems(deps, actor, head.branchId, today, data.items);
  await deps.sys.uow.run(async (tx) => {
    const q = await deps.quotes.getInTx(tx, scope, id);
    if (!q) throw notFound();
    if (q.version !== data.version) throw versionConflict();
    await assertWritable(deps, tx, actor, scope, q.branchId, 'edit_open_order');
    const cur = await deps.versions.getInTx(tx, scope, versionId(id, q.currentN));
    if (!cur) throw notFound();
    const mode = editMode(cur.status);
    if (mode === 'locked') throw new AppError('quote_locked', 409);
    const body = {
      items: built.items,
      totals: built.totals,
      taxes: built.taxes,
      pricedOn: today,
      ...(data.note ? { note: data.note } : {}),
      updatedAt: now,
      updatedBy: actor.userId,
    };
    let n = cur.n;
    if (mode === 'in_place') {
      deps.versions.update(tx, cur.id, {
        ...body,
        note: data.note ?? null,
        version: cur.version + 1,
      });
    } else {
      if (cur.n >= deps.rec.maxVersions) throw new AppError('quote_too_large', 422);
      n = cur.n + 1;
      deps.versions.create(tx, {
        id: versionId(id, n),
        quoteId: id,
        tenantId: q.tenantId,
        branchId: q.branchId,
        n,
        status: 'draft',
        createdAt: now,
        createdBy: actor.userId,
        version: 1,
        ...body,
      });
    }
    deps.quotes.update(tx, id, {
      currentN: n,
      status: 'draft',
      validUntil: null,
      totalVnd: built.totals.totalVnd,
      updatedAt: now,
      updatedBy: actor.userId,
      version: q.version + 1,
    });
    deps.sys.audit.record(
      tx,
      auditEntry(deps.sys, actor, ctx, {
        branchId: q.branchId,
        entityType: 'quote',
        entityId: id,
        action: mode === 'in_place' ? 'quote.update' : 'quote.revise',
        before: { n: cur.n, status: cur.status, totalVnd: cur.totals.totalVnd },
        after: { n, status: 'draft', totalVnd: built.totals.totalVnd, items: built.items.length },
      }),
    );
  });
  return getQuote(deps, actor, id);
}

// ---- send / reject -----------------------------------------------------------------------------------

export const quoteActionSchema = z.object({ version: z.number().int().min(1) });
/** R10: `print` (a paper copy is handed over) and `counter` (shown at the counter) exist today; `link` waits for the customer page. */
export const sendQuoteSchema = quoteActionSchema.extend({
  via: z.enum(['print', 'counter']).optional(),
});
export const rejectQuoteSchema = z.object({
  version: z.number().int().min(1),
  reason: z.string().trim().min(3).max(300),
});

/** Sending freezes the version with the prices it carries; the previous version stops being valid (Câu 1). */
export async function sendQuote(
  deps: RecDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'quote:update');
  const data = parseInput(sendQuoteSchema, input);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/rec/quotes/${id}/send`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ id, ...data }),
    },
    async (tx) => {
      const q = await deps.quotes.getInTx(tx, scope, id);
      if (!q) throw notFound();
      if (q.version !== data.version) throw versionConflict();
      await assertWritable(deps, tx, actor, scope, q.branchId, 'edit_open_order');
      // R47: a supplement of a closed order is not sent
      await assertSupplementOrderOpen(deps, tx, scope, q);
      const cur = await deps.versions.getInTx(tx, scope, versionId(id, q.currentN));
      if (!cur) throw notFound();
      const lines = cur.items.reduce((s, i) => s + i.lines.length, 0);
      const t = transitionQuote(cur.status, 'send', { hasLines: lines > 0 });
      if (!t.ok) throw new AppError(t.reason, 409);
      const now = deps.sys.clock.now();
      const today = businessDate(now);
      // the prices were read on `pricedOn`; a draft kept overnight must be saved again to be re-priced
      if (cur.pricedOn !== today) throw new AppError('prices_outdated', 409);
      const validUntil = addDays(today, deps.rec.quoteValidityDays);
      const prev =
        cur.n > 1 ? await deps.versions.getInTx(tx, scope, versionId(id, cur.n - 1)) : null;
      deps.versions.update(tx, cur.id, {
        status: t.state,
        sentAt: now,
        sentBy: actor.userId,
        validUntil,
        // R10: no message channel exists yet, so the version is only frozen (`none`); print and counter set their own value
        sentVia: data.via ?? 'none',
        updatedAt: now,
        updatedBy: actor.userId,
        version: cur.version + 1,
      });
      if (prev)
        deps.versions.update(tx, prev.id, {
          replacedAt: now,
          replacedByN: cur.n,
          version: prev.version + 1,
        });
      deps.quotes.update(tx, id, {
        status: t.state,
        validUntil,
        updatedAt: now,
        updatedBy: actor.userId,
        version: q.version + 1,
      });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: q.branchId,
          entityType: 'quote',
          entityId: id,
          action: 'quote.send',
          before: { n: cur.n, status: cur.status },
          after: { n: cur.n, status: t.state, validUntil, totalVnd: cur.totals.totalVnd },
        }),
      );
      return {
        status: 200,
        body: toQuoteDto({ ...q, status: t.state, version: q.version + 1 }, today),
      };
    },
  );
}

/** The customer refused the whole quote (ba-answers-03 Câu 2: the customer-page "Từ chối" always means all of it). */
export async function rejectQuote(
  deps: RecDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'quote:update');
  const data = parseInput(rejectQuoteSchema, input);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/rec/quotes/${id}/reject`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ id, ...data }),
    },
    async (tx) => {
      const q = await deps.quotes.getInTx(tx, scope, id);
      if (!q) throw notFound();
      if (q.version !== data.version) throw versionConflict();
      await assertWritable(deps, tx, actor, scope, q.branchId, 'edit_open_order');
      const cur = await deps.versions.getInTx(tx, scope, versionId(id, q.currentN));
      if (!cur) throw notFound();
      const t = transitionQuote(cur.status, 'reject');
      if (!t.ok) throw new AppError(t.reason, 409);
      const now = deps.sys.clock.now();
      const today = businessDate(now);
      deps.versions.update(tx, cur.id, {
        status: t.state,
        rejectedAt: now,
        rejectReason: data.reason,
        rejectedBy: actor.userId,
        updatedAt: now,
        updatedBy: actor.userId,
        version: cur.version + 1,
      });
      deps.quotes.update(tx, id, {
        status: t.state,
        updatedAt: now,
        updatedBy: actor.userId,
        version: q.version + 1,
      });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: q.branchId,
          entityType: 'quote',
          entityId: id,
          action: 'quote.reject',
          before: { n: cur.n, status: cur.status },
          after: { n: cur.n, status: t.state },
          reason: data.reason,
        }),
      );
      return {
        status: 200,
        body: toQuoteDto({ ...q, status: t.state, version: q.version + 1 }, today),
      };
    },
  );
}
