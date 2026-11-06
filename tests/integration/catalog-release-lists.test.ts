import { beforeAll, describe, expect, it } from 'vitest';
import { businessDateOf } from '@/platform/effective/effective';
import { backends, createHarness, type Harness } from './harness';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * FR-SYS-016: a change released at head office applies to the branches chosen. The service lists offered to a branch
 * (quote picker and the branch service list) honour `isReleasedToBranch`; head office keeps the full catalogue.
 */
describe.each(backends)('FR-SYS-016 release applied to service lists [%s]', (backend) => {
  let h: Harness;
  let cvQ7: string;
  let ownerTd: string;
  let owner: string;
  const today = businessDateOf(new Date());
  const codes = (r: { json: { items: Row[] } }) => r.json.items.map((x) => x.code);
  const pick = (cookie: string) => h.call('GET', '/api/v1/rec/pickers/services?q=bao', { cookie });
  const list = (cookie: string, extra = '') =>
    h.call('GET', `/api/v1/sys/services?limit=50${extra}`, { cookie });

  beforeAll(async () => {
    h = await createHarness(backend);
    cvQ7 = await h.loginAt('u_cv_q7', 'br_q7');
    ownerTd = await h.loginAt('u_owner', 'br_td');
    owner = await h.loginAt('u_owner', 'all');
  });

  it('no release = every branch sees the service; a release to Q7 hides it from Thủ Đức; head office still lists it', async () => {
    expect(codes(await pick(cvQ7))).toContain('SV-DAU'); // no release yet: unrestricted
    expect(codes(await pick(ownerTd))).toContain('SV-DAU');

    const p = await h.call('POST', '/api/v1/sys/config/catalog-release', {
      cookie: owner,
      key: 'rel-list-00000001',
      body: {
        scopeKey: 'service:SV-DAU',
        effectiveFrom: today,
        payload: { audience: 'branches', branchIds: ['br_q7'] },
        reason: 'Chỉ phát hành cho Quận 7',
      },
    });
    expect(p.status, p.text).toBe(201);
    expect(codes(await pick(ownerTd))).toContain('SV-DAU'); // pending changes nothing
    const ok = await h.call(
      'POST',
      `/api/v1/sys/config/catalog-release/${encodeURIComponent(p.json.id)}/decide`,
      {
        cookie: owner,
        key: 'rel-list-00000002',
        body: { decision: 'approve', reauthPassword: 'Demo!Pass-2026' },
      },
    );
    expect(ok.status, ok.text).toBe(200);

    expect(codes(await pick(cvQ7))).toContain('SV-DAU'); // released to Q7
    expect(codes(await pick(ownerTd))).not.toContain('SV-DAU'); // not released to Thủ Đức
    expect(codes(await list(ownerTd))).not.toContain('SV-DAU'); // the branch service list
    expect(codes(await list(owner))).toContain('SV-DAU'); // head office, company scope
    expect(codes(await list(ownerTd, '&released=all'))).toContain('SV-DAU');
  });
});
