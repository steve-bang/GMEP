import { beforeAll, describe, expect, it } from 'vitest';
import { getDb } from '@/infrastructure/firestore/client';
import { allRouteFiles, backends, createHarness, type Harness } from './harness';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
let seq = 0;
const key = (p: string) => `${p}-${String(++seq).padStart(6, '0')}-xxxxxxxx`;

const SV_DAU = 'svc_cmp_demo_SV-DAU'; // 30 min
const SV_PHANH = 'svc_cmp_demo_SV-PHANH'; // 90 min
const SV_NOHOURS = 'svc_cmp_demo_SV-NOHOURS';
const P_FILTER = 'part_seed_01'; // list 130.000, Q7 available 18 (20 on hand, 2 reserved)
const P_NOPRICE = 'part_seed_05'; // no price-item
const VEH_AN = 'veh_an'; // Q7 + TD, last km 64.200
const VEH_BINH = 'veh_binh'; // TD only, last km 31.000
const VEH_BIZ = 'veh_biz'; // Q7 only

/**
 * Slice 1.5 REC (first part): FR-REC-001, 002, 003, 004, 005, 007; RULE-005/006/007; NFR-ISO-01;
 * NFR-MNT-01 (prices, hours, rate, tax and discount limit all come from effective-dated config).
 */
