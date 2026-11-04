import { encodeCursor, type Page } from '@/platform/pagination/pagination';
import { scopeAllows, type Scope } from '@/platform/scope/scope';
import type { DocData, DocStore, QueryFamily, StoredDoc } from '@/platform/store/docStore';
import type { Tx } from '@/platform/tx/unitOfWork';
import type {
  Intake,
  IntakeRepository,
  Quote,
  QuoteRepository,
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
  currentN: x.currentN,
  status: x.status,
  totalVnd: x.totalVnd ?? 0,
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
  tax: x.tax ?? null,
  pricedOn: x.pricedOn,
  ...put('note', opt<string>(x.note)),
  ...put('sentAt', opt<Date>(x.sentAt)),
  ...put('sentBy', opt<string>(x.sentBy)),
  ...put('validUntil', opt<string>(x.validUntil)),
  ...put('replacedAt', opt<Date>(x.replacedAt)),
  ...put('replacedByN', opt<number>(x.replacedByN)),
  ...put('rejectedAt', opt<Date>(x.rejectedAt)),
  ...put('rejectReason', opt<string>(x.rejectReason)),
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
