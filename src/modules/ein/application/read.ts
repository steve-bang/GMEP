import { businessDate } from '@/platform/format/date';
import { resolveScope, hasPermission, type Actor } from '@/platform/rbac/rbac';
import { normalizeSearch } from '@/platform/text/normalize';
import { decodeCursor } from '@/platform/pagination/pagination';
import type {
  Invoice,
  InvoiceDocType,
  InvoiceRequest,
  QueueItem,
  RequestStatus,
  SyncState,
} from '../domain/invoice';
import { isOpenRequest } from '../domain/state';
import type { EinDeps } from '../ports/deps';
import { issuerOf, providerActive } from './config';
import { accessEntry, AppError, einBranch, notFound } from './support';

/**
 * Reads (FR-EIN-005, 006, 009, 010): list, detail, files, the warning list and the queue. Every read takes the Scope; lists
 * run one branch newest first and filter in memory over a bounded window (R68), saying so when the window ends before the
 * data does ("còn nữa") instead of silently cutting.
 */

export type DisplayStatus =
  'not_issued' | 'issued' | 'adjustment' | 'replacement' | 'cancelled' | 'abandoned';

export const displayStatusOf = (i: Pick<Invoice, 'status' | 'docType'>): DisplayStatus =>
  i.status === 'issued' && i.docType === 'adjustment'
    ? 'adjustment'
    : i.status === 'issued' && i.docType === 'replacement'
      ? 'replacement'
      : i.status;

export interface InvoiceDto {
  id: string;
  orderId: string;
  orderNumber: string;
  plate: string;
  docType: InvoiceDocType;
  status: Invoice['status'];
  displayStatus: DisplayStatus;
  sync: SyncState;
  syncError: { kind: string; code: string; message: string } | null;
  number: string | null;
  symbol: string;
  issuedAt: string | null;
  taxAuthorityCode: string | null;
  buyerName: string;
  buyerKind: string;
  buyerTaxCode: string | null;
  totalVnd: number;
  netVnd: number;
  taxVnd: number;
  originalInvoiceId: string | null;
  adjustedBy: string[];
  replacedBy: string | null;
  requestNumber: string;
  artifactsReady: boolean;
  createdAt: string;
  version: number;
}

export function toInvoiceDto(i: Invoice): InvoiceDto {
  return {
    id: i.id,
    orderId: i.orderId,
    orderNumber: i.orderNumber,
    plate: i.plate,
    docType: i.docType,
    status: i.status,
    displayStatus: displayStatusOf(i),
    sync: i.sync,
    syncError: i.syncError ?? null,
    number: i.number ?? null,
    symbol: i.issuer.symbol,
    issuedAt: i.issuedAt?.toISOString() ?? null,
    taxAuthorityCode: i.taxAuthorityCode ?? null,
    buyerName: i.buyer.name,
    buyerKind: i.buyer.kind,
    buyerTaxCode: i.buyer.taxCode ?? null,
    totalVnd: i.totalVnd,
    netVnd: i.netVnd,
    taxVnd: i.taxVnd,
    originalInvoiceId: i.originalInvoiceId ?? null,
    adjustedBy: i.adjustedBy,
    replacedBy: i.replacedBy ?? null,
    requestNumber: i.requestNumber,
    artifactsReady: i.artifactsReady,
    createdAt: i.createdAt.toISOString(),
    version: i.version,
  };
}

/** An invoice that counts in the "hiệu lực" total: issued, not replaced, not cancelled (design EIN-01 footnote). */
export const isEffective = (i: Pick<Invoice, 'status' | 'replacedBy'>): boolean =>
  i.status === 'issued' && !i.replacedBy;

export interface InvoiceListQuery {
  status?: DisplayStatus;
  from?: string;
  to?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}

export interface InvoiceListDto {
  items: InvoiceDto[];
  nextCursor: string | null;
  /** the scan window ended before the data did: narrow the dates */
  truncated: boolean;
  effectiveTotalVnd: number;
}

const dayStart = (iso: string) => new Date(`${iso}T00:00:00+07:00`);

