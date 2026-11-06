import { encodeCursor, type Page } from '@/platform/pagination/pagination';
import { scopeAllows, type Scope } from '@/platform/scope/scope';
import type { DocData, DocStore, StoredDoc } from '@/platform/store/docStore';
import type { Tx } from '@/platform/tx/unitOfWork';
import type {
  Invoice,
  InvoiceArtifacts,
  InvoicePii,
  InvoiceQueue,
  InvoiceQueueRepository,
  InvoiceRepository,
  InvoiceRequest,
  InvoiceRequestRepository,
  OrderInvoiceIndex,
  OrderInvoiceIndexRepository,
} from '@/modules/ein';
import { COL, Q } from './queries';

const without = <T extends object>(o: T, ...keys: (keyof T)[]) => {
  const c = { ...o } as Record<string, unknown>;
  for (const k of keys) delete c[k as string];
  return c as DocData;
};
const inScope = (scope: Scope, x: { tenantId: string; branchId: string }) =>
  scopeAllows(scope, x.tenantId, x.branchId);
/** optional fields are stored as null when cleared; the entity omits them */
const clean = <T extends object>(x: T): T => {
  const c = { ...x } as Record<string, unknown>;
  for (const k of Object.keys(c)) if (c[k] === null) delete c[k];
  return c as T;
};
const asEntity = <T extends object>({ id, data }: StoredDoc): T => clean({ id, ...data }) as T;
const isoOf = (d: unknown) => (d instanceof Date ? d.toISOString() : String(d ?? ''));

export class DocInvoiceRepository implements InvoiceRepository {
  constructor(private readonly store: DocStore) {}
  async get(scope: Scope, id: string) {
    const d = await this.store.get(COL.invoices, id);
    const x = d ? asEntity<Invoice>(d) : null;
    return x && inScope(scope, x) ? x : null;
  }
  async getInTx(tx: Tx, scope: Scope, id: string) {
    const d = await this.store.getInTx(tx, COL.invoices, id);
    const x = d ? asEntity<Invoice>(d) : null;
    return x && inScope(scope, x) ? x : null;
  }
  async getMany(scope: Scope, ids: readonly string[]) {
    if (ids.length === 0) return [];
    const docs = await this.store.getMany(COL.invoices, ids);
    return docs.map((d) => asEntity<Invoice>(d)).filter((x) => inScope(scope, x));
  }
  async listByBranch(
    scope: Scope,
    branchId: string,
    q: { limit: number; cursor?: { v: string; id: string }; from?: Date; to?: Date },
  ): Promise<Page<Invoice>> {
    if (!scopeAllows(scope, scope.tenantId, branchId)) return { items: [], nextCursor: null };
    const rows = await this.store.query(Q.invoicesByBranch.pick([], false), {
      eq: { tenantId: scope.tenantId, branchId },
      ...(q.from || q.to
        ? { range: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lt: q.to } : {}) } }
        : {}),
      ...(q.cursor ? { cursor: q.cursor } : {}),
      limit: q.limit + 1,
    });
    const items = rows.map((r) => asEntity<Invoice>(r)).slice(0, q.limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        rows.length > q.limit && last
          ? encodeCursor({ v: isoOf(last.createdAt), id: last.id })
          : null,
    };
  }
  create(tx: Tx, i: Invoice) {
    this.store.create(tx, COL.invoices, i.id, without(i, 'id'));
  }
  update(tx: Tx, id: string, patch: Record<string, unknown>) {
    this.store.update(tx, COL.invoices, id, patch);
  }
  async getPii(scope: Scope, id: string) {
    const d = await this.store.get(COL.invoicePii, id);
    const x = d ? asEntity<InvoicePii>(d) : null;
    return x && inScope(scope, x) ? x : null;
  }
  async getPiiInTx(tx: Tx, scope: Scope, id: string) {
    const d = await this.store.getInTx(tx, COL.invoicePii, id);
    const x = d ? asEntity<InvoicePii>(d) : null;
    return x && inScope(scope, x) ? x : null;
  }
  savePii(tx: Tx, p: InvoicePii) {
    this.store.set(tx, COL.invoicePii, p.id, without(p, 'id'));
  }
  async getArtifacts(scope: Scope, id: string) {
    const d = await this.store.get(COL.invoiceArtifacts, id);
    const x = d ? asEntity<InvoiceArtifacts>(d) : null;
    return x && inScope(scope, x) ? x : null;
  }
  saveArtifacts(tx: Tx, a: InvoiceArtifacts) {
    this.store.set(tx, COL.invoiceArtifacts, a.id, without(a, 'id'));
  }
}

