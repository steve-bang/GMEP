import { beforeAll, describe, expect, it } from 'vitest';
import { journey, type Row, SV_DAU, SV_PHANH } from '../helpers/journey';
import { backends, createHarness, type Harness } from './harness';

/**
 * Slice 2.8b: FR-REC-020 (a maintenance package from the effective-dated `service-package` catalogue gives the quote
 * all its items and lines, priced by the normal pricing; the sample package is "minh họa") and FR-REC-024 (items the
 * customer refused come back to the advisor when the vehicle returns; only quotes inside the reader's scope).
 */
describe.each(backends)('REC packages and declined items [%s]', (backend) => {
  let h: Harness;
  let j: ReturnType<typeof journey>;
  let cv: string;
  let qlTd: string;
  void backend;

  beforeAll(async () => {
    h = await createHarness(backend);
    j = journey(h);
    cv = await h.loginAt('u_cv_q7', 'br_q7');
    qlTd = await h.loginAt('u_ql_td', 'br_td');
  });

  it('FR-REC-020: choosing a package adds every item and line of the package to the quote, priced like any line', async () => {
    const list = await j.get(cv, '/api/v1/rec/pickers/packages');
    expect(list.status, list.text).toBe(200);
    const pkg = list.json.items.find((p: Row) => p.code === 'bd-10000');
    expect(pkg).toBeTruthy();
    expect(pkg.items).toHaveLength(2);
    const c = await j.customerWithVehicle(cv, 'PKG1', '51P-123.45');
    const intake = await j.post(cv, '/api/v1/rec/intakes', { vehicleId: c.vehicleId });
    const p = await j.call(cv, 'PATCH', `/api/v1/rec/intakes/${intake.json.id}`, {
      version: intake.json.version,
      step: 5,
      km: 990_000,
      customerRequest: 'Bảo dưỡng định kỳ',
      serviceType: 'maintenance',
      promisedDate: '2099-01-01',
    });
    expect(p.status, p.text).toBe(200);
    const done = await j.post(cv, `/api/v1/rec/intakes/${intake.json.id}/complete`, {
      version: p.json.version,
    });
    expect(done.status, done.text).toBe(200);
    const q = await j.post(cv, '/api/v1/rec/quotes', { intakeId: intake.json.id });
    const edited = await j.call(cv, 'PATCH', `/api/v1/rec/quotes/${q.json.id}`, {
      version: q.json.version,
      items: pkg.items,
    });
    expect(edited.status, edited.text).toBe(200);
    const shown = (await j.get(cv, `/api/v1/rec/quotes/${q.json.id}`)).json;
    const items = shown.shown?.items ?? shown.items;
    expect(items.map((i: Row) => i.name)).toEqual(['Thay dầu và lọc dầu', 'Kiểm tra phanh']);
    expect(items[0].lines).toHaveLength(2);
    expect(items[0].subtotalVnd).toBeGreaterThan(0);
  });

  it('FR-REC-024: an item the customer refused is listed for the vehicle (in scope only)', async () => {
    const c = await j.customerWithVehicle(cv, 'DEC1', '51D-555.66');
    const { q, token } = await j.sentQuote(cv, c.vehicleId, [
      { name: 'Thay dầu', necessity: 'required', lines: [{ kind: 'labor', serviceId: SV_DAU }] },
      {
        name: 'Thay má phanh',
        necessity: 'optional',
        lines: [{ kind: 'labor', serviceId: SV_PHANH }],
      },
    ]);
    const first = q.shown.items.find((x: Row) => x.name === 'Thay dầu');
    const r = await j.pub('/api/v1/rec/public/quote/approve', {
      token,
      selectedItemNos: [first.no],
    });
    expect(r.status, r.text).toBe(200);
    const d = await j.get(cv, `/api/v1/rec/declined-items?vehicleId=${c.vehicleId}`);
    expect(d.status, d.text).toBe(200);
    expect(d.json.items).toHaveLength(1);
    expect(d.json.items[0]).toMatchObject({
      name: 'Thay má phanh',
      necessity: 'optional',
      safety: false,
      quoteId: q.id,
    });
    // another branch: the vehicle is not in its scope
    expect((await j.get(qlTd, `/api/v1/rec/declined-items?vehicleId=${c.vehicleId}`)).status).toBe(
      404,
    );
  });
});
