import { encodeCursor, type Page } from '@/platform/pagination/pagination';
import { scopeAllows, type Scope } from '@/platform/scope/scope';
import type { DocData, DocStore, QueryFamily, StoredDoc } from '@/platform/store/docStore';
import type { Tx } from '@/platform/tx/unitOfWork';
import type {
  PartRequest,
  PartRequestRepository,
  PartRequestStatus,
  RepairItem,
  RepairItemRepository,
  RepairOrder,
  RepairOrderRepository,
  OrderStatus,
  Intake,
  IntakeRepository,
  IntakeStatus,
  Quote,
  QuoteStatus,
  QuoteRepository,
  QuoteLink,
  QuoteLinkRepository,
  QuoteOtpRepository,
  QuoteDeliveryRepository,
  QuoteOtpRecord,
  QuoteDelivery,
  MessageQueue,
  QuoteVersion,
  QuoteVersionRepository,
} from '@/modules/rec';
import { versionId } from '@/modules/rec';
import { COL, Q } from './queries';

type Cur = { v: string; id: string } | undefined;
const without = <T extends object>(o: T, ...keys: (keyof T)[]) => {
  const c = { ...o } as Record<string, unknown>;
  for (const k of keys) delete c[k as string];
  return c as DocData;
};
/** U+F8FF is above every character used in plates and numbers */
const prefixRange = (p: string) => ({ gte: p, lt: `${p}` });
const scopeParams = (scope: Scope) =>
  scope.kind === 'branches' ? { scopeBranches: scope.branchIds } : {};
const isoOf = (d: unknown) => (d instanceof Date ? d.toISOString() : String(d ?? ''));
/** optional fields are stored as null when cleared; the entity omits them */
const opt = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v);
const put = <K extends string, V>(k: K, v: V | null | undefined) =>
  v === null || v === undefined ? {} : ({ [k]: v } as Record<K, V>);

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

interface ListQ {
  limit: number;
  cursor?: Cur;
  status?: string;
  platePrefix?: string;
  numberPrefix?: string;
}

/** Picks the registered shape for text search (plate / number prefix) or the newest-first list. */
interface Families {
  list: QueryFamily;
  plate: QueryFamily;
  number: QueryFamily;
}
function listShape(fams: Families, scope: Scope, q: ListQ) {
  const optional = q.status ? ['status'] : [];
  const scoped = scope.kind === 'branches';
  if (q.numberPrefix)
    return {
      shape: fams.number.pick(optional, scoped),
      range: prefixRange(q.numberPrefix),
      key: 'number',
    };
  if (q.platePrefix)
    return {
      shape: fams.plate.pick(optional, scoped),
      range: prefixRange(q.platePrefix),
      key: 'plateNorm',
    };
  return { shape: fams.list.pick(optional, scoped), range: undefined, key: 'createdAt' };
}

async function listVia<T extends { id: string }>(
  store: DocStore,
  fams: Families,
  scope: Scope,
  q: ListQ,
  fromDoc: (d: StoredDoc) => T,
): Promise<Page<T>> {
  const { shape, range, key } = listShape(fams, scope, q);
  const rows = await store.query(shape, {
    eq: { companyId: scope.companyId, ...(q.status ? { status: q.status } : {}) },
    ...scopeParams(scope),
    ...(range ? { range } : {}),
    ...(q.cursor ? { cursor: q.cursor } : {}),
    limit: q.limit + 1,
  });
  return pageOf(rows.map(fromDoc), q.limit, (t) => {
    const v = (t as Record<string, unknown>)[key];
    return isoOf(v);
  });
}

// ---- intakes -------------------------------------------------------------------------------------

