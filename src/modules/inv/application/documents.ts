/**
 * Stock documents: GRN (receipt), GIN (issue), RTN (return to stock), ADJ (opening / adjustment).
 * FR-INV-005, 006, 007, 008, 019, 021, 027; RULE-007 (source document), RULE-008, RULE-009,
 * RULE-010 (posted documents are final; corrected by a reversal document).
 *
 * Lifecycle: draft (editable, "Nháp", no number, no stock effect) -> posted (number allocated at
 * posting, balances and ledger written in ONE transaction) | cancelled. Posting an abnormal document
 * (adjustment, receipt without purchase order, price/quantity variance) needs `stock-doc:approve`
 * from a person other than the creator.
 */
import { AppError, forbidden, validationFailed } from '@/platform/errors/errors';
import {
  decodeCursor,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  type Page,
} from '@/platform/pagination/pagination';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import {
  hasPermission,
  requireWorkingBranch,
  resolveScope,
  resolveWorkingScope,
  type Actor,
  type Permission,
} from '@/platform/rbac/rbac';
import { branchesScope, scopeAllows, type Scope } from '@/platform/scope/scope';
import { draftReference } from '@/platform/numbering/numbering';
import type { Tx } from '@/platform/tx/unitOfWork';
import {
  allocateDocumentNumber,
  notifyUsers,
  usersWithRole,
  type Branch,
  type WriteKind,
} from '@/modules/sys';
import {
  DOC_SERIES,
  DOC_TYPES,
  issueReturnId,
  reservationId,
  reversalId,
  type Part,
  type Reservation,
  type StockDocLine,
  type StockDocSource,
  type StockDocType,
  type StockDocument,
} from '../domain/entities';
import { approvalReasons, assertTransition, checkLines, checkSource } from '../domain/document';
import {
  applyEffect,
  holdStatus,
  InvRuleError,
  issue as ledgerIssue,
  receive,
  receiveValue,
  remainingDemand,
  surplusValue,
  type Quantities,
} from '../domain/ledger';
import { proportion, type CostMethod } from '../domain/cost';
import { reservationPatch } from './holds';
import type { InvDeps } from '../ports/deps';
import { resolveCostMethod, resolveGrnThresholds, today } from './config';
import { BalanceSet, quantitiesOf } from './engine';
import {
  activeWarehouse,
  assertWritable,
  auditEntry,
  guard,
  idemOf,
  idToken,
  notFound,
  parseInput,
  versionConflict,
  z,
  type RequestCtx,
} from './support';

// ---- DTO -------------------------------------------------------------------------------

export interface DocLineDto extends Omit<StockDocLine, 'unitCostVnd' | 'valueVnd'> {
  unitCostVnd: number | null;
  valueVnd: number | null;
}

export interface DocumentDto {
  id: string;
  type: StockDocType;
  status: StockDocument['status'];
  /** official number once posted, otherwise the temporary "Nháp" reference */
  displayNo: string;
  number: string | null;
  branchId: string;
  warehouseId: string;
  businessDate: string | null;
  source: StockDocSource;
  reason: string | null;
  receiverUserId: string | null;
  originalDocumentId: string | null;
  lines: DocLineDto[];
  totalValueVnd: number | null;
  approvalReasons: string[];
  needsApproval: boolean;
  /** whether THIS actor may post it now (permission, branch and separation of duties) */
  canPost: boolean;
  reversalOf: string | null;
  reversedBy: string | null;
  createdAt: string;
  createdBy: string;
  postedAt: string | null;
  postedBy: string | null;
  version: number;
}

/** Costs of issues/returns/adjustments are cost data (stock-cost:view); a receipt shows its own purchase price. */
function toDocumentDto(d: StockDocument, actor: Actor, reasons = d.approvalReasons): DocumentDto {
  const cost = hasPermission(actor, 'stock-cost:view') || d.type === 'GRN';
  return {
    id: d.id,
    type: d.type,
    status: d.status,
    displayNo: d.number ?? d.draftRef,
    number: d.number,
    branchId: d.branchId,
    warehouseId: d.warehouseId,
    businessDate: d.businessDate,
    source: d.source,
    reason: d.reason ?? null,
    receiverUserId: d.receiverUserId ?? null,
    originalDocumentId: d.originalDocumentId ?? null,
    lines: d.lines.map((l) => ({
      ...l,
      unitCostVnd: cost || d.status === 'draft' ? (l.unitCostVnd ?? null) : null,
      valueVnd: cost ? (l.valueVnd ?? null) : null,
    })),
    totalValueVnd: cost && d.status === 'posted' ? d.totalValueVnd : null,
    approvalReasons: reasons,
    needsApproval: reasons.length > 0,
    canPost: d.status === 'draft' && postAllowed(actor, d, reasons),
    reversalOf: d.reversalOf ?? null,
    reversedBy: d.reversedBy ?? null,
    createdAt: d.createdAt.toISOString(),
    createdBy: d.createdBy,
    postedAt: d.postedAt?.toISOString() ?? null,
    postedBy: d.postedBy ?? null,
    version: d.version,
  };
}

function can(actor: Actor, permission: Permission, branchId: string): boolean {
  try {
    return scopeAllows(resolveScope(actor, permission), actor.companyId, branchId);
  } catch {
    return false;
  }
}

function postAllowed(actor: Actor, d: StockDocument, reasons: string[]): boolean {
  if (reasons.length > 0)
    return can(actor, 'stock-doc:approve', d.branchId) && d.createdBy !== actor.userId;
  return can(actor, 'stock-doc:create', d.branchId) || can(actor, 'stock-doc:approve', d.branchId);
}

/** Union of the branches where the actor may create OR approve stock documents. */
function postScope(actor: Actor): Scope {
  const scopes: Scope[] = [];
  for (const p of ['stock-doc:create', 'stock-doc:approve'] as const) {
    try {
      scopes.push(resolveScope(actor, p));
    } catch {
      /* not held */
    }
  }
  if (scopes.length === 0) throw forbidden();
  const all = scopes.find((s) => s.kind === 'all');
  if (all) return all;
  return branchesScope(
    actor.companyId,
    scopes.flatMap((s) => (s.kind === 'branches' ? [...s.branchIds] : [])),
  );
}

