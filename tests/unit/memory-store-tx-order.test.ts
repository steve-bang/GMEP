import { describe, expect, it } from 'vitest';
import { MemoryDb, MemoryDocStore, MemoryUnitOfWork } from '@/infrastructure/store/memoryDocStore';

function setup(opts?: { enforceReadsBeforeWrites?: boolean }) {
  const db = new MemoryDb();
  return { store: new MemoryDocStore(db, opts), uow: new MemoryUnitOfWork(db) };
}

describe('memory store transaction order (Firestore: reads before writes)', () => {
  it('throws on a read after a write in the same transaction', async () => {
    const { store, uow } = setup();
    await expect(
      uow.run(async (tx) => {
        store.create(tx, 'c', 'a', { v: 1 });
        await store.getInTx(tx, 'c', 'b');
      }),
    ).rejects.toThrow(/reads must precede writes/);
  });

  it.each(['set', 'update', 'delete'] as const)('%s also turns the guard on', async (op) => {
    const { store, uow } = setup();
    await uow.run(async (tx) => store.create(tx, 'c', 'a', { v: 1 }));
    await expect(
      uow.run(async (tx) => {
        if (op === 'set') store.set(tx, 'c', 'a', { v: 2 });
        else if (op === 'update') store.update(tx, 'c', 'a', { v: 2 });
        else store.delete(tx, 'c', 'a');
        await store.getInTx(tx, 'c', 'a');
      }),
    ).rejects.toThrow(/reads must precede writes/);
  });

  it('reads first, then writes, works', async () => {
    const { store, uow } = setup();
    await uow.run(async (tx) => {
      expect(await store.getInTx(tx, 'c', 'a')).toBeNull();
      expect(await store.getInTx(tx, 'c', 'b')).toBeNull();
      store.create(tx, 'c', 'a', { v: 1 });
      store.create(tx, 'c', 'b', { v: 2 });
    });
    expect((await store.get('c', 'b'))?.data.v).toBe(2);
  });

  it('a failed transaction discards its staged writes', async () => {
    const { store, uow } = setup();
    await expect(
      uow.run(async (tx) => {
        store.create(tx, 'c', 'a', { v: 1 });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await store.get('c', 'a')).toBeNull();
  });

  it('a read in a separate later transaction is fine', async () => {
    const { store, uow } = setup();
    await uow.run(async (tx) => store.create(tx, 'c', 'a', { v: 1 }));
    const got = await uow.run((tx) => store.getInTx(tx, 'c', 'a'));
    expect(got?.data.v).toBe(1);
  });

  it('the emergency switch turns the guard off', async () => {
    const { store, uow } = setup({ enforceReadsBeforeWrites: false });
    await uow.run(async (tx) => {
      store.create(tx, 'c', 'a', { v: 1 });
      expect(await store.getInTx(tx, 'c', 'b')).toBeNull();
    });
  });
});