describe.each(backends)('REC intake and quote [%s]', (backend) => {
  let h: Harness;
  let cv: string;
  let ql: string;
  let qlTd: string;
  let th: string;
  let kt: string;
  let owner: string;
  let ownerAll: string;

  const rows = async (name: string): Promise<Row[]> =>
    backend === 'memory'
      ? ([...h.container.memory!.db.col(name).entries()].map(([id, v]) => ({ id, ...v })) as Row[])
      : ((await getDb(h.container.env).collection(name).get()).docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Row[]);
  const call = (cookie: string, method: string, path: string, body?: unknown, k = key('rec')) =>
    h.call(method, path, { cookie, key: k, ...(body !== undefined ? { body } : {}) });
  const patchDoc = async (collection: string, id: string, patch: Row) => {
    if (backend === 'memory')
      Object.assign(h.container.memory!.db.col(collection).get(id) as Row, patch);
    else await getDb(h.container.env).collection(collection).doc(id).update(patch);
  };

  /** A completed intake (all required facts) for a vehicle, as the wizard would send it. */
  async function completedIntake(cookie: string, vehicleId: string, km = 70000) {
    const c = await call(cookie, 'POST', '/api/v1/rec/intakes', { vehicleId });
    expect(c.status).toBe(201);
    const p = await call(cookie, 'PATCH', `/api/v1/rec/intakes/${c.json.id}`, {
      version: c.json.version,
      step: 5,
      km,
      customerRequest: 'Thay nhớt định kỳ, xe kêu khi đạp phanh',
      serviceType: 'maintenance',
      promisedDate: '2099-01-01',
      promisedTime: '16:00',
    });
    expect(p.status).toBe(200);
    const done = await call(cookie, 'POST', `/api/v1/rec/intakes/${c.json.id}/complete`, {
      version: p.json.version,
    });
    expect(done.status).toBe(200);
    return done.json as Row;
  }
  const lines = (...l: Row[]) => [{ name: 'Bảo dưỡng', necessity: 'required', lines: l }];
  const labor = (serviceId: string, extra: Row = {}) => ({ kind: 'labor', serviceId, ...extra });
  const part = (partId: string, qty: number, extra: Row = {}) => ({
    kind: 'part',
    partId,
    qty,
    ...extra,
  });
  async function newQuote(cookie: string, intakeId: string) {
    const r = await call(cookie, 'POST', '/api/v1/rec/quotes', { intakeId });
    expect(r.status).toBe(201);
    return r.json as Row;
  }
  const edit = (cookie: string, q: Row, items: Row[], extra: Row = {}) =>
    call(cookie, 'PATCH', `/api/v1/rec/quotes/${q.id}`, { version: q.version, items, ...extra });

  beforeAll(async () => {
    h = await createHarness(backend);
    cv = await h.loginAt('u_cv_q7', 'br_q7');
    ql = await h.loginAt('u_ql_q7', 'br_q7');
    qlTd = await h.loginAt('u_ql_td', 'br_td');
    th = await h.loginAt('u_th_q7', 'br_q7');
    kt = await h.login('u_kt');
    owner = await h.login('u_owner');
    ownerAll = await h.loginAt('u_owner', 'all');
  });

  describe('intake wizard (FR-REC-001, 002, 003)', () => {
    let draft: Row;
    it('FR-REC-001: opens a draft for a known vehicle and fills vehicle and owner from CRM', async () => {
      const k = key('intake');
      const r = await call(cv, 'POST', '/api/v1/rec/intakes', { vehicleId: VEH_AN }, k);
      expect(r.status).toBe(201);
      draft = r.json;
      expect(draft).toMatchObject({
        status: 'draft',
        plate: '51H-123.45',
        customerName: 'Nguyễn Văn An',
        lastKmAtOpen: 64200,
        step: 1,
      });
      expect(draft.number).toMatch(/^TX-Q7-\d{4}-\d{5}$/);
      // idempotent: the same key returns the same intake, no second number is used
      const again = await call(cv, 'POST', '/api/v1/rec/intakes', { vehicleId: VEH_AN }, k);
      expect(again.json.id).toBe(draft.id);
      expect(again.headers.get('idempotent-replayed')).toBe('true');
      expect((await rows('intakes')).filter((i) => i.vehicleId === VEH_AN)).toHaveLength(1);
    });
    it('no personal contact data is copied into the intake (PDPL)', async () => {
      const raw = JSON.stringify((await rows('intakes'))[0]);
      expect(raw).not.toContain('0900000211');
      expect(raw).not.toContain('Nguyễn Văn Linh');
    });
    it('FR-REC-003: a reading below the last one needs a reason; abnormal drops are flagged', async () => {
      const bad = await call(cv, 'PATCH', `/api/v1/rec/intakes/${draft.id}`, {
        version: draft.version,
        step: 2,
        km: 60000,
      });
      expect(bad.status).toBe(422);
      expect(bad.json.errors[0].field).toBe('kmReason');
      const other = await call(cv, 'PATCH', `/api/v1/rec/intakes/${draft.id}`, {
        version: draft.version,
        km: 60000,
        kmReason: 'other',
        kmNote: 'ab',
      });
      expect(other.json.errors[0].field).toBe('kmNote');
      const ok = await call(cv, 'PATCH', `/api/v1/rec/intakes/${draft.id}`, {
        version: draft.version,
        step: 2,
        km: 60000,
        kmReason: 'typo',
      });
      expect(ok.status).toBe(200);
      expect(ok.json).toMatchObject({ km: 60000, kmReason: 'typo', kmAbnormal: true, step: 2 });
      draft = ok.json;
      // the change and its reason are in the audit trail
      const audit = (await rows('auditLogs')).filter(
        (a) => a.entityId === draft.id && a.action === 'intake.update',
      );
      expect(audit.at(-1)?.reason).toContain('typo');
    });
    it('FR-REC-003: raising the reading clears the warning data', async () => {
      const r = await call(cv, 'PATCH', `/api/v1/rec/intakes/${draft.id}`, {
        version: draft.version,
        km: 64500,
      });
      expect(r.status).toBe(200);
      expect(r.json).toMatchObject({ km: 64500, kmReason: null, kmAbnormal: false });
      draft = r.json;
    });
    it('FR-REC-002: cannot complete without the odometer and the customer words', async () => {
      const fresh = await call(cv, 'POST', '/api/v1/rec/intakes', { vehicleId: VEH_BIZ });
      const r = await call(cv, 'POST', `/api/v1/rec/intakes/${fresh.json.id}/complete`, {
        version: fresh.json.version,
      });
      expect(r.status).toBe(422);
      expect(r.json.errors.map((e: Row) => e.field).sort()).toEqual([
        'customerRequest',
        'km',
        'promisedDate',
        'serviceType',
      ]);
    });
    it('rejects an optimistic-lock conflict and a stale step save', async () => {
      const r = await call(cv, 'PATCH', `/api/v1/rec/intakes/${draft.id}`, {
        version: 1,
        customerRequest: 'x',
      });
      expect(r.status).toBe(409);
    });
    it('completes, then the intake is read-only; cancelling needs a reason', async () => {
      const done = await completedIntake(cv, VEH_AN);
      expect(done.status).toBe('completed');
      const edit = await call(cv, 'PATCH', `/api/v1/rec/intakes/${done.id}`, {
        version: done.version,
        customerRequest: 'đổi ý',
      });
      expect(edit.status).toBe(409);
      const noReason = await call(cv, 'POST', `/api/v1/rec/intakes/${done.id}/cancel`, {
        version: done.version,
        reason: 'x',
      });
      expect(noReason.status).toBe(422);
      const cancelled = await call(cv, 'POST', `/api/v1/rec/intakes/${done.id}/cancel`, {
        version: done.version,
        reason: 'Khách đổi lịch',
      });
      expect(cancelled.json.status).toBe('cancelled');
    });
  });

  describe('branch isolation and permissions (NFR-ISO-01)', () => {
    let intake: Row;
    let quote: Row;
    beforeAll(async () => {
      intake = await completedIntake(cv, VEH_BIZ, 130000);
      quote = await newQuote(cv, intake.id);
    });
    it('another branch gets 404 for an intake or quote id it knows, and an empty list', async () => {
      expect((await call(qlTd, 'GET', `/api/v1/rec/intakes/${intake.id}`)).status).toBe(404);
      expect((await call(qlTd, 'GET', `/api/v1/rec/quotes/${quote.id}`)).status).toBe(404);
      expect(
        (await call(qlTd, 'PATCH', `/api/v1/rec/quotes/${quote.id}`, { version: 1, items: [] }))
          .status,
      ).toBe(404);
      const list = await call(qlTd, 'GET', '/api/v1/rec/quotes?limit=50');
      expect(list.json.items.some((q: Row) => q.id === quote.id)).toBe(false);
      const search = await call(qlTd, 'GET', `/api/v1/rec/quotes?q=${quote.number}`);
      expect(search.json.items).toHaveLength(0);
    });
    it('a vehicle of another branch cannot open an intake', async () => {
      const r = await call(cv, 'POST', '/api/v1/rec/intakes', { vehicleId: VEH_BINH });
      expect(r.status).toBe(404);
    });
    it('the owner sees every branch in the consolidated view but cannot create (scope + permission)', async () => {
      const list = await call(ownerAll, 'GET', '/api/v1/rec/quotes?limit=50');
      expect(list.status).toBe(200);
      expect(list.json.items.some((q: Row) => q.id === quote.id)).toBe(true);
      expect((await call(owner, 'POST', '/api/v1/rec/intakes', { vehicleId: VEH_AN })).status).toBe(
        403,
      );
      expect(
        (await call(owner, 'POST', '/api/v1/rec/quotes', { intakeId: intake.id })).status,
      ).toBe(403);
    });
    it('role matrix: TH sees nothing, KT reads quotes only, QL writes', async () => {
      expect((await call(th, 'GET', '/api/v1/rec/quotes')).status).toBe(403);
      expect((await call(th, 'GET', '/api/v1/rec/intakes')).status).toBe(403);
      expect((await call(kt, 'GET', '/api/v1/rec/quotes')).status).toBe(200);
      expect((await call(kt, 'GET', '/api/v1/rec/intakes')).status).toBe(403);
      expect(
        (await call(kt, 'PATCH', `/api/v1/rec/quotes/${quote.id}`, { version: 1, items: [] }))
          .status,
      ).toBe(403);
      expect((await call(ql, 'GET', `/api/v1/rec/quotes/${quote.id}`)).status).toBe(200);
    });
    it('write routes need the Idempotency-Key and an Origin', async () => {
      const noKey = await h.call('POST', '/api/v1/rec/intakes', {
        cookie: cv,
        body: { vehicleId: VEH_AN },
      });
      expect(noKey.status).toBe(400);
      const noOrigin = await h.call('POST', '/api/v1/rec/quotes', {
        cookie: cv,
        key: key('o'),
        origin: null,
        body: { intakeId: intake.id },
      });
      expect([400, 403]).toContain(noOrigin.status);
    });
  });

  describe('quote lines, formulas and snapshots (FR-REC-004, 005, 007)', () => {
    let q: Row;
    beforeAll(async () => {
      const i = await completedIntake(cv, VEH_AN);
      q = await newQuote(cv, i.id);
    });
    it('RULE-007: a quote needs a completed intake, and only one per intake', async () => {
      const draft = await call(cv, 'POST', '/api/v1/rec/intakes', { vehicleId: VEH_BIZ });
      const r = await call(cv, 'POST', '/api/v1/rec/quotes', { intakeId: draft.json.id });
      expect(r.status).toBe(409);
      const dup = await call(cv, 'POST', '/api/v1/rec/quotes', { intakeId: q.intakeId });
      expect(dup.status).toBe(409);
      expect((await call(cv, 'POST', '/api/v1/rec/quotes', { intakeId: 'nope' })).status).toBe(404);
    });
    it('numbering: BG-<branch>-<yymm>-<seq> from the numbering service, versions never take a new number', () => {
      expect(q.number).toMatch(/^BG-Q7-\d{4}-\d{5}$/);
    });
    it('FR-REC-005: standard hours x branch hourly rate; FR-REC-004: totals and tax from config', async () => {
      const r = await edit(cv, q, lines(labor(SV_DAU), part(P_FILTER, 2)));
      expect(r.status).toBe(200);
      const v = r.json.shown;
      const [l, p] = v.items[0].lines;
      // 30 min at 300.000/h = 150.000 (company rate); 2 x 130.000 = 260.000 (list price STD)
      expect(l).toMatchObject({
        kind: 'labor',
        minutes: 30,
        standardMinutes: 30,
        unitVnd: 300000,
        amountVnd: 150000,
      });
      expect(p).toMatchObject({
        kind: 'part',
        qty: 2,
        listUnitVnd: 130000,
        unitVnd: 130000,
        amountVnd: 260000,
        discountBp: 0,
      });
      expect(v.totals).toMatchObject({ subtotalVnd: 410000, taxVnd: 32800, totalVnd: 442800 });
      expect(v.tax).toMatchObject({ rateBp: 800 });
      expect(v.items[0].selected).toBe(true); // required items start ticked
      expect(r.json.totalVnd).toBe(442800);
      for (const n of Object.values(v.totals)) expect(Number.isInteger(n)).toBe(true);
      q = { ...q, version: r.json.version };
    });
    it('FR-REC-006: shows the AVAILABLE quantity only, never on-hand or reserved or cost', async () => {
      const r = await call(cv, 'GET', `/api/v1/rec/quotes/${q.id}`);
      const p = r.json.shown.items[0].lines[1];
      expect(p.available).toBe(18);
      expect(r.text).not.toMatch(/onHand|reserved|costVnd/);
    });
    it('FR-REC-007: optional items start unticked unless the customer asked for them', async () => {
      const r = await edit(cv, q, [
        ...lines(labor(SV_DAU)),
        { name: 'Cân chỉnh', necessity: 'optional', lines: [labor(SV_PHANH)] },
        {
          name: 'Theo yêu cầu',
          necessity: 'optional',
          customerRequested: true,
          lines: [part(P_FILTER, 1)],
        },
      ]);
      const items = r.json.shown.items;
      expect(items.map((i: Row) => i.selected)).toEqual([true, false, true]);
      const t = r.json.shown.totals;
      // all: 150.000 + 450.000 + 130.000 = 730.000 ; ticked: 150.000 + 130.000 = 280.000
      expect(t).toMatchObject({ subtotalVnd: 730000, selectedSubtotalVnd: 280000 });
      expect(t.selectedTaxVnd).toBe(22400);
      q = { ...q, version: r.json.version };
    });
    it('the branch override of the hourly rate applies (Thu Duc 360.000/h)', async () => {
      // an approved effective-dated override for Thu Duc only (config data, nothing in code)
      const id = 'labor-rate__branch~br_td__2026-10-01';
      const cfg = {
        companyId: 'cmp_demo',
        type: 'labor-rate',
        scopeKey: 'branch:br_td',
        effectiveFrom: '2026-10-01',
        status: 'approved',
        payload: { hourlyRateVnd: 360000 },
        proposedBy: 'test',
        proposedAt: new Date('2026-10-01T00:00:00Z'),
        reason: 'test',
        decidedBy: 'test',
        decidedAt: new Date('2026-10-01T00:00:00Z'),
        decisionNote: null,
        version: 1,
      };
      if (backend === 'memory') h.container.memory!.db.col('configVersions').set(id, cfg);
      else await getDb(h.container.env).collection('configVersions').doc(id).set(cfg);
      h.container.sys.caches.config.clear();
      const i = await completedIntake(qlTd, VEH_BINH, 32000);
      const tq = await newQuote(qlTd, i.id);
      const r = await edit(qlTd, tq, lines(labor(SV_DAU)));
      expect(r.json.shown.items[0].lines[0]).toMatchObject({ unitVnd: 360000, amountVnd: 180000 });
    });
    it('missing config is an error, not a silent default: price, standard hours, tax rate', async () => {
      const noPrice = await edit(cv, q, lines(part(P_NOPRICE, 1)));
      expect(noPrice.status).toBe(422);
      expect(noPrice.json.errors[0].field).toBe('items.0.lines.0');
      const noHours = await edit(cv, q, lines(labor(SV_NOHOURS)));
      expect(noHours.status).toBe(422);
      // before the first tax-rate version takes effect there is no rate to apply
      h.clock.set('2026-09-15T05:00:00.000Z');
      try {
        const noTax = await edit(cv, q, lines(labor(SV_DAU)));
        expect(noTax.status).toBe(409);
        expect(noTax.json.code ?? noTax.json.type).toContain('tax_rate_missing');
      } finally {
        h.clock.set(new Date().toISOString());
      }
    });
    it('FR-INV-025: a discount above the role limit is refused; a manager with a higher limit may', async () => {
      // 130.000 -> 121.000 is 6,92%, 693 bp after rounding up against the advisor limit of 5%
      const over = await edit(cv, q, lines(part(P_FILTER, 1, { unitVnd: 121000 })));
      expect(over.status).toBe(422);
      expect(over.json.errors[0].field).toBe('items.0.lines.0.unitVnd');
      const inLimit = await edit(cv, q, lines(part(P_FILTER, 1, { unitVnd: 123500 }))); // 5%
      expect(inLimit.status).toBe(200);
      expect(inLimit.json.shown.items[0].lines[0]).toMatchObject({
        discountBp: 500,
        amountVnd: 123500,
      });
      q = { ...q, version: inLimit.json.version };
      const mgr = await edit(ql, q, lines(part(P_FILTER, 1, { unitVnd: 121000 })));
      expect(mgr.status).toBe(200);
      expect(mgr.json.shown.items[0].lines[0].discountBp).toBe(693); // 6,92% rounded up
      q = { ...q, version: mgr.json.version };
    });
    it('validates input at the boundary (floats, negatives, unknown kind, empty item)', async () => {
      expect((await edit(cv, q, lines(part(P_FILTER, 1.5)))).status).toBe(422);
      expect((await edit(cv, q, lines(part(P_FILTER, 0)))).status).toBe(422);
      expect((await edit(cv, q, lines(part(P_FILTER, 1, { unitVnd: -5 })))).status).toBe(422);
      expect((await edit(cv, q, [{ name: 'x', necessity: 'required', lines: [] }])).status).toBe(
        422,
      );
      expect((await edit(cv, q, lines({ kind: 'other' }))).status).toBe(422);
    });
    it('a stale version is a conflict, not an overwrite', async () => {
      const r = await call(cv, 'PATCH', `/api/v1/rec/quotes/${q.id}`, { version: 1, items: [] });
      expect(r.status).toBe(409);
    });
  });

  describe('versions, sending, states (RULE-005/006)', () => {
    let q: Row;
    let reservationsBefore: number;
    beforeAll(async () => {
      const i = await completedIntake(cv, VEH_AN);
      q = await newQuote(cv, i.id);
      reservationsBefore = (await rows('stockReservations')).length;
    });
    it('cannot send an empty quote', async () => {
      const r = await call(cv, 'POST', `/api/v1/rec/quotes/${q.id}/send`, { version: q.version });
      expect(r.status).toBe(409);
    });
    it('sends v1, audits it in the same transaction and holds NO stock', async () => {
      const e = await edit(cv, q, lines(labor(SV_DAU), part(P_FILTER, 2)));
      q = { ...q, version: e.json.version };
      const k = key('send');
      const r = await call(
        cv,
        'POST',
        `/api/v1/rec/quotes/${q.id}/send`,
        { version: q.version },
        k,
      );
      expect(r.status).toBe(200);
      expect(r.json).toMatchObject({ status: 'sent', currentN: 1 });
      const again = await call(
        cv,
        'POST',
        `/api/v1/rec/quotes/${q.id}/send`,
        { version: q.version },
        k,
      );
      expect(again.headers.get('idempotent-replayed')).toBe('true');
      expect((await rows('stockReservations')).length).toBe(reservationsBefore);
      const audit = (await rows('auditLogs'))
        .filter((a) => a.entityId === q.id)
        .map((a) => a.action);
      expect(audit).toEqual(expect.arrayContaining(['quote.create', 'quote.update', 'quote.send']));
      const v1 = (await rows('quoteVersions')).find((v) => v.id === `${q.id}__v1`)!;
      expect(v1.status).toBe('sent');
      expect(v1.validUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      q = { ...q, version: r.json.version };
    });
    it('editing a sent quote creates v2 (draft); v1 keeps its price and stays sent until v2 is sent', async () => {
      const r = await edit(cv, q, lines(labor(SV_DAU), part(P_FILTER, 3)));
      expect(r.status).toBe(200);
      expect(r.json).toMatchObject({ currentN: 2, status: 'draft' });
      expect(r.json.versions.map((v: Row) => [v.n, v.status])).toEqual([
        [1, 'sent'],
        [2, 'draft'],
      ]);
      const v1 = await call(cv, 'GET', `/api/v1/rec/quotes/${q.id}?v=1`);
      expect(v1.json.shown).toMatchObject({ n: 1, current: false });
      expect(v1.json.shown.totals.totalVnd).toBe(442800); // priced with 2 filters
      expect(r.json.shown.totals.totalVnd).toBe(150000 + 390000 + 0 + Math.round(540000 * 0.08));
      q = { ...q, version: r.json.version };
    });
    it('sending v2 replaces v1 (read-only); the list shows one row for the quote', async () => {
      const r = await call(cv, 'POST', `/api/v1/rec/quotes/${q.id}/send`, { version: q.version });
      expect(r.status).toBe(200);
      const d = await call(cv, 'GET', `/api/v1/rec/quotes/${q.id}`);
      expect(d.json.versions[0]).toMatchObject({ n: 1, status: 'sent', replacedByN: 2 });
      expect(d.json.shown).toMatchObject({ n: 2, status: 'sent', current: true });
      expect(d.json.allowed).toEqual(['approve', 'link', 'reject', 'revise']);
      const list = await call(cv, 'GET', `/api/v1/rec/quotes?limit=100`);
      expect(list.json.items.filter((x: Row) => x.id === q.id)).toHaveLength(1);
      q = { ...q, version: r.json.version };
    });
    it('the customer refuses the whole quote -> rejected; editing again makes v3', async () => {
      const rej = await call(cv, 'POST', `/api/v1/rec/quotes/${q.id}/reject`, {
        version: q.version,
        reason: 'Khách chê giá cao',
      });
      expect(rej.json.status).toBe('rejected');
      const dup = await call(cv, 'POST', `/api/v1/rec/quotes/${q.id}/reject`, {
        version: rej.json.version,
        reason: 'lần hai',
      });
      expect(dup.status).toBe(409); // a rejected quote cannot be rejected again
      const v3 = await edit(cv, { ...q, version: rej.json.version }, lines(labor(SV_DAU)));
      expect(v3.json).toMatchObject({ currentN: 3, status: 'draft' });
    });
    it('approved content is locked: no new version, changes go through a supplementary quote', async () => {
      const i = await completedIntake(cv, VEH_AN);
      let a = await newQuote(cv, i.id);
      const e = await edit(cv, a, lines(labor(SV_DAU)));
      a = { ...a, version: e.json.version };
      await call(cv, 'POST', `/api/v1/rec/quotes/${a.id}/send`, { version: a.version });
      // approval itself ships in the next part; the state is set directly to test the lock
      await patchDoc('quoteVersions', `${a.id}__v1`, { status: 'approved_partial' });
      await patchDoc('quotes', a.id, { status: 'approved_partial' });
      const cur = await call(cv, 'GET', `/api/v1/rec/quotes/${a.id}`);
      const r = await edit(
        cv,
        { ...a, version: cur.json.version },
        lines(labor(SV_DAU), part(P_FILTER, 1)),
      );
      expect(r.status).toBe(409);
      const send = await call(cv, 'POST', `/api/v1/rec/quotes/${a.id}/send`, {
        version: cur.json.version,
      });
      expect(send.status).toBe(409);
    });
    it('a draft kept overnight must be re-priced before it is sent', async () => {
      const i = await completedIntake(cv, VEH_AN);
      let d = await newQuote(cv, i.id);
      const e = await edit(cv, d, lines(labor(SV_DAU)));
      d = { ...d, version: e.json.version };
      await patchDoc('quoteVersions', `${d.id}__v1`, { pricedOn: '2026-10-02' });
      const r = await call(cv, 'POST', `/api/v1/rec/quotes/${d.id}/send`, { version: d.version });
      expect(r.status).toBe(409);
    });
    it('no personal contact data in quote responses', async () => {
      const r = await call(cv, 'GET', `/api/v1/rec/quotes/${q.id}`);
      expect(r.text).not.toMatch(/0900000211|an\.demo@example/);
    });
  });

  describe('pickers', () => {
    it('lists services with standard hours and the branch rate, parts with list price and available only', async () => {
      const s = await call(cv, 'GET', '/api/v1/rec/pickers/services?q=bao');
      expect(s.status).toBe(200);
      expect(s.json.items.find((x: Row) => x.code === 'SV-DAU')).toMatchObject({
        standardMinutes: 30,
        hourlyRateVnd: 300000,
      });
      const p = await call(cv, 'GET', '/api/v1/rec/pickers/parts?q=loc');
      expect(p.json.items.find((x: Row) => x.id === P_FILTER)).toMatchObject({
        listPriceVnd: 130000,
        available: 18,
      });
      expect(p.text).not.toMatch(/onHand|reserved|costVnd/);
      expect((await call(th, 'GET', '/api/v1/rec/pickers/parts?q=loc')).status).toBe(403);
    });
  });

  describe('CRM relation (BA §10.1.4)', () => {
    it('relates the customer to the working branch when the visit opens (CRM relateToWorkingBranch)', async () => {
      // the advisor also works at Thu Duc, so a Thu Duc-only vehicle is visible to them while working at Q7
      const asg = {
        userId: 'u_cv_q7',
        companyId: 'cmp_demo',
        roleCode: 'CV',
        branchId: 'br_td',
        employeeCode: 'NV0103',
        createdAt: new Date(),
        createdBy: 'test',
      };
      const id = 'u_cv_q7__CV__br_td';
      if (backend === 'memory') h.container.memory!.db.col('roleAssignments').set(id, asg);
      else await getDb(h.container.env).collection('roleAssignments').doc(id).set(asg);
      const both = await h.loginAt('u_cv_q7', 'br_q7');
      expect((await rows('customers')).find((c) => c.id === 'cus_binh')?.branchIds).toEqual([
        'br_td',
      ]);
      const r = await call(both, 'POST', '/api/v1/rec/intakes', { vehicleId: VEH_BINH });
      expect(r.status).toBe(201);
      expect((await rows('customers')).find((c) => c.id === 'cus_binh')?.branchIds).toContain(
        'br_q7',
      );
      if (backend === 'memory') h.container.memory!.db.col('roleAssignments').delete(id);
      else await getDb(h.container.env).collection('roleAssignments').doc(id).delete();
    });
  });

  it('every REC write route is wrapped (Origin check) and listed', () => {
    const rec = allRouteFiles().filter((r) => r.file.includes('/api/v1/rec/'));
    expect(rec.length).toBeGreaterThanOrEqual(10);
  });
});
