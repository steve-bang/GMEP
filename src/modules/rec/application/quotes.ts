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
import { normalizePlate } from '@/modules/crm';
import { allocateDocumentNumber } from '@/modules/sys';
import {
  versionId,
  type Quote,
  type QuoteItem,
  type QuoteStatus,
  type QuoteVersion,
} from '../domain/entities';
import { computeTotals } from '../domain/pricing';
import { allowedQuoteActions, editMode, transitionQuote } from '../domain/quoteState';
import type { RecDeps } from '../ports/deps';
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
  /** total of the current version including tax */
  totalVnd: number;
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
  qty: number | null;
  qtyScale: number | null;
  serviceId: string | null;
  partId: string | null;
  listUnitVnd: number;
  unitVnd: number;
  discountBp: number;
  amountVnd: number;
  taxRateBp: number;
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

export interface VersionDto {
  n: number;
  status: QuoteStatus;
  items: QuoteItemDto[];
  totals: QuoteVersion['totals'];
  tax: QuoteVersion['tax'];
  pricedOn: string;
  note: string | null;
  sentAt: string | null;
  validUntil: string | null;
  replacedByN: number | null;
  rejectReason: string | null;
  /** read-only when replaced or not the latest */
  current: boolean;
}

export interface QuoteDetailDto extends QuoteDto {
  versions: VersionSummaryDto[];
  shown: VersionDto;
  allowed: string[];
}

const toQuoteDto = (q: Quote): QuoteDto => ({
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
  status: q.status,
  totalVnd: q.totalVnd,
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

async function toVersionDto(
  deps: RecDeps,
  actor: Actor,
  v: QuoteVersion,
  currentN: number,
): Promise<VersionDto> {
  // the available quantity is only useful while the quote can still change or be approved
  const live = v.n === currentN && (v.status === 'draft' || v.status === 'sent');
  const avail = live ? await availabilityOf(deps, actor, v.items) : new Map<string, number>();
  return {
    n: v.n,
    status: v.status,
    items: v.items.map((i) => ({
      ...i,
      lines: i.lines.map((l) => ({
        lineNo: l.lineNo,
        kind: l.kind,
        code: l.code,
        name: l.name,
        minutes: l.kind === 'labor' ? l.minutes : null,
        standardMinutes: l.kind === 'labor' ? l.standardMinutes : null,
        qty: l.kind === 'part' ? l.qty : null,
        qtyScale: l.kind === 'part' ? l.qtyScale : null,
        serviceId: l.kind === 'labor' ? l.serviceId : null,
        partId: l.kind === 'part' ? l.partId : null,
        listUnitVnd: l.listUnitVnd,
        unitVnd: l.unitVnd,
        discountBp: l.discountBp,
        amountVnd: l.amountVnd,
        taxRateBp: l.taxRateBp,
        available: l.kind === 'part' ? (avail.get(l.partId) ?? null) : null,
      })),
    })),
    totals: v.totals,
    tax: v.tax,
    pricedOn: v.pricedOn,
    note: v.note ?? null,
    sentAt: v.sentAt?.toISOString() ?? null,
    validUntil: v.validUntil ?? null,
    replacedByN: v.replacedByN ?? null,
    rejectReason: v.rejectReason ?? null,
    current: v.n === currentN && v.replacedByN === undefined,
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
  return { items: page.items.map(toQuoteDto), nextCursor: page.nextCursor };
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
  return {
    ...toQuoteDto(q),
    versions: versions.map((v) => ({
      n: v.n,
      status: v.status,
      totalVnd: v.totals.totalVnd,
      sentAt: v.sentAt?.toISOString() ?? null,
      replacedByN: v.replacedByN ?? null,
    })),
    shown: await toVersionDto(deps, actor, shown, q.currentN),
    allowed: mayEdit ? allowedQuoteActions(q.status) : [],
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
        companyId: actor.companyId,
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
        companyId: actor.companyId,
        branchId: branch.id,
        n: 1,
        status: 'draft',
        items: [],
        totals: computeTotals([]),
        tax: null,
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
      return { status: 201, body: toQuoteDto(q) };
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
      tax: built.tax,
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
        companyId: q.companyId,
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
  const data = parseInput(quoteActionSchema, input);
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
      return { status: 200, body: toQuoteDto({ ...q, status: t.state, version: q.version + 1 }) };
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
      deps.versions.update(tx, cur.id, {
        status: t.state,
        rejectedAt: now,
        rejectReason: data.reason,
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
      return { status: 200, body: toQuoteDto({ ...q, status: t.state, version: q.version + 1 }) };
    },
  );
}
