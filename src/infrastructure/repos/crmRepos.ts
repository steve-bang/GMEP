import { encodeCursor, type Page } from '@/platform/pagination/pagination';
import { scopeAllows, type Scope } from '@/platform/scope/scope';
import type { DocData, DocStore, QueryFamily, StoredDoc } from '@/platform/store/docStore';
import type { Tx } from '@/platform/tx/unitOfWork';
import {
  customerLinkId,
  plateKey,
  vinKey,
  vehicleLinkId,
  type Consent,
  type ConsentRepository,
  type Customer,
  type CustomerPii,
  type CustomerRepository,
  type DataRequest,
  type DataRequestRepository,
  type Ownership,
  type OwnershipRepository,
  type RelationSource,
  type Vehicle,
  type VehicleHistoryEntry,
  type VehicleHistoryRepository,
  type VehicleRepository,
} from '@/modules/crm';
import { COL, Q } from './queries';

type Cur = { v: string; id: string } | undefined;
const without = <T extends object>(o: T, ...keys: (keyof T)[]) => {
  const c = { ...o } as Record<string, unknown>;
  for (const k of keys) delete c[k as string];
  return c as DocData;
};
/** upper bound of a string prefix range */
const prefixRange = (p: string) => ({ gte: p, lt: `${p}` });
const scopeParams = (scope: Scope) =>
  scope.kind === 'branches' ? { scopeBranches: scope.branchIds } : {};

/** Company-level record visible to a scope through its `branchIds` relation array (BA §10.1.5). */
function visible(scope: Scope, doc: { companyId: string; branchIds: readonly string[] }): boolean {
  if (doc.companyId !== scope.companyId) return false;
  if (scope.kind === 'all') return true;
  return doc.branchIds.some((b) => scopeAllows(scope, doc.companyId, b));
}

/**
 * Lists a company-level entity for a scope. 'all' scopes read the entity collection; branch scopes
 * read the relation links, where an entity linked to several branches of the scope appears once per
 * link. Links of one entity are contiguous in the order (ids share the `entity~` prefix), so the page
 * is built over up to `limit * branches + 1` link rows and cut on an entity boundary: no duplicates
 * across pages and a correct cursor. Reads grow with the number of scope branches (H1 note).
 */
async function listViaLinks<E extends { id: string }>(args: {
  store: DocStore;
  scope: Scope;
  limit: number;
  cursor: Cur;
  direct: {
    family: QueryFamily;
    optionalEq: Record<string, string>;
    range?: { gte: string; lt: string };
  };
  links: {
    family: QueryFamily;
    optionalEq: Record<string, string>;
    range?: { gte: string; lt: string };
    entityField: string;
  };
  orderField: string;
  load: (ids: string[]) => Promise<E[]>;
  fromDoc: (d: StoredDoc) => E;
}): Promise<Page<E>> {
  const { store, scope, limit, cursor } = args;
  const optKeys = Object.keys(args.direct.optionalEq);
  if (scope.kind === 'all') {
    const shape = args.direct.family.pick(optKeys, false);
    const rows = await store.query(shape, {
      eq: { companyId: scope.companyId, ...args.direct.optionalEq },
      ...(args.direct.range ? { range: args.direct.range } : {}),
      ...(cursor ? { cursor } : {}),
      limit: limit + 1,
    });
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return {
      items: items.map(args.fromDoc),
      nextCursor:
        rows.length > limit && last
          ? encodeCursor({ v: String(last.data[args.orderField] ?? ''), id: last.id })
          : null,
    };
  }
  const B = scope.branchIds.length;
  const fetch = Math.min(limit * B + 1, 1000);
  const shape = args.links.family.pick(optKeys, true);
  const rows = await store.query(shape, {
    eq: { companyId: scope.companyId, ...args.links.optionalEq },
    ...scopeParams(scope),
    ...(args.links.range ? { range: args.links.range } : {}),
    ...(cursor ? { cursor } : {}),
    limit: fetch,
  });
  const picked: string[] = [];
  const seen = new Set<string>();
  let lastRow: StoredDoc | undefined;
  let more = false;
  for (const r of rows) {
    const eid = r.data[args.links.entityField] as string;
    if (!seen.has(eid)) {
      if (picked.length === limit) {
        more = true;
        break;
      }
      seen.add(eid);
      picked.push(eid);
    }
    lastRow = r;
  }
  const byId = new Map((await args.load(picked)).map((e) => [e.id, e] as const));
  return {
    items: picked.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])),
    nextCursor:
      more && lastRow
        ? encodeCursor({ v: String(lastRow.data[args.orderField] ?? ''), id: lastRow.id })
        : null,
  };
}

