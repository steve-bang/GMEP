import { encodeCursor, type Page } from '@/platform/pagination/pagination';
import { scopeAllows, type Scope } from '@/platform/scope/scope';
import type { DocData, DocStore, StoredDoc } from '@/platform/store/docStore';
import type { Tx } from '@/platform/tx/unitOfWork';
import type {
  IssueReturnRepository,
  MovementRepository,
  Part,
  PartRepository,
  Reservation,
  ReservationRepository,
  StockBalance,
  StockBalanceRepository,
  StockDocument,
  StockDocumentRepository,
  StockMovement,
} from '@/modules/inv';
import { COL, Q } from './queries';

type Cur = { v: string; id: string } | undefined;
const without = <T extends object>(o: T, ...keys: (keyof T)[]) => {
  const c = { ...o } as Record<string, unknown>;
  for (const k of keys) delete c[k as string];
  return c as DocData;
};
/** upper bound of a string prefix range (U+F8FF is above every character used in codes and names) */
const prefixRange = (p: string) => ({ gte: p, lt: `${p}` });
const scopeParams = (scope: Scope) =>
  scope.kind === 'branches' ? { scopeBranches: scope.branchIds } : {};
const isoOf = (d: unknown) => (d instanceof Date ? d.toISOString() : String(d ?? ''));

/** limit+1 look-ahead page; `keyOf` is the value of the sort field of the last row */
function pageOf<T extends { id: string }>(
  rows: T[],
  limit: number,
  keyOf: (t: T) => string,
): Page<T> {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor: rows.length > limit && last ? encodeCursor({ v: keyOf(last), id: last.id }) : null,
  };
}

// ---- parts -----------------------------------------------------------------------------------

const partFromDoc = ({ id, data: x }: StoredDoc): Part => ({
  id,
  companyId: x.companyId,
  code: x.code,
  codeKey: x.codeKey,
  name: x.name,
  nameNorm: x.nameNorm,
  brand: x.brand ?? '',
  unit: x.unit,
  group: x.group,
  quantityScale: x.quantityScale ?? 1,
  ...(x.barcode ? { barcode: x.barcode } : {}),
  compat: x.compat ?? [],
  compatKeys: x.compatKeys ?? [],
  status: x.status,
  createdAt: x.createdAt,
  createdBy: x.createdBy,
  updatedAt: x.updatedAt,
  updatedBy: x.updatedBy,
  version: x.version,
});

const codeSlot = (companyId: string, codeKey: string) => `${companyId}__${codeKey}`;
const compatLinkId = (companyId: string, key: string, partId: string) =>
  `${companyId}__${key.replace(/[/]/g, '~')}__${partId}`;

export class DocPartRepository implements PartRepository {
  constructor(private readonly store: DocStore) {}

