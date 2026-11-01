import {
  FieldPath,
  Timestamp,
  type Firestore,
  type Query,
  type Transaction,
} from 'firebase-admin/firestore';
import {
  AlreadyExistsError,
  assertParams,
  assertRegistered,
  chunkBranches,
  cursorValue,
  mergeOrdered,
  type DocData,
  type DocStore,
  type QueryParams,
  type QueryShape,
  type StoreStats,
  type StoredDoc,
} from '@/platform/store/docStore';
import type { Tx, UnitOfWork } from '@/platform/tx/unitOfWork';

class FirestoreTx {
  constructor(readonly t: Transaction) {}
}

export function asFirestoreTx(tx: Tx): Transaction {
  if (!(tx instanceof FirestoreTx))
    throw new Error('Transaction handle does not belong to the Firestore adapter');
  return tx.t;
}

/** gRPC ALREADY_EXISTS (code 6) from the Admin SDK. */
const isAlreadyExists = (e: unknown) =>
  (e as { code?: number | string })?.code === 6 ||
  (e as { code?: string })?.code === 'already-exists';

export class FirestoreUnitOfWork implements UnitOfWork {
  constructor(private readonly db: Firestore) {}
  run<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    // Admin SDK transactions are pessimistic and retried on contention; fn must be re-runnable.
    return this.db
      .runTransaction(async (t) => fn(new FirestoreTx(t) as unknown as Tx), { maxAttempts: 10 })
      .catch((e: unknown) => {
        if (isAlreadyExists(e)) throw new AlreadyExistsError('document');
        throw e;
      });
  }
}

/** Timestamps -> Date, recursively (documents are plain data). */
function fromFirestore(v: unknown): unknown {
  if (v instanceof Timestamp) return v.toDate();
  if (Array.isArray(v)) return v.map(fromFirestore);
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) o[k] = fromFirestore(x);
    return o;
  }
  return v;
}

/** Firestore rejects `undefined` values; drop them (null is kept). */
function toFirestore(v: DocData): DocData {
  const out: DocData = {};
  for (const [k, x] of Object.entries(v)) if (x !== undefined) out[k] = x;
  return out;
}

export class FirestoreDocStore implements DocStore {
  readonly stats: StoreStats = { reads: 0, queries: 0, writes: 0 };
  constructor(private readonly db: Firestore) {}

  private ref(collection: string, id: string) {
    return this.db.collection(collection).doc(id);
  }

  async get(collection: string, id: string): Promise<StoredDoc | null> {
    this.stats.reads++;
    const s = await this.ref(collection, id).get();
    return s.exists ? { id: s.id, data: fromFirestore(s.data()) as DocData } : null;
  }

  async getInTx(tx: Tx, collection: string, id: string): Promise<StoredDoc | null> {
    this.stats.reads++;
    const s = await asFirestoreTx(tx).get(this.ref(collection, id));
    return s.exists ? { id: s.id, data: fromFirestore(s.data()) as DocData } : null;
  }

  async getMany(collection: string, ids: readonly string[]): Promise<StoredDoc[]> {
    if (ids.length === 0) return [];
    this.stats.reads += ids.length;
    const snaps = await this.db.getAll(...ids.map((i) => this.ref(collection, i)));
    return snaps
      .filter((s) => s.exists)
      .map((s) => ({ id: s.id, data: fromFirestore(s.data()) as DocData }));
  }

  private build(shape: QueryShape, p: QueryParams, chunk: readonly string[] | undefined): Query {
    let q: Query = this.db.collection(shape.collection);
    for (const f of shape.eq) q = q.where(f, '==', p.eq![f]);
    if (shape.scopeField && chunk)
      q =
        chunk.length === 1
          ? q.where(shape.scopeField, '==', chunk[0])
          : q.where(shape.scopeField, 'in', [...chunk]);
    if (p.range?.gte !== undefined) q = q.where(shape.order.field, '>=', p.range.gte);
    if (p.range?.lt !== undefined) q = q.where(shape.order.field, '<', p.range.lt);
    q = q
      .orderBy(shape.order.field, shape.order.dir)
      .orderBy(FieldPath.documentId(), shape.order.dir);
    if (p.cursor) q = q.startAfter(cursorValue(shape, p.cursor.v), p.cursor.id);
    return q.limit(p.limit);
  }

  async query(shape: QueryShape, p: QueryParams): Promise<StoredDoc[]> {
    assertRegistered(shape);
    assertParams(shape, p);
    // H3: scopes wider than the `in` limit are split into chunks; each chunk returns its own top
    // `limit` after the cursor, so the merged top `limit` of the union is exact (cursor correct).
    const chunks: (readonly string[] | undefined)[] = p.scopeBranches
      ? chunkBranches(p.scopeBranches)
      : [undefined];
    if (p.scopeBranches && p.scopeBranches.length === 0) return [];
    this.stats.queries += chunks.length;
    const sets = await Promise.all(
      chunks.map(async (c) => {
        const snap = await this.build(shape, p, c).get();
        this.stats.reads += snap.size;
        return snap.docs.map((d) => ({ id: d.id, data: fromFirestore(d.data()) as DocData }));
      }),
    );
    return chunks.length === 1 ? sets[0]! : mergeOrdered(shape, sets, p.limit);
  }

  create(tx: Tx, collection: string, id: string, data: DocData): void {
    this.stats.writes++;
    asFirestoreTx(tx).create(this.ref(collection, id), toFirestore(data));
  }
  set(tx: Tx, collection: string, id: string, data: DocData): void {
    this.stats.writes++;
    asFirestoreTx(tx).set(this.ref(collection, id), toFirestore(data));
  }
  update(tx: Tx, collection: string, id: string, patch: DocData): void {
    this.stats.writes++;
    asFirestoreTx(tx).update(this.ref(collection, id), toFirestore(patch));
  }
  delete(tx: Tx, collection: string, id: string): void {
    this.stats.writes++;
    asFirestoreTx(tx).delete(this.ref(collection, id));
  }
  async createNow(collection: string, id: string, data: DocData): Promise<void> {
    this.stats.writes++;
    try {
      await this.ref(collection, id).create(toFirestore(data));
    } catch (e) {
      if (isAlreadyExists(e)) throw new AlreadyExistsError('document');
      throw e;
    }
  }
  async updateNow(collection: string, id: string, patch: DocData): Promise<void> {
    this.stats.writes++;
    await this.ref(collection, id).update(toFirestore(patch));
  }
}
