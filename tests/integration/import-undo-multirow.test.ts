import { describe, expect, it } from 'vitest';
import { importCustomers } from '../helpers/volume';
import { backends, createHarness } from './harness';

/**
 * FR-SYS-007 / UAT-12 / RULE-010 regression found by the UI journey (docs/dev/stream-a-findings.md F-6): undoing a committed
 * customers-and-vehicles batch of TWO OR MORE customers must remove exactly the batch on the Firestore Emulator too. The
 * in-memory adapter does not enforce Firestore's "all reads before the first write" rule, so a one-row batch passes
 * everywhere and a three-row batch fails with a 500 only on Firestore until the undo loop reads a chunk before it writes.
 */
describe.each(backends)('import undo with several customers [%s]', (backend) => {
  it('undo of a 3-customer batch removes the customers and vehicles and answers 200', async () => {
    const h = await createHarness(backend);
    const ql = await h.loginAt('u_ql_q7', 'br_q7');
    const batch = await importCustomers(h, ql, 70_000, 3);
    const found = async () =>
      (
        await h.call('GET', `/api/v1/crm/customers?q=${encodeURIComponent('khach volume 7000')}`, {
          cookie: ql,
        })
      ).json.items as unknown[];
    expect((await found()).length).toBe(3);

    const u = await h.call('POST', `/api/v1/sys/imports/${batch.id}/undo`, {
      cookie: ql,
      key: 'undo-multirow-000000001',
      body: { reason: 'Hoàn tác lô nhiều dòng' },
    });
    expect(u.status, u.text.slice(0, 300)).toBe(200);
    expect(u.json.status).toBe('undone');
    expect((await found()).length).toBe(0);
  });
});