// ---- customers -----------------------------------------------------------------------

const customerFromDoc = ({ id, data: x }: StoredDoc): Customer => ({
  id,
  companyId: x.companyId,
  branchId: x.branchId,
  code: x.code,
  type: x.type,
  name: x.name,
  nameNorm: x.nameNorm,
  ...(x.taxCode ? { taxCode: x.taxCode } : {}),
  ...(x.contactName ? { contactName: x.contactName } : {}),
  labels: x.labels ?? [],
  status: x.status,
  vehicleCount: x.vehicleCount ?? 0,
  marketing: x.marketing ?? [],
  branchIds: x.branchIds ?? [],
  ...(x.anonymizedAt ? { anonymizedAt: x.anonymizedAt } : {}),
  createdAt: x.createdAt,
  createdBy: x.createdBy,
  updatedAt: x.updatedAt,
  updatedBy: x.updatedBy,
  version: x.version,
});

export class DocCustomerRepository implements CustomerRepository {
  constructor(private readonly store: DocStore) {}

  async list(
    scope: Scope,
    q: {
      limit: number;
      cursor?: Cur;
      type?: Customer['type'];
      namePrefix?: string;
      direction: 'asc' | 'desc';
    },
  ): Promise<Page<Customer>> {
    const opt: Record<string, string> = q.type ? { type: q.type } : {};
    const range = q.namePrefix ? prefixRange(q.namePrefix) : undefined;
    return listViaLinks<Customer>({
      store: this.store,
      scope,
      limit: q.limit,
      cursor: q.cursor,
      direct: {
        family: Q.customersByName[q.direction],
        optionalEq: opt,
        ...(range ? { range } : {}),
      },
      links: {
        family: Q.customerLinksByName[q.direction],
        optionalEq: opt,
        ...(range ? { range } : {}),
        entityField: 'customerId',
      },
      orderField: 'nameNorm',
      load: async (ids) => (await this.store.getMany(COL.customers, ids)).map(customerFromDoc),
      fromDoc: customerFromDoc,
    });
  }

  async get(scope: Scope, id: string) {
    const d = await this.store.get(COL.customers, id);
    const c = d ? customerFromDoc(d) : null;
    return c && visible(scope, c) ? c : null;
  }
  async getInTx(tx: Tx, scope: Scope, id: string) {
    const d = await this.store.getInTx(tx, COL.customers, id);
    const c = d ? customerFromDoc(d) : null;
    return c && visible(scope, c) ? c : null;
  }
  async getMany(scope: Scope, ids: readonly string[]) {
    if (ids.length === 0) return [];
    return (await this.store.getMany(COL.customers, ids))
      .map(customerFromDoc)
      .filter((c) => visible(scope, c));
  }
  async getCompanyWide(companyId: string, id: string) {
    const d = await this.store.get(COL.customers, id);
    const c = d ? customerFromDoc(d) : null;
    return c && c.companyId === companyId ? c : null;
  }
  async getCompanyWideInTx(tx: Tx, companyId: string, id: string) {
    const d = await this.store.getInTx(tx, COL.customers, id);
    const c = d ? customerFromDoc(d) : null;
    return c && c.companyId === companyId ? c : null;
  }

  create(tx: Tx, c: Customer, pii: CustomerPii) {
    this.store.create(tx, COL.customers, c.id, without(c, 'id'));
    this.store.create(tx, COL.customerPii, c.id, without(pii, 'customerId'));
  }
  update(tx: Tx, id: string, patch: Record<string, unknown>) {
    this.store.update(tx, COL.customers, id, patch);
  }
  link(
    tx: Tx,
    c: Pick<Customer, 'id' | 'companyId' | 'nameNorm' | 'type' | 'code'>,
    branchId: string,
    at: Date,
    relation: { source: RelationSource; by: string },
  ) {
    this.store.set(tx, COL.customerLinks, customerLinkId(c.id, branchId), {
      source: relation.source,
      createdBy: relation.by,
      companyId: c.companyId,
      customerId: c.id,
      branchId,
      nameNorm: c.nameNorm,
      type: c.type,
      code: c.code,
      createdAt: at,
    });
  }
  relink(
    tx: Tx,
    c: Pick<Customer, 'id' | 'companyId' | 'nameNorm' | 'type' | 'code' | 'branchIds'>,
  ) {
    for (const b of c.branchIds)
      this.store.update(tx, COL.customerLinks, customerLinkId(c.id, b), {
        nameNorm: c.nameNorm,
        type: c.type,
      });
  }