  async list(
    scope: Scope,
    q: {
      limit: number;
      cursor?: Cur;
      sort: 'code' | 'name';
      direction: 'asc' | 'desc';
      prefix?: string;
      group?: Part['group'];
      status?: Part['status'];
    },
  ): Promise<Page<Part>> {
    const optional = [...(q.group ? ['group'] : []), ...(q.status ? ['status'] : [])];
    const family = q.sort === 'code' ? Q.partsByCode : Q.partsByName;
    const shape = family.pick(optional, false);
    const rows = await this.store.query(shape, {
      eq: {
        companyId: scope.companyId,
        ...(q.group ? { group: q.group } : {}),
        ...(q.status ? { status: q.status } : {}),
      },
      ...(q.prefix ? { range: prefixRange(q.prefix) } : {}),
      ...(q.cursor ? { cursor: q.cursor } : {}),
      limit: q.limit + 1,
    });
    const field = q.sort === 'code' ? 'code' : 'nameNorm';
    return pageOf(
      rows.map(partFromDoc),
      q.limit,
      (p) => (p as unknown as Record<string, string>)[field]!,
    );
  }
  async get(scope: Scope, id: string) {
    const d = await this.store.get(COL.parts, id);
    const p = d ? partFromDoc(d) : null;
    return p && p.companyId === scope.companyId ? p : null;
  }
  async getInTx(tx: Tx, scope: Scope, id: string) {
    const d = await this.store.getInTx(tx, COL.parts, id);
    const p = d ? partFromDoc(d) : null;
    return p && p.companyId === scope.companyId ? p : null;
  }
  async getMany(scope: Scope, ids: readonly string[]) {
    const docs = await this.store.getMany(COL.parts, [...new Set(ids)]);
    return docs.map(partFromDoc).filter((p) => p.companyId === scope.companyId);
  }
  async idByCodeKey(scope: Scope, codeKey: string) {
    const d = await this.store.get(COL.partCodes, codeSlot(scope.companyId, codeKey));
    return d ? (d.data.partId as string) : null;
  }
  async idByBarcode(scope: Scope, barcode: string) {
    const d = await this.store.get(COL.partBarcodes, codeSlot(scope.companyId, barcode));
    return d ? (d.data.partId as string) : null;
  }
  async listByCompat(scope: Scope, compatKey: string, limit: number) {
    const rows = await this.store.query(Q.partCompatByModel.pick([], false), {
      eq: { companyId: scope.companyId, compatKey },
      limit,
    });
    return this.getMany(
      scope,
      rows.map((r) => r.data.partId as string),
    );
  }
  create(tx: Tx, p: Part) {
    // uniqueness slots are CREATED: a second part with the same code key or barcode fails the transaction (FR-INV-002)
    this.store.create(tx, COL.partCodes, codeSlot(p.companyId, p.codeKey), {
      companyId: p.companyId,
      partId: p.id,
    });
    if (p.barcode)
      this.store.create(tx, COL.partBarcodes, codeSlot(p.companyId, p.barcode), {
        companyId: p.companyId,
        partId: p.id,
      });
    this.store.create(tx, COL.parts, p.id, without(p, 'id'));
  }
  remove(
    tx: Tx,
    p: Pick<Part, 'id' | 'companyId' | 'code' | 'codeKey' | 'barcode' | 'compatKeys'>,
  ) {
    this.relinkCompat(tx, p, p.compatKeys, []);
    if (p.barcode) this.store.delete(tx, COL.partBarcodes, codeSlot(p.companyId, p.barcode));
    this.store.delete(tx, COL.partCodes, codeSlot(p.companyId, p.codeKey));
    this.store.delete(tx, COL.parts, p.id);
  }
  update(tx: Tx, id: string, patch: Record<string, unknown>) {
    this.store.update(tx, COL.parts, id, patch);
  }
  rebarcode(
    tx: Tx,
    p: Pick<Part, 'id' | 'companyId'>,
    from: string | undefined,
    to: string | undefined,
  ) {
    if (from) this.store.delete(tx, COL.partBarcodes, codeSlot(p.companyId, from));
    if (to)
      this.store.create(tx, COL.partBarcodes, codeSlot(p.companyId, to), {
        companyId: p.companyId,
        partId: p.id,
      });
  }
  relinkCompat(
    tx: Tx,
    p: Pick<Part, 'id' | 'companyId' | 'code'>,
    from: readonly string[],
    to: readonly string[],
  ) {
    for (const k of from)
      if (!to.includes(k))
        this.store.delete(tx, COL.partCompat, compatLinkId(p.companyId, k, p.id));
    for (const k of to)
      if (!from.includes(k))
        this.store.set(tx, COL.partCompat, compatLinkId(p.companyId, k, p.id), {
          companyId: p.companyId,
          compatKey: k,
          partId: p.id,
          code: p.code,
        });
  }
}

// ---- balances ----------------------------------------------------------------------------------

const balanceFromDoc = ({ id, data: x }: StoredDoc): StockBalance => ({
  id,
  companyId: x.companyId,
  branchId: x.branchId,
  warehouseId: x.warehouseId,
  partId: x.partId,
  partCode: x.partCode,
  partCodeNorm: x.partCodeNorm,
  partName: x.partName,
  onHand: x.onHand,
  reserved: x.reserved,
  inTransit: x.inTransit ?? 0,
  valueVnd: x.valueVnd ?? 0,
  minQty: x.minQty ?? null,
  maxQty: x.maxQty ?? null,
  lowStock: !!x.lowStock,
  nonZero: !!x.nonZero,
  seq: x.seq ?? 0,
  createdAt: x.createdAt,
  updatedAt: x.updatedAt,
});

export class DocStockBalanceRepository implements StockBalanceRepository {
  constructor(private readonly store: DocStore) {}

