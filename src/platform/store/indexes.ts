import { registeredQueries, type QueryShape } from './docStore';

/**
 * Composite-index derivation from query shapes (S8 / H3). The Emulator does not enforce
 * composite indexes, so this static check is the guard until the nightly staging run exists.
 */
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
  /** equality fields (any order, ascending) */
  equalityFields: string[];
  /** order-by fields: exact sequence and direction (the order field, then __name__ is implicit) */
  orderFields: IndexField[];
  collectionGroup: string;
}

/** null when the automatic single-field indexes suffice. */
export function requiredIndex(shape: QueryShape): RequiredIndex | null {
  const equality = [...shape.eq, ...(shape.scopeField ? [shape.scopeField] : [])];
  const fields = new Set<string>([...equality, shape.order.field]);
  if (fields.size <= 1) return null;
  return {
    collectionGroup: shape.collection,
    equalityFields: equality.filter((f) => f !== shape.order.field),
    orderFields: [
      {
        fieldPath: shape.order.field,
        order: shape.order.dir === 'asc' ? 'ASCENDING' : 'DESCENDING',
      },
    ],
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

export function requiredIndexDefs(): IndexDef[] {
  const seen = new Map<string, IndexDef>();
  for (const shape of registeredQueries()) {
    const need = requiredIndex(shape);
    if (!need) continue;
    const def: IndexDef = {
      collectionGroup: need.collectionGroup,
      queryScope: 'COLLECTION',
      fields: [
        ...[...need.equalityFields]
          .sort()
          .map((f) => ({ fieldPath: f, order: 'ASCENDING' as const })),
        ...need.orderFields,
      ],
    };
    seen.set(JSON.stringify(def), def);
  }
  return [...seen.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, d]) => d);
}