const intakeFromDoc = ({ id, data: x }: StoredDoc): Intake => ({
  id,
  companyId: x.companyId,
  branchId: x.branchId,
  number: x.number,
  status: x.status,
  vehicleId: x.vehicleId,
  customerId: x.customerId,
  plate: x.plate,
  plateNorm: x.plateNorm,
  vehicleLabel: x.vehicleLabel,
  customerName: x.customerName,
  lastKmAtOpen: x.lastKmAtOpen ?? null,
  step: x.step ?? 1,
  ...put('km', opt<number>(x.km)),
  ...put('kmReason', opt<Intake['kmReason']>(x.kmReason)),
  ...put('kmNote', opt<string>(x.kmNote)),
  ...put('kmAbnormal', opt<boolean>(x.kmAbnormal)),
  ...put('fuel', opt<Intake['fuel']>(x.fuel)),
  ...put('customerRequest', opt<string>(x.customerRequest)),
  ...put('condition', opt<string>(x.condition)),
  belongings: x.belongings ?? [],
  ...put('belongingsOther', opt<string>(x.belongingsOther)),
  ...put('serviceType', opt<Intake['serviceType']>(x.serviceType)),
  advisorId: x.advisorId,
  ...put('promisedDate', opt<string>(x.promisedDate)),
  ...put('promisedTime', opt<string>(x.promisedTime)),
  customerParts: x.customerParts ?? [],
  photos: x.photos ?? [],
  ...put('internalNote', opt<string>(x.internalNote)),
  ...put('quoteId', opt<string>(x.quoteId)),
  ...put('cancelReason', opt<string>(x.cancelReason)),
  ...put('completedAt', opt<Date>(x.completedAt)),
  createdAt: x.createdAt,
  createdBy: x.createdBy,
  updatedAt: x.updatedAt,
  updatedBy: x.updatedBy,
  version: x.version,
});

export class DocIntakeRepository implements IntakeRepository {
  constructor(private readonly store: DocStore) {}
  list(scope: Scope, q: ListQ) {
    return listVia(
      this.store,
      { list: Q.intakes, plate: Q.intakesByPlate, number: Q.intakesByNumber },
      scope,
      q,
      intakeFromDoc,
    );
  }
  async get(scope: Scope, id: string) {
    const d = await this.store.get(COL.intakes, id);
    const x = d ? intakeFromDoc(d) : null;
    return x && scopeAllows(scope, x.companyId, x.branchId) ? x : null;
  }
  async getInTx(tx: Tx, scope: Scope, id: string) {
    const d = await this.store.getInTx(tx, COL.intakes, id);
    const x = d ? intakeFromDoc(d) : null;
    return x && scopeAllows(scope, x.companyId, x.branchId) ? x : null;
  }
  async listByCustomer(companyId: string, customerId: string, status: IntakeStatus, limit: number) {
    const rows = await this.store.query(Q.intakesByCustomer.pick([], false), {
      eq: { companyId, customerId, status },
      limit,
    });
    return rows.map(intakeFromDoc);
  }
  create(tx: Tx, i: Intake) {
    this.store.create(tx, COL.intakes, i.id, without(i, 'id'));
  }
  update(tx: Tx, id: string, patch: Record<string, unknown>) {
    this.store.update(tx, COL.intakes, id, patch);
  }
}

// ---- quotes --------------------------------------------------------------------------------------

const quoteFromDoc = ({ id, data: x }: StoredDoc): Quote => ({
  id,
  companyId: x.companyId,
  branchId: x.branchId,
  number: x.number,
  intakeId: x.intakeId,
  vehicleId: x.vehicleId,
  customerId: x.customerId,
  plate: x.plate,
  plateNorm: x.plateNorm,
  vehicleLabel: x.vehicleLabel,
  customerName: x.customerName,
  advisorId: x.advisorId,
  ...put('supplementOfOrderId', opt<string>(x.supplementOfOrderId)),
  ...put('orderId', opt<string>(x.orderId)),
  currentN: x.currentN,
  status: x.status,
  ...put('validUntil', opt<string>(x.validUntil)),
  ...put('remindedFor', opt<string>(x.remindedFor)),
  totalVnd: x.totalVnd ?? 0,
  ...put('approvedTotalVnd', opt<number>(x.approvedTotalVnd)),
  createdAt: x.createdAt,
  createdBy: x.createdBy,
  updatedAt: x.updatedAt,
  updatedBy: x.updatedBy,
  version: x.version,
});