  async getPii(companyId: string, customerId: string) {
    const d = await this.store.get(COL.customerPii, customerId);
    return d && d.data.companyId === companyId ? piiFromDoc(d) : null;
  }
  async getPiiInTx(tx: Tx, companyId: string, customerId: string) {
    const d = await this.store.getInTx(tx, COL.customerPii, customerId);
    return d && d.data.companyId === companyId ? piiFromDoc(d) : null;
  }
  setPii(tx: Tx, customerId: string, patch: Record<string, unknown>) {
    this.store.update(tx, COL.customerPii, customerId, patch);
  }
  async customerIdsByPhone(
    companyId: string,
    phoneNorm: string,
    mode: 'exact' | 'prefix',
    limit: number,
  ) {
    if (!phoneNorm) return [];
    const rows = await this.store.query(Q.customerPiiByPhone.pick([], false), {
      eq: { companyId },
      range: prefixRange(phoneNorm),
      limit: mode === 'exact' ? Math.max(limit * 4, 20) : limit,
    });
    const hit = mode === 'exact' ? rows.filter((r) => r.data.phoneNorm === phoneNorm) : rows;
    return hit.slice(0, limit).map((r) => r.id);
  }
}

const piiFromDoc = ({ id, data: x }: StoredDoc): CustomerPii => ({
  customerId: id,
  companyId: x.companyId,
  ...(x.phone ? { phone: x.phone } : {}),
  ...(x.phoneNorm ? { phoneNorm: x.phoneNorm } : {}),
  ...(x.email ? { email: x.email } : {}),
  ...(x.address ? { address: x.address } : {}),
  createdAt: x.createdAt,
});

// ---- vehicles ------------------------------------------------------------------------

const vehicleFromDoc = ({ id, data: x }: StoredDoc): Vehicle => ({
  id,
  companyId: x.companyId,
  branchId: x.branchId,
  plate: x.plate,
  plateNorm: x.plateNorm,
  previousPlates: x.previousPlates ?? [],
  ...(x.vin ? { vin: x.vin } : {}),
  ...(x.engineNo ? { engineNo: x.engineNo } : {}),
  make: x.make,
  model: x.model,
  year: x.year,
  isCommercial: !!x.isCommercial,
  ...(x.lastKm !== undefined && x.lastKm !== null ? { lastKm: x.lastKm } : {}),
  ...(x.lastKmAt ? { lastKmAt: x.lastKmAt } : {}),
  ...(x.odometerReplacedAt ? { odometerReplacedAt: x.odometerReplacedAt } : {}),
  currentOwnerId: x.currentOwnerId ?? null,
  branchIds: x.branchIds ?? [],
  createdAt: x.createdAt,
  createdBy: x.createdBy,
  updatedAt: x.updatedAt,
  updatedBy: x.updatedBy,
  version: x.version,
});

export class DocVehicleRepository implements VehicleRepository {
  constructor(private readonly store: DocStore) {}