  async list(
    scope: Scope,
    q: {
      limit: number;
      cursor?: Cur;
      direction: 'asc' | 'desc';
      prefix?: string;
      warehouseId?: string;
      lowStock?: boolean;
    },
  ): Promise<Page<StockBalance>> {
    const optional = [
      ...(q.lowStock ? ['lowStock'] : []),
      ...(q.warehouseId ? ['warehouseId'] : []),
    ];
    const rows = await this.store.query(Q.stockByPart.pick(optional, scope.kind === 'branches'), {
      eq: {
        companyId: scope.companyId,
        ...(q.lowStock ? { lowStock: true } : {}),
        ...(q.warehouseId ? { warehouseId: q.warehouseId } : {}),
      },
      ...scopeParams(scope),
      ...(q.prefix ? { range: prefixRange(q.prefix) } : {}),
      ...(q.cursor ? { cursor: q.cursor } : {}),
      limit: q.limit + 1,
    });
    return pageOf(rows.map(balanceFromDoc), q.limit, (b) => b.partCodeNorm);
  }
  async listByPart(scope: Scope, partId: string, limit: number) {
    const rows = await this.store.query(Q.stockOfPart.pick([], scope.kind === 'branches'), {
      eq: { companyId: scope.companyId, partId },
      ...scopeParams(scope),
      limit,
    });
    return rows.map(balanceFromDoc);
  }
  async get(scope: Scope, id: string) {
    const d = await this.store.get(COL.stockBalances, id);
    const b = d ? balanceFromDoc(d) : null;
    return b && scopeAllows(scope, b.companyId, b.branchId) ? b : null;
  }
  async getInTx(tx: Tx, scope: Scope, id: string) {
    const d = await this.store.getInTx(tx, COL.stockBalances, id);
    const b = d ? balanceFromDoc(d) : null;
    return b && scopeAllows(scope, b.companyId, b.branchId) ? b : null;
  }
  save(tx: Tx, b: StockBalance) {
    this.store.set(tx, COL.stockBalances, b.id, without(b, 'id'));
  }
  async hasStock(companyId: string, warehouseId: string) {
    const rows = await this.store.query(Q.stockNonZero.pick([], false), {
      eq: { companyId, warehouseId, nonZero: true },
      limit: 1,
    });
    return rows.length > 0;
  }
}

// ---- movements ----------------------------------------------------------------------------------

const movementFromDoc = ({ id, data: x }: StoredDoc): StockMovement => ({
  id,
  companyId: x.companyId,
  branchId: x.branchId,
  warehouseId: x.warehouseId,
  partId: x.partId,
  partCode: x.partCode,
  kind: x.kind,
  documentId: x.documentId ?? null,
  documentNo: x.documentNo ?? null,
  reservationId: x.reservationId ?? null,
  lineNo: x.lineNo ?? null,
  sourceType: x.sourceType ?? null,
  sourceId: x.sourceId ?? null,
  onHandDelta: x.onHandDelta,
  reservedDelta: x.reservedDelta,
  inTransitDelta: x.inTransitDelta,
  valueDeltaVnd: x.valueDeltaVnd,
  unitCostVnd: x.unitCostVnd,
  onHandAfter: x.onHandAfter,
  reservedAfter: x.reservedAfter,
  inTransitAfter: x.inTransitAfter,
  valueAfterVnd: x.valueAfterVnd,
  seq: x.seq,
  at: x.at,
  businessDate: x.businessDate,
  actorId: x.actorId,
  ...(x.note ? { note: x.note } : {}),
});

export class DocMovementRepository implements MovementRepository {
  constructor(private readonly store: DocStore) {}
  append(tx: Tx, m: StockMovement) {
    // create-only: the ledger is append-only, there is no update or delete method (RULE-009)
    this.store.create(tx, COL.stockMovements, m.id, {
      ...without(m, 'id'),
      // zero-padded so the stock card orders strictly by the balance's own sequence, not by clock ties
      seqKey: String(m.seq).padStart(10, '0'),
    });
  }
  async listByBalance(
    scope: Scope,
    q: { limit: number; cursor?: Cur; warehouseId: string; partId: string },
  ) {
    const rows = await this.store.query(Q.movementsByBalance.pick([], scope.kind === 'branches'), {
      eq: { companyId: scope.companyId, warehouseId: q.warehouseId, partId: q.partId },
      ...scopeParams(scope),
      ...(q.cursor ? { cursor: q.cursor } : {}),
      limit: q.limit + 1,
    });
    return pageOf(rows.map(movementFromDoc), q.limit, (m) => String(m.seq).padStart(10, '0'));
  }
}