export class DocQuoteRepository implements QuoteRepository {
  constructor(private readonly store: DocStore) {}
  list(scope: Scope, q: ListQ) {
    return listVia(
      this.store,
      { list: Q.quotes, plate: Q.quotesByPlate, number: Q.quotesByNumber },
      scope,
      q,
      quoteFromDoc,
    );
  }
  async get(scope: Scope, id: string) {
    const d = await this.store.get(COL.quotes, id);
    const x = d ? quoteFromDoc(d) : null;
    return x && scopeAllows(scope, x.companyId, x.branchId) ? x : null;
  }
  async getInTx(tx: Tx, scope: Scope, id: string) {
    const d = await this.store.getInTx(tx, COL.quotes, id);
    const x = d ? quoteFromDoc(d) : null;
    return x && scopeAllows(scope, x.companyId, x.branchId) ? x : null;
  }
  async listByCustomer(companyId: string, customerId: string, status: QuoteStatus, limit: number) {
    const rows = await this.store.query(Q.quotesByCustomer.pick([], false), {
      eq: { companyId, customerId, status },
      limit,
    });
    return rows.map(quoteFromDoc);
  }
  create(tx: Tx, q: Quote) {
    this.store.create(tx, COL.quotes, q.id, without(q, 'id'));
  }
  update(tx: Tx, id: string, patch: Record<string, unknown>) {
    this.store.update(tx, COL.quotes, id, patch);
  }
}

// ---- quote versions ---------------------------------------------------------------------------------

const versionFromDoc = ({ id, data: x }: StoredDoc): QuoteVersion => ({
  id,
  quoteId: x.quoteId,
  companyId: x.companyId,
  branchId: x.branchId,
  n: x.n,
  status: x.status,
  items: x.items ?? [],
  totals: x.totals,
  taxes: x.taxes ?? [],
  pricedOn: x.pricedOn,
  ...put('note', opt<string>(x.note)),
  ...put('sentAt', opt<Date>(x.sentAt)),
  ...put('sentBy', opt<string>(x.sentBy)),
  ...put('validUntil', opt<string>(x.validUntil)),
  ...put('sentVia', opt<QuoteVersion['sentVia']>(x.sentVia)),
  ...put('replacedAt', opt<Date>(x.replacedAt)),
  ...put('replacedByN', opt<number>(x.replacedByN)),
  ...put('closedAt', opt<Date>(x.closedAt)),
  ...put('closedReason', opt<string>(x.closedReason)),
  ...put('rejectedAt', opt<Date>(x.rejectedAt)),
  ...put('rejectReason', opt<string>(x.rejectReason)),
  ...(x.rejectedBy === undefined ? {} : { rejectedBy: x.rejectedBy as string | null }),
  ...put('approval', opt<QuoteVersion['approval']>(x.approval)),
  ...put('linkHash', opt<string>(x.linkHash)),
  createdAt: x.createdAt,
  createdBy: x.createdBy,
  updatedAt: x.updatedAt,
  updatedBy: x.updatedBy,
  version: x.version,
});

export class DocQuoteVersionRepository implements QuoteVersionRepository {
  constructor(private readonly store: DocStore) {}
  async get(scope: Scope, id: string) {
    const d = await this.store.get(COL.quoteVersions, id);
    const x = d ? versionFromDoc(d) : null;
    return x && scopeAllows(scope, x.companyId, x.branchId) ? x : null;
  }
  async getInTx(tx: Tx, scope: Scope, id: string) {
    const d = await this.store.getInTx(tx, COL.quoteVersions, id);
    const x = d ? versionFromDoc(d) : null;
    return x && scopeAllows(scope, x.companyId, x.branchId) ? x : null;
  }
  async listByQuote(scope: Scope, quoteId: string, count: number) {
    // ids are deterministic (`<quote>__v<n>`): a bounded multi-get, no query or index needed
    const ids = Array.from({ length: count }, (_, i) => versionId(quoteId, i + 1));
    const rows = (await this.store.getMany(COL.quoteVersions, ids)).map(versionFromDoc);
    return rows
      .filter((v) => scopeAllows(scope, v.companyId, v.branchId))
      .sort((a, b) => a.n - b.n);
  }
  create(tx: Tx, v: QuoteVersion) {
    this.store.create(tx, COL.quoteVersions, v.id, without(v, 'id'));
  }
  update(tx: Tx, id: string, patch: Record<string, unknown>) {
    this.store.update(tx, COL.quoteVersions, id, patch);
  }
}