// ---- input -----------------------------------------------------------------------------

const lineSchema = z.object({
  partId: z.string().trim().min(1).max(128),
  qty: z.number().int().min(-1_000_000).max(1_000_000),
  unitCostVnd: z.number().int().min(0).max(1_000_000_000).optional(),
  expectedQty: z.number().int().min(1).max(1_000_000).optional(),
  expectedUnitCostVnd: z.number().int().min(0).max(1_000_000_000).optional(),
  lineKey: idToken.optional(),
  originalLineNo: z.number().int().min(1).max(1000).optional(),
  note: z.string().trim().max(200).optional(),
});

const sourceSchema = z.object({
  type: z.string().trim().min(1).max(30),
  id: idToken.nullish(),
});

export const createDocumentSchema = z.object({
  type: z.enum(DOC_TYPES),
  warehouseId: z.string().trim().min(1).max(128),
  source: sourceSchema,
  reason: z.string().trim().max(300).optional(),
  receiverUserId: z.string().trim().min(1).max(128).optional(),
  originalDocumentId: z.string().trim().min(1).max(160).optional(),
  lines: z.array(lineSchema).min(1).max(200),
});
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

export const updateDocumentSchema = createDocumentSchema
  .omit({ type: true, warehouseId: true })
  .extend({ version: z.number().int().min(1) });

const requireReason = (reason: string | undefined, field = 'reason'): void => {
  if (!reason || reason.trim().length < 5)
    throw validationFailed([{ field, message: 'Cần lý do (ít nhất 5 ký tự).' }]);
};

/** Which branch-state row governs a document: tied to an order or not (FR-SYS-011). */
function writeKind(type: StockDocType, source: StockDocSource): WriteKind {
  return (type === 'GIN' || type === 'RTN') && source.type === 'repair-order'
    ? 'edit_open_order'
    : 'free_stock_doc';
}

interface Built {
  source: StockDocSource;
  lines: StockDocLine[];
  parts: Map<string, Part>;
  original?: StockDocument;
  reasons: string[];
}

/** R75: an order with a valid invoice blocks stock returns until the invoice is cancelled or adjusted. Fail closed. */
async function assertNoValidInvoice(deps: InvDeps, scope: Scope, orderId: string): Promise<void> {
  let has: boolean;
  try {
    has = await deps.invoices.hasValidInvoice(scope, orderId);
  } catch {
    throw new AppError('invoice_check_unavailable', 409);
  }
  if (has) throw new AppError('order_has_valid_invoice', 409);
}

/**
 * Validates and normalises the editable part of a document (create and update share it).
 * All reads of the transaction happen here.
 */
async function build(
  deps: InvDeps,
  tx: Tx,
  actor: Actor,
  scope: Scope,
  branch: Branch,
  warehouseId: string,
  type: StockDocType,
  data: Omit<CreateDocumentInput, 'type' | 'warehouseId'>,
): Promise<Built> {
  if (data.lines.length > deps.inv.maxDocLines)
    throw validationFailed([
      { field: 'lines', message: `Tối đa ${deps.inv.maxDocLines} dòng cho mỗi chứng từ.` },
    ]);
  const source = guard(() =>
    checkSource(
      type,
      { type: data.source.type, id: data.source.id ?? null },
      { allowTransferOrder: deps.inv.allowTransferOrderSource },
    ),
  );
  const lines: StockDocLine[] = data.lines.map((l, i) => ({
    lineNo: i + 1,
    partId: l.partId,
    partCode: '',
    partName: '',
    qty: l.qty,
    ...(l.unitCostVnd !== undefined ? { unitCostVnd: l.unitCostVnd } : {}),
    ...(l.expectedQty !== undefined ? { expectedQty: l.expectedQty } : {}),
    ...(l.expectedUnitCostVnd !== undefined ? { expectedUnitCostVnd: l.expectedUnitCostVnd } : {}),
    ...(l.lineKey ? { lineKey: l.lineKey } : {}),
    ...(l.originalLineNo !== undefined ? { originalLineNo: l.originalLineNo } : {}),
    ...(l.note ? { note: l.note } : {}),
  }));
  // I20: a repair-order issue names the immutable order line it serves; without a key it is accepted only
  // when the order has ONE open demand line for the part, never by guessing the part code
  if (type === 'GIN' && source.type === 'repair-order' && source.id) {
    const demand = (
      await deps.reservations.listBySource(scope, 'repair-order', source.id, 200)
    ).filter((r) => !r.closed && r.warehouseId === warehouseId);
    const ambiguous: { field: string; message: string }[] = [];
    lines.forEach((l, i) => {
      if (l.lineKey) return;
      const cands = demand.filter((r) => r.partId === l.partId);
      if (cands.length === 1) l.lineKey = cands[0]!.lineKey;
      else if (cands.length > 1)
        ambiguous.push({
          field: `lines.${i}.lineKey`,
          message: 'Lệnh có nhiều dòng cùng phụ tùng này. Chọn dòng nhu cầu (lineKey) cần xuất.',
        });
    });
    if (ambiguous.length) throw validationFailed(ambiguous);
  }
  guard(() => checkLines(type, lines, { opening: source.type === 'opening-balance' }));
  if (type === 'ADJ' && source.type === 'manual-adjustment') requireReason(data.reason);
  if (type === 'GRN' && source.type === 'no-po') requireReason(data.reason);
  if (type === 'GIN' && source.type === 'repair-order' && !data.receiverUserId)
    throw validationFailed([
      { field: 'receiverUserId', message: 'Cần ghi người nhận phụ tùng (thợ).' },
    ]);
  if (data.receiverUserId) {
    const u = await deps.sys.users.getByIdInTx(tx, data.receiverUserId);
    if (!u || u.companyId !== actor.companyId)
      throw validationFailed([{ field: 'receiverUserId', message: 'Không tìm thấy người nhận.' }]);
  }
  const partIds = [...new Set(lines.map((l) => l.partId))];
  const found = await Promise.all(partIds.map((id) => deps.parts.getInTx(tx, scope, id)));
  const parts = new Map<string, Part>();
  found.forEach((p, i) => {
    if (!p)
      throw validationFailed([
        { field: 'lines', message: `Không tìm thấy phụ tùng ${partIds[i]}.` },
      ]);
    parts.set(p.id, p);
  });
  for (const l of lines) {
    const p = parts.get(l.partId)!;
    l.partCode = p.code;
    l.partName = p.name;
    if (p.status !== 'active' && (type === 'GRN' || (type === 'ADJ' && l.qty > 0)))
      throw new AppError('part_inactive', 409);
  }
  let original: StockDocument | undefined;
  // R75 (FR-INV-022): stock cannot come back for an order that has a valid invoice
  if (type === 'RTN' && source.type === 'repair-order' && source.id)
    await assertNoValidInvoice(deps, scope, source.id);
  if (type === 'RTN') {
    if (!data.originalDocumentId)
      throw validationFailed([
        { field: 'originalDocumentId', message: 'Cần phiếu xuất gốc của lệnh.' },
      ]);
    const o = await deps.documents.getInTx(tx, scope, data.originalDocumentId);
    if (
      !o ||
      o.type !== 'GIN' ||
      o.status !== 'posted' ||
      o.reversedBy ||
      o.warehouseId !== warehouseId ||
      o.source.type !== 'repair-order' ||
      o.source.id !== source.id
    )
      throw new AppError('original_invalid', 409);
    for (const l of lines) {
      const ol = o.lines.find((x) => x.lineNo === l.originalLineNo);
      if (!ol || ol.partId !== l.partId)
        throw validationFailed([
          { field: 'lines', message: `Dòng ${l.lineNo} không khớp phiếu xuất gốc.` },
        ]);
    }
    original = o;
  }
  const th = await resolveGrnThresholds(deps, actor.companyId, branch.id, today(deps));
  const reasons = approvalReasons({
    type,
    source,
    lines,
    priceVarianceBp: th.priceVarianceBp,
    qtyVarianceBp: th.qtyVarianceBp,
  });
  return { source, lines, parts, ...(original ? { original } : {}), reasons };
}

