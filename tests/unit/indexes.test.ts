import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  allQuerySpecs,
  indexSatisfies,
  requiredIndex,
  warehouseListSpec,
  type IndexDef,
} from '@/infrastructure/firestore/queries';

/** S8: the static index check that compensates for the emulator not enforcing composite indexes. */
const declared = (
  JSON.parse(readFileSync('firestore.indexes.json', 'utf8')) as { indexes: IndexDef[] }
).indexes;

describe('Firestore index coverage (ADR 0001 §6.1, S8)', () => {
  it('every query variant the adapters can issue is covered by firestore.indexes.json', () => {
    const uncovered = allQuerySpecs().filter((spec) => {
      const need = requiredIndex(spec);
      return need && !declared.some((d) => indexSatisfies(d, need));
    });
    expect(uncovered.map((s) => s.name)).toEqual([]);
  });

  it('detects a missing index (drop one declared index and the check fails)', () => {
    const need = requiredIndex(warehouseListSpec('branches', 'nameNorm', 'desc'))!;
    const without = declared.filter((d) => !indexSatisfies(d, need));
    expect(without.length).toBe(declared.length - 1);
    expect(without.some((d) => indexSatisfies(d, need))).toBe(false);
  });

  it('direction and field order matter', () => {
    const need = requiredIndex(warehouseListSpec('all', 'code', 'desc'))!;
    const wrongDir: IndexDef = {
      collectionGroup: 'warehouses',
      queryScope: 'COLLECTION',
      fields: [
        { fieldPath: 'companyId', order: 'ASCENDING' },
        { fieldPath: 'code', order: 'ASCENDING' },
      ],
    };
    expect(indexSatisfies(wrongDir, need)).toBe(false);
    const ok: IndexDef = {
      ...wrongDir,
      fields: [wrongDir.fields[0]!, { fieldPath: 'code', order: 'DESCENDING' }],
    };
    expect(indexSatisfies(ok, need)).toBe(true);
  });

  it('single-field queries need no composite index', () => {
    expect(
      requiredIndex({ name: 'x', collection: 'users', equality: ['email'], orderBy: [] }),
    ).toBeNull();
  });
});