  async list(
    scope: Scope,
    q: { limit: number; cursor?: Cur; platePrefix?: string; direction: 'asc' | 'desc' },
  ) {
    const range = q.platePrefix ? prefixRange(q.platePrefix) : undefined;
    return listViaLinks<Vehicle>({
      store: this.store,
      scope,
      limit: q.limit,
      cursor: q.cursor,
      direct: {
        family: Q.vehiclesByPlate[q.direction],
        optionalEq: {},
        ...(range ? { range } : {}),
      },
      links: {
        family: Q.vehicleLinksByPlate[q.direction],
        optionalEq: {},
        ...(range ? { range } : {}),
        entityField: 'vehicleId',
      },
      orderField: 'plateNorm',
      load: async (ids) => (await this.store.getMany(COL.vehicles, ids)).map(vehicleFromDoc),
      fromDoc: vehicleFromDoc,
    });
  }
  async get(scope: Scope, id: string) {
    const d = await this.store.get(COL.vehicles, id);
    const v = d ? vehicleFromDoc(d) : null;
    return v && visible(scope, v) ? v : null;
  }
  async getInTx(tx: Tx, scope: Scope, id: string) {
    const d = await this.store.getInTx(tx, COL.vehicles, id);
    const v = d ? vehicleFromDoc(d) : null;
    return v && visible(scope, v) ? v : null;
  }
  async getMany(scope: Scope, ids: readonly string[]) {
    if (ids.length === 0) return [];
    return (await this.store.getMany(COL.vehicles, ids))
      .map(vehicleFromDoc)
      .filter((v) => visible(scope, v));
  }
  async getCompanyWide(companyId: string, id: string) {
    const d = await this.store.get(COL.vehicles, id);
    const v = d ? vehicleFromDoc(d) : null;
    return v && v.companyId === companyId ? v : null;
  }
  async getCompanyWideInTx(tx: Tx, companyId: string, id: string) {
    const d = await this.store.getInTx(tx, COL.vehicles, id);
    const v = d ? vehicleFromDoc(d) : null;
    return v && v.companyId === companyId ? v : null;
  }
  async vehicleIdByPlate(companyId: string, plateNorm: string) {
    const d = await this.store.get(COL.vehiclePlates, plateKey(companyId, plateNorm));
    return d ? (d.data.vehicleId as string) : null;
  }
  async vehicleIdByVin(companyId: string, vin: string) {
    const d = await this.store.get(COL.vehicleVins, vinKey(companyId, vin));
    return d ? (d.data.vehicleId as string) : null;
  }
  setVin(
    tx: Tx,
    v: Pick<Vehicle, 'id' | 'companyId'>,
    oldVin: string | null,
    newVin: string | null,
  ) {
    if (newVin)
      this.store.create(tx, COL.vehicleVins, vinKey(v.companyId, newVin), {
        companyId: v.companyId,
        vehicleId: v.id,
      });
    if (oldVin) this.store.delete(tx, COL.vehicleVins, vinKey(v.companyId, oldVin));
  }
  create(tx: Tx, v: Vehicle) {
    // the registry slot is created, not set: a taken plate fails the whole transaction (FR-CRM-002)
    this.store.create(tx, COL.vehiclePlates, plateKey(v.companyId, v.plateNorm), {
      companyId: v.companyId,
      vehicleId: v.id,
    });
    if (v.vin) this.setVin(tx, v, null, v.vin);
    this.store.create(tx, COL.vehicles, v.id, without(v, 'id'));
  }
  update(tx: Tx, id: string, patch: Record<string, unknown>) {
    this.store.update(tx, COL.vehicles, id, patch);
  }
  changePlate(
    tx: Tx,
    v: Pick<Vehicle, 'id' | 'companyId' | 'plateNorm' | 'branchIds'>,
    newPlateNorm: string,
  ) {
    this.store.create(tx, COL.vehiclePlates, plateKey(v.companyId, newPlateNorm), {
      companyId: v.companyId,
      vehicleId: v.id,
    });
    this.store.delete(tx, COL.vehiclePlates, plateKey(v.companyId, v.plateNorm));
    for (const b of v.branchIds)
      this.store.update(tx, COL.vehicleLinks, vehicleLinkId(v.id, b), { plateNorm: newPlateNorm });
  }
  link(tx: Tx, v: Pick<Vehicle, 'id' | 'companyId' | 'plateNorm'>, branchId: string, at: Date) {
    this.store.set(tx, COL.vehicleLinks, vehicleLinkId(v.id, branchId), {
      companyId: v.companyId,
      vehicleId: v.id,
      branchId,
      plateNorm: v.plateNorm,
      createdAt: at,
    });
  }
  async byCustomer(scope: Scope, customerId: string, limit: number) {
    const rows = await this.store.query(Q.vehiclesByOwner.pick([], false), {
      eq: { companyId: scope.companyId, currentOwnerId: customerId },
      limit,
    });
    return rows.map(vehicleFromDoc).filter((v) => visible(scope, v));
  }
}

// ---- ownership -------------------------------------------------------------------------