// ---- create / update / cancel ------------------------------------------------------------

/** Creates a DRAFT: no number, no stock effect. */
export async function createDocument(
  deps: InvDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'stock-doc:create');
  const data = parseInput(createDocumentSchema, input);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: 'POST /api/v1/inv/documents',
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf(data),
    },
    async (tx) => {
      const branchId = requireWorkingBranch(actor);
      const source = { type: data.source.type, id: data.source.id ?? null };
      const branch = await assertWritable(
        deps,
        tx,
        actor,
        scope,
        branchId,
        writeKind(data.type, source),
      );
      const w = await activeWarehouse(deps, tx, scope, data.warehouseId, branch.id);
      const built = await build(deps, tx, actor, scope, branch, w.id, data.type, data);
      const now = deps.sys.clock.now();
      const id = `stk_${deps.sys.newId()}`;
      const doc: StockDocument = {
        id,
        companyId: actor.companyId,
        branchId: branch.id,
        warehouseId: w.id,
        type: data.type,
        status: 'draft',
        number: null,
        draftRef: draftReference(id),
        businessDate: null,
        source: built.source,
        ...(data.reason ? { reason: data.reason } : {}),
        ...(data.receiverUserId ? { receiverUserId: data.receiverUserId } : {}),
        ...(data.originalDocumentId ? { originalDocumentId: data.originalDocumentId } : {}),
        lines: built.lines,
        totalValueVnd: 0,
        approvalReasons: built.reasons,
        createdAt: now,
        createdBy: actor.userId,
        updatedAt: now,
        updatedBy: actor.userId,
        version: 1,
      };
      deps.documents.create(tx, doc);
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: branch.id,
          entityType: 'stockDocument',
          entityId: id,
          action: 'stockDocument.create',
          after: { type: doc.type, source: doc.source.type, lines: doc.lines.length },
        }),
      );
      return { status: 201, body: toDocumentDto(doc, actor) };
    },
  );
}

/** Edits a draft (full replace of the editable fields). A posted document is never edited (RULE-010). */
export async function updateDocument(
  deps: InvDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx,
): Promise<DocumentDto> {
  const scope = resolveScope(actor, 'stock-doc:update');
  const data = parseInput(updateDocumentSchema, input);
  return deps.sys.uow.run(async (tx) => {
    const d = await deps.documents.getInTx(tx, scope, id);
    if (!d) throw notFound();
    if (d.version !== data.version) throw versionConflict();
    if (d.status !== 'draft') throw new AppError('state_invalid', 409);
    const branch = await assertWritable(
      deps,
      tx,
      actor,
      scope,
      d.branchId,
      writeKind(d.type, d.source),
    );
    await activeWarehouse(deps, tx, scope, d.warehouseId, branch.id);
    const built = await build(deps, tx, actor, scope, branch, d.warehouseId, d.type, data);
    const now = deps.sys.clock.now();
    const next: StockDocument = {
      ...d,
      source: built.source,
      lines: built.lines,
      approvalReasons: built.reasons,
      updatedAt: now,
      updatedBy: actor.userId,
      version: d.version + 1,
    };
    delete next.reason;
    delete next.receiverUserId;
    delete next.originalDocumentId;
    if (data.reason) next.reason = data.reason;
    if (data.receiverUserId) next.receiverUserId = data.receiverUserId;
    if (data.originalDocumentId) next.originalDocumentId = data.originalDocumentId;
    deps.documents.update(tx, id, {
      source: next.source,
      lines: next.lines,
      approvalReasons: next.approvalReasons,
      reason: next.reason ?? null,
      receiverUserId: next.receiverUserId ?? null,
      originalDocumentId: next.originalDocumentId ?? null,
      updatedAt: now,
      updatedBy: actor.userId,
      version: next.version,
    });
    deps.sys.audit.record(
      tx,
      auditEntry(deps.sys, actor, ctx, {
        branchId: d.branchId,
        entityType: 'stockDocument',
        entityId: id,
        action: 'stockDocument.update',
        before: { lines: d.lines.length },
        after: { lines: next.lines.length },
      }),
    );
    return toDocumentDto(next, actor);
  });
}

export const cancelSchema = z.object({
  reason: z.string().trim().min(5).max(300),
  version: z.number().int().min(1),
});

