import type { Tx } from '../tx/unitOfWork';

/**
 * Vendor-neutral document store port (ADR 0001 §6.2). Repositories in infrastructure/repos are
 * written once against this port and run on Firestore and on the in-memory test adapter.
 *
 * Every query goes through a registered {@link QueryShape}: the shape is the single source of
 * truth for (a) the composite index that must exist (scripts/check-indexes.ts, H3) and (b) which
 * queries the application may issue. Executing an unregistered shape throws.
 */
export type Scalar = string | number | boolean | null;
export type DocData = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface StoredDoc {
  id: string;
  data: DocData;
}

export class AlreadyExistsError extends Error {
  constructor(what: string) {
    super(`${what} already exists`);
    this.name = 'AlreadyExistsError';
  }
}

export interface OrderSpec {
  field: string;
  dir: 'asc' | 'desc';
  /** 'date' fields hold Date values; cursors carry them as ISO strings. */
  type: 'string' | 'date';
}

export interface QueryShape {
  name: string;
  collection: string;
  /** equality fields; all must be supplied in params.eq */
  eq: readonly string[];
  /** when set, the query is restricted to params.scopeBranches on this field (== or chunked `in`) */
  scopeField?: string;
  /** a range (gte/lt) on the ORDER field is allowed (prefix search, date window) */
  range?: boolean;
  /** single order field; the document id is always the tie-breaker in the same direction */
  order: OrderSpec;
}

export interface QueryParams {
  eq?: Record<string, Scalar>;
  /** required exactly when shape.scopeField is set; may exceed the Firestore `in` limit (chunked) */
  scopeBranches?: readonly string[];
  range?: { gte?: string | Date; lt?: string | Date };
  cursor?: { v: string; id: string };
  limit: number;
}

export interface DocStore {
  get(collection: string, id: string): Promise<StoredDoc | null>;
  getInTx(tx: Tx, collection: string, id: string): Promise<StoredDoc | null>;
  /** existing documents only, order not guaranteed */
  getMany(collection: string, ids: readonly string[]): Promise<StoredDoc[]>;
  query(shape: QueryShape, params: QueryParams): Promise<StoredDoc[]>;
  /** stages a create; fails at commit with AlreadyExistsError when the id exists */
  create(tx: Tx, collection: string, id: string, data: DocData): void;
  /** stages an upsert */
  set(tx: Tx, collection: string, id: string, data: DocData): void;
  /** stages a partial update (document must exist) */
  update(tx: Tx, collection: string, id: string, patch: DocData): void;
  /** stages a delete (configuration slots, expired technical records only; never financial data) */
  delete(tx: Tx, collection: string, id: string): void;
  /** single-document writes outside a business transaction (sessions, counters) */
  createNow(collection: string, id: string, data: DocData): Promise<void>;
  updateNow(collection: string, id: string, patch: DocData): Promise<void>;
}

// ---- query registry (catalogue) -------------------------------------------

const registry = new Map<string, QueryShape>();

export function registerQuery(shape: QueryShape): QueryShape {
  const existing = registry.get(shape.name);
  if (existing && JSON.stringify(existing) !== JSON.stringify(shape))
    throw new Error(`query shape ${shape.name} registered twice with different structure`);
  registry.set(shape.name, shape);
  return shape;
}

export function registeredQueries(): QueryShape[] {
  return [...registry.values()];
}

export class UnregisteredQueryError extends Error {
  constructor(name: string) {
    super(
      `query shape "${name}" is not in the query catalogue (register it in infrastructure/repos/queries.ts)`,
    );
    this.name = 'UnregisteredQueryError';
  }
}

export function assertRegistered(shape: QueryShape): void {
  const known = registry.get(shape.name);
  if (!known || JSON.stringify(known) !== JSON.stringify(shape))
    throw new UnregisteredQueryError(shape.name);
}

export interface QueryFamily {
  /** Picks the registered shape for the supplied optional equality fields and scope kind. */
  pick(optionalEq: readonly string[], scoped: boolean): QueryShape;
}

/**
 * Registers every variant of a query family: 2^n subsets of the optional equality fields,
 * with and without the scope restriction. Variants are enumerated so the index check sees them all.
 */
export function defineQuery(def: {
  name: string;
  collection: string;
  eq?: readonly string[];
  optionalEq?: readonly string[];
  scopeField?: string;
  range?: boolean;
  order: OrderSpec;
}): QueryFamily {
  const optional = [...(def.optionalEq ?? [])].sort();
  const variants = new Map<string, QueryShape>();
  for (let mask = 0; mask < 1 << optional.length; mask++) {
    const chosen = optional.filter((_, i) => mask & (1 << i));
    for (const scoped of def.scopeField ? [false, true] : [false]) {
      const shape: QueryShape = {
        name: `${def.name}${chosen.length ? `[${chosen.join(',')}]` : ''}${scoped ? '@scope' : ''}`,
        collection: def.collection,
        eq: [...(def.eq ?? []), ...chosen],
        ...(scoped && def.scopeField ? { scopeField: def.scopeField } : {}),
        ...(def.range ? { range: true } : {}),
        order: def.order,
      };
      registerQuery(shape);
      variants.set(`${chosen.join(',')}|${scoped}`, shape);
    }
  }
  return {
    pick(optionalEq, scoped) {
      const key = `${[...optionalEq].sort().join(',')}|${scoped && !!def.scopeField}`;
      const shape = variants.get(key);
      if (!shape) throw new Error(`no registered variant ${key} for ${def.name}`);
      return shape;
    },
  };
}

// ---- shared helpers for adapters ------------------------------------------

/** Firestore `in` accepts at most 30 values (ADR §13: re-verify against current docs). */
export const IN_LIMIT = 30;

export function chunkBranches(ids: readonly string[], size = IN_LIMIT): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

export function orderValue(shape: QueryShape, doc: StoredDoc): string {
  const v = doc.data[shape.order.field];
  return v instanceof Date ? v.toISOString() : String(v ?? '');
}

/** Merge per-chunk ordered result sets into the exact top-`limit` of the union (cursor correct). */
export function mergeOrdered(shape: QueryShape, sets: StoredDoc[][], limit: number): StoredDoc[] {
  const dir = shape.order.dir === 'asc' ? 1 : -1;
  const all = sets.flat();
  all.sort((a, b) => {
    const x = orderValue(shape, a);
    const y = orderValue(shape, b);
    return dir * (x < y ? -1 : x > y ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  });
  return all.slice(0, limit);
}

export function cursorValue(shape: QueryShape, v: string): string | Date {
  return shape.order.type === 'date' ? new Date(v) : v;
}

export function assertParams(shape: QueryShape, p: QueryParams): void {
  for (const f of shape.eq)
    if (!p.eq || !(f in p.eq)) throw new Error(`query ${shape.name}: missing eq ${f}`);
  if (p.eq)
    for (const f of Object.keys(p.eq))
      if (!shape.eq.includes(f)) throw new Error(`query ${shape.name}: unexpected eq ${f}`);
  if (!!shape.scopeField !== !!p.scopeBranches)
    throw new Error(`query ${shape.name}: scope mismatch`);
  if (p.range && !shape.range) throw new Error(`query ${shape.name}: range not allowed`);
}

/** Per-request cost counters (H1 measurement). */
export interface StoreStats {
  reads: number;
  queries: number;
  writes: number;
}
