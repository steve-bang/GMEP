import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertRegistered,
  defineQuery,
  registeredQueries,
  UnregisteredQueryError,
  type QueryShape,
} from '@/platform/store/docStore';
import { indexSatisfies, requiredIndex, type IndexDef } from '@/platform/store/indexes';
import { MemoryDb, MemoryDocStore } from '@/infrastructure/store/memoryDocStore';
import { Q } from '@/infrastructure/repos/queries';

/** S8 / H3: the index check derives from the repository layer's query catalogue. */
const declared = (
  JSON.parse(readFileSync('firestore.indexes.json', 'utf8')) as { indexes: IndexDef[] }
).indexes;

describe('Firestore index coverage derived from the repository layer (ADR 0001 §6.1, S8, H3)', () => {
  it('every registered query shape is covered by firestore.indexes.json', () => {
    const uncovered = registeredQueries().filter((shape) => {
      const need = requiredIndex(shape);
      return need && !declared.some((d) => indexSatisfies(d, need));
    });
    expect(uncovered.map((s) => s.name)).toEqual([]);
    expect(registeredQueries().length).toBeGreaterThan(30);
  });

  it('detects a missing index (drop one declared index and the check fails)', () => {
    const shape = Q.warehouses['name.desc']!.pick([], true);
    const need = requiredIndex(shape)!;
    const without = declared.filter((d) => !indexSatisfies(d, need));
    expect(without.length).toBeLessThan(declared.length);
    expect(without.some((d) => indexSatisfies(d, need))).toBe(false);
  });

  it('direction and field order matter', () => {
    const need = requiredIndex(Q.warehouses['code.desc']!.pick([], false))!;
    const wrongDir: IndexDef = {
      collectionGroup: 'warehouses',
      queryScope: 'COLLECTION',
      fields: [
        { fieldPath: 'companyId', order: 'ASCENDING' },
        { fieldPath: 'code', order: 'ASCENDING' },
      ],
    };
    expect(indexSatisfies(wrongDir, need)).toBe(false);
    expect(
      indexSatisfies(
        { ...wrongDir, fields: [wrongDir.fields[0]!, { fieldPath: 'code', order: 'DESCENDING' }] },
        need,
      ),
    ).toBe(true);
  });

  it('a repository query that is missing from the catalogue fails instead of running (H3)', async () => {
    const store = new MemoryDocStore(new MemoryDb());
    const rogue: QueryShape = {
      name: 'rogue.query',
      collection: 'users',
      eq: ['email'],
      order: { field: 'createdAt', dir: 'asc', type: 'date' },
    };
    expect(() => assertRegistered(rogue)).toThrow(UnregisteredQueryError);
    await expect(store.query(rogue, { eq: { email: 'x' }, limit: 1 })).rejects.toThrow(
      UnregisteredQueryError,
    );
    // a registered name with a different structure is refused too
    const tampered = { ...Q.userByEmail.pick([], false), eq: ['email', 'status'] };
    await expect(
      store.query(tampered, { eq: { email: 'x', status: 'a' }, limit: 1 }),
    ).rejects.toThrow(UnregisteredQueryError);
  });

  it('every store.query call site in the repository layer passes a catalogued shape', () => {
    const dir = 'src/infrastructure/repos';
    const sources = readdirSync(dir)
      .filter((f) => f.endsWith('.ts') && f !== 'queries.ts')
      .map((f) => readFileSync(join(dir, f), 'utf8'))
      .join('\n');
    const calls = [...sources.matchAll(/store\.query\(\s*([\w.]+)/g)].map((m) => m[1]!);
    expect(calls.length).toBeGreaterThan(10);
    // each first argument must come from the Q catalogue (directly, via a variable named shape, or a pick())
    for (const c of calls)
      expect(c === 'shape' || c.startsWith('shape.') || c.startsWith('Q.'), c).toBe(true);
  });

  it('single-field queries need no composite index', () => {
    const f = defineQuery({
      name: 'test.single',
      collection: 'x',
      order: { field: 'a', dir: 'asc', type: 'string' },
    });
    expect(requiredIndex(f.pick([], false))).toBeNull();
  });
});
