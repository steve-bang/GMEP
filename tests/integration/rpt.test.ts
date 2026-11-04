import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { getDb } from '@/infrastructure/firestore/client';
import { businessDate } from '@/platform/format/date';
import { backends, createHarness, type Harness } from './harness';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
let seq = 0;
const key = (p: string) => `${p}-${String(++seq).padStart(6, '0')}-xxxxxxxx`;

const SV_DAU = 'svc_cmp_demo_SV-DAU';
const P_FILTER = 'part_seed_01';
const Q7 = 'wh_br_q7_WH-CHINH';

/**
 * Slice 1.9 "Báo cáo một chi nhánh": FR-RPT-001 (role dashboard, consolidated from per-branch rollups), 003 (daily
 * report, rebuild equals incremental, idempotent job), 004 minimum (invoices vs orders without, stock issue without
 * source = 0), 011 (drill-down to source documents), 012/014 (orders and filters of the day), 013 (formula printed),
 * exception alerts, CSV export with audit; RULE-007, RULE-010; R68 (no new index); NFR-ISO-01.
 */
describe.each(backends)('RPT single-branch reports [%s]', (backend) => {
  let h: Harness;
  let cv: string;
  let ql: string;
  let qd: string;
  let th: string;
  let tk: string;
  let tn: string;
  let kt: string;
  let ch: string;
  let qv: string;
  let qlTd: string;
  let t0 = '';
  let today = '';
  const rows = async (name: string): Promise<Row[]> =>
    backend === 'memory'
      ? ([...h.container.memory!.db.col(name).entries()].map(([id, v]) => ({ id, ...v })) as Row[])
      : ((await getDb(h.container.env).collection(name).get()).docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Row[]);
  const wipeRollups = async () => {
    if (backend === 'memory') h.container.memory!.db.col('rollups').clear();
    else {
      const db = getDb(h.container.env);
      for (const d of await db.collection('rollups').listDocuments()) await d.delete();
    }
  };
  const call = (cookie: string, method: string, path: string, body?: unknown, k = key('rpt')) =>
    h.call(method, path, { cookie, key: k, ...(body !== undefined ? { body } : {}) });
  const post = (cookie: string, path: string, body: unknown = {}) =>
    call(cookie, 'POST', path, body);
  const get = (cookie: string, path: string) => h.call('GET', path, { cookie });
  const pub = (path: string, body: unknown) =>
    h.call('POST', path, { body, key: key('pub'), headers: { 'x-forwarded-for': '203.0.113.77' } });

  let odo = 600_000;
  async function openedOrder(vehicleId = 'veh_an'): Promise<Row> {
    const c = await post(cv, '/api/v1/rec/intakes', { vehicleId });
    const p = await call(cv, 'PATCH', `/api/v1/rec/intakes/${c.json.id}`, {
      version: c.json.version,
      step: 5,
      km: (odo += 100),
      customerRequest: 'Bảo dưỡng',
      serviceType: 'maintenance',
      promisedDate: '2099-01-01',
    });
    const done = await post(cv, `/api/v1/rec/intakes/${c.json.id}/complete`, {
      version: p.json.version,
    });
    const created = await post(cv, '/api/v1/rec/quotes', { intakeId: done.json.id });
    const edited = await call(cv, 'PATCH', `/api/v1/rec/quotes/${created.json.id}`, {
      version: created.json.version,
      items: [
        {
          name: 'Thay dầu và lọc',
          necessity: 'required',
          lines: [
            { kind: 'labor', serviceId: SV_DAU },
            { kind: 'part', partId: P_FILTER, qty: 2 },
          ],
        },
      ],
    });
    const sent = await post(cv, `/api/v1/rec/quotes/${created.json.id}/send`, {
      version: edited.json.version,
    });
    const link = await post(cv, `/api/v1/rec/quotes/${created.json.id}/link`, {
      version: sent.json.version,
    });
    const q = (await get(cv, `/api/v1/rec/quotes/${created.json.id}`)).json as Row;
    const r = await pub('/api/v1/rec/public/quote/approve', {
      token: link.json.token,
      selectedItemNos: q.shown.items.map((x: Row) => x.no),
    });
    expect(r.status, r.text).toBe(200);
    const head = (await get(cv, `/api/v1/rec/quotes/${q.id}`)).json;
    return order(head.orderId);
  }
  const order = async (id: string) => (await get(cv, `/api/v1/rec/orders/${id}`)).json as Row;
  async function readyOrder(): Promise<Row> {
    const o = await openedOrder();
    for (const it of o.items) {
      let cur = (await order(o.id)).items.find((x: Row) => x.id === it.id);
      await post(qd, `/api/v1/rec/items/${it.id}/assign`, {
        version: cur.version,
        technicianId: 'u_th_q7',
      });
      // parts issued against the order by the storekeeper (RULE-007: the goods issue carries the order as source)
      const fresh = (await order(o.id)).items.find((x: Row) => x.id === it.id);
      const line = fresh.lines.find((l: Row) => l.kind === 'part');
      if (line) {
        const req = await post(th, `/api/v1/rec/orders/${o.id}/part-requests`, {
          itemId: it.id,
          lineKey: line.lineKey,
          qty: 1,
        });
        expect(req.status, req.text).toBe(201);
        const dec = await post(tk, `/api/v1/rec/part-requests/${req.json.id}/decide`, {
          decision: 'issue',
          version: 1,
        });
        expect(dec.status, dec.text).toBe(200);
      }
      for (const ev of ['start', 'finish']) {
        cur = (await order(o.id)).items.find((x: Row) => x.id === it.id);
        await post(th, `/api/v1/rec/items/${it.id}/${ev}`, { version: cur.version });
      }
    }
    let cur = await order(o.id);
    await post(cv, `/api/v1/rec/orders/${o.id}/submit-qc`, { version: cur.version });
    const list = (await get(qd, `/api/v1/rec/orders/${o.id}/qc-checklist`)).json;
    cur = await order(o.id);
    const r = await post(qd, `/api/v1/rec/orders/${o.id}/qc`, {
      version: cur.version,
      checks: list.checks.map((c: Row) => ({ code: c.code, ok: true })),
    });
    expect(r.status, r.text).toBe(200);
    return order(o.id);
  }
  async function payFull(orderId: string) {
    const s = await post(tn, '/api/v1/acc/shifts', {});
    expect([201, 409], s.text).toContain(s.status);
    const b = (await get(tn, `/api/v1/acc/orders/${orderId}`)).json.balance;
    const r = await post(tn, `/api/v1/acc/orders/${orderId}/payments`, {
      kind: 'receipt',
      lines: [{ method: 'cash', amountVnd: b.outstandingVnd }],
    });
    expect(r.status, r.text).toBe(201);
  }
  async function handOver(o: Row) {
    const cur = await order(o.id);
    const r = await post(cv, `/api/v1/rec/orders/${o.id}/handover`, {
      version: cur.version,
      receiverName: 'Nguyễn Văn An',
      confirmation: 'screen',
      belongingsReturned: true,
      oldPartsReturned: true,
    });
    expect(r.status, r.text).toBe(200);
  }
  const rollup = async (cookie = ql, branch = 'br_q7') =>
    (await get(cookie, `/api/v1/rpt/daily?date=${today}&branchId=${branch}`)).json as Row;
  const stored = async (branch = 'br_q7') =>
    (await rows('rollups')).find((r) => r.id === `${branch}_${today.replace(/-/g, '')}`);

  let a: Row;
  let b: Row;
  let c: Row;
  let before: { revenue: number };

  beforeAll(async () => {
    h = await createHarness(backend);
    t0 = h.clock.now().toISOString();
    today = businessDate(h.clock.now());
    cv = await h.loginAt('u_cv_q7', 'br_q7');
    ql = await h.loginAt('u_ql_q7', 'br_q7');
    qd = await h.loginAt('u_qd_q7', 'br_q7');
    th = await h.loginAt('u_th_q7', 'br_q7');
    tk = await h.loginAt('u_tk_q7', 'br_q7');
    tn = await h.loginAt('u_tn_q7', 'br_q7');
    kt = await h.loginAt('u_kt', 'br_q7');
    ch = await h.loginAt('u_owner', 'all');
    qv = await h.loginAt('u_qv', 'all');
    qlTd = await h.loginAt('u_ql_td', 'br_td');
    const grn = await post(tk, '/api/v1/inv/documents', {
      warehouseId: Q7,
      type: 'GRN',
      source: { type: 'purchase-order', id: 'po-rpt-1' },
      lines: [{ partId: P_FILTER, qty: 300, unitCostVnd: 85_000 }],
    });
    const posted = await post(tk, `/api/v1/inv/documents/${grn.json.id}/post`, {
      version: grn.json.version,
    });
    expect(posted.status, posted.text).toBe(200);
    // A: paid, handed over, invoiced. B: paid, handed over, NOT invoiced. C: still open.
    a = await readyOrder();
    await payFull(a.id);
    await handOver(a);
    const inv = await post(tn, `/api/v1/ein/orders/${a.id}/invoices`, {});
    expect(inv.status, inv.text).toBe(201);
    b = await readyOrder();
    await payFull(b.id);
    await handOver(b);
    c = await openedOrder();
    before = { revenue: 0 };
  });
  afterEach(() => {
    h.clock.set(t0);
  });

  describe('the due job (FR-RPT-003)', () => {
    it('run-due builds today from the source documents; a repeat writes nothing; the first run is audited', async () => {
      const r1 = await post(ql, '/api/v1/rpt/jobs/run-due', {});
      expect(r1.status, r1.text).toBe(200);
      const todayOutcome = r1.json.branches[0].days.find((d: Row) => d.date === today);
      expect(r1.json.branches).toHaveLength(1);
      expect(r1.json.branches[0].branchId).toBe('br_q7');
      expect(todayOutcome.result).toBe('created');
      const r2 = await post(ql, '/api/v1/rpt/jobs/run-due', {});
      expect(r2.json.branches[0].days.every((d: Row) => d.result === 'unchanged')).toBe(true);
      const audit = (await rows('auditLogs')).filter(
        (x) => x.entityType === 'rollup' && x.action === 'rollup.refresh',
      );
      expect(audit.length).toBeGreaterThanOrEqual(1);
      expect(audit[0]!.branchId).toBe('br_q7');
    });

    it('permissions and scope: only report-job:manage inside the scope can run or rebuild', async () => {
      for (const who of [cv, tn, kt, qv, tk])
        expect(
          (await post(who, '/api/v1/rpt/jobs/run-due', {})).status,
          'no report-job:manage',
        ).toBe(403);
      // the Thu Duc manager cannot run it for Quan 7
      expect((await post(qlTd, '/api/v1/rpt/jobs/run-due', { branchId: 'br_q7' })).status).toBe(
        403,
      );
      expect(
        (await post(qlTd, '/api/v1/rpt/jobs/rebuild', { date: today, branchId: 'br_q7' })).status,
      ).toBe(403);
      expect((await post(ql, '/api/v1/rpt/jobs/rebuild', { date: '2099-01-01' })).status).toBe(422);
      expect((await post(ql, '/api/v1/rpt/jobs/rebuild', { date: '2001-01-01' })).status).toBe(422);
      expect((await post(ql, '/api/v1/rpt/jobs/rebuild', { date: 'abc' })).status).toBe(422);
    });
  });

  describe('daily report (FR-RPT-003, 004 minimum, 012, 013)', () => {
    it('the figures follow the source documents: orders, revenue split, payments, invoices, stock', async () => {
      await post(ql, '/api/v1/rpt/jobs/run-due', {});
      const d = await rollup();
      const r = d.rollup;
      expect(r.orders).toMatchObject({ opened: 3, closed: 2, handedOver: 2, openAtEnd: 1 });
      const oa = await get(ql, `/api/v1/rec/orders/${a.id}`);
      const ob = await get(ql, `/api/v1/rec/orders/${b.id}`);
      const total = oa.json.totalVnd + ob.json.totalVnd;
      expect(r.revenue.orderTotalVnd).toBe(total);
      // labor + parts before tax; tax is the rest (VAT 8% sample)
      expect(r.revenue.laborVnd).toBeGreaterThan(0);
      expect(r.revenue.partsVnd).toBeGreaterThan(0);
      expect(r.revenue.exTaxVnd).toBe(r.revenue.laborVnd + r.revenue.partsVnd);
      expect(r.revenue.exTaxVnd + r.revenue.taxAndOtherVnd).toBe(total);
      // FR-RPT-003: received + debt + gap = total; both orders were paid in full
      expect(r.money.receivedForClosedVnd).toBe(total);
      expect(r.money.gapVnd).toBe(0);
      expect(r.money.byMethod.cash).toBe(total);
      expect(r.money.inflowVnd).toBe(total);
      // invoices issued vs orders without: A has one, B does not (FR-RPT-004 minimum)
      expect(r.invoices.issuedCount).toBe(1);
      expect(r.invoices.closedWithoutInvoiceCount).toBe(1);
      // RULE-007: every goods issue has a source document
      expect(r.stock.issuesWithoutSource).toBe(0);
      expect(r.stock.issueDocuments).toBeGreaterThanOrEqual(2);
      // FR-RPT-010: the day is not closed yet, so it is provisional
      expect(r.official).toBe(false);
      expect(d.branchId).toBe('br_q7');
      // FR-RPT-013: the formula travels with the figure
      expect(d.formula.revenue).toBe('laborPlusParts');
      before.revenue = r.revenue.exTaxVnd;
    });

    it('incremental refresh equals a rebuild from scratch (same document hash)', async () => {
      // incremental: a payment-independent change - issue the invoice of B, refresh
      const inv = await post(tn, `/api/v1/ein/orders/${b.id}/invoices`, {});
      expect(inv.status, inv.text).toBe(201);
      const run = await post(ql, '/api/v1/rpt/jobs/run-due', {});
      expect(run.json.branches[0].days.find((d: Row) => d.date === today).result).toBe('updated');
      const incremental = await stored();
      expect(incremental!.invoices).toMatchObject({ issuedCount: 2, closedWithoutInvoiceCount: 0 });
      // rebuild from nothing
      await wipeRollups();
      expect(await stored()).toBeUndefined();
      const rb = await post(ql, '/api/v1/rpt/jobs/rebuild', { date: today });
      expect(rb.status, rb.text).toBe(200);
      expect(rb.json.branches[0].days[0].result).toBe('created');
      const rebuilt = await stored();
      expect(rebuilt!.sourceHash).toBe(incremental!.sourceHash);
      // and a second rebuild writes nothing
      const again = await post(ql, '/api/v1/rpt/jobs/rebuild', { date: today });
      expect(again.json.branches[0].days[0].result).toBe('unchanged');
      const actions = (await rows('auditLogs'))
        .filter((x) => x.entityType === 'rollup')
        .map((x) => x.action);
      expect(actions).toContain('rollup.rebuild');
      await post(ql, '/api/v1/rpt/jobs/run-due', {});
    });

    it('a missing day is an empty state, not zeros; a day the user cannot see is not found', async () => {
      const old = await get(ql, `/api/v1/rpt/daily?date=2026-01-02&branchId=br_q7`);
      expect(old.status).toBe(200);
      expect(old.json.rollup).toBeNull();
      expect((await get(ql, '/api/v1/rpt/daily?date=oops')).status).toBe(422);
    });
  });

  describe('drill-down to source documents (FR-RPT-011)', () => {
    it('closed orders and payments open the documents that make the number', async () => {
      await post(ql, '/api/v1/rpt/jobs/run-due', {});
      const closed = (await get(ql, `/api/v1/rpt/drill?date=${today}&metric=closed&branchId=br_q7`))
        .json;
      expect(closed.refs.map((r: Row) => r.id).sort()).toEqual([a.id, b.id].sort());
      for (const ref of closed.refs)
        expect((await get(ql, `/api/v1/rec/orders/${ref.id}`)).status).toBe(200);
      const pays = (await get(ql, `/api/v1/rpt/drill?date=${today}&metric=payments&branchId=br_q7`))
        .json;
      expect(pays.refs).toHaveLength(2);
      for (const ref of pays.refs)
        expect((await get(ql, `/api/v1/acc/payments/${ref.id}`)).status).toBe(200);
      const invs = (
        await get(ql, `/api/v1/rpt/drill?date=${today}&metric=invoicesIssued&branchId=br_q7`)
      ).json;
      expect(invs.refs).toHaveLength(2);
      const open = (
        await get(ql, `/api/v1/rpt/drill?date=${today}&metric=openAtEnd&branchId=br_q7`)
      ).json;
      expect(open.refs.map((r: Row) => r.id)).toEqual([c.id]);
    });

    it('the permission of the source module is needed; an unknown metric is rejected', async () => {
      // the storekeeper may read orders (to see what to issue) but has neither payments nor invoices
      expect(
        (await get(tk, `/api/v1/rpt/drill?date=${today}&metric=closed&branchId=br_q7`)).status,
      ).toBe(200);
      expect(
        (await get(tk, `/api/v1/rpt/drill?date=${today}&metric=payments&branchId=br_q7`)).status,
      ).toBe(403);
      expect(
        (await get(tk, `/api/v1/rpt/drill?date=${today}&metric=invoicesIssued&branchId=br_q7`))
          .status,
      ).toBe(403);
      expect(
        (await get(qd, `/api/v1/rpt/drill?date=${today}&metric=openDebts&branchId=br_q7`)).status,
      ).toBe(403);
      expect(
        (await get(tk, `/api/v1/rpt/drill?date=${today}&metric=stockWithoutSource&branchId=br_q7`))
          .status,
      ).toBe(200);
      expect(
        (await get(tn, `/api/v1/rpt/drill?date=${today}&metric=nope&branchId=br_q7`)).status,
      ).toBe(422);
    });
  });

  describe('role dashboard (FR-RPT-001) and branch isolation (NFR-ISO-01)', () => {
    it('manager sees everything of the branch; the lens follows the role', async () => {
      await post(ql, '/api/v1/rpt/jobs/run-due', {});
      const d = (await get(ql, `/api/v1/rpt/dashboard?date=${today}`)).json;
      expect(d.lens).toBe('manager');
      expect(d.consolidated).toBe(false);
      expect(d.rows).toHaveLength(1);
      expect(d.totals.revenue.exTaxVnd).toBe(before.revenue);
      expect(d.visible).toMatchObject({
        orders: true,
        revenue: true,
        money: true,
        invoices: true,
        stock: true,
      });
    });

    it('sections are cut by the permission of their module on the SERVER (advisor, cashier, storekeeper)', async () => {
      const adv = (await get(cv, `/api/v1/rpt/dashboard?date=${today}`)).json;
      expect(adv.lens).toBe('advisor');
      expect(adv.visible.revenue).toBe(false);
      expect(adv.totals.revenue.exTaxVnd).toBe(0);
      expect(JSON.stringify(adv.rows[0].rollup.revenue)).not.toContain(String(before.revenue));
      const cash = (await get(tn, `/api/v1/rpt/dashboard?date=${today}`)).json;
      expect(cash.lens).toBe('cashier');
      expect(cash.visible.money).toBe(true);
      expect(cash.totals.revenue.exTaxVnd).toBe(0); // no report-daily:view
      expect(cash.totals.money.inflowVnd).toBeGreaterThan(0);
      const sk = (await get(tk, `/api/v1/rpt/dashboard?date=${today}`)).json;
      expect(sk.lens).toBe('storekeeper');
      expect(sk.visible).toMatchObject({
        stock: true,
        orders: true,
        money: false,
        revenue: false,
        invoices: false,
      });
      expect(sk.totals.money.inflowVnd).toBe(0);
      expect(sk.totals.invoices.issuedCount).toBe(0);
      expect(sk.totals.revenue.orderTotalVnd).toBe(0);
      expect(sk.totals.stock.issueDocuments).toBeGreaterThanOrEqual(2);
      // the technician has no report at all
      expect((await get(th, '/api/v1/rpt/dashboard')).status).toBe(403);
    });

    it('branch isolation matrix: Thu Duc sees only Thu Duc; naming Quan 7 is refused; the owner sees both, summed from the per-branch documents', async () => {
      await post(ql, '/api/v1/rpt/jobs/run-due', {});
      const own = (await get(qlTd, `/api/v1/rpt/dashboard?date=${today}`)).json;
      expect(own.rows.map((r: Row) => r.branchId)).toEqual(['br_td']);
      expect(own.rows[0].missing).toBe(true);
      expect(own.totals.revenue.exTaxVnd).toBe(0);
      expect((await get(qlTd, `/api/v1/rpt/dashboard?date=${today}&branchId=br_q7`)).status).toBe(
        403,
      );
      expect((await get(qlTd, `/api/v1/rpt/daily?date=${today}&branchId=br_q7`)).status).toBe(403);
      expect(
        (await get(qlTd, `/api/v1/rpt/drill?date=${today}&metric=closed&branchId=br_q7`)).status,
      ).toBe(403);
      expect((await get(qlTd, `/api/v1/rpt/alerts?date=${today}&branchId=br_q7`)).status).toBe(403);
      expect(
        (await post(qlTd, '/api/v1/rpt/daily/export', { date: today, branchId: 'br_q7' })).status,
      ).toBe(403);
      // the owner (all branches, consolidated): one row per branch + the total
      for (const who of [ch, qv]) {
        const all = (await get(who, `/api/v1/rpt/dashboard?date=${today}`)).json;
        expect(all.consolidated).toBe(true);
        expect(all.rows.map((r: Row) => r.branchId)).toContain('br_q7');
        expect(all.rows.map((r: Row) => r.branchId)).toContain('br_td');
        const q7 = all.rows.find((r: Row) => r.branchId === 'br_q7');
        expect(q7.missing).toBe(false);
        expect(all.totals.revenue.exTaxVnd).toBe(before.revenue);
      }
      // the owner may narrow to one branch
      const one = (await get(ch, `/api/v1/rpt/dashboard?date=${today}&branchId=br_q7`)).json;
      expect(one.rows).toHaveLength(1);
      // the daily report is one branch: a consolidated session must name it
      expect((await get(ch, `/api/v1/rpt/daily?date=${today}`)).status).toBe(409);
      expect((await get(ch, `/api/v1/rpt/daily?date=${today}&branchId=br_q7`)).status).toBe(200);
    });

    it('the rollup repository drops documents of other branches even when asked by id (defence in depth)', async () => {
      const scoped = await h.container.rpt.rollups.get(
        // a Thu Duc scope asking for the Quan 7 document by key
        (await import('@/platform/scope/scope')).branchesScope('cmp_demo', ['br_td']),
        'br_q7',
        today,
      );
      expect(scoped).toBeNull();
    });
  });

  describe('exception alerts (G4-RPT-09)', () => {
    it('shows the open order and the uninvoiced one as they age; each alert opens its document', async () => {
      // two days later: C has been open "too long" with a lowered threshold? use time: 6 days later
      h.clock.set(new Date(h.clock.now().getTime() + 6 * 86_400_000).toISOString());
      const mgr = await h.loginAt('u_ql_q7', 'br_q7');
      const d = businessDate(h.clock.now());
      const run = await post(mgr, '/api/v1/rpt/jobs/run-due', {});
      expect(run.status, run.text).toBe(200);
      const al = (await get(mgr, `/api/v1/rpt/alerts?date=${d}`)).json;
      expect(al.counts.order_open_too_long).toBe(1);
      const row = al.items.find((x: Row) => x.kind === 'order_open_too_long');
      expect(row.ref.id).toBe(c.id);
      expect(row.ageDays).toBeGreaterThanOrEqual(6);
      expect((await get(mgr, `/api/v1/rec/orders/${row.ref.id}`)).status).toBe(200);
      // alerts are filtered by the permission of their kind: the foreman (orders only) sees no money or invoice kinds
      const fm = await h.loginAt('u_qd_q7', 'br_q7');
      const fmAl = (await get(fm, `/api/v1/rpt/alerts?date=${d}`)).json;
      expect(fmAl.counts.order_open_too_long).toBe(1);
      expect(fmAl.counts.not_invoiced).toBe(0);
      expect(fmAl.counts.handover_unpaid).toBe(0);
      expect(fmAl.items.every((x: Row) => x.kind === 'order_open_too_long')).toBe(true);
      // the cashier's list has the money kinds as well
      const cashier = await h.loginAt('u_tn_q7', 'br_q7');
      expect(
        (await get(cashier, `/api/v1/rpt/alerts?date=${d}`)).json.counts.order_open_too_long,
      ).toBe(1);
      expect(
        (await get(await h.loginAt('u_th_q7', 'br_q7'), `/api/v1/rpt/alerts?date=${d}`)).status,
      ).toBe(403);
    });
  });

  describe('CSV export (permission, scope, audit)', () => {
    it('exports the daily report of one branch, audited; others are refused', async () => {
      await post(ql, '/api/v1/rpt/jobs/run-due', {});
      const bad = await post(cv, '/api/v1/rpt/daily/export', { date: today, branchId: 'br_q7' });
      expect(bad.status).toBe(403);
      const none = await post(ql, '/api/v1/rpt/daily/export', { date: '2026-01-02' });
      expect(none.status).toBe(404);
      const logsBefore = (await rows('auditLogs')).filter(
        (x) => x.action === 'rollup.export',
      ).length;
      const ok = await post(kt, '/api/v1/rpt/daily/export', {
        date: today,
        branchId: 'br_q7',
        reason: 'Đối chiếu cuối ngày',
      });
      expect(ok.status, ok.text).toBe(200);
      expect(ok.headers.get('content-type')).toContain('text/csv');
      expect(ok.headers.get('content-disposition')).toContain(`bao-cao-ngay-Q7-${today}.csv`);
      expect(ok.text).toContain('Mã chỉ tiêu');
      expect(ok.text).toContain('revenue.exTaxVnd');
      expect(ok.text).toContain(String(before.revenue));
      expect(ok.text).not.toContain('Nguyễn'); // no customer names or phones in the file
      const logsAfter = (await rows('auditLogs')).filter((x) => x.action === 'rollup.export');
      expect(logsAfter.length).toBe(logsBefore + 1);
      expect(logsAfter.at(-1)!.branchId).toBe('br_q7');
      // the quan ly of the branch may export; the owner must name the branch (no merged file)
      expect((await post(ql, '/api/v1/rpt/daily/export', { date: today })).status).toBe(200);
      expect((await post(ch, '/api/v1/rpt/daily/export', { date: today })).status).toBe(409);
    });

    it('FR-RPT-009: the daily report as .xlsx has the same permission, scope and audit as the CSV', async () => {
      await post(ql, '/api/v1/rpt/jobs/run-due', {});
      expect(
        (
          await post(cv, '/api/v1/rpt/daily/export', {
            date: today,
            branchId: 'br_q7',
            format: 'xlsx',
          })
        ).status,
      ).toBe(403);
      expect(
        (await post(ql, '/api/v1/rpt/daily/export', { date: today, format: 'ods' })).status,
      ).toBe(422);
      expect(
        (await post(ch, '/api/v1/rpt/daily/export', { date: today, format: 'xlsx' })).status,
      ).toBe(409);
      const before = (await rows('auditLogs')).filter((x) => x.action === 'rollup.export').length;
      const ok = await post(kt, '/api/v1/rpt/daily/export', {
        date: today,
        branchId: 'br_q7',
        format: 'xlsx',
      });
      expect(ok.status, ok.text).toBe(200);
      expect(ok.headers.get('content-type')).toContain('spreadsheetml.sheet');
      expect(ok.headers.get('content-disposition')).toContain(`bao-cao-ngay-Q7-${today}.xlsx`);
      expect(ok.text.startsWith('PK')).toBe(true);
      const after = (await rows('auditLogs')).filter((x) => x.action === 'rollup.export');
      expect(after.length).toBe(before + 1);
      expect(JSON.stringify(after.at(-1)!.after)).toContain('xlsx');
    });
  });

  describe('monthly, reconciliation, warehouse, technician reports (FR-RPT-002, 004, 005, 006, 014)', () => {
    it('monthly = the sum of the daily rollups; scope and permission are enforced on the server', async () => {
      await post(ql, '/api/v1/rpt/jobs/run-due', {});
      const month = today.slice(0, 7);
      const m = await get(ql, `/api/v1/rpt/monthly?month=${month}&branchId=br_q7`);
      expect(m.status, m.text).toBe(200);
      const d = await rollup();
      expect(m.json.report.revenue.exTaxVnd).toBe(d.rollup.revenue.exTaxVnd);
      expect(m.json.report.orders.closed).toBe(d.rollup.orders.closed);
      expect(m.json.report.missingDates.length).toBe(m.json.report.days - m.json.report.present);
      expect((await get(cv, `/api/v1/rpt/monthly?month=${month}`)).status).toBe(403);
      expect((await get(qlTd, `/api/v1/rpt/monthly?month=${month}&branchId=br_q7`)).status).toBe(
        403,
      );
      expect((await get(ch, `/api/v1/rpt/monthly?month=${month}`)).status).toBe(409);
      expect((await get(ch, `/api/v1/rpt/monthly?month=${month}&branchId=br_q7`)).status).toBe(200);
      expect((await get(ql, '/api/v1/rpt/monthly?month=2026-13')).status).toBe(422);
    });

    it('reconciliation judges the four checks per day and points to the drill-down', async () => {
      await post(ql, '/api/v1/rpt/jobs/run-due', {});
      const r = await get(ql, `/api/v1/rpt/reconcile?from=${today}&to=${today}&branchId=br_q7`);
      expect(r.status, r.text).toBe(200);
      const row = r.json.report.rows[0];
      expect(row.date).toBe(today);
      // both completed orders are paid and invoiced by now: nothing fails; the flag follows the count
      expect(row.failed.includes('invoices')).toBe(row.notInvoicedCount > 0);
      expect(row.failed).not.toContain('payments');
      expect(row.failed).not.toContain('stock');
      expect(row.gapVnd).toBe(0);
      const drill = await get(ql, `/api/v1/rpt/drill?date=${today}&metric=closed&branchId=br_q7`);
      expect(drill.json.refs.map((x: Row) => x.id).sort()).toEqual([a.id, b.id].sort());
      expect((await get(tn, `/api/v1/rpt/reconcile?from=${today}&to=${today}`)).status).toBe(403);
      expect(
        (await get(ql, `/api/v1/rpt/reconcile?from=${today}&to=2000-01-01&branchId=br_q7`)).status,
      ).toBe(422);
      expect(
        (await get(ql, `/api/v1/rpt/reconcile?from=2020-01-01&to=${today}&branchId=br_q7`)).status,
      ).toBe(422);
    });

    it('warehouse report: stock lines of the branch only, reorder judged on available', async () => {
      const w = await get(tk, '/api/v1/rpt/warehouse?branchId=br_q7');
      expect(w.status, w.text).toBe(200);
      expect(w.json.report.lineCount).toBeGreaterThan(0);
      for (const x of w.json.report.below) expect(x.available).toBeLessThanOrEqual(x.minQty);
      expect((await get(qlTd, '/api/v1/rpt/warehouse?branchId=br_q7')).status).toBe(403);
      if (!w.json.showValue) expect(w.json.report.totalValueVnd).toBe(0);
    });

    it('technician report: finished items per technician, service type filter, no pay data', async () => {
      const t = await get(ql, `/api/v1/rpt/technicians?from=${today}&to=${today}&branchId=br_q7`);
      expect(t.status, t.text).toBe(200);
      const row = t.json.report.rows.find((x: Row) => x.technicianId === 'u_th_q7');
      expect(row.jobs).toBeGreaterThanOrEqual(2);
      expect(JSON.stringify(t.json)).not.toMatch(/commission|salary|pay/i);
      const none = await get(
        ql,
        `/api/v1/rpt/technicians?from=${today}&to=${today}&branchId=br_q7&serviceType=body-paint`,
      );
      expect(none.json.report.totals.jobs).toBe(0);
      const same = await get(
        ql,
        `/api/v1/rpt/technicians?from=${today}&to=${today}&branchId=br_q7&serviceType=maintenance`,
      );
      expect(same.json.report.totals.jobs).toBe(t.json.report.totals.jobs);
      expect((await get(cv, '/api/v1/rpt/technicians')).status).toBe(403);
      expect((await get(qlTd, '/api/v1/rpt/technicians?branchId=br_q7')).status).toBe(403);
    });

    it('CSV export of the new reports needs report-daily:export, is scoped and audited', async () => {
      const month = today.slice(0, 7);
      const before = (await rows('auditLogs')).filter((x) => x.action === 'rollup.export').length;
      for (const body of [
        { kind: 'monthly', month, branchId: 'br_q7' },
        { kind: 'reconcile', from: today, to: today, branchId: 'br_q7' },
        { kind: 'warehouse', branchId: 'br_q7' },
        { kind: 'technicians', from: today, to: today, branchId: 'br_q7' },
      ]) {
        const ok = await post(ql, '/api/v1/rpt/export', body);
        expect(ok.status, ok.text).toBe(200);
        expect(ok.headers.get('content-type')).toContain('text/csv');
      }
      const after = (await rows('auditLogs')).filter((x) => x.action === 'rollup.export');
      expect(after.length).toBe(before + 4);
      expect(after.at(-1)!.branchId).toBe('br_q7');
      expect((await post(cv, '/api/v1/rpt/export', { kind: 'monthly', month })).status).toBe(403);
      expect(
        (await post(qlTd, '/api/v1/rpt/export', { kind: 'monthly', month, branchId: 'br_q7' }))
          .status,
      ).toBe(403);
      expect((await post(ql, '/api/v1/rpt/export', { kind: 'nope' })).status).toBe(422);
    });

    it('FR-RPT-009/014: .xlsx export has the same permission and audit as CSV; the service-type filter is accepted on monthly and reconcile', async () => {
      const month = today.slice(0, 7);
      const before = (await rows('auditLogs')).filter((x) => x.action === 'rollup.export').length;
      const x = await post(ql, '/api/v1/rpt/export', {
        kind: 'monthly',
        month,
        branchId: 'br_q7',
        serviceType: 'maintenance',
        format: 'xlsx',
      });
      expect(x.status, x.text).toBe(200);
      expect(x.headers.get('content-type')).toContain('spreadsheetml.sheet');
      expect(x.headers.get('content-disposition')).toContain('.xlsx');
      expect(x.text.startsWith('PK')).toBe(true);
      const after = (await rows('auditLogs')).filter((e) => e.action === 'rollup.export');
      expect(after.length).toBe(before + 1);
      expect(JSON.stringify(after.at(-1)!.after)).toContain('xlsx');
      expect(
        (await post(cv, '/api/v1/rpt/export', { kind: 'monthly', month, format: 'xlsx' })).status,
      ).toBe(403);
      expect(
        (await post(ql, '/api/v1/rpt/export', { kind: 'monthly', month, format: 'ods' })).status,
      ).toBe(422);
      const m = await get(
        ql,
        `/api/v1/rpt/monthly?month=${month}&branchId=br_q7&serviceType=maintenance`,
      );
      expect(m.status, m.text).toBe(200);
      expect(m.json.serviceType).toBe('maintenance');
      const all = await get(ql, `/api/v1/rpt/monthly?month=${month}&branchId=br_q7`);
      expect(m.json.report.orders.closed).toBeLessThanOrEqual(all.json.report.orders.closed);
      const r = await get(
        ql,
        `/api/v1/rpt/reconcile?from=${today}&to=${today}&branchId=br_q7&serviceType=maintenance`,
      );
      expect(r.status, r.text).toBe(200);
      expect(r.json.visible.cash).toBe(false);
      // FR-RPT-014: the "không gắn lệnh" line is present in the filtered views only
      expect(r.json.unlinked).toMatchObject({ inflowVnd: expect.any(Number) });
      expect(m.json.unlinked).not.toBeNull();
      expect(all.json.unlinked).toBeNull();
    });
  });

  describe('R68: no composite index added by the reports', () => {
    it('the rollup collection is read by key only', async () => {
      const { registeredQueries } = await import('@/platform/store/docStore');
      await import('@/infrastructure/repos/queries');
      expect(registeredQueries().filter((q) => q.collection === 'rollups')).toHaveLength(0);
    });
  });
});