// ---- quote links ----------------------------------------------------------------------------------

const linkFromDoc = ({ id, data: x }: StoredDoc): QuoteLink => ({
  id,
  companyId: x.companyId,
  branchId: x.branchId,
  quoteId: x.quoteId,
  n: x.n,
  createdAt: x.createdAt,
  createdBy: x.createdBy,
  ...put('revokedAt', opt<Date>(x.revokedAt)),
  ...put('revokedReason', opt<string>(x.revokedReason)),
  ...put('usedAt', opt<Date>(x.usedAt)),
});

export class DocQuoteLinkRepository implements QuoteLinkRepository {
  constructor(private readonly store: DocStore) {}
  async find(hash: string) {
    const d = await this.store.get(COL.quoteLinks, hash);
    return d ? linkFromDoc(d) : null;
  }
  async findInTx(tx: Tx, hash: string) {
    const d = await this.store.getInTx(tx, COL.quoteLinks, hash);
    return d ? linkFromDoc(d) : null;
  }
  create(tx: Tx, l: QuoteLink) {
    this.store.create(tx, COL.quoteLinks, l.id, without(l, 'id'));
  }
  update(tx: Tx, hash: string, patch: Record<string, unknown>) {
    this.store.update(tx, COL.quoteLinks, hash, patch);
  }
}

// ---- A4: approval codes, quote-link deliveries and their queue (by key only) --------------------------

const clean = <T extends object>(x: T): T => {
  const c = { ...x } as Record<string, unknown>;
  for (const k of Object.keys(c)) if (c[k] === null) delete c[k];
  return c as T;
};
const asRec = <T extends object>({ id, data }: StoredDoc): T => clean({ id, ...data }) as T;

export class DocQuoteOtpRepository implements QuoteOtpRepository {
  constructor(private readonly store: DocStore) {}
  async get(linkId: string) {
    const d = await this.store.get(COL.quoteOtps, linkId);
    return d ? asRec<QuoteOtpRecord>(d) : null;
  }
  async getInTx(tx: Tx, linkId: string) {
    const d = await this.store.getInTx(tx, COL.quoteOtps, linkId);
    return d ? asRec<QuoteOtpRecord>(d) : null;
  }
  set(tx: Tx, r: QuoteOtpRecord) {
    this.store.set(tx, COL.quoteOtps, r.id, without(r, 'id'));
  }
  update(tx: Tx, linkId: string, patch: Record<string, unknown>) {
    this.store.update(tx, COL.quoteOtps, linkId, patch);
  }
  delete(tx: Tx, linkId: string) {
    this.store.delete(tx, COL.quoteOtps, linkId);
  }
}

export class DocQuoteDeliveryRepository implements QuoteDeliveryRepository {
  constructor(private readonly store: DocStore) {}
  private readonly allowed = (scope: Scope, x: { companyId: string; branchId: string }) =>
    scopeAllows(scope, x.companyId, x.branchId);
  async get(scope: Scope, id: string) {
    const d = await this.store.get(COL.messageDeliveries, id);
    const x = d ? asRec<QuoteDelivery>(d) : null;
    return x && this.allowed(scope, x) ? x : null;
  }
  async getInTx(tx: Tx, scope: Scope, id: string) {
    const d = await this.store.getInTx(tx, COL.messageDeliveries, id);
    const x = d ? asRec<QuoteDelivery>(d) : null;
    return x && this.allowed(scope, x) ? x : null;
  }
  create(tx: Tx, d: QuoteDelivery) {
    // create(): the deterministic id is the guard against a second delivery of the same request
    this.store.create(tx, COL.messageDeliveries, d.id, without(d, 'id'));
  }
  update(tx: Tx, id: string, patch: Record<string, unknown>) {
    this.store.update(tx, COL.messageDeliveries, id, patch);
  }
  async getQueue(scope: Scope, branchId: string) {
    const d = await this.store.get(COL.messageQueues, branchId);
    const x = d ? asRec<MessageQueue>(d) : null;
    return x && this.allowed(scope, x) ? x : null;
  }
  async getQueueInTx(tx: Tx, scope: Scope, branchId: string) {
    const d = await this.store.getInTx(tx, COL.messageQueues, branchId);
    const x = d ? asRec<MessageQueue>(d) : null;
    return x && this.allowed(scope, x) ? x : null;
  }
  saveQueue(tx: Tx, q: MessageQueue) {
    this.store.set(tx, COL.messageQueues, q.id, without(q, 'id'));
  }
}

