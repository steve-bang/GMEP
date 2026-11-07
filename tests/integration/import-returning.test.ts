import { beforeAll, describe, expect, it } from 'vitest';
import { branchesScope } from '@/platform/scope/scope';
import { backends, createHarness, type Harness } from './harness';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/**
 * Slice 2.1 (2.1-4, FR-RPT-015, FR-SYS-007): a customer created by the Excel import is always counted as RETURNING by
 * the report (never as new), so the import day does not show a spike of new customers. A customer created by hand
 * keeps its real creation time.
 */
describe.each(backends)('imported customers count as returning [%s]', (backend) => {
  let h: Harness;
  let ql: string;

  beforeAll(async () => {
    h = await createHarness(backend);
    ql = await h.loginAt('u_ql_q7', 'br_q7');
  });

  it('the report source dates an imported customer before any day; a hand-made customer keeps its creation time', async () => {
    const form = new FormData();
    form.set('kind', 'customers-vehicles');
    form.set(
      'file',
      new File(
        [
          'Mã khách cũ,Tên khách hàng,Số điện thoại,Biển số xe,Hãng xe,Dòng xe,Năm sản xuất\r\n' +
            'R1,Phạm Nhập,0911000777,51Z-777.77,Toyota,Vios,2020\r\n',
        ],
        'k.csv',
      ),
    );
    const up = await h.call('POST', '/api/v1/sys/imports', {
      cookie: ql,
      form,
      key: 'imp-ret-000001-xxxxxxxx',
    });
    expect(up.status, up.text).toBe(201);
    const c = await h.call('POST', `/api/v1/sys/imports/${up.json.id}/commit`, {
      cookie: ql,
      key: 'imp-ret-000002-xxxxxxxx',
      body: {},
    });
    expect(c.status, c.text).toBe(200);
    const hand = await h.call('POST', '/api/v1/crm/customers', {
      cookie: ql,
      key: 'imp-ret-000003-xxxxxxxx',
      body: { type: 'individual', name: 'Khách Nhập Tay' },
    });
    expect(hand.status, hand.text).toBe(201);

    const find = async (q: string) =>
      (
        (await h.call('GET', `/api/v1/crm/customers?q=${encodeURIComponent(q)}`, { cookie: ql }))
          .json.items as Row[]
      )[0]!;
    const imported = await find('Phạm Nhập');
    const manual = await find('Khách Nhập Tay');
    const src = h.container.rpt.sources.customerCreated!;
    const got = await src(branchesScope('tnt_demo', ['br_q7']), [imported.id, manual.id]);
    expect(got.get(imported.id)!.getTime()).toBe(0); // always before the window: returning
    expect(got.get(manual.id)!.getTime()).toBeGreaterThan(Date.parse('2020-01-01'));
  });
});