/** Cancels a draft. It never touched stock and never consumed a number (group B numbers are given at posting). */
export async function cancelDocument(
  deps: InvDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx,
): Promise<DocumentDto> {
  const scope = resolveScope(actor, 'stock-doc:update');
  const data = parseInput(cancelSchema, input);
  return deps.sys.uow.run(async (tx) => {
    const d = await deps.documents.getInTx(tx, scope, id);
    if (!d) throw notFound();
    if (d.version !== data.version) throw versionConflict();
    guard(() => assertTransition(d.status, 'cancelled'));
    await assertWritable(deps, tx, actor, scope, d.branchId, writeKind(d.type, d.source));
    const now = deps.sys.clock.now();
    deps.documents.update(tx, id, {
      status: 'cancelled',
      cancelReason: data.reason,
      updatedAt: now,
      updatedBy: actor.userId,
      version: d.version + 1,
    });
    deps.sys.audit.record(
      tx,
      auditEntry(deps.sys, actor, ctx, {
        branchId: d.branchId,
        entityType: 'stockDocument',
        entityId: id,
        action: 'stockDocument.cancel',
        before: { status: d.status },
        after: { status: 'cancelled' },
        reason: data.reason,
      }),
    );
    return toDocumentDto({ ...d, status: 'cancelled', version: d.version + 1 }, actor);
  });
}

// ---- posting -----------------------------------------------------------------------------

export const postSchema = z.object({ version: z.number().int().min(1) });

/** I15: per shortened hold, how many units a count cut from it (new unmet minus the unmet it had). */
function shortenedHolds(
  cuttable: Map<string, Reservation[]>,
  after: readonly Reservation[],
): { sourceId: string; partCode: string; qty: number }[] {
  const before = new Map([...cuttable.values()].flat().map((r) => [r.id, r] as const));
  return after.flatMap((r) => {
    const b = before.get(r.id);
    const qty = b ? r.unmetQty - b.unmetQty : 0;
    return qty > 0 ? [{ sourceId: r.sourceId, partCode: r.partCode, qty }] : [];
  });
}

interface Applied {
  lines: StockDocLine[];
  totalValueVnd: number;
  reservations: Reservation[];
  tallies: { id: string; documentId: string; lineNo: number; returnedQty: number }[];
}

interface LineResult {
  next: Quantities;
  /** signed like the stock change (receipt +, issue -) */
  value: number;
  unit: number;
  kind: 'receipt' | 'issue' | 'return' | 'adjust';
  reservationId: string | null;
}

/**
 * Applies the lines of a document to the balances (in memory) and queues the ledger rows.
 * Pure with respect to the store: reservations and return tallies were read by the caller.
 */
function applyLines(
  set: BalanceSet,
  method: CostMethod,
  doc: Pick<StockDocument, 'id' | 'type' | 'source' | 'warehouseId'>,
  number: string,
  lines: readonly StockDocLine[],
  holds: Map<string, Reservation>,
  original: StockDocument | undefined,
  returned: Map<number, number>,
  now: Date,
  actorId: string,
  /** ADJ with a negative line: holds of the warehouse x part, to shorten when the count falls below reserved (row 23) */
  cuttable: Map<string, Reservation[]> = new Map(),
): Applied {
  const out: StockDocLine[] = [];
  const touched = new Map<string, Reservation>();
  let total = 0;
  for (const l of lines) {
    const b = quantitiesOf(set.get(l.partId));
    const r: LineResult = guard((): LineResult => {
      if (doc.type === 'GRN') {
        const x = receive(b, method, l.qty, l.unitCostVnd!);
        return {
          next: x.next,
          value: x.valueVnd,
          unit: x.unitCostVnd,
          kind: 'receipt',
          reservationId: null,
        };
      }
      if (doc.type === 'GIN') {
        const rid = reservationId(
          doc.source.type,
          doc.source.id ?? '',
          l.lineKey ?? l.partId,
          doc.warehouseId,
        );
        const h = touched.get(rid) ?? holds.get(rid);
        if (doc.source.type === 'repair-order') {
          // I8 / RULE-007 / FR-INV-007: only parts the order demands, and never more than the demand still open (I3 cap)
          if (!h || h.closed) throw new InvRuleError('order_line_missing');
          if (l.qty > remainingDemand(h)) throw new InvRuleError('issue_exceeds_demand');
        }
        const fromHeld = h ? Math.min(l.qty, h.heldQty) : 0;
        const x = ledgerIssue(b, method, l.qty, fromHeld);
        if (h) {
          const issuedQty = h.issuedQty + l.qty;
          const heldQty = h.heldQty - fromHeld;
          const upd: Reservation = {
            ...h,
            issuedQty,
            heldQty,
            qty: Math.max(h.qty, issuedQty + heldQty),
            updatedAt: now,
            updatedBy: actorId,
            version: h.version + 1,
          };
          // the part of the demand served from available stock is no longer unmet
          upd.unmetQty = Math.max(0, upd.qty - issuedQty - heldQty);
          upd.status = holdStatus(upd);
          touched.set(rid, upd);
        }
        return {
          next: x.next,
          value: -x.valueVnd,
          unit: x.unitCostVnd,
          kind: 'issue',
          reservationId: h ? rid : null,
        };
      }
      if (doc.type === 'RTN') {
        const ol = original!.lines.find((o) => o.lineNo === l.originalLineNo)!;
        const already = returned.get(l.originalLineNo!) ?? 0;
        if (already + l.qty > ol.qty) throw new InvRuleError('return_exceeds_issued');
        returned.set(l.originalLineNo!, already + l.qty);
        // I5: returned parts re-enter at the VALUE they left with, pro rata to the quantity (cumulative, so the
        // last return of a line takes exactly the remainder and no dong is left over or created)
        const lineValue = Math.abs(ol.valueVnd ?? 0);
        const value =
          proportion(lineValue, already + l.qty, ol.qty) - proportion(lineValue, already, ol.qty);
        const x = receiveValue(b, l.qty, value);
        return {
          next: x.next,
          value: x.valueVnd,
          unit: x.unitCostVnd,
          kind: 'return',
          reservationId: null,
        };
      }
      if (l.qty > 0) {
        let x;
        if (l.unitCostVnd !== undefined) x = receive(b, method, l.qty, l.unitCostVnd);
        else {
          // I5: surplus defaults to the average cost; only an empty balance has no average to use
          if (b.onHand <= 0)
            throw new InvRuleError('line_invalid', { line: l.lineNo, why: 'cost' });
          x = receiveValue(b, l.qty, surplusValue(method, b, l.qty));
        }
        return {
          next: x.next,
          value: x.valueVnd,
          unit: x.unitCostVnd,
          kind: 'adjust',
          reservationId: null,
        };
      }
      // row 23: the count is a fact. When it falls below what is reserved, the holds given LAST are
      // shortened first; the lost part becomes their unmet quantity
      const outQty = -l.qty;
      const shortage = Math.max(0, outQty - (b.onHand - b.reserved));
      let cut = 0;
      if (shortage > 0) {
        const mine = [...(cuttable.get(l.partId) ?? [])].sort(
          (a, c) => c.createdAt.getTime() - a.createdAt.getTime() || c.id.localeCompare(a.id),
        );
        for (const h of mine) {
          if (cut >= shortage) break;
          const cur = touched.get(h.id) ?? h;
          const take = Math.min(cur.heldQty, shortage - cut);
          if (take <= 0) continue;
          const upd: Reservation = {
            ...cur,
            heldQty: cur.heldQty - take,
            unmetQty: cur.unmetQty + take,
            updatedAt: now,
            updatedBy: actorId,
            version: cur.version + 1,
          };
          upd.status = holdStatus(upd);
          touched.set(h.id, upd);
          cut += take;
        }
      }
      const x = ledgerIssue(b, method, outQty, cut);
      return {
        next: x.next,
        value: -x.valueVnd,
        unit: x.unitCostVnd,
        kind: 'adjust',
        reservationId: null,
      };
    });
    set.move(
      l.partId,
      r.next,
      {
        id: `${doc.id}#${l.lineNo}`,
        kind: r.kind,
        documentId: doc.id,
        documentNo: number,
        reservationId: r.reservationId,
        lineNo: l.lineNo,
        sourceType: doc.source.type,
        sourceId: doc.source.id,
        unitCostVnd: r.unit,
      },
      l.note,
    );
    total += Math.abs(r.value);
    out.push({ ...l, unitCostVnd: r.unit, valueVnd: r.value });
  }
  const tallies: Applied['tallies'] = [];
  if (doc.type === 'RTN')
    for (const [lineNo, qty] of returned)
      tallies.push({
        id: issueReturnId(original!.id, lineNo),
        documentId: original!.id,
        lineNo,
        returnedQty: qty,
      });
  return { lines: out, totalValueVnd: total, reservations: [...touched.values()], tallies };
}

