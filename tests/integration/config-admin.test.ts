import { beforeAll, describe, expect, it } from 'vitest';
import { resolveConfigAt } from '@/modules/sys';
import { businessDateOf } from '@/platform/effective/effective';
import { backends, createHarness, type Harness } from './harness';

const inDays = (n: number) => businessDateOf(new Date(Date.now() + n * 86_400_000));

/**
 * FR-SYS-004 effective-dated configuration with approval; FR-ACC-009 tax rates as configuration (BA-03 is OPEN:
 * the values below are SAMPLE DATA, NOT signed off by an accountant); FR-INV-025 discount limits; price lists.
 */
describe.each(backends)('FR-SYS-004 configuration framework and approval [%s]', (backend) => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness(backend);
  });
  const propose = (as: string, type: string, body: object, key: string) =>
    h.call('POST', `/api/v1/sys/config/${type}`, { as, key, body });
  const decide = (as: string, type: string, id: string, body: object, key: string) =>
    h.call('POST', `/api/v1/sys/config/${type}/${encodeURIComponent(id)}/decide`, {
      as,
      key,
      body,
    });
  const sampleTax = (rateBp: number) => ({
    name: 'VAT mẫu (không phải số liệu kế toán đã ký)',
    rateBp,
  });

  it('propose -> pending -> approve (by another person) -> resolveAt returns it only from its effective date', async () => {
    const eff = inDays(10);
    const p = await propose(
      'u_kt',
      'tax-rate',
      {
        scopeKey: 'VAT-SAMPLE',
        effectiveFrom: eff,
        payload: sampleTax(800),
        reason: 'Dữ liệu mẫu cho test',
      },
      'cfg-prop-0001-aaaa',
    );
    expect(p.status).toBe(201);
    expect(p.json.status).toBe('pending');
    const deps = h.container.sys;
    const at = (date: string) =>
      resolveConfigAt(deps, {
        companyId: 'cmp_demo',
        type: 'tax-rate',
        scopeKey: 'VAT-SAMPLE',
        date,
      });
    expect(await at(inDays(11))).toBeNull(); // pending changes nothing
    // the proposer cannot approve; AD has no approve right at all
    expect(
      (await decide('u_kt', 'tax-rate', p.json.id, { decision: 'approve' }, 'cfg-dec-0001-aaaa'))
        .status,
    ).toBe(403);
    expect(
      (await decide('u_ad', 'tax-rate', p.json.id, { decision: 'approve' }, 'cfg-dec-0002-aaaa'))
        .status,
    ).toBe(403);
    const ok = await decide(
      'u_owner',
      'tax-rate',
      p.json.id,
      { decision: 'approve', note: 'ok' },
      'cfg-dec-0003-aaaa',
    );
    expect(ok.status).toBe(200);
    expect(ok.json.status).toBe('approved');
    const snap = await at(inDays(10));
    expect(snap).toMatchObject({ type: 'tax-rate', payload: { rateBp: 800 }, effectiveFrom: eff });
    expect(await at(inDays(9))).toBeNull(); // before the effective date: nothing in force
    // second decision on the same version is refused
    expect(
      (await decide('u_owner', 'tax-rate', p.json.id, { decision: 'reject' }, 'cfg-dec-0004-aaaa'))
        .status,
    ).toBe(409);
  });

  it('later versions supersede earlier ones from their date on; documents keep their snapshot', async () => {
    const e1 = inDays(20);
    const e2 = inDays(40);
    for (const [eff, bp, k] of [
      [e1, 800, 'a'],
      [e2, 1000, 'b'],
    ] as const) {
      const p = await propose(
        'u_kt',
        'tax-rate',
        { scopeKey: 'VAT-SAMPLE2', effectiveFrom: eff, payload: sampleTax(bp), reason: 'mẫu' },
        `cfg-seq-0001-${k}aaaa`,
      );
      await decide(
        'u_owner',
        'tax-rate',
        p.json.id,
        { decision: 'approve' },
        `cfg-seq-0002-${k}aaaa`,
      );
    }
    const deps = h.container.sys;
    const q = (date: string) =>
      resolveConfigAt(deps, {
        companyId: 'cmp_demo',
        type: 'tax-rate',
        scopeKey: 'VAT-SAMPLE2',
        date,
      });
    const snapshotUsedByAQuote = await q(inDays(25));
    expect(snapshotUsedByAQuote?.payload).toMatchObject({ rateBp: 800 });
    expect((await q(inDays(40)))?.payload).toMatchObject({ rateBp: 1000 });
    // a later change does not alter the snapshot object a document already stored
    expect(snapshotUsedByAQuote?.payload).toMatchObject({ rateBp: 800 });
    expect(snapshotUsedByAQuote?.versionId).toContain('VAT-SAMPLE2');
  });

  it('rejects past dates, duplicate slots, invalid payloads (no floats) and unknown scope keys', async () => {
    const base = { scopeKey: 'VAT-X', payload: sampleTax(800), reason: 'mẫu' };
    expect(
      (
        await propose(
          'u_kt',
          'tax-rate',
          { ...base, effectiveFrom: inDays(-1) },
          'cfg-bad-0001-aaaa',
        )
      ).json.code,
    ).toBe('config_effective_in_past');
    expect(
      (
        await propose(
          'u_kt',
          'tax-rate',
          { ...base, effectiveFrom: inDays(5), payload: sampleTax(8.5) },
          'cfg-bad-0002-aaaa',
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await propose(
          'u_kt',
          'tax-rate',
          { ...base, scopeKey: 'bad key!', effectiveFrom: inDays(5) },
          'cfg-bad-0003-aaaa',
        )
      ).status,
    ).toBe(422);
    const first = await propose(
      'u_kt',
      'tax-rate',
      { ...base, effectiveFrom: inDays(6) },
      'cfg-bad-0004-aaaa',
    );
    expect(first.status).toBe(201);
    expect(
      (
        await propose(
          'u_kt',
          'tax-rate',
          { ...base, effectiveFrom: inDays(6) },
          'cfg-bad-0005-aaaa',
        )
      ).json.code,
    ).toBe('config_slot_taken');
    // rejection frees the slot
    await decide(
      'u_owner',
      'tax-rate',
      first.json.id,
      { decision: 'reject', note: 'sai' },
      'cfg-bad-0006-aaaa',
    );
    expect(
      (
        await propose(
          'u_kt',
          'tax-rate',
          { ...base, effectiveFrom: inDays(6) },
          'cfg-bad-0007-aaaa',
        )
      ).status,
    ).toBe(201);
  });

  it('the owner may approve their own proposal only with the password re-entered; it is audited as self-approved', async () => {
    const p = await propose(
      'u_owner',
      'tax-rate',
      { scopeKey: 'VAT-OWN', effectiveFrom: inDays(7), payload: sampleTax(500), reason: 'mẫu' },
      'cfg-own-0001-aaaa',
    );
    expect(p.status).toBe(201);
    expect(
      (await decide('u_owner', 'tax-rate', p.json.id, { decision: 'approve' }, 'cfg-own-0002-aaaa'))
        .json.code,
    ).toBe('reauth_required');
    expect(
      (
        await decide(
          'u_owner',
          'tax-rate',
          p.json.id,
          { decision: 'approve', reauthPassword: 'wrong-password' },
          'cfg-own-0003-aaaa',
        )
      ).json.code,
    ).toBe('reauth_required');
    const ok = await decide(
      'u_owner',
      'tax-rate',
      p.json.id,
      { decision: 'approve', reauthPassword: 'Demo!Pass-2026' },
      'cfg-own-0004-aaaa',
    );
    expect(ok.status).toBe(200);
    const audit = await h.call('GET', '/api/v1/sys/audit?entityType=config.tax-rate&limit=100', {
      as: 'u_owner',
    });
    const entry = audit.json.items.find(
      (e: { action: string; entityId: string }) =>
        e.action === 'config.approve' && e.entityId === p.json.id,
    );
    expect(entry.after.selfApproved).toBe(true);
    expect(JSON.stringify(audit.json)).not.toContain('Demo!Pass-2026');
  });

  it('proposal replay with the same Idempotency-Key returns the same version once', async () => {
    const body = {
      scopeKey: 'VAT-IDEM',
      effectiveFrom: inDays(8),
      payload: sampleTax(800),
      reason: 'mẫu',
    };
    const a = await propose('u_kt', 'tax-rate', body, 'cfg-idem-0001-aaaa');
    const b = await propose('u_kt', 'tax-rate', body, 'cfg-idem-0001-aaaa');
    expect(b.headers.get('idempotent-replayed')).toBe('true');
    expect(b.json.id).toBe(a.json.id);
  });

  it('approvers get an in-system notification (FR-SYS-009), the proposer hears the outcome, nobody else sees them', async () => {
    const p = await propose(
      'u_kt',
      'tax-rate',
      { scopeKey: 'VAT-NOTIFY', effectiveFrom: inDays(9), payload: sampleTax(800), reason: 'mẫu' },
      'cfg-ntf-0001-aaaa',
    );
    const owner = await h.call('GET', '/api/v1/sys/notifications', { as: 'u_owner' });
    const n = owner.json.items.find(
      (x: { link: string; titleKey: string }) => x.titleKey === 'notifications.configPending',
    );
    expect(n).toBeTruthy();
    expect(JSON.stringify(owner.json)).not.toMatch(/0900000|@demo/); // no personal data in notifications
    expect(
      (await h.call('GET', '/api/v1/sys/notifications', { as: 'u_ql_q7' })).json.items.some(
        (x: { titleKey: string }) => x.titleKey === 'notifications.configPending',
      ),
    ).toBe(false);
    await decide('u_owner', 'tax-rate', p.json.id, { decision: 'approve' }, 'cfg-ntf-0002-aaaa');
    const kt = await h.call('GET', '/api/v1/sys/notifications', { as: 'u_kt' });
    expect(
      kt.json.items.some(
        (x: { titleKey: string }) => x.titleKey === 'notifications.configApproved',
      ),
    ).toBe(true);
    // marking another user's notification as read looks like a missing one
    const mine = owner.json.items[0].id as string;
    expect(
      (await h.call('POST', `/api/v1/sys/notifications/${mine}/read`, { as: 'u_kt', body: {} }))
        .status,
    ).toBe(404);
    expect(
      (await h.call('POST', `/api/v1/sys/notifications/${mine}/read`, { as: 'u_owner', body: {} }))
        .status,
    ).toBe(200);
  });

  it('branch override: a branch manager proposes a labour rate for their own branch only; resolveAt prefers the branch key', async () => {
    const eff = inDays(3);
    const own = await propose(
      'u_ql_q7',
      'labor-rate',
      {
        scopeKey: 'branch:br_q7',
        effectiveFrom: eff,
        payload: { hourlyRateVnd: 250000 },
        reason: 'giá giờ Q7',
      },
      'cfg-lab-0001-aaaa',
    );
    expect(own.status).toBe(201);
    expect(
      (
        await propose(
          'u_ql_q7',
          'labor-rate',
          {
            scopeKey: 'branch:br_td',
            effectiveFrom: eff,
            payload: { hourlyRateVnd: 1 },
            reason: 'xxx',
          },
          'cfg-lab-0002-aaaa',
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await propose(
          'u_ql_q7',
          'labor-rate',
          { scopeKey: 'company', effectiveFrom: eff, payload: { hourlyRateVnd: 1 }, reason: 'xxx' },
          'cfg-lab-0003-aaaa',
        )
      ).status,
    ).toBe(403);
    await decide(
      'u_owner',
      'labor-rate',
      own.json.id,
      { decision: 'approve' },
      'cfg-lab-0004-aaaa',
    );
    const co = await propose(
      'u_owner',
      'labor-rate',
      {
        scopeKey: 'company',
        effectiveFrom: eff,
        payload: { hourlyRateVnd: 200000 },
        reason: 'giá giờ công ty',
      },
      'cfg-lab-0005-aaaa',
    );
    await decide(
      'u_owner',
      'labor-rate',
      co.json.id,
      { decision: 'approve', reauthPassword: 'Demo!Pass-2026' },
      'cfg-lab-0006-aaaa',
    );
    const deps = h.container.sys;
    const at = (branchId: string) =>
      resolveConfigAt(deps, {
        companyId: 'cmp_demo',
        type: 'labor-rate',
        scopeKey: 'company',
        date: eff,
        branchId,
      });
    expect((await at('br_q7'))?.payload).toMatchObject({ hourlyRateVnd: 250000 });
    expect((await at('br_td'))?.payload).toMatchObject({ hourlyRateVnd: 200000 });
    // branch isolation of the list: TD's manager does not see Q7's override
    const tdList = await h.call('GET', '/api/v1/sys/config/labor-rate', { as: 'u_ql_td' });
    expect(tdList.status).toBe(200);
    expect(tdList.json.items.some((v: { scopeKey: string }) => v.scopeKey === 'branch:br_q7')).toBe(
      false,
    );
    expect(tdList.json.items.some((v: { scopeKey: string }) => v.scopeKey === 'company')).toBe(
      true,
    );
  });

  it('price items keep cost and list price separate; cost is hidden from roles that may not see it (ba-answers-04)', async () => {
    const pl = await h.call('POST', '/api/v1/sys/price-lists', {
      as: 'u_owner',
      key: 'pl-create-0001-aa',
      body: { code: 'std', name: 'Bảng giá chuẩn' },
    });
    expect(pl.status).toBe(201);
    const item = await propose(
      'u_owner',
      'price-item',
      {
        scopeKey: `${pl.json.code}:LOC-GIO`,
        effectiveFrom: inDays(2),
        payload: { name: 'Lọc gió', costVnd: 120000, listPriceVnd: 180000 },
        reason: 'mẫu',
      },
      'cfg-prc-0001-aaaa',
    );
    expect(item.status).toBe(201);
    await decide(
      'u_owner',
      'price-item',
      item.json.id,
      { decision: 'approve', reauthPassword: 'Demo!Pass-2026' },
      'cfg-prc-0002-aaaa',
    );
    const asOwner = await h.call('GET', '/api/v1/sys/config/price-item', { as: 'u_owner' });
    expect(asOwner.json.items[0].payload).toMatchObject({ costVnd: 120000, listPriceVnd: 180000 });
    const asCv = await h.call('GET', '/api/v1/sys/config/price-item', { as: 'u_cv_q7' });
    expect(asCv.status).toBe(200);
    expect(asCv.json.items[0].payload).toEqual({ name: 'Lọc gió', listPriceVnd: 180000 });
    expect(JSON.stringify(asCv.json)).not.toContain('120000');
    // storekeeper reads prices (list only); the AD (no price-list rights) gets 403
    expect((await h.call('GET', '/api/v1/sys/config/price-item', { as: 'u_ad' })).status).toBe(403);
  });

  it('discount limits and document templates use the same framework (metadata only for templates)', async () => {
    const d = await propose(
      'u_owner',
      'discount-limit',
      {
        scopeKey: 'company',
        effectiveFrom: inDays(4),
        payload: { maxDiscountBpByRole: { CV: 500, QL: 1500 } },
        reason: 'mẫu',
      },
      'cfg-dsc-0001-aaaa',
    );
    expect(d.status).toBe(201);
    expect(
      (
        await propose(
          'u_ql_q7',
          'discount-limit',
          {
            scopeKey: 'branch:br_q7',
            effectiveFrom: inDays(4),
            payload: { maxDiscountBpByRole: { CV: 9000 } },
            reason: 'xxx',
          },
          'cfg-dsc-0002-aaaa',
        )
      ).status,
    ).toBe(403); // QL does not edit own branch limit
    const t = await propose(
      'u_ad',
      'doc-template',
      {
        scopeKey: 'tpl:bao-gia-a4',
        effectiveFrom: inDays(4),
        payload: { name: 'Báo giá A4', kind: 'quote', paper: 'A4' },
        reason: 'mẫu',
      },
      'cfg-tpl-0001-aaaa',
    );
    expect(t.status).toBe(201);
    expect(
      (
        await decide(
          'u_kt',
          'doc-template',
          t.json.id,
          { decision: 'approve' },
          'cfg-tpl-0002-aaaa',
        )
      ).status,
    ).toBe(200); // accountant approves templates (BA §2.3)
  });
});