const ownershipFromDoc = ({ id, data: x }: StoredDoc): Ownership => ({
  id,
  companyId: x.companyId,
  vehicleId: x.vehicleId,
  customerId: x.customerId,
  from: x.from,
  to: x.to ?? null,
  branchId: x.branchId,
  ...(x.note ? { note: x.note } : {}),
  createdAt: x.createdAt,
  createdBy: x.createdBy,
});

export class DocOwnershipRepository implements OwnershipRepository {
  constructor(private readonly store: DocStore) {}
  async listByVehicle(companyId: string, vehicleId: string) {
    const rows = await this.store.query(Q.ownershipsByVehicle.pick([], false), {
      eq: { companyId, vehicleId },
      limit: 200,
    });
    return rows.map(ownershipFromDoc);
  }
  // Firestore queries are not transactional here: the vehicle document read in the same tx carries
  // the optimistic version, so a concurrent owner change makes this transaction retry.
  listByVehicleInTx(_tx: Tx, companyId: string, vehicleId: string) {
    return this.listByVehicle(companyId, vehicleId);
  }
  async listByCustomer(companyId: string, customerId: string, limit: number) {
    const rows = await this.store.query(Q.ownershipsByCustomer.pick([], false), {
      eq: { companyId, customerId },
      limit,
    });
    return rows.map(ownershipFromDoc);
  }
  create(tx: Tx, o: Ownership) {
    this.store.create(tx, COL.vehicleOwnerships, o.id, without(o, 'id'));
  }
  close(tx: Tx, id: string, to: string) {
    this.store.update(tx, COL.vehicleOwnerships, id, { to });
  }
}

// ---- consents ---------------------------------------------------------------------------

const consentFromDoc = ({ id, data: x }: StoredDoc): Consent => ({
  id,
  companyId: x.companyId,
  branchId: x.branchId,
  customerId: x.customerId,
  purpose: x.purpose,
  channel: x.channel,
  basis: x.basis,
  status: x.status,
  grantedAt: x.grantedAt,
  ...(x.evidenceKind ? { evidenceKind: x.evidenceKind } : {}),
  ...(x.evidenceRef ? { evidenceRef: x.evidenceRef } : {}),
  ...(x.evidence ? { evidence: x.evidence } : {}),
  ...(x.policyVersion ? { policyVersion: x.policyVersion } : {}),
  ...(x.withdrawnAt ? { withdrawnAt: x.withdrawnAt } : {}),
  ...(x.withdrawnBy ? { withdrawnBy: x.withdrawnBy } : {}),
  ...(x.withdrawnReason ? { withdrawnReason: x.withdrawnReason } : {}),
  createdBy: x.createdBy,
  version: x.version,
});

export class DocConsentRepository implements ConsentRepository {
  constructor(private readonly store: DocStore) {}
  async listByCustomer(companyId: string, customerId: string) {
    const rows = await this.store.query(Q.consentsByCustomer.pick([], false), {
      eq: { companyId, customerId },
      limit: 200,
    });
    return rows.map(consentFromDoc);
  }
  async get(companyId: string, id: string) {
    const d = await this.store.get(COL.consents, id);
    return d && d.data.companyId === companyId ? consentFromDoc(d) : null;
  }
  async getInTx(tx: Tx, companyId: string, id: string) {
    const d = await this.store.getInTx(tx, COL.consents, id);
    return d && d.data.companyId === companyId ? consentFromDoc(d) : null;
  }
  create(tx: Tx, c: Consent) {
    this.store.create(tx, COL.consents, c.id, without(c, 'id'));
  }
  update(tx: Tx, id: string, patch: Record<string, unknown>) {
    this.store.update(tx, COL.consents, id, patch);
  }
}

// ---- data-subject requests -----------------------------------------------------------------

const requestFromDoc = ({ id, data: x }: StoredDoc): DataRequest => ({
  id,
  companyId: x.companyId,
  branchId: x.branchId,
  code: x.code,
  customerId: x.customerId,
  type: x.type,
  status: x.status,
  receivedVia: x.receivedVia,
  receivedAt: x.receivedAt,
  internalDueAt: x.internalDueAt ?? x.dueAt,
  legalDueAt: x.legalDueAt ?? null,
  assigneeId: x.assigneeId ?? null,
  ...(x.note ? { note: x.note } : {}),
  ...(x.resultNote ? { resultNote: x.resultNote } : {}),
  ...(x.closedAt ? { closedAt: x.closedAt } : {}),
  ...(x.closedBy ? { closedBy: x.closedBy } : {}),
  ...(x.anonymizedAt ? { anonymizedAt: x.anonymizedAt } : {}),
  createdBy: x.createdBy,
  updatedAt: x.updatedAt,
  updatedBy: x.updatedBy,
  version: x.version,
});