// ---- repair orders (slice 1.6) ---------------------------------------------------------------------

const orderFromDoc = ({ id, data: x }: StoredDoc): RepairOrder => ({
  id,
  companyId: x.companyId,
  branchId: x.branchId,
  number: x.number,
  status: x.status,
  open: x.open === true,
  quoteId: x.quoteId,
  quoteNumber: x.quoteNumber,
  quoteVersionN: x.quoteVersionN,
  evidenceHash: x.evidenceHash,
  intakeId: x.intakeId,
  vehicleId: x.vehicleId,
  customerId: x.customerId,
  plate: x.plate,
  plateNorm: x.plateNorm,
  vehicleLabel: x.vehicleLabel,
  customerName: x.customerName,
  advisorId: x.advisorId,
  ...put('serviceType', opt<string>(x.serviceType)),
  ...put('workflowVersionId', opt<string>(x.workflowVersionId)),
  steps: x.steps ?? [],
  ...put('km', opt<number>(x.km)),
  ...put('promisedDate', opt<string>(x.promisedDate)),
  baseTotalVnd: x.baseTotalVnd ?? 0,
  totalVnd: x.totalVnd ?? 0,
  supplements: x.supplements ?? [],
  supplementQuoteIds: x.supplementQuoteIds ?? [],
  warehouseId: x.warehouseId ?? null,
  unmetLines: x.unmetLines ?? 0,
  itemCount: x.itemCount ?? 0,
  doneCount: x.doneCount ?? 0,
  ...put('pausedReason', opt<string>(x.pausedReason)),
  proposals: x.proposals ?? [],
  photos: x.photos ?? [],
  qcRuns: x.qcRuns ?? [],
  ...put('handover', opt<RepairOrder['handover']>(x.handover)),
  history: x.history ?? [],
  ...put('startedAt', opt<Date>(x.startedAt)),
  ...put('completedAt', opt<Date>(x.completedAt)),
  ...put('cancelledAt', opt<Date>(x.cancelledAt)),
  ...put('cancelReason', opt<string>(x.cancelReason)),
  createdAt: x.createdAt,
  createdBy: x.createdBy,
  updatedAt: x.updatedAt,
  updatedBy: x.updatedBy,
  version: x.version,
});