export class DocInvoiceRequestRepository implements InvoiceRequestRepository {
  constructor(private readonly store: DocStore) {}
  async get(scope: Scope, id: string) {
    const d = await this.store.get(COL.invoiceRequests, id);
    const x = d ? asEntity<InvoiceRequest>(d) : null;
    return x && inScope(scope, x) ? x : null;
  }
  async getInTx(tx: Tx, scope: Scope, id: string) {
    const d = await this.store.getInTx(tx, COL.invoiceRequests, id);
    const x = d ? asEntity<InvoiceRequest>(d) : null;
    return x && inScope(scope, x) ? x : null;
  }
  async getMany(scope: Scope, ids: readonly string[]) {
    if (ids.length === 0) return [];
    const docs = await this.store.getMany(COL.invoiceRequests, ids);
    return docs.map((d) => asEntity<InvoiceRequest>(d)).filter((x) => inScope(scope, x));
  }
  create(tx: Tx, r: InvoiceRequest) {
    // create(): the deterministic id is the business uniqueness guard (FR-EIN-013), it never expires
    this.store.create(tx, COL.invoiceRequests, r.id, without(r, 'id'));
  }
  update(tx: Tx, id: string, patch: Record<string, unknown>) {
    this.store.update(tx, COL.invoiceRequests, id, patch);
  }
}

export class DocOrderInvoiceIndexRepository implements OrderInvoiceIndexRepository {
  constructor(private readonly store: DocStore) {}
  async get(scope: Scope, orderId: string) {
    const d = await this.store.get(COL.einOrders, orderId);
    const x = d ? asEntity<OrderInvoiceIndex>(d) : null;
    return x && inScope(scope, x) ? x : null;
  }
  async getInTx(tx: Tx, scope: Scope, orderId: string) {
    const d = await this.store.getInTx(tx, COL.einOrders, orderId);
    const x = d ? asEntity<OrderInvoiceIndex>(d) : null;
    return x && inScope(scope, x) ? x : null;
  }
  async getMany(scope: Scope, orderIds: readonly string[]) {
    if (orderIds.length === 0) return [];
    const docs = await this.store.getMany(COL.einOrders, orderIds);
    return docs.map((d) => asEntity<OrderInvoiceIndex>(d)).filter((x) => inScope(scope, x));
  }
  save(tx: Tx, x: OrderInvoiceIndex) {
    this.store.set(tx, COL.einOrders, x.id, without(x, 'id'));
  }
}

export class DocInvoiceQueueRepository implements InvoiceQueueRepository {
  constructor(private readonly store: DocStore) {}
  async get(scope: Scope, branchId: string) {
    const d = await this.store.get(COL.invoiceQueues, branchId);
    const x = d ? asEntity<InvoiceQueue>(d) : null;
    return x && inScope(scope, x) ? x : null;
  }
  async getInTx(tx: Tx, scope: Scope, branchId: string) {
    const d = await this.store.getInTx(tx, COL.invoiceQueues, branchId);
    const x = d ? asEntity<InvoiceQueue>(d) : null;
    return x && inScope(scope, x) ? x : null;
  }
  save(tx: Tx, q: InvoiceQueue) {
    this.store.set(tx, COL.invoiceQueues, q.id, without(q, 'id'));
  }
}