export class DocDataRequestRepository implements DataRequestRepository {
  constructor(private readonly store: DocStore) {}
  async list(
    scope: Scope,
    q: { limit: number; cursor?: Cur; status?: DataRequest['status']; customerId?: string },
  ): Promise<Page<DataRequest>> {
    const opt = [...(q.status ? ['status'] : []), ...(q.customerId ? ['customerId'] : [])];
    const rows = await this.store.query(Q.dataRequests.pick(opt, scope.kind === 'branches'), {
      eq: {
        companyId: scope.companyId,
        ...(q.status ? { status: q.status } : {}),
        ...(q.customerId ? { customerId: q.customerId } : {}),
      },
      ...scopeParams(scope),
      ...(q.cursor ? { cursor: q.cursor } : {}),
      limit: q.limit + 1,
    });
    const items = rows.slice(0, q.limit);
    const last = items.at(-1);
    return {
      items: items.map(requestFromDoc),
      nextCursor:
        rows.length > q.limit && last
          ? encodeCursor({ v: (last.data.receivedAt as Date).toISOString(), id: last.id })
          : null,
    };
  }
  async get(scope: Scope, id: string) {
    const d = await this.store.get(COL.dataSubjectRequests, id);
    const r = d ? requestFromDoc(d) : null;
    return r && scopeAllows(scope, r.companyId, r.branchId) ? r : null;
  }
  async getInTx(tx: Tx, scope: Scope, id: string) {
    const d = await this.store.getInTx(tx, COL.dataSubjectRequests, id);
    const r = d ? requestFromDoc(d) : null;
    return r && scopeAllows(scope, r.companyId, r.branchId) ? r : null;
  }
  create(tx: Tx, r: DataRequest) {
    this.store.create(tx, COL.dataSubjectRequests, r.id, without(r, 'id'));
  }
  update(tx: Tx, id: string, patch: Record<string, unknown>) {
    this.store.update(tx, COL.dataSubjectRequests, id, patch);
  }
}

// ---- vehicle history projection ----------------------------------------------------------------

const historyFromDoc = ({ id, data: x }: StoredDoc): VehicleHistoryEntry => ({
  id,
  companyId: x.companyId,
  vehicleId: x.vehicleId,
  branchId: x.branchId,
  branchName: x.branchName,
  orderCode: x.orderCode,
  date: x.date,
  ...(x.km !== undefined && x.km !== null ? { km: x.km } : {}),
  items: x.items ?? [],
  parts: x.parts ?? [],
  ...(x.totalVnd !== undefined && x.totalVnd !== null ? { totalVnd: x.totalVnd } : {}),
  projectedAt: x.projectedAt,
});

export class DocVehicleHistoryRepository implements VehicleHistoryRepository {
  constructor(private readonly store: DocStore) {}
  /** Whitelist at the write boundary too: only the VehicleHistoryEntry fields are persisted. */
  upsert(tx: Tx, e: VehicleHistoryEntry) {
    const {
      id,
      companyId,
      vehicleId,
      branchId,
      branchName,
      orderCode,
      date,
      km,
      items,
      parts,
      totalVnd,
      projectedAt,
    } = e;
    this.store.set(tx, COL.vehicleHistory, id, {
      companyId,
      vehicleId,
      branchId,
      branchName,
      orderCode,
      date,
      km,
      items,
      parts,
      totalVnd,
      projectedAt,
    });
  }
  async listByVehicle(companyId: string, vehicleId: string, q: { limit: number; cursor?: Cur }) {
    const rows = await this.store.query(Q.vehicleHistory.pick([], false), {
      eq: { companyId, vehicleId },
      ...(q.cursor ? { cursor: q.cursor } : {}),
      limit: q.limit + 1,
    });
    const items = rows.slice(0, q.limit);
    const last = items.at(-1);
    return {
      items: items.map(historyFromDoc),
      nextCursor:
        rows.length > q.limit && last
          ? encodeCursor({ v: String(last.data.date), id: last.id })
          : null,
    };
  }
}
