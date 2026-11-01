import { describe, expect, it } from 'vitest';
import { IN_LIMIT, chunkBranches, mergeOrdered, type StoredDoc } from '@/platform/store/docStore';
import { MemoryDb, MemoryDocStore, MemoryUnitOfWork } from '@/infrastructure/store/memoryDocStore';
import { Q } from '@/infrastructure/repos/queries';

describe('H3 splitting `in` queries over 30 branches', () => {
  it('chunks branch ids into groups of at most 30', () => {
    const ids = Array.from({ length: 75 }, (_, i) => `b${i}`);
    const chunks = chunkBranches(ids);
    expect(chunks.map((c) => c.length)).toEqual([30, 30, 15]);
    expect(chunks.every((c) => c.length <= IN_LIMIT)).toBe(true);
    expect(chunks.flat()).toEqual(ids);
  });
  it('merging per-chunk ordered result sets yields the exact top-N of the union (asc and desc)', () => {
    const shape = Q.warehouses['code.asc']!.pick([], true);
    const doc = (code: string): StoredDoc => ({ id: `id-${code}`, data: { code } });
    const sets = [
      [doc('A'), doc('D'), doc('G')],
      [doc('B'), doc('E')],
      [doc('C'), doc('F'), doc('H')],
    ];
    expect(mergeOrdered(shape, sets, 5).map((d) => d.data.code)).toEqual(['A', 'B', 'C', 'D', 'E']);
    const desc = Q.warehouses['code.desc']!.pick([], true);
    const sorted = sets.map((s) => [...s].reverse());
    expect(mergeOrdered(desc, sorted, 3).map((d) => d.data.code)).toEqual(['H', 'G', 'F']);
  });
  it('same-key ties are broken by document id, so cursors never skip or repeat rows', () => {
    const shape = Q.warehouses['code.asc']!.pick([], true);
    const d = (id: string): StoredDoc => ({ id, data: { code: 'SAME' } });
    expect(
      mergeOrdered(
        shape,
        [
          [d('2'), d('4')],
          [d('1'), d('3')],
        ],
        4,
      ).map((x) => x.id),
    ).toEqual(['1', '2', '3', '4']);
  });
  it('the memory adapter accepts a scope of any width (the Firestore adapter chunks it, see integration test)', async () => {
    const db = new MemoryDb();
    const store = new MemoryDocStore(db);
    const uow = new MemoryUnitOfWork(db);
    await uow.run(async (tx) => {
      for (let i = 0; i < 90; i++)
        store.create(tx, 'warehouses', `w${i}`, {
          companyId: 'c',
          branchId: `b${i % 45}`,
          code: `C${String(i).padStart(3, '0')}`,
        });
    });
    const branches = Array.from({ length: 45 }, (_, i) => `b${i}`);
    const rows = await store.query(Q.warehouses['code.asc']!.pick([], true), {
      eq: { companyId: 'c' },
      scopeBranches: branches,
      limit: 100,
    });
    expect(rows).toHaveLength(90);
  });
});
