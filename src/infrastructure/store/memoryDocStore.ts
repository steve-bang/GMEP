/**
 * IN-MEMORY adapters. TEST / LOCAL USE ONLY - not a substitute for Firestore.
 * Semantics deliberately mirror Firestore transactions where it matters for the tests:
 * writes are staged and applied atomically at commit, a thrown error discards all staged writes,
 * reads see only committed state, `create` fails when the document exists, and transactions are
 * serialised (stronger than Firestore, which retries on contention).
 * It does NOT model indexes, query limits, latency or contention retries; the query CATALOGUE
 * check (assertRegistered) is enforced here too, so an uncatalogued query fails in every adapter.
 */
import {
  AlreadyExistsError,
  assertParams,
  assertRegistered,
  type DocData,
  type DocStore,
  type QueryParams,
  type QueryShape,
  type StoreStats,
  type StoredDoc,
} from '@/platform/store/docStore';
import type { Tx, UnitOfWork } from '@/platform/tx/unitOfWork';

export class MemoryDb {
  private readonly cols = new Map<string, Map<string, DocData>>();
  col<T = DocData>(name: string): Map<string, T> {
    let c = this.cols.get(name);
    if (!c) this.cols.set(name, (c = new Map()));
    return c as unknown as Map<string, T>;
  }
}

class MemoryTx {
  readonly staged: { check: () => void; apply: () => void }[] = [];
  constructor(readonly db: MemoryDb) {}
  stage(check: () => void, apply: () => void) {
    this.staged.push({ check, apply });
  }
}

function asTx(tx: Tx): MemoryTx {
  if (!(tx instanceof MemoryTx))
    throw new Error('Transaction handle does not belong to the memory adapter');
  return tx;
}

export class MemoryUnitOfWork implements UnitOfWork {
  private chain: Promise<void> = Promise.resolve();
  constructor(private readonly db: MemoryDb) {}
  async run<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const previous = this.chain;
    let release!: () => void;
    this.chain = new Promise<void>((r) => (release = r));
    await previous;
    try {
      const tx = new MemoryTx(this.db);
      const result = await fn(tx as unknown as Tx);
      // commit: like Firestore, conflicts surface here (not at stage time) and are all-or-nothing
      for (const w of tx.staged) w.check();
      for (const w of tx.staged) w.apply();
      return result;
    } finally {
      release();
    }
  }
}

const clone = <T>(v: T): T => structuredClone(v);

export class MemoryDocStore implements DocStore {
  readonly stats: StoreStats = { reads: 0, queries: 0, writes: 0 };
  constructor(private readonly db: MemoryDb) {}

  async get(collection: string, id: string) {
    this.stats.reads++;
    const d = this.db.col(collection).get(id);
    return d ? { id, data: clone(d) } : null;
  }
  async getInTx(tx: Tx, collection: string, id: string) {
    this.stats.reads++;
    const d = asTx(tx).db.col(collection).get(id);
    return d ? { id, data: clone(d) } : null;
  }
  async getMany(collection: string, ids: readonly string[]) {
    this.stats.reads += ids.length;
    const col = this.db.col(collection);
    return ids.flatMap((id) => (col.has(id) ? [{ id, data: clone(col.get(id)!) }] : []));
  }

  async query(shape: QueryShape, p: QueryParams): Promise<StoredDoc[]> {
    assertRegistered(shape);
    assertParams(shape, p);
    this.stats.queries++;
    const f = shape.order.field;
    const val = (d: DocData): string => {
      const v = d[f];
      return v instanceof Date ? v.toISOString() : String(v ?? '');
    };
    const dir = shape.order.dir === 'asc' ? 1 : -1;
    const iso = (x: string | Date) => (x instanceof Date ? x.toISOString() : x);
    let rows = [...this.db.col(shape.collection).entries()].filter(([, d]) => {
      // like Firestore: a document without the order field is not part of the result
      if (d[f] === undefined || d[f] === null) return false;
      for (const k of shape.eq) if (d[k] !== p.eq![k]) return false;
      if (shape.scopeField && !p.scopeBranches!.includes(d[shape.scopeField])) return false;
      if (p.range?.gte !== undefined && !(val(d) >= iso(p.range.gte))) return false;
      if (p.range?.lt !== undefined && !(val(d) < iso(p.range.lt))) return false;
      return true;
    });
    rows.sort(([ia, a], [ib, b]) => {
      const x = val(a);
      const y = val(b);
      return dir * (x < y ? -1 : x > y ? 1 : ia < ib ? -1 : ia > ib ? 1 : 0);
    });
    if (p.cursor) {
      const c = p.cursor;
      rows = rows.filter(([id, d]) => {
        const x = val(d);
        return dir * (x < c.v ? -1 : x > c.v ? 1 : id < c.id ? -1 : id > c.id ? 1 : 0) > 0;
      });
    }
    const out = rows.slice(0, p.limit).map(([id, d]) => ({ id, data: clone(d) }));
    this.stats.reads += out.length;
    return out;
  }

  create(tx: Tx, collection: string, id: string, data: DocData) {
    this.stats.writes++;
    const t = asTx(tx);
    const col = t.db.col(collection);
    const value = clone(strip(data));
    t.stage(
      () => {
        if (col.has(id)) throw new AlreadyExistsError(collection);
      },
      () => col.set(id, value),
    );
  }
  set(tx: Tx, collection: string, id: string, data: DocData) {
    this.stats.writes++;
    const t = asTx(tx);
    const col = t.db.col(collection);
    const value = clone(strip(data));
    t.stage(
      () => undefined,
      () => col.set(id, value),
    );
  }
  update(tx: Tx, collection: string, id: string, patch: DocData) {
    this.stats.writes++;
    const t = asTx(tx);
    const col = t.db.col(collection);
    const value = clone(strip(patch));
    t.stage(
      () => {
        if (!col.has(id)) throw new Error(`update of missing document ${collection}/${id}`);
      },
      () => col.set(id, { ...col.get(id)!, ...value }),
    );
  }
  delete(tx: Tx, collection: string, id: string) {
    this.stats.writes++;
    const t = asTx(tx);
    const col = t.db.col(collection);
    t.stage(
      () => undefined,
      () => void col.delete(id),
    );
  }
  async createNow(collection: string, id: string, data: DocData) {
    this.stats.writes++;
    const col = this.db.col(collection);
    if (col.has(id)) throw new AlreadyExistsError(collection);
    col.set(id, clone(strip(data)));
  }
  async updateNow(collection: string, id: string, patch: DocData) {
    this.stats.writes++;
    const col = this.db.col(collection);
    if (!col.has(id)) throw new Error(`update of missing document ${collection}/${id}`);
    col.set(id, { ...col.get(id)!, ...clone(strip(patch)) });
  }
}

function strip(d: DocData): DocData {
  const o: DocData = {};
  for (const [k, v] of Object.entries(d)) if (v !== undefined) o[k] = v;
  return o;
}
