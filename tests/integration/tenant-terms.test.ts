import { beforeAll, describe, expect, it } from 'vitest';
import {
  decideTenantTransition,
  getTenant,
  provisionTenant,
  recordTermsAcceptance,
  tenantTermsBlock,
  transitionTenant,
  type PlatformActor,
} from '@/modules/sys';
import { checkEligibility, DEFAULT_ELIGIBILITY_POLICY } from '@/modules/ein';
import { backends, createHarness, type Harness } from './harness';

/**
 * RULE-029 / FR-TEN-037 (minimum), MT0-3: the tenant's Terms and DPA acceptance is recorded by hand; until then a live
 * tenant cannot go `onboarding -> active`, import real data or issue a live invoice.
 */
const cnt: PlatformActor = {
  kind: 'platform',
  platformUserId: 'pf_owner',
  role: 'CNT',
  displayName: 'CNT',
};
const qtn: PlatformActor = {
  kind: 'platform',
  platformUserId: 'pf_admin',
  role: 'QTN',
  displayName: 'QTN',
};
const htn: PlatformActor = {
  kind: 'platform',
  platformUserId: 'pf_help',
  role: 'HTN',
  displayName: 'HTN',
};
let n = 0;
const rid = () => ({ requestId: `req-${++n}` });
const TERMS = {
  termsVersion: '2026-11-v1',
  dpaVersion: '2026-11-v1',
  acceptedByName: 'Người đại diện thử',
  acceptedByCapacity: 'Chủ garage',
  acceptedOn: '2026-11-06',
  documentRef: 'HS-Q38/khach-so-1.pdf',
};