// ---- documents ------------------------------------------------------------------------------------

const documentFromDoc = ({ id, data: x }: StoredDoc): StockDocument => ({
  id,
  companyId: x.companyId,
  branchId: x.branchId,
  warehouseId: x.warehouseId,
  type: x.type,
  status: x.status,
  number: x.number ?? null,
  draftRef: x.draftRef,
  businessDate: x.businessDate ?? null,
  source: x.source,
  ...(x.reason ? { reason: x.reason } : {}),
  ...(x.receiverUserId ? { receiverUserId: x.receiverUserId } : {}),
  ...(x.originalDocumentId ? { originalDocumentId: x.originalDocumentId } : {}),
  lines: x.lines ?? [],
  totalValueVnd: x.totalValueVnd ?? 0,
  approvalReasons: x.approvalReasons ?? [],
  ...(x.postedAt ? { postedAt: x.postedAt } : {}),
  ...(x.postedBy ? { postedBy: x.postedBy } : {}),
  ...(x.reversalOf ? { reversalOf: x.reversalOf } : {}),
  ...(x.reversedBy ? { reversedBy: x.reversedBy } : {}),
  ...(x.cancelReason ? { cancelReason: x.cancelReason } : {}),
  createdAt: x.createdAt,
  createdBy: x.createdBy,
  updatedAt: x.updatedAt,
  updatedBy: x.updatedBy,
  version: x.version,
});

export class DocStockDocumentRepository implements StockDocumentRepository {
  constructor(private readonly store: DocStore) {}
  async list(
    scope: Scope,
    q: {
      limit: number;
      cursor?: Cur;
      type?: StockDocument['type'];
      status?: StockDocument['status'];
      warehouseId?: string;
    },
  ) {
    const optional = [...(q.type ? ['type'] : []), ...(q.status ? ['status'] : [])];
    const rows = await this.store.query(
      Q.stockDocuments.pick(optional, scope.kind === 'branches'),
      {
        eq: {
          companyId: scope.companyId,
          ...(q.type ? { type: q.type } : {}),
          ...(q.status ? { status: q.status } : {}),
        },
        ...scopeParams(scope),
        ...(q.cursor ? { cursor: q.cursor } : {}),
        limit: q.limit + 1,
      },
    );
    return pageOf(rows.map(documentFromDoc), q.limit, (d) => isoOf(d.createdAt));
  }
  async get(scope: Scope, id: string) {
    const d = await this.store.get(COL.stockDocuments, id);
    const x = d ? documentFromDoc(d) : null;
    return x && scopeAllows(scope, x.companyId, x.branchId) ? x : null;
  }
  async getInTx(tx: Tx, scope: Scope, id: string) {
    const d = await this.store.getInTx(tx, COL.stockDocuments, id);
    const x = d ? documentFromDoc(d) : null;
    return x && scopeAllows(scope, x.companyId, x.branchId) ? x : null;
  }
  create(tx: Tx, d: StockDocument) {
    this.store.create(tx, COL.stockDocuments, d.id, without(d, 'id'));
  }
  update(tx: Tx, id: string, patch: Record<string, unknown>) {
    this.store.update(tx, COL.stockDocuments, id, patch);
  }
  async listByWarehouseStatus(
    companyId: string,
    warehouseId: string,
    status: StockDocument['status'],
    limit: number,
  ) {
    const rows = await this.store.query(Q.stockDocumentsOpen.pick([], false), {
      eq: { companyId, warehouseId, status },
      limit,
    });
    return rows.map(documentFromDoc);
  }
  async listAllByWarehouseStatus(
    companyId: string,
    warehouseId: string,
    status: StockDocument['status'],
    maxDocs: number,
    PAGE = 500,
  ) {
    const out: StockDocument[] = [];
    let cursor: { v: string; id: string } | undefined;
    for (;;) {
      const rows = await this.store.query(Q.stockDocumentsOpen.pick([], false), {
        eq: { companyId, warehouseId, status },
        ...(cursor ? { cursor } : {}),
        limit: PAGE + 1,
      });
      const docs = rows.map(documentFromDoc);
      for (const d of docs.slice(0, PAGE)) {
        if (out.length >= maxDocs) return { docs: out, truncated: true };
        out.push(d);
      }
      const last = docs[PAGE - 1];
      if (docs.length <= PAGE || !last) return { docs: out, truncated: false };
      cursor = { v: isoOf(last.createdAt), id: last.id };
    }
  }
  async hasOpen(companyId: string, warehouseId: string) {
    const rows = await this.store.query(Q.stockDocumentsOpen.pick([], false), {
      eq: { companyId, warehouseId, status: 'draft' },
      limit: 1,
    });
    return rows.length > 0;
  }
}