export class DocRepairOrderRepository implements RepairOrderRepository {
  constructor(private readonly store: DocStore) {}
  async list(
    scope: Scope,
    q: {
      limit: number;
      cursor?: Cur;
      status?: OrderStatus;
      platePrefix?: string;
      numberPrefix?: string;
    },
  ) {
    const scoped = scope.kind === 'branches';
    const text = q.numberPrefix
      ? { shape: Q.repairOrdersByNumber.pick([], scoped), key: 'number', range: q.numberPrefix }
      : q.platePrefix
        ? { shape: Q.repairOrdersByPlate.pick([], scoped), key: 'plateNorm', range: q.platePrefix }
        : null;
    const shape = text ? text.shape : Q.repairOrders.pick(q.status ? ['status'] : [], scoped);
    const rows = await this.store.query(shape, {
      eq: { companyId: scope.companyId, ...(!text && q.status ? { status: q.status } : {}) },
      ...scopeParams(scope),
      ...(text ? { range: prefixRange(text.range) } : {}),
      ...(q.cursor ? { cursor: q.cursor } : {}),
      limit: q.limit + 1,
    });
    let items = rows.map(orderFromDoc);
    // a text search cannot also filter by status in the index; the status is applied on the page
    if (text && q.status) items = items.filter((o) => o.status === q.status);
    return pageOf(items, q.limit, (o) =>
      text ? String((o as unknown as Record<string, unknown>)[text.key]) : isoOf(o.createdAt),
    );
  }
  async listOpen(scope: Scope, limit: number) {
    const rows = await this.store.query(Q.repairOrdersOpen.pick([], scope.kind === 'branches'), {
      eq: { companyId: scope.companyId, open: true },
      ...scopeParams(scope),
      limit,
    });
    return rows.map(orderFromDoc);
  }
  async get(scope: Scope, id: string) {
    const d = await this.store.get(COL.repairOrders, id);
    const x = d ? orderFromDoc(d) : null;
    return x && scopeAllows(scope, x.companyId, x.branchId) ? x : null;
  }
  async getInTx(tx: Tx, scope: Scope, id: string) {
    const d = await this.store.getInTx(tx, COL.repairOrders, id);
    const x = d ? orderFromDoc(d) : null;
    return x && scopeAllows(scope, x.companyId, x.branchId) ? x : null;
  }
  async getMany(companyId: string, ids: readonly string[]) {
    return (await this.store.getMany(COL.repairOrders, ids))
      .map(orderFromDoc)
      .filter((o) => o.companyId === companyId);
  }
  async listOpenByCustomer(companyId: string, customerId: string, limit: number) {
    const rows = await this.store.query(Q.repairOrdersByCustomer.pick([], false), {
      eq: { companyId, customerId, open: true },
      limit,
    });
    return rows.map(orderFromDoc);
  }
  create(tx: Tx, o: RepairOrder) {
    this.store.create(tx, COL.repairOrders, o.id, without(o, 'id'));
  }
  update(tx: Tx, id: string, patch: Record<string, unknown>) {
    this.store.update(tx, COL.repairOrders, id, patch);
  }
}

// ---- repair items ----------------------------------------------------------------------------------

const itemDocFrom = ({ id, data: x }: StoredDoc): RepairItem => ({
  id,
  companyId: x.companyId,
  branchId: x.branchId,
  orderId: x.orderId,
  no: x.no,
  seqKey: x.seqKey,
  origin: x.origin,
  sourceQuoteId: x.sourceQuoteId,
  sourceItemNo: x.sourceItemNo,
  name: x.name,
  necessity: x.necessity,
  lines: x.lines ?? [],
  subtotalVnd: x.subtotalVnd ?? 0,
  status: x.status,
  active: x.active === true,
  ...put('pauseReason', opt<string>(x.pauseReason)),
  waitingParts: x.waitingParts === true,
  technicianId: x.technicianId ?? null,
  technicianName: x.technicianName ?? null,
  assignments: x.assignments ?? [],
  events: x.events ?? [],
  workedMs: x.workedMs ?? 0,
  approvedMinutes: x.approvedMinutes ?? 0,
  orderNumber: x.orderNumber,
  plate: x.plate,
  vehicleLabel: x.vehicleLabel,
  createdAt: x.createdAt,
  createdBy: x.createdBy,
  updatedAt: x.updatedAt,
  updatedBy: x.updatedBy,
  version: x.version,
});