export async function listInvoices(
  deps: EinDeps,
  actor: Actor,
  q: InvoiceListQuery,
): Promise<InvoiceListDto> {
  const scope = resolveScope(actor, 'invoice:view');
  const branchId = einBranch(actor, scope);
  const limit = Math.min(q.limit ?? deps.ein.listPageSize, 100);
  const needle = q.q ? normalizeSearch(q.q) : '';
  const from = q.from ? dayStart(q.from) : undefined;
  const to = q.to ? new Date(dayStart(q.to).getTime() + 86_400_000) : undefined;
  let cursor = decodeCursor(q.cursor);
  const out: Invoice[] = [];
  let scanned = 0;
  let truncated = false;
  let hasMore = false;
  let lastConsumed: Invoice | undefined;
  while (out.length < limit) {
    const page = await deps.invoices.listByBranch(scope, branchId, {
      limit: 100,
      ...(cursor ? { cursor } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    });
    let stoppedAt = -1;
    for (let k = 0; k < page.items.length; k++) {
      const i = page.items[k]!;
      scanned++;
      lastConsumed = i;
      const hit =
        (!q.status || displayStatusOf(i) === q.status) &&
        (!needle ||
          normalizeSearch(
            `${i.number ?? ''} ${i.orderNumber} ${i.buyer.name} ${i.buyer.taxCode ?? ''} ${i.plate}`,
          ).includes(needle));
      if (hit) out.push(i);
      if (out.length >= limit) {
        stoppedAt = k;
        break;
      }
    }
    const restOfPage = stoppedAt >= 0 && stoppedAt < page.items.length - 1;
    if (out.length >= limit) {
      hasMore = restOfPage || page.nextCursor !== null;
      break;
    }
    if (!page.nextCursor) break;
    if (scanned >= deps.ein.scanMax) {
      // the window ended before the data did: say so instead of cutting silently
      truncated = true;
      hasMore = true;
      break;
    }
    cursor = decodeCursor(page.nextCursor);
  }
  const items = out;
  const nextCursor =
    hasMore && lastConsumed
      ? Buffer.from(
          JSON.stringify({ v: lastConsumed.createdAt.toISOString(), id: lastConsumed.id }),
          'utf8',
        ).toString('base64url')
      : null;
  return {
    items: items.map(toInvoiceDto),
    nextCursor,
    truncated,
    effectiveTotalVnd: items.filter(isEffective).reduce((s, i) => s + i.totalVnd, 0),
  };
}

export interface RequestDto {
  id: string;
  number: string;
  purpose: InvoiceRequest['purpose'];
  status: RequestStatus;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  lastError: { kind: string; code: string; message: string } | null;
  reason: string | null;
  version: number;
  /** the stable provider key: technical, shown to KT / CH / AD only */
  idempotencyKey?: string;
  attempts: { n: number; at: string; phase: string; outcome: string; code: string | null }[];
}

const toRequestDto = (r: InvoiceRequest, technical: boolean): RequestDto => ({
  id: r.id,
  number: r.number,
  purpose: r.purpose,
  status: r.status,
  attemptCount: r.attemptCount,
  maxAttempts: r.maxAttempts,
  nextAttemptAt: r.nextAttemptAt?.toISOString() ?? null,
  lastError: r.lastError ?? null,
  reason: r.reason ?? null,
  version: r.version,
  ...(technical ? { idempotencyKey: r.idempotencyKey } : {}),
  attempts: r.attempts.map((a) => ({
    n: a.n,
    at: a.at.toISOString(),
    phase: a.phase,
    outcome: a.outcome,
    code: a.code ?? null,
  })),
});

export interface InvoiceDetailDto extends InvoiceDto {
  lines: Invoice['lines'];
  taxSummary: Invoice['taxSummary'];
  lineMode: Invoice['lineMode'];
  issuer: {
    sellerName: string;
    sellerTaxCode: string;
    symbol: string;
    environment: string;
    providerCode: string;
  };
  buyerAddress: { value: string | null; masked: boolean; reveal: 'none' | 'plain' | 'reason' };
  buyerEmail: { value: string | null; masked: boolean; reveal: 'none' | 'plain' | 'reason' };
  history: { at: string; event: string; note: string | null }[];
  request: RequestDto | null;
  versions: InvoiceDto[];
  cancelReason: string | null;
  actions: Record<
    'correct' | 'sync' | 'download' | 'report',
    { allowed: boolean; reasonCode?: string }
  >;
}

export async function getInvoice(
  deps: EinDeps,
  actor: Actor,
  id: string,
  ctx: { requestId: string },
): Promise<InvoiceDetailDto> {
  const scope = resolveScope(actor, 'invoice:view');
  const inv = await deps.invoices.get(scope, id);
  if (!inv) throw notFound();
  const [pii, req, idx] = await Promise.all([
    deps.invoices.getPii(scope, id),
    deps.requests.get(scope, inv.requestId),
    deps.index.get(scope, inv.orderId),
  ]);
  // oldest first = the order the documents were opened in (the index appends them)
  const ids = idx?.invoiceIds ?? [inv.id];
  const byId = new Map((await deps.invoices.getMany(scope, ids)).map((x) => [x.id, x]));
  const versions = ids.flatMap((vid) => (byId.get(vid) ? [byId.get(vid)!] : []));
  const addr = deps.sys.pii.present(actor, 'address', pii?.address);
  const mail = deps.sys.pii.present(actor, 'email', pii?.email);
  const seenFull = (['address', 'email'] as const).filter(
    (f) => deps.sys.pii.level(actor, f) === 'full' && !!pii?.[f],
  );
  if (seenFull.length)
    await deps.sys.piiLog.record(
      accessEntry(deps, actor, ctx.requestId, {
        entityType: 'invoice',
        entityId: id,
        purpose: 'open_record',
        fields: [...seenFull],
        branchId: inv.branchId,
      }),
    );
  const technical = hasPermission(actor, 'invoice-technical:view');
  const may = (p: string) => hasPermission(actor, p as 'x:view');
  const openCorrection = (idx ? await deps.requests.getMany(scope, idx.requestIds) : []).some(
    (r) =>
      r.purpose !== 'issue' &&
      isOpenRequest(r.status) &&
      (r.targetInvoiceId === inv.id || r.invoiceId === inv.id),
  );
  const correct = !may('invoice-correction:create')
    ? { allowed: false, reasonCode: 'no_permission' }
    : inv.status !== 'issued'
      ? { allowed: false, reasonCode: 'invoice_not_issued' }
      : inv.docType === 'adjustment'
        ? { allowed: false, reasonCode: 'adjustment_not_correctable' }
        : inv.replacedBy
          ? { allowed: false, reasonCode: 'invoice_replaced' }
          : openCorrection
            ? { allowed: false, reasonCode: 'correction_in_progress' }
            : { allowed: true };
  return {
    ...toInvoiceDto(inv),
    lines: inv.lines,
    taxSummary: inv.taxSummary,
    lineMode: inv.lineMode,
    issuer: {
      sellerName: inv.issuer.sellerName,
      sellerTaxCode: inv.issuer.sellerTaxCode,
      symbol: inv.issuer.symbol,
      environment: inv.issuer.environment,
      providerCode: inv.issuer.providerCode,
    },
    buyerAddress: { value: addr.value ?? null, masked: addr.masked, reveal: addr.reveal },
    buyerEmail: { value: mail.value ?? null, masked: mail.masked, reveal: mail.reveal },
    history: inv.history.map((h) => ({
      at: h.at.toISOString(),
      event: h.event,
      note: h.note ?? null,
    })),
    request: req ? toRequestDto(req, technical) : null,
    versions: versions.map(toInvoiceDto),
    cancelReason: inv.cancelReason ?? null,
    actions: {
      correct,
      sync: may('invoice-queue:update')
        ? { allowed: true }
        : { allowed: false, reasonCode: 'no_permission' },
      download: !may('invoice:view')
        ? { allowed: false, reasonCode: 'no_permission' }
        : inv.artifactsReady
          ? { allowed: true }
          : { allowed: false, reasonCode: 'files_not_ready' },
      report:
        may('invoice-report:create') && inv.status === 'issued'
          ? { allowed: true }
          : {
              allowed: false,
              reasonCode: inv.status === 'issued' ? 'no_permission' : 'invoice_not_issued',
            },
    },
  };
}

/** FR-EIN-006: the stored XML or PDF of an invoice, opened from the original order. Scope-checked, access is audited by the caller. */
export async function readInvoiceFile(
  deps: EinDeps,
  actor: Actor,
  id: string,
  kind: 'xml' | 'pdf',
  ctx: { requestId: string },
): Promise<{ bytes: Uint8Array; contentType: string; filename: string }> {
  const scope = resolveScope(actor, 'invoice:view');
  const inv = await deps.invoices.get(scope, id);
  if (!inv) throw notFound();
  const art = await deps.invoices.getArtifacts(scope, id);
  if (!art) throw new AppError('files_not_ready', 404);
  const f = await deps.files.get(kind === 'xml' ? art.xmlPath : art.pdfPath);
  if (!f) throw new AppError('files_not_ready', 404);
  // R77 / PDPL: the file carries the buyer's data in full, so every download is access-logged (never the content)
  await deps.sys.piiLog.record(
    accessEntry(deps, actor, ctx.requestId, {
      entityType: 'invoice',
      entityId: id,
      purpose: 'export',
      fields: ['address', 'email'],
      columns: [`file:${kind}`],
      rowCount: 1,
      branchId: inv.branchId,
    }),
  );
  const base = `${inv.issuer.symbol}-${inv.number ?? inv.id}`.replace(/[^A-Za-z0-9._-]/g, '_');
  return { ...f, filename: `${base}.${kind}` };
}

// ---- warnings (FR-EIN-009, G4-EIN-05) -------------------------------------------------------------------------------

export interface WarningRow {
  orderId: string;
  orderNumber: string;
  plate: string;
  customerName: string;
  completedAt: string | null;
  ageDays: number;
  reason: 'no_request' | 'request_cancelled';
  totalVnd: number;
}
export interface WarningsDto {
  items: WarningRow[];
  totalVnd: number;
  oldestDays: number;
  truncated: boolean;
}

/**
 * Orders handed over without a valid invoice and without an open request (an order with a request in the queue is NOT here,
 * so nobody issues it twice). Bounded: the newest `scanMax` completed orders of the branch; `truncated` says when more exist.
 */
export async function listWarnings(deps: EinDeps, actor: Actor): Promise<WarningsDto> {
  const scope = resolveScope(actor, 'invoice:view');
  const branchId = einBranch(actor, scope);
  const orders = (await deps.orders.listCompleted(scope, deps.ein.scanMax + 1)).filter(
    (o) => o.branchId === branchId,
  );
  const truncated = orders.length > deps.ein.scanMax;
  const rows = orders.slice(0, deps.ein.scanMax);
  const idx = new Map(
    (
      await deps.index.getMany(
        scope,
        rows.map((o) => o.id),
      )
    ).map((x) => [x.id, x]),
  );
  const now = deps.sys.clock.now();
  const items: WarningRow[] = [];
  for (const o of rows) {
    const x = idx.get(o.id);
    if (x?.validInvoiceId) continue;
    if (x?.issueRequestId) {
      const r = await deps.requests.get(scope, x.issueRequestId);
      if (r && isOpenRequest(r.status)) continue;
    }
    items.push({
      orderId: o.id,
      orderNumber: o.number,
      plate: o.plate,
      customerName: o.customerName,
      completedAt: o.completedAt?.toISOString() ?? null,
      ageDays: o.completedAt
        ? Math.max(0, Math.floor((now.getTime() - o.completedAt.getTime()) / 86_400_000))
        : 0,
      reason: x && x.rounds > 0 ? 'request_cancelled' : 'no_request',
      totalVnd: o.totalVnd,
    });
  }
  items.sort((a, b) => b.ageDays - a.ageDays || a.orderNumber.localeCompare(b.orderNumber));
  return {
    items,
    totalVnd: items.reduce((s, i) => s + i.totalVnd, 0),
    oldestDays: items[0]?.ageDays ?? 0,
    truncated,
  };
}

// ---- queue (FR-EIN-010, G4-EIN-06) ------------------------------------------------------------------------------------

export interface QueueRowDto {
  requestId: string;
  number: string;
  purpose: QueueItem['purpose'];
  orderId: string;
  orderNumber: string;
  invoiceId: string;
  status: RequestStatus;
  errorKind: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  valueVnd: number;
  createdAt: string;
  version: number;
  actions: Record<'retry' | 'fixBuyer' | 'cancel', { allowed: boolean; reasonCode?: string }>;
}

export async function listQueue(
  deps: EinDeps,
  actor: Actor,
): Promise<{ items: QueueRowDto[]; total: number }> {
  const scope = resolveScope(actor, 'invoice-queue:view');
  const branchId = einBranch(actor, scope);
  const q = await deps.queue.get(scope, branchId);
  const may = hasPermission(actor, 'invoice-queue:update');
  const items = Object.values(q?.items ?? {}).sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  return {
    total: items.length,
    items: items.map((i): QueueRowDto => {
      const no = (reasonCode: string) => ({ allowed: false, reasonCode });
      return {
        requestId: i.requestId,
        number: i.number,
        purpose: i.purpose,
        orderId: i.orderId,
        orderNumber: i.orderNumber,
        invoiceId: i.invoiceId,
        status: i.status,
        errorKind: i.errorKind ?? null,
        errorCode: i.errorCode ?? null,
        errorMessage: i.errorMessage ?? null,
        attemptCount: i.attemptCount,
        maxAttempts: i.maxAttempts,
        nextAttemptAt: i.nextAttemptAt?.toISOString() ?? null,
        valueVnd: i.valueVnd,
        createdAt: i.createdAt.toISOString(),
        version: i.version,
        actions: {
          retry: !may
            ? no('no_permission')
            : i.status === 'failed_data'
              ? no('fix_data_first')
              : i.status === 'sending'
                ? no('request_in_flight')
                : { allowed: true },
          fixBuyer: !may
            ? no('no_permission')
            : i.status === 'failed_data' && i.purpose !== 'cancel'
              ? { allowed: true }
              : no('request_not_fixable'),
          cancel: !may
            ? no('no_permission')
            : i.status === 'sending'
              ? no('request_in_flight')
              : { allowed: true },
        },
      };
    }),
  };
}

// ---- connection (EIN-07) ---------------------------------------------------------------------------------------------

export interface ConnectionDto {
  activated: boolean;
  providerCode: string | null;
  environment: string | null;
  symbol: string | null;
  knownProviders: string[];
  queueOpen: number;
}

export async function getConnection(deps: EinDeps, actor: Actor): Promise<ConnectionDto> {
  // anyone who works with invoices needs to know whether the provider is activated; the config readers (AD) too
  const scope = hasPermission(actor, 'invoice:view')
    ? resolveScope(actor, 'invoice:view')
    : resolveScope(actor, 'einvoice-config:view');
  const branchId = einBranch(actor, scope);
  const issuer = await issuerOf(deps, actor.tenantId, branchId, businessDate(deps.sys.clock.now()));
  const q = hasPermission(actor, 'invoice-queue:view')
    ? await deps.queue.get(scope, branchId)
    : null;
  return {
    activated: providerActive(deps, issuer),
    providerCode: issuer?.snapshot.providerCode ?? null,
    environment: issuer?.snapshot.environment ?? null,
    symbol: issuer?.snapshot.symbol ?? null,
    knownProviders: deps.providers.codes(),
    queueOpen: Object.keys(q?.items ?? {}).length,
  };
}

/** For REC / INV gates (FR-INV-022, order cancellation): does the order have an effective invoice? Read by key. */
export async function hasValidInvoice(
  deps: EinDeps,
  scope: Parameters<EinDeps['index']['get']>[0],
  orderId: string,
): Promise<boolean> {
  return !!(await deps.index.get(scope, orderId))?.validInvoiceId;
}

export interface OrderInvoicesDto {
  /** the effective invoice (or null) and every document of the order, oldest first */
  validInvoiceId: string | null;
  items: InvoiceDto[];
  /** an issue request is still open: the order must not be issued again */
  openRequest: { id: string; number: string; status: RequestStatus } | null;
}

/** The invoice side of ONE order (its own status set, never merged into the order status). Read by key. */
export async function listOrderInvoices(
  deps: EinDeps,
  actor: Actor,
  orderId: string,
): Promise<OrderInvoicesDto> {
  const scope = resolveScope(actor, 'invoice:view');
  const idx = await deps.index.get(scope, orderId);
  if (!idx) return { validInvoiceId: null, items: [], openRequest: null };
  const byId = new Map((await deps.invoices.getMany(scope, idx.invoiceIds)).map((x) => [x.id, x]));
  const items = idx.invoiceIds.flatMap((id) => (byId.get(id) ? [toInvoiceDto(byId.get(id)!)] : []));
  const r = idx.issueRequestId ? await deps.requests.get(scope, idx.issueRequestId) : null;
  return {
    validInvoiceId: idx.validInvoiceId,
    items,
    openRequest:
      r && isOpenRequest(r.status) ? { id: r.id, number: r.number, status: r.status } : null,
  };
}
