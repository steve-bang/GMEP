import { beforeAll, describe, expect, it } from 'vitest';
import { getDb } from '@/infrastructure/firestore/client';
import { businessDate } from '@/platform/format/date';
import { customerLinkId } from '@/modules/crm';
import { backends, createHarness, type Harness } from './harness';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
let seq = 0;
const key = (p: string) => `${p}-${String(++seq).padStart(6, '0')}-xxxxxxxx`;

const SV_DAU = 'svc_cmp_demo_SV-DAU'; // 30 min
const P_FILTER = 'part_seed_01'; // list 130.000
const VEH_AN = 'veh_an';
const VEH_BINH = 'veh_binh';

/**
 * BA answers §17 (docs/dev/ba-answers-for-dev.md): R2, R5, R7, R9, R10, C17, C24 on REC; every test has
 * its own database (one harness per backend), so configuration proposed here does not leak elsewhere.
 */
describe.each(backends)('REC after BA §17 [%s]', (backend) => {
  let h: Harness;
  let cv: string;
  let ql: string;
  let kt: string;
  let owner: string;
  const today = () => businessDate(h.clock.now());
  const addDays = (iso: string, n: number) => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };

  const rows = async (name: string): Promise<Row[]> =>
    backend === 'memory'
      ? ([...h.container.memory!.db.col(name).entries()].map(([id, v]) => ({ id, ...v })) as Row[])
      : ((await getDb(h.container.env).collection(name).get()).docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Row[]);
  const patchDoc = async (collection: string, id: string, patch: Row) => {
    if (backend === 'memory')
      Object.assign(h.container.memory!.db.col(collection).get(id) as Row, patch);
    else await getDb(h.container.env).collection(collection).doc(id).update(patch);
  };
  const dropDoc = async (collection: string, id: string) => {
    if (backend === 'memory') h.container.memory!.db.col(collection).delete(id);
    else await getDb(h.container.env).collection(collection).doc(id).delete();
  };
  const call = (cookie: string, method: string, path: string, body?: unknown, k = key('rec')) =>
    h.call(method, path, { cookie, key: k, ...(body !== undefined ? { body } : {}) });

  /** propose (as `by`) and approve (as the owner) one configuration version effective today */
  async function config(by: string, type: string, scopeKey: string, payload: Row, from?: string) {
    const p = await call(by, 'POST', `/api/v1/sys/config/${type}`, {
      scopeKey,
      effectiveFrom: from ?? today(),
      payload,
      reason: 'Thử nghiệm theo BA §17',
    });
    expect(p.status, p.text).toBe(201);
    const d = await call(
      owner,
      'POST',
      `/api/v1/sys/config/${type}/${encodeURIComponent(p.json.id)}/decide`,
      { decision: 'approve' },
    );
    expect(d.status, d.text).toBe(200);
  }

  async function completedIntake(
    cookie: string,
    vehicleId: string,
    km: number,
    extra: Row = {},
  ): Promise<Row> {
    const c = await call(cookie, 'POST', '/api/v1/rec/intakes', { vehicleId });
    expect(c.status, c.text).toBe(201);
    const p = await call(cookie, 'PATCH', `/api/v1/rec/intakes/${c.json.id}`, {
      version: c.json.version,
      step: 5,
      km,
      customerRequest: 'Thay nhớt định kỳ',
      serviceType: 'maintenance',
      promisedDate: '2099-01-01',
      ...extra,
    });
    expect(p.status, p.text).toBe(200);
    const done = await call(cookie, 'POST', `/api/v1/rec/intakes/${c.json.id}/complete`, {
      version: p.json.version,
    });
    expect(done.status, done.text).toBe(200);
    return done.json as Row;
  }
  const lines = (...l: Row[]) => [{ name: 'Bảo dưỡng', necessity: 'required', lines: l }];
  const labor = (extra: Row = {}) => ({ kind: 'labor', serviceId: SV_DAU, ...extra });
  const part = (qty: number) => ({ kind: 'part', partId: P_FILTER, qty });
  async function quoteOf(cookie: string, intakeId: string, items: Row[]): Promise<Row> {
    const q = await call(cookie, 'POST', '/api/v1/rec/quotes', { intakeId });
    expect(q.status, q.text).toBe(201);
    const e = await call(cookie, 'PATCH', `/api/v1/rec/quotes/${q.json.id}`, {
      version: q.json.version,
      items,
    });
    expect(e.status, e.text).toBe(200);
    return e.json as Row;
  }

  beforeAll(async () => {
    h = await createHarness(backend);
    cv = await h.loginAt('u_cv_q7', 'br_q7');
    ql = await h.loginAt('u_ql_q7', 'br_q7');
    kt = await h.login('u_kt');
    owner = await h.login('u_owner');
  });

  describe('R5 labor lines flag a difference from the standard hours', () => {
    it('stores the flag and the gap with the line; the standard time is not flagged', async () => {
      const i = await completedIntake(cv, VEH_AN, 70000);
      const q = await quoteOf(cv, i.id, [
        ...lines(labor()),
        { name: 'Thêm giờ', necessity: 'optional', lines: [labor({ minutes: 45 })] },
        { name: 'Bớt giờ', necessity: 'optional', lines: [labor({ minutes: 20 })] },
      ]);
      const [std, more, less] = q.shown.items.map((it: Row) => it.lines[0]);
      expect(std).toMatchObject({ differsFromStandard: false, minutesDelta: 0, minutesDeltaBp: 0 });
      expect(more).toMatchObject({
        differsFromStandard: true,
        minutesDelta: 15,
        minutesDeltaBp: 5000,
        standardMinutes: 30,
      });
      expect(less).toMatchObject({ minutesDelta: -10, minutesDeltaBp: -3333 });
      const stored = (await rows('quoteVersions')).find((v) => v.id === `${q.id}__v1`)!;
      expect(stored.items[1].lines[0].differsFromStandard).toBe(true);
    });
  });

  describe('R9 one odometer rule, updated when the intake completes', () => {
    it('completing the intake records the reading on the vehicle in the same transaction', async () => {
      const before = await call(cv, 'GET', `/api/v1/crm/vehicles/${VEH_AN}`);
      expect(before.json.lastKm).toBeLessThan(72000); // seeded 64.200, later intakes raised it
      await completedIntake(cv, VEH_AN, 72000);
      const after = await call(cv, 'GET', `/api/v1/crm/vehicles/${VEH_AN}`);
      expect(after.json).toMatchObject({ lastKm: 72000, lastKmAt: today() });
      const audit = (await rows('auditLogs')).filter(
        (a) => a.entityId === VEH_AN && a.action === 'vehicle.odometer',
      );
      expect(audit.find((a) => a.after?.lastKm === 72000)?.after).toMatchObject({
        lastKm: 72000,
        source: 'intake',
      });
    });
    it('a draft that is not completed does not touch the vehicle', async () => {
      const c = await call(cv, 'POST', '/api/v1/rec/intakes', { vehicleId: VEH_AN });
      await call(cv, 'PATCH', `/api/v1/rec/intakes/${c.json.id}`, {
        version: c.json.version,
        km: 99999,
      });
      expect((await call(cv, 'GET', `/api/v1/crm/vehicles/${VEH_AN}`)).json.lastKm).toBe(72000);
    });
    it('a big drop is flagged, tells the branch manager once and uses the SHARED threshold', async () => {
      const notices = async () =>
        (await rows('notifications')).filter(
          (n) => n.kind === 'crm.odometer_abnormal' && n.userId === 'u_ql_q7',
        );
      const n0 = (await notices()).length;
      const done = await completedIntake(cv, VEH_AN, 60000, { kmReason: 'typo' });
      expect(done.kmAbnormal).toBe(true);
      const got = (await notices()).slice(n0);
      expect(got).toHaveLength(1);
      expect(got[0]!.params).toMatchObject({ from: '72000', to: '60000' });
      expect(JSON.stringify(got)).not.toMatch(/Nguyễn|0900000211/);
      // REC has no threshold of its own: raising CRM's value changes REC's decision
      const crm = h.container.crm.crm;
      const saved = crm.abnormalKmDrop;
      crm.abnormalKmDrop = 50_000;
      try {
        const again = await completedIntake(cv, VEH_AN, 50000, { kmReason: 'typo' });
        expect(again.kmAbnormal ?? false).toBe(false);
        expect(await notices()).toHaveLength(n0 + 1);
      } finally {
        crm.abnormalKmDrop = saved;
      }
    });
    it('a lower reading still needs a reason when completing', async () => {
      const c = await call(cv, 'POST', '/api/v1/rec/intakes', { vehicleId: VEH_AN });
      const p = await call(cv, 'PATCH', `/api/v1/rec/intakes/${c.json.id}`, {
        version: c.json.version,
        km: 10,
        customerRequest: 'x',
        serviceType: 'maintenance',
        promisedDate: '2099-01-01',
      });
      expect(p.status).toBe(422);
      expect(p.json.errors[0].field).toBe('kmReason');
    });
  });

  describe('R7 service types are a configurable catalogue', () => {
    it('only codes of the catalogue are accepted; a new type is data; a retired one is not offered', async () => {
      const c = await call(cv, 'POST', '/api/v1/rec/intakes', { vehicleId: VEH_AN });
      const set = (serviceType: string, version: number) =>
        call(cv, 'PATCH', `/api/v1/rec/intakes/${c.json.id}`, { version, serviceType });
      const unknown = await set('inspection', c.json.version);
      expect(unknown.status).toBe(422);
      expect(unknown.json.errors[0].field).toBe('serviceType');
      await config(ql, 'service-type', 'inspection', { name: 'Đăng kiểm hộ', status: 'active' });
      const ok = await set('inspection', c.json.version);
      expect(ok.status, ok.text).toBe(200);
      expect(ok.json.serviceType).toBe('inspection');
      // retire body_paint: it stays readable but cannot be chosen again
      await patchDoc('configVersions', 'service-type__body_paint__2026-10-01', {
        payload: { name: 'Đồng sơn', status: 'inactive' },
      });
      const retired = await set('body_paint', ok.json.version);
      expect(retired.status).toBe(422);
      expect(retired.json.errors[0].message).toMatch(/ngừng/);
    });
  });

  describe('R2 tax by kind of line, stored on every line, with a validity warning', () => {
    it('defaults every line to vat and stores key and version', async () => {
      const i = await completedIntake(cv, VEH_AN, 70000);
      const q = await quoteOf(cv, i.id, lines(labor(), part(2)));
      for (const l of q.shown.items[0].lines)
        expect(l).toMatchObject({
          taxKey: 'vat',
          taxRateBp: 800,
          taxVersionId: 'tax-rate__vat__2026-10-01',
        });
      expect(q.shown.taxes).toHaveLength(1);
      expect(q.shown.tax).toMatchObject({ key: 'vat', rateBp: 800 });
    });
    it('a tax-mapping version gives parts their own rate: two rates, tax per rate', async () => {
      await config(kt, 'tax-rate', 'vat-part', { name: 'Thuế phụ tùng (mẫu)', rateBp: 1000 });
      await config(kt, 'tax-mapping', 'company', { labor: 'vat', part: 'vat-part' });
      const i = await completedIntake(cv, VEH_AN, 70000);
      const q = await quoteOf(cv, i.id, lines(labor(), part(2)));
      const [l, p] = q.shown.items[0].lines;
      expect(l).toMatchObject({ taxKey: 'vat', taxRateBp: 800, amountVnd: 150000 });
      expect(p).toMatchObject({ taxKey: 'vat-part', taxRateBp: 1000, amountVnd: 260000 });
      // 150.000 x 8% = 12.000; 260.000 x 10% = 26.000
      expect(q.shown.totals).toMatchObject({
        subtotalVnd: 410000,
        taxVnd: 38000,
        totalVnd: 448000,
      });
      expect(q.shown.taxes.map((t: Row) => t.key)).toEqual(['vat', 'vat-part']);
      expect(q.shown.tax).toBeNull(); // more than one rate: no single figure to show
      const stored = (await rows('quoteVersions')).find((v) => v.id === `${q.id}__v1`)!;
      expect(stored.items[0].lines[1]).toMatchObject({
        taxKey: 'vat-part',
        taxVersionId: expect.stringContaining('vat-part'),
      });
    });
    it('a mapped key with no rate in force is a configuration error, not a silent default', async () => {
      // only the mapping that names a rate nobody defined: registered directly (a future rate key typo)
      const forget = () => h.container.sys.caches.config.invalidateTag('cfg:cmp_demo:tax-mapping');
      await patchDoc('configVersions', 'tax-mapping__company__' + today(), {
        payload: { labor: 'vat', part: 'vat-typo' },
      });
      forget();
      const i = await completedIntake(cv, VEH_AN, 70000);
      const q = await call(cv, 'POST', '/api/v1/rec/quotes', { intakeId: i.id });
      const r = await call(cv, 'PATCH', `/api/v1/rec/quotes/${q.json.id}`, {
        version: q.json.version,
        items: lines(part(1)),
      });
      expect(r.status).toBe(409);
      expect(r.json.code).toBe('tax_rate_missing');
      await patchDoc('configVersions', 'tax-mapping__company__' + today(), {
        payload: { labor: 'vat', part: 'vat-part' },
      });
      forget();
    });
    it('warns when the validity runs past an approved change of a rate the quote used', async () => {
      const change = addDays(today(), 3); // inside the 7 days of validity
      await config(kt, 'tax-rate', 'vat', { name: 'Thuế GTGT (mẫu, mới)', rateBp: 1000 }, change);
      const i = await completedIntake(cv, VEH_AN, 70000);
      const q = await quoteOf(cv, i.id, lines(labor()));
      expect(q.shown.warnings).toEqual([
        expect.objectContaining({
          code: 'tax_change_within_validity',
          taxKey: 'vat',
          effectiveFrom: change,
          newRateBp: 1000,
        }),
      ]);
      // a change after the validity does not warn
      const i2 = await completedIntake(cv, VEH_AN, 70000);
      const q2 = await call(cv, 'POST', '/api/v1/rec/quotes', { intakeId: i2.id });
      const e2 = await call(cv, 'PATCH', `/api/v1/rec/quotes/${q2.json.id}`, {
        version: q2.json.version,
        items: lines(labor()),
      });
      expect(e2.json.shown.warnings).toHaveLength(1); // same change, still inside this validity
      await patchDoc('configVersions', `tax-rate__vat__${change}`, {
        effectiveFrom: addDays(today(), 30),
      });
      h.container.sys.caches.config.invalidateTag('cfg:cmp_demo:tax-rate');
      const again = await call(cv, 'GET', `/api/v1/rec/quotes/${q2.json.id}`);
      expect(again.json.shown.warnings).toHaveLength(0);
    });
  });

  describe('R10 expiry is derived; nothing pretends a message was sent', () => {
    it('a sent quote past its validity reads expired everywhere without a job', async () => {
      const i = await completedIntake(cv, VEH_AN, 70000);
      const q = await quoteOf(cv, i.id, lines(labor()));
      const sent = await call(cv, 'POST', `/api/v1/rec/quotes/${q.id}/send`, {
        version: q.version,
      });
      expect(sent.status).toBe(200);
      const live = await call(cv, 'GET', `/api/v1/rec/quotes/${q.id}`);
      expect(live.json.status).toBe('sent');
      expect(live.json.allowed).toEqual(['reject', 'revise']);
      // delivery: only frozen, not delivered
      expect(live.json.shown.sentVia).toBe('none');
      const yesterday = addDays(today(), -1);
      await patchDoc('quoteVersions', `${q.id}__v1`, { validUntil: yesterday });
      await patchDoc('quotes', q.id, { validUntil: yesterday });
      const expired = await call(cv, 'GET', `/api/v1/rec/quotes/${q.id}`);
      expect(expired.json.status).toBe('expired');
      expect(expired.json.shown).toMatchObject({ status: 'expired', storedStatus: 'sent' });
      expect(expired.json.allowed).toEqual(['revise']);
      const list = await call(cv, 'GET', '/api/v1/rec/quotes?limit=100');
      expect(list.json.items.find((x: Row) => x.id === q.id).status).toBe('expired');
      // an expired version can still be revised into v2
      const v2 = await call(cv, 'PATCH', `/api/v1/rec/quotes/${q.id}`, {
        version: expired.json.version,
        items: lines(labor()),
      });
      expect(v2.status).toBe(200);
      expect(v2.json).toMatchObject({ currentN: 2, status: 'draft' });
    });
    it('records how the customer was told: print and counter exist, nothing claims a message', async () => {
      const i = await completedIntake(cv, VEH_AN, 70000);
      const q = await quoteOf(cv, i.id, lines(labor()));
      const sent = await call(cv, 'POST', `/api/v1/rec/quotes/${q.id}/send`, {
        version: q.version,
        via: 'print',
      });
      expect(sent.status).toBe(200);
      expect((await call(cv, 'GET', `/api/v1/rec/quotes/${q.id}`)).json.shown.sentVia).toBe(
        'print',
      );
      const i2 = await completedIntake(cv, VEH_AN, 70000);
      const q2 = await quoteOf(cv, i2.id, lines(labor()));
      const bad = await call(cv, 'POST', `/api/v1/rec/quotes/${q2.id}/send`, {
        version: q2.version,
        via: 'zalo',
      });
      expect(bad.status).toBe(422); // no message channel is built
    });
  });

  describe('C17 REC joins the data-retention gate', () => {
    it('blocks while an intake is open or a quote waits for the customer; stays unverified for the modules not built', async () => {
      const customer = 'cus_biz';
      const gate = () => h.container.crm.retention.check('cmp_demo', customer);
      expect((await gate()).blockers).toEqual([]);
      const c = await call(cv, 'POST', '/api/v1/rec/intakes', { vehicleId: 'veh_biz' });
      expect((await gate()).blockers.join(' ')).toMatch(/hồ sơ tiếp nhận chưa hoàn tất/);
      await call(cv, 'POST', `/api/v1/rec/intakes/${c.json.id}/cancel`, {
        version: c.json.version,
        reason: 'Khách không đến',
      });
      expect((await gate()).blockers).toEqual([]);
      const i = await completedIntake(cv, 'veh_biz', 131000);
      const q = await quoteOf(cv, i.id, lines(labor()));
      await call(cv, 'POST', `/api/v1/rec/quotes/${q.id}/send`, { version: q.version });
      const waiting = await gate();
      expect(waiting.blockers.join(' ')).toMatch(/báo giá đang chờ khách duyệt/);
      // orders, payments, invoices and warranty are not connected yet: the whole gate is unverified (C4)
      expect(waiting.verified).toBe(false);
    });
  });

  describe('C24 relation sources', () => {
    it('opening an intake relates by `intake`, creating the quote by `quote`; the business-event flag stays off', async () => {
      // the advisor also works at Thu Duc, so a Thu Duc-only vehicle is visible while working at Q7
      const asg = {
        userId: 'u_cv_q7',
        companyId: 'cmp_demo',
        roleCode: 'CV',
        branchId: 'br_td',
        employeeCode: 'NV0103',
        createdAt: new Date(),
        createdBy: 'test',
      };
      const aid = 'u_cv_q7__CV__br_td';
      if (backend === 'memory') h.container.memory!.db.col('roleAssignments').set(aid, asg);
      else await getDb(h.container.env).collection('roleAssignments').doc(aid).set(asg);
      try {
        const both = await h.loginAt('u_cv_q7', 'br_q7');
        expect(h.container.crm.crm.adoptRequiresBusinessEvent).toBe(false);
        const flag = h.container.crm.crm;
        flag.adoptRequiresBusinessEvent = true; // even with the flag, a real intake relates the customer
        try {
          const opened = await call(both, 'POST', '/api/v1/rec/intakes', { vehicleId: VEH_BINH });
          expect(opened.status, opened.text).toBe(201);
        } finally {
          flag.adoptRequiresBusinessEvent = false;
        }
        const link = (await rows('customerLinks')).find(
          (l) => l.customerId === 'cus_binh' && l.branchId === 'br_q7',
        );
        expect(link).toMatchObject({ source: 'intake' });
        // forget the relation, then creating the quote re-creates it with the source `quote`
        const intakeId = (await rows('intakes')).find(
          (x) => x.customerId === 'cus_binh' && x.branchId === 'br_q7',
        )!.id;
        const patched = await call(both, 'PATCH', `/api/v1/rec/intakes/${intakeId}`, {
          version: 1,
          step: 5,
          km: 32000,
          customerRequest: 'Kiểm tra',
          serviceType: 'maintenance',
          promisedDate: '2099-01-01',
        });
        expect(patched.status, patched.text).toBe(200);
        const done = await call(both, 'POST', `/api/v1/rec/intakes/${intakeId}/complete`, {
          version: patched.json.version,
        });
        expect(done.status, done.text).toBe(200);
        await dropDoc('customerLinks', customerLinkId('cus_binh', 'br_q7'));
        const cust = (await rows('customers')).find((c) => c.id === 'cus_binh')!;
        await patchDoc('customers', 'cus_binh', {
          branchIds: cust.branchIds.filter((b: string) => b !== 'br_q7'),
        });
        const q = await call(both, 'POST', '/api/v1/rec/quotes', { intakeId });
        expect(q.status, q.text).toBe(201);
        const again = (await rows('customerLinks')).find(
          (l) => l.customerId === 'cus_binh' && l.branchId === 'br_q7',
        );
        expect(again).toMatchObject({ source: 'quote' });
      } finally {
        if (backend === 'memory') h.container.memory!.db.col('roleAssignments').delete(aid);
        else await getDb(h.container.env).collection('roleAssignments').doc(aid).delete();
      }
    });
  });
});
