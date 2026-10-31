import { describe, expect, it } from 'vitest';
import { getDb } from '@/infrastructure/firestore/client';
import { loadEnv } from '@/platform/config/env';
import { indexSatisfies, requiredIndex, type IndexDef } from '@/infrastructure/firestore/queries';
import { hasEmulator } from './harness';

/**
 * S8 (emulator part): documents that the Emulator does NOT enforce composite indexes, which is why
 * the static check (scripts/check-indexes.ts, tests/unit/indexes.test.ts) and the nightly run on a
 * real staging project are mandatory. Result is specific to the emulator build used here.
 */
describe.runIf(hasEmulator)('S8 emulator vs composite indexes', () => {
  it('the emulator happily runs a query whose composite index is NOT declared (so it cannot be trusted to find missing indexes)', async () => {
    const db = getDb(
      loadEnv({ ...process.env, GMEP_ENV: 'local', NODE_ENV: 'test' } as Record<
        string,
        string | undefined
      >),
    );
    const col = db.collection('s8_probe');
    await col.doc('a').set({ companyId: 'c', status: 'active', createdAt: 2 });
    await col.doc('b').set({ companyId: 'c', status: 'active', createdAt: 1 });
    // equality on two fields + order by a third: real Firestore needs a composite index for this
    const snap = await col
      .where('companyId', '==', 'c')
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .get();
    expect(snap.docs.map((d) => d.id)).toEqual(['a', 'b']);

    // ...but our static checker flags it, because no declared index covers it
    const need = requiredIndex({
      name: 's8',
      collection: 's8_probe',
      equality: ['companyId', 'status'],
      orderBy: [{ field: 'createdAt', dir: 'desc' }],
    })!;
    const declared: IndexDef[] = [];
    expect(declared.some((d) => indexSatisfies(d, need))).toBe(false);
  });
});