// ---- reservations ---------------------------------------------------------------------------------

const reservationFromDoc = ({ id, data: x }: StoredDoc): Reservation => ({
  id,
  companyId: x.companyId,
  branchId: x.branchId,
  warehouseId: x.warehouseId,
  partId: x.partId,
  partCode: x.partCode,
  sourceType: x.sourceType,
  sourceId: x.sourceId,
  lineKey: x.lineKey,
  qty: x.qty,
  heldQty: x.heldQty,
  issuedQty: x.issuedQty,
  unmetQty: x.unmetQty ?? 0,
  closed: x.closed ?? false,
  status: x.status,
  opCount: x.opCount ?? 0,
  createdAt: x.createdAt,
  createdBy: x.createdBy,
  updatedAt: x.updatedAt,
  updatedBy: x.updatedBy,
  version: x.version,
});

export class DocReservationRepository implements ReservationRepository {
  constructor(private readonly store: DocStore) {}
  async get(scope: Scope, id: string) {
    const d = await this.store.get(COL.stockReservations, id);
    const r = d ? reservationFromDoc(d) : null;
    return r && scopeAllows(scope, r.companyId, r.branchId) ? r : null;
  }
  async getInTx(tx: Tx, scope: Scope, id: string) {
    const d = await this.store.getInTx(tx, COL.stockReservations, id);
    const r = d ? reservationFromDoc(d) : null;
    return r && scopeAllows(scope, r.companyId, r.branchId) ? r : null;
  }
  async listBySource(scope: Scope, sourceType: string, sourceId: string, limit: number) {
    const rows = await this.store.query(
      Q.reservationsBySource.pick([], scope.kind === 'branches'),
      {
        eq: { companyId: scope.companyId, sourceType, sourceId },
        ...scopeParams(scope),
        limit,
      },
    );
    return rows.map(reservationFromDoc);
  }
  async listByPart(
    scope: Scope,
    q: { limit: number; cursor?: Cur; partId: string; status?: Reservation['status'] },
  ) {
    const rows = await this.store.query(
      Q.reservationsByPart.pick(q.status ? ['status'] : [], scope.kind === 'branches'),
      {
        eq: {
          companyId: scope.companyId,
          partId: q.partId,
          ...(q.status ? { status: q.status } : {}),
        },
        ...scopeParams(scope),
        ...(q.cursor ? { cursor: q.cursor } : {}),
        limit: q.limit + 1,
      },
    );
    return pageOf(rows.map(reservationFromDoc), q.limit, (r) => isoOf(r.updatedAt));
  }
  async listOpen(scope: Scope, limit: number) {
    const rows = await this.store.query(Q.reservationsOpen.pick([], scope.kind === 'branches'), {
      eq: { companyId: scope.companyId, status: 'holding' },
      ...scopeParams(scope),
      limit,
    });
    return rows.map(reservationFromDoc);
  }
  create(tx: Tx, r: Reservation) {
    this.store.create(tx, COL.stockReservations, r.id, without(r, 'id'));
  }
  update(tx: Tx, id: string, patch: Record<string, unknown>) {
    this.store.update(tx, COL.stockReservations, id, patch);
  }
}

// ---- return tallies -------------------------------------------------------------------------------

export class DocIssueReturnRepository implements IssueReturnRepository {
  constructor(private readonly store: DocStore) {}
  async getInTx(tx: Tx, scope: Scope, id: string) {
    const d = await this.store.getInTx(tx, COL.issueReturns, id);
    if (!d || !scopeAllows(scope, d.data.companyId, d.data.branchId)) return null;
    return { returnedQty: d.data.returnedQty as number };
  }
  save(
    tx: Tx,
    id: string,
    v: {
      companyId: string;
      branchId: string;
      documentId: string;
      lineNo: number;
      returnedQty: number;
    },
  ) {
    this.store.set(tx, COL.issueReturns, id, v);
  }
}
