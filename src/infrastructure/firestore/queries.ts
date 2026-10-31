/**
 * Query catalogue: the single source of truth for which Firestore queries exist, so that
 * (a) the adapters build queries from it and (b) scripts/check-indexes.ts can prove that
 * firestore.indexes.json covers every one of them (S8). The Emulator does NOT enforce
 * composite indexes, so this static check is the guard until the nightly staging run exists.
 */
export interface QuerySpec {
  name: string;
  collection: string;
  /** fields compared with == or `in` */
  equality: string[];
  /** field with a range comparison (>=, <) if any */
  range?: string;
  orderBy: { field: string; dir: 'asc' | 'desc' }[];
}

export type ScopeShape = 'all' | 'branches';

export function warehouseListSpec(
  shape: ScopeShape,
  field: 'code' | 'nameNorm',
  dir: 'asc' | 'desc',
): QuerySpec {
  return {
    name: `warehouses.list.${shape}.${field}.${dir}`,
    collection: 'warehouses',
    equality: shape === 'all' ? ['companyId'] : ['companyId', 'branchId'],
    ...(field === 'nameNorm' ? { range: 'nameNorm' } : {}),
    orderBy: [{ field, dir }],
  };
}

export function auditListSpec(shape: ScopeShape): QuerySpec {
  return {
    name: `auditLogs.list.${shape}`,
    collection: 'auditLogs',
    equality: [
      'companyId',
      'entityType',
      'entityId',
      ...(shape === 'branches' ? ['branchId'] : []),
    ],
    orderBy: [{ field: 'at', dir: 'desc' }],
  };
}

/** Every query variant the adapters can issue. */
export function allQuerySpecs(): QuerySpec[] {
  const specs: QuerySpec[] = [];
  for (const shape of ['all', 'branches'] as const)
    for (const field of ['code', 'nameNorm'] as const)
      for (const dir of ['asc', 'desc'] as const) specs.push(warehouseListSpec(shape, field, dir));
  specs.push(auditListSpec('all'), auditListSpec('branches'));
  return specs;
}

export interface IndexField {
  fieldPath: string;
  order: 'ASCENDING' | 'DESCENDING';
}
export interface IndexDef {
  collectionGroup: string;
  queryScope: 'COLLECTION' | 'COLLECTION_GROUP';
  fields: IndexField[];
}

export interface RequiredIndex {
  /** equality fields: may appear in any order, ascending */
  equalityFields: string[];
  /** order-by fields: exact sequence and direction */
  orderFields: IndexField[];
  collectionGroup: string;
}

/**
 * Composite index the query needs, or null when the automatic single-field indexes suffice
 * (one distinct field; __name__ is implicit). Otherwise: equality fields first (any order),
 * then the order-by fields with their directions. Conservative on direction: ASC and DESC
 * variants are separate specs. Verify against the real project in the staging run (S8).
 */
export function requiredIndex(spec: QuerySpec): RequiredIndex | null {
  const fields = new Set<string>([
    ...spec.equality,
    ...(spec.range ? [spec.range] : []),
    ...spec.orderBy.map((o) => o.field),
  ]);
  if (fields.size <= 1) return null;
  const orderNames = spec.orderBy.map((o) => o.field);
  return {
    collectionGroup: spec.collection,
    equalityFields: spec.equality.filter((f) => !orderNames.includes(f)),
    orderFields: spec.orderBy.map((o) => ({
      fieldPath: o.field,
      order: o.dir === 'asc' ? 'ASCENDING' : 'DESCENDING',
    })),
  };
}

export function indexSatisfies(declared: IndexDef, needed: RequiredIndex): boolean {
  if (declared.collectionGroup !== needed.collectionGroup || declared.queryScope !== 'COLLECTION')
    return false;
  const n = needed.equalityFields.length;
  if (declared.fields.length !== n + needed.orderFields.length) return false;
  const dEq = declared.fields
    .slice(0, n)
    .map((f) => f.fieldPath)
    .sort()
    .join();
  if (dEq !== [...needed.equalityFields].sort().join()) return false;
  return needed.orderFields.every((f, i) => {
    const d = declared.fields[n + i];
    return d?.fieldPath === f.fieldPath && d.order === f.order;
  });
}