/**
 * Posts a draft: allocates the official number, writes balances, the append-only ledger, reservation
 * consumption, the document and the audit entry in ONE transaction. Concurrent postings serialise on
 * the balance documents; the loser re-evaluates availability on the new state (no oversell, no
 * negative stock - FR-INV-019, RULE-008). Replays with the same Idempotency-Key return the stored
 * result.
 */
export async function postDocument(
  deps: InvDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = postScope(actor);
  const data = parseInput(postSchema, input);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/inv/documents/${id}:post`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf(data),
    },
    async (tx) => ({
      status: 200,
      body: await postDocumentInTx(deps, tx, actor, scope, id, data.version, ctx),
    }),
  );
}

async function postDocumentInTx(
  deps: InvDeps,
  tx: Tx,
  actor: Actor,
  scope: Scope,
  id: string,
  version: number,
  ctx: RequestCtx,
): Promise<DocumentDto> {
  const d = await deps.documents.getInTx(tx, scope, id);
  if (!d) throw notFound();
  if (d.version !== version) throw versionConflict();
  guard(() => assertTransition(d.status, 'posted'));
  const branch = await assertWritable(
    deps,
    tx,
    actor,
    scope,
    d.branchId,
    writeKind(d.type, d.source),
  );
  const w = await activeWarehouse(deps, tx, scope, d.warehouseId, branch.id);
  const built = await build(deps, tx, actor, scope, branch, w.id, d.type, {
    source: d.source,
    lines: d.lines,
    ...(d.reason ? { reason: d.reason } : {}),
    ...(d.receiverUserId ? { receiverUserId: d.receiverUserId } : {}),
    ...(d.originalDocumentId ? { originalDocumentId: d.originalDocumentId } : {}),
  });
  // authorisation: abnormal documents need a manager other than the creator
  if (built.reasons.length > 0) {
    if (!can(actor, 'stock-doc:approve', d.branchId))
      throw new AppError('stock_approval_required', 403);
    if (d.createdBy === actor.userId) throw new AppError('approver_must_differ', 409);
  } else if (!(
    can(actor, 'stock-doc:create', d.branchId) || can(actor, 'stock-doc:approve', d.branchId)
  )) {
    throw forbidden();
  }
  const date = today(deps);
  const { method } = await resolveCostMethod(deps, actor.companyId, date);
  const set = await BalanceSet.load(
    deps,
    tx,
    scope,
    w,
    d.lines.map((l) => built.parts.get(l.partId)!),
    actor.userId,
    date,
  );
  // reads that depend on the document type (reservations to consume, quantities already returned)
  const holds = new Map<string, Reservation>();
  if (d.type === 'GIN' && d.source.type === 'repair-order' && d.source.id) {
    const rids = [
      ...new Set(
        d.lines.map((l) =>
          reservationId('repair-order', d.source.id!, l.lineKey ?? l.partId, w.id),
        ),
      ),
    ];
    for (const r of await Promise.all(rids.map((rid) => deps.reservations.getInTx(tx, scope, rid))))
      if (r) holds.set(r.id, r);
  }
  // row 23: holds that a negative count may have to shorten (read now, before any write)
  const cuttable = new Map<string, Reservation[]>();
  if (d.type === 'ADJ')
    for (const l of d.lines.filter((x) => x.qty < 0)) {
      const page = await deps.reservations.listByPart(scope, {
        partId: l.partId,
        status: 'holding',
        limit: 100,
      });
      const fresh = await Promise.all(
        page.items
          .filter((r) => r.warehouseId === w.id && r.heldQty > 0)
          .map((r) => deps.reservations.getInTx(tx, scope, r.id)),
      );
      cuttable.set(
        l.partId,
        fresh.flatMap((r) => (r && r.heldQty > 0 ? [r] : [])),
      );
    }
  const returned = new Map<number, number>();
  if (d.type === 'RTN' && built.original) {
    const nos = [...new Set(d.lines.map((l) => l.originalLineNo!))];
    const rows = await Promise.all(
      nos.map((n) => deps.returns.getInTx(tx, scope, issueReturnId(built.original!.id, n))),
    );
    nos.forEach((n, i) => returned.set(n, rows[i]?.returnedQty ?? 0));
  }
  const alloc = await allocateDocumentNumber(deps.sys, tx, {
    branch,
    docType: DOC_SERIES[d.type],
    businessDate: date,
    stage: 'post',
    documentId: d.id,
    requestKey: `stock-doc:${d.id}`,
  });
  const number = alloc.number!;
  const now = deps.sys.clock.now();
  const applied = applyLines(
    set,
    method,
    d,
    number,
    d.lines,
    holds,
    built.original,
    returned,
    now,
    actor.userId,
    cuttable,
  );
  // I15: who must hear about holds a count cut. Recipients are read BEFORE the first write; a failing
  // lookup never blocks posting (the count is a fact, the notice is a courtesy)
  const cuts = d.type === 'ADJ' ? shortenedHolds(cuttable, applied.reservations) : [];
  let recipients: { managers: string[]; advisors: Map<string, string> } = {
    managers: [],
    advisors: new Map(),
  };
  if (cuts.length)
    try {
      recipients = {
        managers: await usersWithRole(deps.sys, actor.companyId, ['QL'], d.branchId),
        advisors: await deps.advisors.advisorsOf(
          actor.companyId,
          'repair-order',
          cuts.map((c) => c.sourceId),
        ),
      };
    } catch {
      /* notice skipped */
    }
  // ---- writes ----
  set.flush(tx);
  for (const c of cuts) {
    const advisor = recipients.advisors.get(c.sourceId);
    const to = [...recipients.managers, ...(advisor ? [advisor] : [])];
    if (to.length === 0) continue;
    try {
      notifyUsers(deps.sys, tx, {
        companyId: actor.companyId,
        userIds: to,
        kind: 'stock.reservation_shortened',
        titleKey: 'notifications.reservationShortened',
        // part code, order and quantity only: no personal data (BA §7.1)
        params: { partCode: c.partCode, orderId: c.sourceId, qty: String(c.qty) },
        link: `/inv/documents/${d.id}`,
        branchId: d.branchId,
      });
    } catch {
      /* staging a notice never blocks the ledger */
    }
  }
  for (const r of applied.reservations) {
    deps.reservations.update(tx, r.id, reservationPatch(r));
    deps.sys.audit.record(
      tx,
      auditEntry(deps.sys, actor, ctx, {
        branchId: r.branchId,
        entityType: 'stockReservation',
        entityId: r.id,
        action: d.type === 'ADJ' ? 'stockReservation.shorten' : 'stockReservation.consume',
        after: { heldQty: r.heldQty, issuedQty: r.issuedQty, unmetQty: r.unmetQty },
      }),
    );
  }
  for (const t of applied.tallies)
    deps.returns.save(tx, t.id, {
      companyId: d.companyId,
      branchId: d.branchId,
      documentId: t.documentId,
      lineNo: t.lineNo,
      returnedQty: t.returnedQty,
    });
  const posted: StockDocument = {
    ...d,
    status: 'posted',
    number,
    businessDate: date,
    lines: applied.lines,
    totalValueVnd: applied.totalValueVnd,
    approvalReasons: built.reasons,
    postedAt: now,
    postedBy: actor.userId,
    updatedAt: now,
    updatedBy: actor.userId,
    version: d.version + 1,
  };
  deps.documents.update(tx, d.id, {
    status: 'posted',
    number,
    businessDate: date,
    lines: posted.lines,
    totalValueVnd: posted.totalValueVnd,
    approvalReasons: built.reasons,
    postedAt: now,
    postedBy: actor.userId,
    updatedAt: now,
    updatedBy: actor.userId,
    version: posted.version,
  });
  deps.sys.audit.record(
    tx,
    auditEntry(deps.sys, actor, ctx, {
      branchId: d.branchId,
      entityType: 'stockDocument',
      entityId: d.id,
      action: 'stockDocument.post',
      before: { status: 'draft' },
      after: { status: 'posted', number, type: d.type, lines: posted.lines.length },
      ...(built.reasons.length ? { reason: built.reasons.join(',') } : {}),
    }),
  );
  return toDocumentDto(posted, actor);
}

/**
 * REC entry point (FR-INV-006/007): create and post a GIN for a repair order in one transaction.
 * The source is the order (RULE-007); the technician who receives the parts is recorded;
 * the order's own reservation is consumed first (BA-04 Câu 9). Idempotent by Idempotency-Key.
 */
const issueForOrderSchema = z.object({
  warehouseId: z.string().trim().min(1).max(128),
  orderId: idToken,
  receiverUserId: z.string().trim().min(1).max(128),
  lines: z
    .array(
      z.object({
        partId: z.string().trim().min(1).max(128),
        qty: z.number().int().min(1).max(1_000_000),
        lineKey: idToken.optional(),
      }),
    )
    .min(1)
    .max(200),
});
export type IssueForOrderInput = z.infer<typeof issueForOrderSchema>;

export async function issueForOrder(
  deps: InvDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const data = parseInput(issueForOrderSchema, input);
  const scope = resolveScope(actor, 'stock-doc:create');
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: 'POST /api/v1/inv/issues',
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf(data),
    },
    async (tx) => ({
      status: 201,
      body: await issueForOrderInTx(deps, tx, actor, scope, data, ctx),
    }),
  );
}

/**
 * The issue itself, inside the caller's transaction (REC marks its part request issued in the same
 * transaction). The caller must have done ALL its own reads before calling: this reads, then stages writes.
 * RULE-007: the source is the repair order; the caller (REC) has checked that the order and the line exist.
 */
export async function issueForOrderInTx(
  deps: InvDeps,
  tx: Tx,
  actor: Actor,
  scope: Scope,
  input: IssueForOrderInput,
  ctx: RequestCtx,
): Promise<DocumentDto> {
  const data = parseInput(issueForOrderSchema, input);
  const branchId = requireWorkingBranch(actor);
  const source = { type: 'repair-order', id: data.orderId };
  const branch = await assertWritable(deps, tx, actor, scope, branchId, 'edit_open_order');
  const w = await activeWarehouse(deps, tx, scope, data.warehouseId, branch.id);
  const built = await build(deps, tx, actor, scope, branch, w.id, 'GIN', {
    source,
    receiverUserId: data.receiverUserId,
    lines: data.lines,
  });
  const id = `stk_${deps.sys.newId()}`;
  const now = deps.sys.clock.now();
  const doc: StockDocument = {
    id,
    companyId: actor.companyId,
    branchId: branch.id,
    warehouseId: w.id,
    type: 'GIN',
    status: 'draft',
    number: null,
    draftRef: draftReference(id),
    businessDate: null,
    source: built.source,
    receiverUserId: data.receiverUserId,
    lines: built.lines,
    totalValueVnd: 0,
    approvalReasons: [],
    createdAt: now,
    createdBy: actor.userId,
    updatedAt: now,
    updatedBy: actor.userId,
    version: 1,
  };
  return postPreparedGin(deps, tx, actor, scope, doc, branch, built, ctx);
}

/** Posting path for a document created in the same transaction (its reads were already done by `build`). */
async function postPreparedGin(
  deps: InvDeps,
  tx: Tx,
  actor: Actor,
  scope: Scope,
  d: StockDocument,
  branch: Branch,
  built: Built,
  ctx: RequestCtx,
): Promise<DocumentDto> {
  const date = today(deps);
  const { method } = await resolveCostMethod(deps, actor.companyId, date);
  const set = await BalanceSet.load(
    deps,
    tx,
    scope,
    { id: d.warehouseId, branchId: d.branchId, companyId: d.companyId },
    d.lines.map((l) => built.parts.get(l.partId)!),
    actor.userId,
    date,
  );
  const holds = new Map<string, Reservation>();
  const rids = [
    ...new Set(
      d.lines.map((l) =>
        reservationId('repair-order', d.source.id!, l.lineKey ?? l.partId, d.warehouseId),
      ),
    ),
  ];
  for (const r of await Promise.all(rids.map((rid) => deps.reservations.getInTx(tx, scope, rid))))
    if (r) holds.set(r.id, r);
  const alloc = await allocateDocumentNumber(deps.sys, tx, {
    branch,
    docType: DOC_SERIES.GIN,
    businessDate: date,
    stage: 'post',
    documentId: d.id,
    requestKey: `stock-doc:${d.id}`,
  });
  const number = alloc.number!;
  const now = deps.sys.clock.now();
  const applied = applyLines(
    set,
    method,
    d,
    number,
    d.lines,
    holds,
    undefined,
    new Map(),
    now,
    actor.userId,
  );
  set.flush(tx);
  for (const r of applied.reservations) {
    deps.reservations.update(tx, r.id, reservationPatch(r));
    deps.sys.audit.record(
      tx,
      auditEntry(deps.sys, actor, ctx, {
        branchId: r.branchId,
        entityType: 'stockReservation',
        entityId: r.id,
        action: 'stockReservation.consume',
        after: { heldQty: r.heldQty, issuedQty: r.issuedQty, unmetQty: r.unmetQty },
      }),
    );
  }
  const posted: StockDocument = {
    ...d,
    status: 'posted',
    number,
    businessDate: date,
    lines: applied.lines,
    totalValueVnd: applied.totalValueVnd,
    postedAt: now,
    postedBy: actor.userId,
  };
  // created already posted: the draft never existed outside this transaction
  deps.documents.create(tx, posted);
  deps.sys.audit.record(
    tx,
    auditEntry(deps.sys, actor, ctx, {
      branchId: d.branchId,
      entityType: 'stockDocument',
      entityId: d.id,
      action: 'stockDocument.post',
      after: {
        status: 'posted',
        number,
        type: 'GIN',
        lines: posted.lines.length,
        order: d.source.id,
      },
    }),
  );
  return toDocumentDto(posted, actor);
}

// ---- reversal ------------------------------------------------------------------------------

export const reverseSchema = z.object({
  reason: z.string().trim().min(5).max(300),
  version: z.number().int().min(1),
});

/**
 * RULE-010: a posted document is corrected by a reversal document with its own number, linked both
 * ways; the original is never changed except for the `reversedBy` link. The reversal is refused when
 * stock to take back is no longer there (negative stock is blocked, FR-INV-019).
 */
export async function reverseDocument(
  deps: InvDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'stock-doc:approve');
  const data = parseInput(reverseSchema, input);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/inv/documents/${id}:reverse`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf(data),
    },
    async (tx) => {
      const o = await deps.documents.getInTx(tx, scope, id);
      if (!o) throw notFound();
      if (o.version !== data.version) throw versionConflict();
      if (o.status !== 'posted' || o.reversalOf || o.reversedBy)
        throw new AppError('state_invalid', 409);
      // R75: reversing an issue made for an order puts the parts back; blocked while the order has a valid invoice
      if (o.type === 'GIN' && o.source.type === 'repair-order' && o.source.id)
        await assertNoValidInvoice(deps, scope, o.source.id);
      const branch = await assertWritable(
        deps,
        tx,
        actor,
        scope,
        o.branchId,
        writeKind(o.type, o.source),
      );
      const w = await activeWarehouse(deps, tx, scope, o.warehouseId, branch.id);
      const parts = await deps.parts.getMany(
        scope,
        o.lines.map((l) => l.partId),
      );
      const date = today(deps);
      const set = await BalanceSet.load(
        deps,
        tx,
        scope,
        w,
        o.lines.map(
          (l) =>
            parts.find((p) => p.id === l.partId) ?? {
              id: l.partId,
              code: l.partCode,
              name: l.partName,
            },
        ),
        actor.userId,
        date,
      );
      const tallies = new Map<number, number>();
      if (o.type === 'RTN' && o.originalDocumentId) {
        const nos = [...new Set(o.lines.map((l) => l.originalLineNo!))];
        const rows = await Promise.all(
          nos.map((n) => deps.returns.getInTx(tx, scope, issueReturnId(o.originalDocumentId!, n))),
        );
        nos.forEach((n, i) => tallies.set(n, rows[i]?.returnedQty ?? 0));
      }
      // row 13: a reversed issue puts the demand back on the order line (if the line is still open)
      const lineHolds = new Map<string, Reservation>();
      if (o.type === 'GIN' && o.source.type === 'repair-order' && o.source.id) {
        const rids = [
          ...new Set(
            o.lines.map((l) =>
              reservationId('repair-order', o.source.id!, l.lineKey ?? l.partId, w.id),
            ),
          ),
        ];
        for (const r of await Promise.all(
          rids.map((rid) => deps.reservations.getInTx(tx, scope, rid)),
        ))
          if (r) lineHolds.set(r.id, r);
      }
      const alloc = await allocateDocumentNumber(deps.sys, tx, {
        branch,
        docType: DOC_SERIES[o.type],
        businessDate: date,
        stage: 'post',
        documentId: reversalId(o.id),
        requestKey: `stock-doc:${reversalId(o.id)}`,
      });
      const number = alloc.number!;
      const now = deps.sys.clock.now();
      const rid = reversalId(o.id);
      const restored = new Map<string, Reservation>();
      for (const l of o.lines) {
        const b = quantitiesOf(set.get(l.partId));
        // undo exactly what the original did: same quantity, same value
        // original on-hand effect: GRN +qty, GIN -qty, RTN +qty, ADJ +qty (signed)
        const onHand = o.type === 'GIN' ? l.qty : -l.qty;
        const value = -(l.valueVnd ?? 0);
        let heldBack = 0;
        if (o.type === 'GIN' && o.source.type === 'repair-order') {
          const rid2 = reservationId(
            'repair-order',
            o.source.id ?? '',
            l.lineKey ?? l.partId,
            w.id,
          );
          const h = restored.get(rid2) ?? lineHolds.get(rid2);
          if (h && !h.closed && h.issuedQty >= l.qty) {
            // hold what the restored stock can cover; the rest of the returned demand is unmet
            heldBack = Math.min(l.qty, b.onHand + onHand - b.reserved);
            const upd: Reservation = {
              ...h,
              issuedQty: h.issuedQty - l.qty,
              heldQty: h.heldQty + heldBack,
              unmetQty: h.unmetQty + (l.qty - heldBack),
              updatedAt: now,
              updatedBy: actor.userId,
              version: h.version + 1,
            };
            upd.status = holdStatus(upd);
            restored.set(rid2, upd);
          }
        }
        const next = guard(() =>
          applyEffect(b, { onHand, valueVnd: value, ...(heldBack ? { reserved: heldBack } : {}) }),
        );
        set.move(
          l.partId,
          next,
          {
            id: `${rid}#${l.lineNo}`,
            kind: 'reversal',
            documentId: rid,
            documentNo: number,
            reservationId: null,
            lineNo: l.lineNo,
            sourceType: o.source.type,
            sourceId: o.source.id,
            unitCostVnd: l.unitCostVnd ?? 0,
          },
          data.reason,
        );
        if (o.type === 'RTN')
          tallies.set(l.originalLineNo!, (tallies.get(l.originalLineNo!) ?? 0) - l.qty);
      }
      set.flush(tx);
      for (const r of restored.values()) {
        deps.reservations.update(tx, r.id, reservationPatch(r));
        deps.sys.audit.record(
          tx,
          auditEntry(deps.sys, actor, ctx, {
            branchId: r.branchId,
            entityType: 'stockReservation',
            entityId: r.id,
            action: 'stockReservation.restore',
            after: { heldQty: r.heldQty, issuedQty: r.issuedQty, unmetQty: r.unmetQty },
          }),
        );
      }
      if (o.type === 'RTN' && o.originalDocumentId)
        for (const [lineNo, qty] of tallies)
          deps.returns.save(tx, issueReturnId(o.originalDocumentId, lineNo), {
            companyId: o.companyId,
            branchId: o.branchId,
            documentId: o.originalDocumentId,
            lineNo,
            returnedQty: Math.max(0, qty),
          });
      const reversal: StockDocument = {
        ...o,
        id: rid,
        status: 'posted',
        number,
        draftRef: draftReference(rid),
        businessDate: date,
        reason: data.reason,
        reversalOf: o.id,
        approvalReasons: [],
        postedAt: now,
        postedBy: actor.userId,
        createdAt: now,
        createdBy: actor.userId,
        updatedAt: now,
        updatedBy: actor.userId,
        version: 1,
      };
      delete reversal.reversedBy;
      delete reversal.cancelReason;
      deps.documents.create(tx, reversal);
      deps.documents.update(tx, o.id, {
        reversedBy: rid,
        updatedAt: now,
        updatedBy: actor.userId,
        version: o.version + 1,
      });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: o.branchId,
          entityType: 'stockDocument',
          entityId: o.id,
          action: 'stockDocument.reverse',
          before: { status: 'posted', number: o.number },
          after: { reversal: number },
          reason: data.reason,
        }),
      );
      return { status: 201, body: toDocumentDto(reversal, actor) };
    },
  );
}

// ---- reads ---------------------------------------------------------------------------------

export async function getDocument(deps: InvDeps, actor: Actor, id: string): Promise<DocumentDto> {
  const scope = resolveScope(actor, 'stock-doc:view');
  const d = await deps.documents.get(scope, id);
  if (!d) throw notFound();
  return toDocumentDto(d, actor);
}

const listSchema = z.object({
  type: z.enum(DOC_TYPES).optional(),
  status: z.enum(['draft', 'posted', 'cancelled']).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  cursor: z.string().max(512).optional(),
});

/** G3-INV-08: documents of the working scope, newest first. */
export async function listDocuments(
  deps: InvDeps,
  actor: Actor,
  raw: unknown,
): Promise<Page<DocumentDto>> {
  const scope = resolveWorkingScope(actor, 'stock-doc:view');
  const q = parseInput(listSchema, raw);
  const page = await deps.documents.list(scope, {
    limit: q.limit,
    ...(q.type ? { type: q.type } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.cursor ? { cursor: decodeCursor(q.cursor)! } : {}),
  });
  return { items: page.items.map((d) => toDocumentDto(d, actor)), nextCursor: page.nextCursor };
}