describe.each(backends)('tenant terms acceptance [%s]', (backend) => {
  let h: Harness;
  const sys = () => h.container.sys;
  beforeAll(async () => {
    h = await createHarness(backend);
  });

  it('RULE-029: a live tenant cannot become active before the acceptance is recorded; a platform owner proposing and approving is written out (MT0-3)', async () => {
    const p = await provisionTenant(
      sys(),
      cnt,
      { code: 'tnt_live1', name: 'Garage Live', environment: 'live' },
      { ...rid(), idempotencyKey: 'prov-live1' },
    );
    expect(p.tenant.status).toBe('onboarding');
    // MT0-3: the owner approving his own provisioning request is explicit in the log
    const start = (await sys().platformAudit.list({ limit: 100 }, 'tnt_live1')).items.find(
      (e) => e.action === 'tenant.status_changed' && e.after?.status === 'provisioning',
    )!;
    expect(start).toMatchObject({ actorId: 'pf_owner', approverId: 'pf_owner' });
    await expect(
      transitionTenant(sys(), cnt, 'tnt_live1', { to: 'active', version: p.tenant.version }, rid()),
    ).rejects.toMatchObject({ code: 'terms_acceptance_required' });
    await expect(
      recordTermsAcceptance(sys(), htn, 'tnt_live1', TERMS, rid()),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      recordTermsAcceptance(sys(), qtn, 'tnt_live1', { ...TERMS, documentRef: '' }, rid()),
    ).rejects.toMatchObject({ status: 422 });
    const rec = await recordTermsAcceptance(sys(), qtn, 'tnt_live1', TERMS, rid());
    expect(rec.termsAcceptance).toMatchObject({
      termsVersion: '2026-11-v1',
      recordedBy: 'pf_admin',
    });
    const ok = await transitionTenant(
      sys(),
      cnt,
      'tnt_live1',
      { to: 'active', version: rec.version },
      rid(),
    );
    expect(ok.state).toBe('applied');
    const items = (await sys().platformAudit.list({ limit: 100 }, 'tnt_live1')).items;
    expect(items.find((e) => e.action === 'tenant.terms_accepted')).toMatchObject({
      actorId: 'pf_admin',
      after: { documentRef: 'HS-Q38/khach-so-1.pdf' },
    });
    // the record is append-only: a second entry adds, the first stays
    await recordTermsAcceptance(
      sys(),
      cnt,
      'tnt_live1',
      { ...TERMS, termsVersion: '2026-12-v2' },
      rid(),
    );
    const t = await sys().tenants.get('tnt_live1');
    expect(t!.termsAcceptances!.map((a) => a.termsVersion)).toEqual(['2026-11-v1', '2026-12-v2']);
    expect((await getTenant(sys(), cnt, 'tnt_live1')).termsAcceptance?.termsVersion).toBe(
      '2026-12-v2',
    );
  });

  it('RULE-029: Excel import of a live tenant is refused until the acceptance exists; a demo tenant is exempt', async () => {
    const form = () => {
      const f = new FormData();
      f.set('kind', 'customers-vehicles');
      f.set(
        'file',
        new File(
          [
            new Uint8Array(
              Buffer.from(
                'Mã khách cũ,Tên khách hàng,Số điện thoại,Biển số xe,Hãng xe,Dòng xe,Năm sản xuất\r\nA1,Nguyễn Một,0911000001,51Z-000.01,Toyota,Vios,2020\r\n',
              ),
            ),
          ],
          'f.csv',
        ),
      );
      return f;
    };
    const ql = await h.loginAt('u_ql_q7', 'br_q7');
    const demo = await h.call('POST', '/api/v1/sys/imports', {
      cookie: ql,
      form: form(),
      key: 'imp-terms-0000000001',
    });
    expect(demo.status, demo.text).toBeLessThan(300);
    // make the demo tenant a live one without a record
    await h.container.sys.uow.run(async (tx) => {
      h.container.sys.tenants.update(tx, 'tnt_demo', { environment: 'live' });
    });
    const blocked = await h.call('POST', '/api/v1/sys/imports', {
      cookie: ql,
      form: form(),
      key: 'imp-terms-0000000002',
    });
    expect(blocked.status).toBe(409);
    expect(blocked.json.code ?? blocked.json.type).toMatch(/terms_acceptance_required/);
    expect(await tenantTermsBlock(sys(), 'tnt_demo')).toBe(true);
    // the e-invoice checklist lists it as a blocking issue
    const base = {
      providerActive: true,
      issuerComplete: true,
      order: {
        status: 'completed',
        qcPassed: true,
        completed: true,
        cancelled: false,
        totalVnd: 1,
        hasLines: true,
      },
      buyer: { kind: 'retail' as const, name: 'Khách lẻ' },
      lines: [],
      built: null,
      existing: 'none' as const,
      currentRates: new Map<string, number>(),
      policy: DEFAULT_ELIGIBILITY_POLICY,
    };
    expect(checkEligibility({ ...base, termsBlocked: true }).issues.map((i) => i.code)).toContain(
      'terms_not_accepted',
    );
    expect(
      checkEligibility({ ...base, termsBlocked: false }).issues.map((i) => i.code),
    ).not.toContain('terms_not_accepted');
    await recordTermsAcceptance(sys(), cnt, 'tnt_demo', TERMS, rid());
    expect(await tenantTermsBlock(sys(), 'tnt_demo')).toBe(false);
    const after = await h.call('POST', '/api/v1/sys/imports', {
      cookie: ql,
      form: form(),
      key: 'imp-terms-0000000003',
    });
    expect(after.status, after.text).toBeLessThan(500);
    expect(after.status).not.toBe(409);
  });

  it('MT0-2: a suspended tenant is read-only for writes but can still export and sync invoices', async () => {
    const ql = await h.loginAt('u_ql_q7', 'br_q7');
    const cnt2: PlatformActor = { ...cnt, platformUserId: 'pf_owner2', displayName: 'CNT2' };
    const t = await getTenant(sys(), cnt, 'tnt_demo');
    await transitionTenant(
      sys(),
      cnt,
      'tnt_demo',
      { to: 'suspended', reason: 'Kiểm thử chỉ đọc', version: t.version },
      rid(),
    );
    await decideTenantTransition(sys(), cnt2, 'tnt_demo', { decision: 'approve' }, rid());
    const write = await h.call('POST', '/api/v1/crm/customers', {
      cookie: ql,
      key: 'ro-write-00000000000001',
      body: { name: 'Khách thử' },
    });
    expect(write.status).toBe(403);
    expect(JSON.stringify(write.json)).toMatch(/tenant_read_only/);
    // export and invoice sync are not stopped by the read-only gate (the body may still be refused on its own merits)
    const exp = await h.call('POST', '/api/v1/rpt/export', { cookie: ql, body: {} });
    expect(JSON.stringify(exp.json ?? {})).not.toMatch(/tenant_read_only/);
    const sync = await h.call('POST', '/api/v1/ein/invoices/inv_none/sync', { cookie: ql });
    expect(JSON.stringify(sync.json ?? {})).not.toMatch(/tenant_read_only/);
  });
});