export class DocRepairItemRepository implements RepairItemRepository {
  constructor(private readonly store: DocStore) {}
  async get(scope: Scope, id: string) {
    const d = await this.store.get(COL.repairItems, id);
    const x = d ? itemDocFrom(d) : null;
    return x && scopeAllows(scope, x.companyId, x.branchId) ? x : null;
  }
  async getInTx(tx: Tx, scope: Scope, id: string) {
    const d = await this.store.getInTx(tx, COL.repairItems, id);
    const x = d ? itemDocFrom(d) : null;
    return x && scopeAllows(scope, x.companyId, x.branchId) ? x : null;
  }
  async listByOrder(scope: Scope, orderId: string, limit: number) {
    const rows = await this.store.query(Q.repairItemsByOrder.pick([], scope.kind === 'branches'), {
      eq: { companyId: scope.companyId, orderId },
      ...scopeParams(scope),
      limit,
    });
    return rows.map(itemDocFrom);
  }
  async listByOrderInTx(_tx: Tx, scope: Scope, orderId: string, limit: number) {
    // queries are not transactional reads on this port; callers use it after taking the order lock
    return this.listByOrder(scope, orderId, limit);
  }
  async listActiveByTechnician(scope: Scope, technicianId: string, limit: number) {
    const rows = await this.store.query(
      Q.repairItemsByTechnician.pick([], scope.kind === 'branches'),
      {
        eq: { companyId: scope.companyId, technicianId, active: true },
        ...scopeParams(scope),
        limit,
      },
    );
    return rows.map(itemDocFrom);
  }
  create(tx: Tx, i: RepairItem) {
    this.store.create(tx, COL.repairItems, i.id, without(i, 'id'));
  }
  update(tx: Tx, id: string, patch: Record<string, unknown>) {
    this.store.update(tx, COL.repairItems, id, patch);
  }
}

// ---- part requests ---------------------------------------------------------------------------------

const requestFromDoc = ({ id, data: x }: StoredDoc): PartRequest => ({
  id,
  companyId: x.companyId,
  branchId: x.branchId,
  orderId: x.orderId,
  orderNumber: x.orderNumber,
  itemId: x.itemId,
  lineKey: x.lineKey,
  partId: x.partId,
  partCode: x.partCode,
  partName: x.partName,
  qty: x.qty,
  qtyScale: x.qtyScale,
  status: x.status,
  requestedBy: x.requestedBy,
  requestedAt: x.requestedAt,
  receiverUserId: x.receiverUserId,
  ...put('note', opt<string>(x.note)),
  ...put('decidedBy', opt<string>(x.decidedBy)),
  ...put('decidedAt', opt<Date>(x.decidedAt)),
  ...put('rejectReason', opt<string>(x.rejectReason)),
  ...put('issueDocumentId', opt<string>(x.issueDocumentId)),
  ...put('issueDocumentNo', opt<string>(x.issueDocumentNo)),
  createdAt: x.createdAt,
  createdBy: x.createdBy,
  updatedAt: x.updatedAt,
  updatedBy: x.updatedBy,
  version: x.version,
});

export class DocPartRequestRepository implements PartRequestRepository {
  constructor(private readonly store: DocStore) {}
  async get(scope: Scope, id: string) {
    const d = await this.store.get(COL.partRequests, id);
    const x = d ? requestFromDoc(d) : null;
    return x && scopeAllows(scope, x.companyId, x.branchId) ? x : null;
  }
  async getInTx(tx: Tx, scope: Scope, id: string) {
    const d = await this.store.getInTx(tx, COL.partRequests, id);
    const x = d ? requestFromDoc(d) : null;
    return x && scopeAllows(scope, x.companyId, x.branchId) ? x : null;
  }
  async listByOrder(scope: Scope, orderId: string, limit: number) {
    const rows = await this.store.query(Q.partRequestsByOrder.pick([], scope.kind === 'branches'), {
      eq: { companyId: scope.companyId, orderId },
      ...scopeParams(scope),
      limit,
    });
    return rows.map(requestFromDoc);
  }
  async listByOrderInTx(_tx: Tx, scope: Scope, orderId: string, limit: number) {
    return this.listByOrder(scope, orderId, limit);
  }
  async listByStatus(scope: Scope, status: PartRequestStatus, limit: number) {
    const rows = await this.store.query(
      Q.partRequestsByStatus.pick([], scope.kind === 'branches'),
      { eq: { companyId: scope.companyId, status }, ...scopeParams(scope), limit },
    );
    return rows.map(requestFromDoc);
  }
  create(tx: Tx, r: PartRequest) {
    this.store.create(tx, COL.partRequests, r.id, without(r, 'id'));
  }
  update(tx: Tx, id: string, patch: Record<string, unknown>) {
    this.store.update(tx, COL.partRequests, id, patch);
  }
}
