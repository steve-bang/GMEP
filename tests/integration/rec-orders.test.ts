import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { getDb } from '@/infrastructure/firestore/client';
import { businessDate } from '@/platform/format/date';
import { viewPublicQuote } from '@/modules/rec';
import { backends, createHarness, type Harness } from './harness';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
let seq = 0;
const key = (p: string) => `${p}-${String(++seq).padStart(6, '0')}-xxxxxxxx`;

const SV_DAU = 'svc_cmp_demo_SV-DAU';
const SV_PHANH = 'svc_cmp_demo_SV-PHANH';
const P_FILTER = 'part_seed_01'; // Q7: 20 on hand, 2 held by the demo order
const P_SCARCE = 'part_seed_03'; // Q7: 3 on hand
const VEH_AN = 'veh_an';
const VEH_BIZ = 'veh_biz';
const Q7 = 'wh_br_q7_WH-CHINH';

/**
 * Slice 1.6: FR-REC-010 (order opened by the approval), 012 (technician), 013 (tablet actions, hours from events),
 * 014 (supplementary work), 015 / 028 (order and item machines), 016 (QC), 017 (handover), 021 (cancel), 022
 * (board); R35, R37; RULE-005, 006, 007, 009, 010; NFR-ISO-01.
 */
describe.each(backends)('REC repair orders [%s]', (backend) => {
  let h: Harness;
  let cv: string;
  let ql: string;
  let qd: string;
  let th: string;
  let tk: string;
  let kt: string;
  let qlTd: string;
  let ip = 0;
  let t0 = '';

  const rows = async (name: string): Promise<Row[]> =>
    backend === 'memory'
      ? ([...h.container.memory!.db.col(name).entries()].map(([id, v]) => ({ id, ...v })) as Row[])
      : ((await getDb(h.container.env).collection(name).get()).docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Row[]);
  const call = (cookie: string, method: string, path: string, body?: unknown, k = key('ord')) =>
    h.call(method, path, { cookie, key: k, ...(body !== undefined ? { body } : {}) });
  const pub = (path: string, body: unknown) =>
    h.call('POST', path, {
      body,
      key: key('pub'),
      headers: { 'x-forwarded-for': `203.0.113.${(ip++ % 200) + 10}` },
    });

  let odo = 300_000;
  async function completedIntake(cookie: string, vehicleId: string): Promise<Row> {
    const c = await call(cookie, 'POST', '/api/v1/rec/intakes', { vehicleId });
    expect(c.status, c.text).toBe(201);
    const p = await call(cookie, 'PATCH', `/api/v1/rec/intakes/${c.json.id}`, {
      version: c.json.version,
      step: 5,
      km: (odo += 100),
      customerRequest: 'Bảo dưỡng',
      serviceType: 'maintenance',
      promisedDate: '2099-01-01',
    });
    const done = await call(cookie, 'POST', `/api/v1/rec/intakes/${c.json.id}/complete`, {
      version: p.json.version,
    });
    expect(done.status, done.text).toBe(200);
    return done.json as Row;
  }

  /** a sent quote with a customer link; item 1 = labor + 1 filter, item 2 = brakes (labor only) */
  async function sentQuote(vehicleId = VEH_AN, items?: Row[]): Promise<{ q: Row; token: string }> {
    const i = await completedIntake(cv, vehicleId);
    const created = await call(cv, 'POST', '/api/v1/rec/quotes', { intakeId: i.id });
    const edited = await call(cv, 'PATCH', `/api/v1/rec/quotes/${created.json.id}`, {
      version: created.json.version,
      items: items ?? [
        {
          name: 'Thay dầu và lọc',
          necessity: 'required',
          lines: [
            { kind: 'labor', serviceId: SV_DAU },
            { kind: 'part', partId: P_FILTER, qty: 2 },
          ],
        },
        {
          name: 'Thay má phanh',
          necessity: 'required',
          lines: [{ kind: 'labor', serviceId: SV_PHANH }],
        },
      ],
    });
    expect(edited.status, edited.text).toBe(200);
    const sent = await call(cv, 'POST', `/api/v1/rec/quotes/${created.json.id}/send`, {
      version: edited.json.version,
    });
    const link = await call(cv, 'POST', `/api/v1/rec/quotes/${created.json.id}/link`, {
      version: sent.json.version,
    });
    return {
      q: (await call(cv, 'GET', `/api/v1/rec/quotes/${created.json.id}`)).json,
      token: link.json.token,
    };
  }

  /** an approved quote -> its order (opened by the approval through the link) */
  async function openedOrder(items?: Row[], vehicleId = VEH_AN): Promise<Row> {
    const { q, token } = await sentQuote(vehicleId, items);
    const r = await pub('/api/v1/rec/public/quote/approve', {
      token,
      selectedItemNos: q.shown.items.map((x: Row) => x.no),
    });
    expect(r.status, r.text).toBe(200);
    const head = (await call(cv, 'GET', `/api/v1/rec/quotes/${q.id}`)).json;
    expect(head.orderId, 'the approval opens the order').toBeTruthy();
    const o = await call(cv, 'GET', `/api/v1/rec/orders/${head.orderId}`);
    expect(o.status, o.text).toBe(200);
    return o.json;
  }
  const order = async (id: string, cookie = cv) =>
    (await call(cookie, 'GET', `/api/v1/rec/orders/${id}`)).json as Row;
  const act = (cookie: string, path: string, body: unknown) => call(cookie, 'POST', path, body);

  /** assign every item to the technician and return the refreshed order */
  async function assignAll(o: Row, techId = 'u_th_q7'): Promise<Row> {
    for (const it of o.items) {
      const cur = (await order(o.id)).items.find((x: Row) => x.id === it.id);
      const r = await act(qd, `/api/v1/rec/items/${it.id}/assign`, {
        version: cur.version,
        technicianId: techId,
      });
      expect(r.status, r.text).toBe(200);
    }
    return order(o.id);
  }
  const item = (o: Row, no: number) => o.items.find((x: Row) => x.no === no) as Row;
  async function tap(
    cookie: string,
    o: Row,
    no: number,
    ev: 'start' | 'pause' | 'finish',
    extra: Row = {},
  ) {
    const cur = item(await order(o.id), no);
    return act(cookie, `/api/v1/rec/items/${cur.id}/${ev}`, { version: cur.version, ...extra });
  }
  async function finishAll(o: Row) {
    for (const it of o.items) {
      expect((await tap(th, o, it.no, 'start')).status).toBe(200);
      expect((await tap(th, o, it.no, 'finish')).status).toBe(200);
    }
  }

  beforeAll(async () => {
    h = await createHarness(backend);
    t0 = h.clock.now().toISOString();
    cv = await h.loginAt('u_cv_q7', 'br_q7');
    ql = await h.loginAt('u_ql_q7', 'br_q7');
    qd = await h.loginAt('u_qd_q7', 'br_q7');
    th = await h.loginAt('u_th_q7', 'br_q7');
    tk = await h.loginAt('u_tk_q7', 'br_q7');
    kt = await h.login('u_kt');
    qlTd = await h.loginAt('u_ql_td', 'br_td');
    // plenty of the filter so that holds of earlier tests never starve the later ones (the scarce part stays scarce)
    const grn = await call(tk, 'POST', '/api/v1/inv/documents', {
      warehouseId: Q7,
      type: 'GRN',
      source: { type: 'purchase-order', id: 'po-demo-1' },
      lines: [{ partId: P_FILTER, qty: 300, unitCostVnd: 85_000 }],
    });
    expect(grn.status, grn.text).toBe(201);
    const posted = await call(tk, 'POST', `/api/v1/inv/documents/${grn.json.id}/post`, {
      version: grn.json.version,
    });
    expect(posted.status, posted.text).toBe(200);
  });

  const relogin = async () => {
    cv = await h.loginAt('u_cv_q7', 'br_q7');
    ql = await h.loginAt('u_ql_q7', 'br_q7');
  };
  // tests move the clock to measure hours; sessions are time bound, so every test starts from the same instant
  afterEach(() => h.clock.set(t0));

  describe('the approval opens the order (FR-REC-010, R35, R37)', () => {
    it('R37 / R35: approving through the link opens exactly one order RO-<BRANCH>-<YYMM>-<seq5> with the approved lines and a stock hold', async () => {
      const { q, token } = await sentQuote();
      const body = { token, selectedItemNos: [1, 2] };
      const k = key('lnk');
      const r1 = await h.call('POST', '/api/v1/rec/public/quote/approve', {
        body,
        key: k,
        headers: { 'x-forwarded-for': '203.0.113.201' },
      });
      expect(r1.status, r1.text).toBe(200);
      // a second tap with ANOTHER key and the same selection must not open a second order
      const r2 = await h.call('POST', '/api/v1/rec/public/quote/approve', {
        body,
        key: key('lnk'),
        headers: { 'x-forwarded-for': '203.0.113.202' },
      });
      expect(r2.status).toBe(200);
      const head = (await call(cv, 'GET', `/api/v1/rec/quotes/${q.id}`)).json;
      const o = await order(head.orderId);
      expect(o.number).toMatch(/^RO-Q7-\d{4}-\d{5}$/);
      expect(o).toMatchObject({
        status: 'approved',
        quoteNumber: q.number,
        itemCount: 2,
        doneCount: 0,
        unmetLines: 0,
        totalVnd: head.approvedTotalVnd,
      });
      expect((await rows('repairOrders')).filter((x) => x.quoteId === q.id)).toHaveLength(1);
      // the order holds only approved lines, each with the immutable key
      const keys = o.items.flatMap((i: Row) => i.lines.map((l: Row) => l.lineKey));
      expect(keys).toEqual([`${q.id}__v1_1_1`, `${q.id}__v1_1_2`, `${q.id}__v1_2_1`]);
      // the part is held for THIS order (RULE-008: against available), nothing issued
      const holds = (await rows('stockReservations')).filter((x) => x.sourceId === o.id);
      expect(holds).toHaveLength(1);
      expect(holds[0]).toMatchObject({
        heldQty: 2,
        issuedQty: 0,
        unmetQty: 0,
        lineKey: `${q.id}__v1_1_2`,
      });
      // the advisor and the manager are told, without personal data
      const n = await h.call('GET', '/api/v1/sys/notifications', { as: 'u_ql_q7' });
      expect(JSON.stringify(n.json)).toContain(o.number);
      expect(JSON.stringify(n.json)).not.toMatch(/Nguyễn Văn An|0900000/);
      // the audit line names the system, not a person
      const audit = (await rows('auditLogs')).find(
        (x) => x.entityId === o.id && x.action === 'repairOrder.create',
      );
      expect(audit).toMatchObject({ actorType: 'system' });
    });

    it('R37: the order number is idempotent by the approval evidence and numbers do not skip on a repeat', async () => {
      const a = await openedOrder();
      const b = await openedOrder(undefined, VEH_BIZ);
      const seqOf = (n: string) => Number(n.slice(-5));
      expect(seqOf(b.number)).toBe(seqOf(a.number) + 1);
      // calling the opening path again (the "Tạo lệnh" route) returns the same order
      const again = await call(cv, 'POST', `/api/v1/rec/quotes/${a.quoteId}/create-order`, {});
      expect(again.status, again.text).toBe(200);
      expect(again.json).toMatchObject({ orderId: a.id, number: a.number, created: false });
    });

    it('R37: partial approval opens an order with the approved items only and its own total', async () => {
      const { q, token } = await sentQuote();
      const r = await pub('/api/v1/rec/public/quote/approve', {
        token,
        selectedItemNos: [2],
        declines: [{ itemNo: 1, reasonCode: 'later' }],
      });
      expect(r.status, r.text).toBe(200);
      const head = (await call(cv, 'GET', `/api/v1/rec/quotes/${q.id}`)).json;
      const o = await order(head.orderId);
      expect(o.items.map((i: Row) => i.name)).toEqual(['Thay má phanh']);
      expect(o.totalVnd).toBe(head.approvedTotalVnd);
      // the declined item holds no stock
      expect((await rows('stockReservations')).filter((x) => x.sourceId === o.id)).toHaveLength(0);
    });

    it('R37: a shortage never blocks the approval; it is stored as unmet and the item waits for parts', async () => {
      const o = await openedOrder([
        {
          name: 'Thay bugi',
          necessity: 'required',
          lines: [
            { kind: 'labor', serviceId: SV_DAU },
            { kind: 'part', partId: P_SCARCE, qty: 5 },
          ],
        },
      ]);
      expect(o.unmetLines).toBe(1);
      expect(o.items[0]).toMatchObject({
        status: 'paused',
        pauseReason: 'waiting_parts',
        waitingParts: true,
      });
      const hold = (await rows('stockReservations')).find((x) => x.sourceId === o.id)!;
      expect(hold).toMatchObject({ heldQty: 3, unmetQty: 2 });
      // the item cannot start while the parts are short (Journey step 5)
      await assignAll(o);
      const start = await tap(th, o, 1, 'start');
      expect(start.status).toBe(409);
      expect(start.json.code).toBe('waiting_parts');
      // re-checking changes nothing while the shelf is still short, and is safe to repeat
      const re = await call(cv, 'POST', `/api/v1/rec/orders/${o.id}/recheck-parts`, {});
      expect(re.status, re.text).toBe(200);
      expect(re.json).toMatchObject({ unmetLines: 1, readyItems: 0 });
    });

    it('R37: a technical failure leaves "approved, no order yet" with a Tạo lệnh that is safe to repeat', async () => {
      const { q, token } = await sentQuote();
      const rec = h.container.rec;
      const real = rec.orders.create.bind(rec.orders);
      let boom = true;
      rec.orders.create = (...a: Parameters<typeof real>) => {
        if (boom) throw new Error('simulated outage');
        return real(...a);
      };
      try {
        const r = await pub('/api/v1/rec/public/quote/approve', { token, selectedItemNos: [1, 2] });
        expect(r.status, 'the approval stands').toBe(200);
      } finally {
        boom = false;
        rec.orders.create = real;
      }
      const head = (await call(cv, 'GET', `/api/v1/rec/quotes/${q.id}`)).json;
      expect(head.status).toBe('approved_full');
      expect(head.orderId).toBeNull();
      expect(head.allowed).toContain('create_order');
      expect(
        (await rows('stockReservations')).filter((x) => x.sourceId === `ro_${q.id}`),
      ).toHaveLength(0);
      const n = await h.call('GET', '/api/v1/sys/notifications', { as: 'u_ql_q7' });
      expect(JSON.stringify(n.json)).toContain(q.number);
      const mk = await call(cv, 'POST', `/api/v1/rec/quotes/${q.id}/create-order`, {});
      expect(mk.status, mk.text).toBe(200);
      expect(mk.json.created).toBe(true);
      const mk2 = await call(cv, 'POST', `/api/v1/rec/quotes/${q.id}/create-order`, {});
      expect(mk2.json).toMatchObject({ created: false, orderId: mk.json.orderId });
    });

    it('NFR-ISO-01: orders are invisible to another branch and to roles without the permission', async () => {
      const o = await openedOrder();
      expect((await call(qlTd, 'GET', `/api/v1/rec/orders/${o.id}`)).status).toBe(404);
      const list = await call(qlTd, 'GET', '/api/v1/rec/orders');
      expect(list.json.items.some((x: Row) => x.id === o.id)).toBe(false);
      expect((await call(kt, 'GET', `/api/v1/rec/orders/${o.id}`)).status).toBe(200); // KT reads orders
      expect((await call(th, 'GET', `/api/v1/rec/orders/${o.id}`)).status).toBe(403); // TH sees only own items
      const q7 = await call(cv, 'GET', '/api/v1/rec/orders');
      expect(q7.json.items.some((x: Row) => x.id === o.id)).toBe(true);
    });
  });

  describe('assigning and the technician tablet (FR-REC-012, 013, 028)', () => {
    it('FR-REC-012: one technician per item, a change needs a reason and is kept in the history', async () => {
      const o = await openedOrder();
      const it1 = item(o, 1);
      const noRole = await act(th, `/api/v1/rec/items/${it1.id}/assign`, {
        version: it1.version,
        technicianId: 'u_th_q7',
      });
      expect(noRole.status).toBe(403);
      const notTech = await act(qd, `/api/v1/rec/items/${it1.id}/assign`, {
        version: it1.version,
        technicianId: 'u_tk_q7',
      });
      expect(notTech.status).toBe(422);
      const a = await act(qd, `/api/v1/rec/items/${it1.id}/assign`, {
        version: it1.version,
        technicianId: 'u_th_q7',
      });
      expect(a.status, a.text).toBe(200);
      const swap = await act(qd, `/api/v1/rec/items/${it1.id}/assign`, {
        version: a.json.version,
        technicianId: 'u_qd_q7',
      });
      expect(swap.status).toBe(422); // reason required
      const swap2 = await act(qd, `/api/v1/rec/items/${it1.id}/assign`, {
        version: a.json.version,
        technicianId: 'u_qd_q7',
        reason: 'Thợ nghỉ ốm',
      });
      expect(swap2.status, swap2.text).toBe(200);
      const after = item(await order(o.id), 1);
      expect(after.assignments.map((x: Row) => x.technicianId)).toEqual(['u_th_q7', 'u_qd_q7']);
      expect(after.assignments[1].reason).toBe('Thợ nghỉ ốm');
    });

    it("FR-REC-013: a technician sees only their own work and cannot touch another technician's item", async () => {
      const o = await openedOrder();
      await act(qd, `/api/v1/rec/items/${item(o, 1).id}/assign`, {
        version: item(o, 1).version,
        technicianId: 'u_th_q7',
      });
      await act(qd, `/api/v1/rec/items/${item(o, 2).id}/assign`, {
        version: item(o, 2).version,
        technicianId: 'u_qd_q7',
      });
      const mine = await call(th, 'GET', '/api/v1/rec/work');
      expect(mine.status).toBe(200);
      const names = mine.json.items.filter((x: Row) => x.orderId === o.id).map((x: Row) => x.no);
      expect(names).toEqual([1]);
      expect(JSON.stringify(mine.json)).not.toMatch(/Nguyễn|0900000|customerName/);
      const other = item(await order(o.id), 2);
      expect((await tap(th, o, 2, 'start')).status).toBe(404);
      expect(other.status).toBe('not_started');
    });

    it('FR-REC-013 / FR-REC-015: start, pause, finish write time events; the first start opens the order; hours come from the events', async () => {
      const o = await assignAll(await openedOrder());
      expect(o.status).toBe('approved');
      h.clock.set(new Date(h.clock.now().getTime() + 1000).toISOString());
      const s = await tap(th, o, 1, 'start');
      expect(s.status, s.text).toBe(200);
      expect(s.json.orderStatus).toBe('in_progress');
      // a double tap of "start" is refused by the item machine, never a second event
      const cur = item(await order(o.id), 1);
      const dup = await act(th, `/api/v1/rec/items/${cur.id}/start`, { version: cur.version });
      expect(dup.status).toBe(409);
      h.clock.set(new Date(h.clock.now().getTime() + 20 * 60_000).toISOString());
      const noReason = await tap(th, o, 1, 'pause');
      expect(noReason.status).toBe(422);
      expect((await tap(th, o, 1, 'pause', { reason: 'break' })).status).toBe(200);
      h.clock.set(new Date(h.clock.now().getTime() + 10 * 60_000).toISOString());
      expect((await tap(th, o, 1, 'start')).status).toBe(200);
      h.clock.set(new Date(h.clock.now().getTime() + 15 * 60_000).toISOString());
      expect((await tap(th, o, 1, 'finish')).status).toBe(200);
      const done = await order(o.id);
      expect(item(done, 1)).toMatchObject({ status: 'done', workedMs: 35 * 60_000 });
      expect(item(done, 1).events.map((e: Row) => e.type)).toEqual([
        'start',
        'pause',
        'start',
        'finish',
      ]);
      expect(done).toMatchObject({ doneCount: 1, status: 'in_progress' });
      // the item machine did not move the order beyond its own events (item 2 not done)
      await relogin(); // the others were idle while the clock ran
      const bad = await act(ql, `/api/v1/rec/orders/${o.id}/submit-qc`, { version: done.version });
      expect(bad.status).toBe(409);
      expect(bad.json.code).toBe('items_not_done');
    });

    it('FR-REC-013: undo takes back the own latest press inside the window and not after it', async () => {
      const o = await assignAll(await openedOrder());
      expect((await tap(th, o, 1, 'start')).status).toBe(200);
      const cur = item(await order(o.id), 1);
      const un = await act(th, `/api/v1/rec/items/${cur.id}/undo`, { version: cur.version });
      expect(un.status, un.text).toBe(200);
      expect(item(await order(o.id), 1)).toMatchObject({ status: 'not_started', workedMs: 0 });
      expect((await tap(th, o, 1, 'start')).status).toBe(200);
      h.clock.set(new Date(h.clock.now().getTime() + 5 * 60_000).toISOString());
      const late = item(await order(o.id), 1);
      const un2 = await act(th, `/api/v1/rec/items/${late.id}/undo`, { version: late.version });
      expect(un2.status).toBe(409);
      expect(un2.json.code).toBe('undo_window_passed');
    });

    it('FR-REC-015: a paused order refuses item work until it is resumed; every change is audited', async () => {
      const o = await assignAll(await openedOrder());
      expect((await tap(th, o, 1, 'start')).status).toBe(200);
      const cur = await order(o.id);
      const p = await act(ql, `/api/v1/rec/orders/${o.id}/pause`, {
        version: cur.version,
        reason: 'Chờ khách xác nhận',
      });
      expect(p.status, p.text).toBe(200);
      const blocked = await tap(th, o, 2, 'start');
      expect(blocked.status).toBe(409);
      expect(blocked.json.code).toBe('order_paused');
      const r = await act(ql, `/api/v1/rec/orders/${o.id}/resume`, { version: p.json.version });
      expect(r.status, r.text).toBe(200);
      expect((await tap(th, o, 2, 'start')).status).toBe(200);
      const actions = (await rows('auditLogs'))
        .filter((x) => x.entityId === o.id)
        .map((x) => x.action);
      expect(actions).toEqual(
        expect.arrayContaining(['repairOrder.create', 'repairOrder.pause', 'repairOrder.resume']),
      );
      expect((await order(o.id)).history.map((x: Row) => x.event)).toEqual(
        expect.arrayContaining(['create', 'start', 'pause', 'resume']),
      );
    });
  });

  describe('parts for the order (RULE-005, 007, 009)', () => {
    it('a request must be an approved part line within the approved quantity; the storekeeper issues it against the order', async () => {
      const o = await assignAll(await openedOrder());
      const it1 = item(o, 1);
      const line = it1.lines.find((l: Row) => l.kind === 'part');
      const base = { itemId: it1.id, lineKey: line.lineKey, qty: 1 };
      // outside the quote: no such line -> refused (RULE-005)
      const rogue = await act(th, `/api/v1/rec/orders/${o.id}/part-requests`, {
        ...base,
        lineKey: 'nope_v1_9_9',
      });
      expect(rogue.status).toBe(422);
      const tooMuch = await act(th, `/api/v1/rec/orders/${o.id}/part-requests`, {
        ...base,
        qty: 3,
      });
      expect(tooMuch.status).toBe(422);
      expect(tooMuch.json.code).toBe('request_exceeds_approved');
      const req = await act(th, `/api/v1/rec/orders/${o.id}/part-requests`, base);
      expect(req.status, req.text).toBe(201);
      // the technician cannot issue; only the storekeeper can
      const forbidden = await act(th, `/api/v1/rec/part-requests/${req.json.id}/decide`, {
        decision: 'issue',
        version: 1,
      });
      expect(forbidden.status).toBe(403);
      const queue = await call(tk, 'GET', '/api/v1/rec/part-requests');
      expect(queue.json.items.some((x: Row) => x.id === req.json.id)).toBe(true);
      const before = (await rows('stockBalances')).find(
        (b) => b.partId === P_FILTER && b.warehouseId === Q7,
      )!;
      const k = key('iss');
      const ok = await h.call('POST', `/api/v1/rec/part-requests/${req.json.id}/decide`, {
        cookie: tk,
        key: k,
        body: { decision: 'issue', version: 1 },
      });
      expect(ok.status, ok.text).toBe(200);
      expect(ok.json).toMatchObject({ status: 'issued' });
      // a replay with the same key answers the same and issues nothing twice
      const replay = await h.call('POST', `/api/v1/rec/part-requests/${req.json.id}/decide`, {
        cookie: tk,
        key: k,
        body: { decision: 'issue', version: 1 },
      });
      expect(replay.status).toBe(200);
      const again = await call(tk, 'POST', `/api/v1/rec/part-requests/${req.json.id}/decide`, {
        decision: 'issue',
        version: 2,
      });
      expect(again.status).toBe(409);
      const after = (await rows('stockBalances')).find(
        (b) => b.partId === P_FILTER && b.warehouseId === Q7,
      )!;
      expect(after.onHand).toBe(before.onHand - 1);
      // the issue document names the order as its source (RULE-007) and the hold shows 1 issued
      const doc = (await rows('stockDocuments')).find((d) => d.id === ok.json.issueDocumentId)!;
      expect(doc).toMatchObject({
        type: 'GIN',
        status: 'posted',
        source: { type: 'repair-order', id: o.id },
      });
      const hold = (await rows('stockReservations')).find((x) => x.sourceId === o.id)!;
      expect(hold).toMatchObject({ issuedQty: 1, heldQty: 1 });
      // the second unit is still requestable, a third is not
      expect((await act(th, `/api/v1/rec/orders/${o.id}/part-requests`, base)).status).toBe(201);
      expect((await act(th, `/api/v1/rec/orders/${o.id}/part-requests`, base)).status).toBe(422);
    });

    it('concurrency: two storekeepers issuing the same request at once issue it exactly once', async () => {
      const o = await assignAll(await openedOrder());
      const it1 = item(o, 1);
      const line = it1.lines.find((l: Row) => l.kind === 'part');
      const req = await act(th, `/api/v1/rec/orders/${o.id}/part-requests`, {
        itemId: it1.id,
        lineKey: line.lineKey,
        qty: 2,
      });
      const before = (await rows('stockBalances')).find(
        (b) => b.partId === P_FILTER && b.warehouseId === Q7,
      )!;
      const res = await Promise.all(
        Array.from({ length: 4 }, () =>
          call(tk, 'POST', `/api/v1/rec/part-requests/${req.json.id}/decide`, {
            decision: 'issue',
            version: 1,
          }),
        ),
      );
      expect(res.filter((r) => r.status === 200)).toHaveLength(1);
      expect(res.filter((r) => r.status === 409 || r.status === 500).length).toBe(3);
      const after = (await rows('stockBalances')).find(
        (b) => b.partId === P_FILTER && b.warehouseId === Q7,
      )!;
      expect(after.onHand).toBe(before.onHand - 2);
      const issued = (await rows('stockDocuments')).filter(
        (d) => d.type === 'GIN' && d.source?.id === o.id,
      );
      expect(issued).toHaveLength(1);
    });

    it('concurrency: approvals of different quotes competing for the last units never hold more than available', async () => {
      const qs = await Promise.all([
        sentQuote(VEH_AN, [
          {
            name: 'A',
            necessity: 'required',
            lines: [
              { kind: 'labor', serviceId: SV_DAU },
              { kind: 'part', partId: P_SCARCE, qty: 2 },
            ],
          },
        ]),
        sentQuote(VEH_BIZ, [
          {
            name: 'B',
            necessity: 'required',
            lines: [
              { kind: 'labor', serviceId: SV_DAU },
              { kind: 'part', partId: P_SCARCE, qty: 2 },
            ],
          },
        ]),
      ]);
      const avail = async () => {
        const b = (await rows('stockBalances')).find(
          (x) => x.partId === P_SCARCE && x.warehouseId === Q7,
        )!;
        return b.onHand - b.reserved;
      };
      const free = await avail();
      const res = await Promise.all(
        qs.map(({ q, token }) =>
          pub('/api/v1/rec/public/quote/approve', { token, selectedItemNos: [1] }).then((r) => ({
            r,
            q,
          })),
        ),
      );
      for (const { r } of res) expect(r.status, r.text).toBe(200);
      const b = (await rows('stockBalances')).find(
        (x) => x.partId === P_SCARCE && x.warehouseId === Q7,
      )!;
      expect(b.reserved).toBeLessThanOrEqual(b.onHand); // RULE-008: never reserve beyond what is on hand
      expect(await avail()).toBeGreaterThanOrEqual(0);
      expect(free - (await avail())).toBeLessThanOrEqual(4);
    });
  });

  describe('supplementary work (FR-REC-014, RULE-005/006)', () => {
    it('a proposal -> supplementary quote -> customer approval adds items to the SAME order, with their own hold and no new order', async () => {
      const o = await assignAll(await openedOrder());
      const p = await act(th, `/api/v1/rec/orders/${o.id}/proposals`, {
        version: o.version,
        title: 'Rò dầu hộp số',
        note: 'Thấy khi nâng xe',
      });
      expect(p.status, p.text).toBe(201);
      const cur = await order(o.id);
      expect(cur.proposals).toHaveLength(1);
      expect(
        (await act(th, `/api/v1/rec/orders/${o.id}/supplement`, { version: cur.version })).status,
      ).toBe(403);
      const sup = await act(cv, `/api/v1/rec/orders/${o.id}/supplement`, {
        version: cur.version,
        proposalId: p.json.id,
      });
      expect(sup.status, sup.text).toBe(201);
      expect(sup.json.number).toMatch(/^BG-Q7-/);
      // until the customer approves, nothing joined the order and the new item cannot be worked on
      expect((await order(o.id)).itemCount).toBe(2);
      const q = (await call(cv, 'GET', `/api/v1/rec/quotes/${sup.json.id}`)).json;
      const edited = await call(cv, 'PATCH', `/api/v1/rec/quotes/${sup.json.id}`, {
        version: q.version,
        items: [
          {
            name: 'Thay gioăng hộp số',
            necessity: 'required',
            lines: [
              { kind: 'labor', serviceId: SV_PHANH },
              { kind: 'part', partId: P_FILTER, qty: 1 },
            ],
          },
        ],
      });
      expect(edited.status, edited.text).toBe(200);
      const sent = await call(cv, 'POST', `/api/v1/rec/quotes/${sup.json.id}/send`, {
        version: edited.json.version,
      });
      const approve = await call(cv, 'POST', `/api/v1/rec/quotes/${sup.json.id}/approve`, {
        version: sent.json.version,
        method: 'counter_signature',
        selectedItemNos: [1],
        signerName: 'Nguyễn Văn An',
      });
      expect(approve.status, approve.text).toBe(200);
      const after = await order(o.id);
      expect(after.itemCount).toBe(3);
      expect(after.supplements).toHaveLength(1);
      expect(after.totalVnd).toBe(o.totalVnd + approve.json.approvedTotalVnd);
      expect(item(after, 3)).toMatchObject({ origin: 'supplement', name: 'Thay gioăng hộp số' });
      expect(after.proposals[0]).toMatchObject({ status: 'quoted', quoteId: sup.json.id });
      expect((await rows('repairOrders')).filter((x) => x.intakeId === o.intakeId)).toHaveLength(1);
      expect((await rows('stockReservations')).filter((x) => x.sourceId === o.id)).toHaveLength(2);
      // the supplementary quote shows its order and is not offered "Tạo lệnh"
      const sq = (await call(cv, 'GET', `/api/v1/rec/quotes/${sup.json.id}`)).json;
      expect(sq.orderId).toBe(o.id);
    });

    it('a supplementary quote is refused on a finished order', async () => {
      const o = await assignAll(await openedOrder());
      const done = await openedOrder(undefined, VEH_BIZ);
      await call(cv, 'GET', `/api/v1/rec/orders/${done.id}`);
      const c = await act(ql, `/api/v1/rec/orders/${done.id}/cancel`, {
        version: done.version,
        reason: 'Khách đổi ý',
      });
      expect(c.status, c.text).toBe(200);
      const s = await act(cv, `/api/v1/rec/orders/${done.id}/supplement`, {
        version: (await order(done.id)).version,
      });
      expect(s.status).toBe(409);
      void o;
    });
  });

  describe('quality check, handover and history (FR-REC-016, 017, 028)', () => {
    it('QC fail returns the item to its technician, QC pass allows the handover, which completes the order, updates the odometer and writes the history row', async () => {
      const o = await assignAll(await openedOrder());
      await finishAll(o);
      let cur = await order(o.id);
      expect(cur).toMatchObject({ doneCount: 2, itemCount: 2 });
      // handover before QC is refused
      const early = await act(cv, `/api/v1/rec/orders/${o.id}/handover`, {
        version: cur.version,
        receiverName: 'Nguyễn Văn An',
        confirmation: 'screen',
        belongingsReturned: true,
        oldPartsReturned: false,
      });
      expect(early.status).toBe(409);
      const sub = await act(cv, `/api/v1/rec/orders/${o.id}/submit-qc`, { version: cur.version });
      expect(sub.status, sub.text).toBe(200);
      const list = await call(qd, 'GET', `/api/v1/rec/orders/${o.id}/qc-checklist`);
      expect(list.json.checks.length).toBeGreaterThan(0);
      cur = await order(o.id);
      expect(cur.status).toBe('awaiting_qc');
      const checks = (failCode?: string) =>
        list.json.checks.map((c: Row) => ({
          code: c.code,
          ok: c.code !== failCode,
          ...(c.code === failCode ? { note: 'Còn rò dầu' } : {}),
        }));
      // a failure must name the items to send back
      const noReturn = await act(qd, `/api/v1/rec/orders/${o.id}/qc`, {
        version: cur.version,
        checks: checks('leaks'),
      });
      expect(noReturn.status).toBe(422);
      const fail = await act(qd, `/api/v1/rec/orders/${o.id}/qc`, {
        version: cur.version,
        checks: checks('leaks'),
        returnItemIds: [item(cur, 1).id],
      });
      expect(fail.status, fail.text).toBe(200);
      expect(fail.json.result).toBe('fail');
      cur = await order(o.id);
      expect(cur).toMatchObject({ status: 'in_progress', doneCount: 1 });
      expect(item(cur, 1).status).toBe('returned');
      expect(item(cur, 1).events.at(-1)).toMatchObject({
        type: 'return',
        reason: expect.stringContaining('rò'),
      });
      // the technician redoes it, the order goes back to QC and passes
      expect((await tap(th, o, 1, 'start')).status).toBe(200);
      expect((await tap(th, o, 1, 'finish')).status).toBe(200);
      cur = await order(o.id);
      expect(
        (await act(cv, `/api/v1/rec/orders/${o.id}/submit-qc`, { version: cur.version })).status,
      ).toBe(200);
      cur = await order(o.id);
      const pass = await act(qd, `/api/v1/rec/orders/${o.id}/qc`, {
        version: cur.version,
        checks: checks(),
      });
      expect(pass.status, pass.text).toBe(200);
      cur = await order(o.id);
      expect(cur.status).toBe('ready_for_delivery');
      expect(cur.qcRuns.map((r: Row) => r.result)).toEqual(['fail', 'pass']);
      // handover: a name is required, the odometer is recorded, the order completes
      const noName = await act(cv, `/api/v1/rec/orders/${o.id}/handover`, {
        version: cur.version,
        confirmation: 'screen',
        belongingsReturned: true,
        oldPartsReturned: true,
      });
      expect(noName.status).toBe(422);
      const km =
        ((await rows('vehicles')).find((v) => v.id === o.vehicleId)!.lastKm as number) + 40;
      const hv = await act(cv, `/api/v1/rec/orders/${o.id}/handover`, {
        version: cur.version,
        receiverName: 'Nguyễn Văn An',
        confirmation: 'screen',
        km,
        belongingsReturned: true,
        oldPartsReturned: true,
      });
      expect(hv.status, hv.text).toBe(200);
      cur = await order(o.id);
      expect(cur).toMatchObject({ status: 'completed', open: false });
      expect(cur.handover).toMatchObject({
        receiverName: 'Nguyễn Văn An',
        km,
        confirmation: 'screen',
      });
      const veh = (await rows('vehicles')).find((v) => v.id === o.vehicleId)!;
      expect(veh.lastKm).toBe(km);
      // CRM history projection: white-listed fields, prices before tax
      const hist = (await rows('vehicleHistory')).find((x) => x.id === `repair-order:${o.id}`)!;
      expect(hist).toMatchObject({
        vehicleId: o.vehicleId,
        branchId: 'br_q7',
        orderCode: o.number,
      });
      expect(hist.items).toEqual(['Thay dầu và lọc', 'Thay má phanh']);
      expect(JSON.stringify(hist)).not.toMatch(/Nguyễn|0900000/);
      // a completed order cannot be cancelled or changed
      expect(
        (
          await act(ql, `/api/v1/rec/orders/${o.id}/cancel`, {
            version: cur.version,
            reason: 'Hủy muộn rồi',
          })
        ).status,
      ).toBe(409);
      // print log: the first print is free, a reprint needs a reason
      const p1 = await act(cv, `/api/v1/rec/orders/${o.id}/handover/print`, { format: 'a5' });
      expect(p1.status, p1.text).toBe(200);
      const p2 = await act(cv, `/api/v1/rec/orders/${o.id}/handover/print`, { format: 'thermal' });
      expect(p2.status).toBe(422);
      expect(
        (
          await act(cv, `/api/v1/rec/orders/${o.id}/handover/print`, {
            format: 'thermal',
            reason: 'Khách xin thêm bản',
          })
        ).status,
      ).toBe(200);
    });

    it('FR-REC-016: only QC staff run the check; KT and CV cannot', async () => {
      const o = await assignAll(await openedOrder());
      await finishAll(o);
      const cur = await order(o.id);
      await act(cv, `/api/v1/rec/orders/${o.id}/submit-qc`, { version: cur.version });
      const v = (await order(o.id)).version;
      expect(
        (await act(cv, `/api/v1/rec/orders/${o.id}/qc`, { version: v, checks: [] })).status,
      ).toBe(403);
      expect(
        (await act(kt, `/api/v1/rec/orders/${o.id}/qc`, { version: v, checks: [] })).status,
      ).toBe(403);
    });
  });

  describe('dispatch board and cancellation (FR-REC-022, 021)', () => {
    it('FR-REC-022: the board groups open orders by state and filters by technician and waiting parts', async () => {
      const o = await assignAll(await openedOrder());
      await tap(th, o, 1, 'start');
      const b = await call(cv, 'GET', '/api/v1/rec/board');
      expect(b.status, b.text).toBe(200);
      expect(b.json.columns.in_progress.some((c: Row) => c.id === o.id)).toBe(true);
      const f = await call(cv, 'GET', '/api/v1/rec/board?technicianId=u_th_q7');
      expect(
        f.json.columns.in_progress.every((c: Row) => c.technicians.includes('Thợ Quận 7')),
      ).toBe(true);
      expect(b.json.load.find((l: Row) => l.technicianId === 'u_th_q7').active).toBeGreaterThan(0);
      const other = await call(qlTd, 'GET', '/api/v1/rec/board');
      expect(JSON.stringify(other.json)).not.toContain(o.number);
    });

    it('FR-REC-021: cancelling before any issue releases the hold; the cancelled order keeps its number', async () => {
      const o = await openedOrder();
      const heldBefore = (await rows('stockReservations')).find((x) => x.sourceId === o.id)!;
      expect(heldBefore.heldQty).toBe(2);
      const noReason = await act(cv, `/api/v1/rec/orders/${o.id}/cancel`, {
        version: o.version,
        reason: 'x',
      });
      expect(noReason.status).toBe(422);
      const c = await act(cv, `/api/v1/rec/orders/${o.id}/cancel`, {
        version: o.version,
        reason: 'Khách không làm nữa',
      });
      expect(c.status, c.text).toBe(200);
      const after = await order(o.id);
      expect(after).toMatchObject({ status: 'cancelled', open: false, number: o.number });
      const hold = (await rows('stockReservations')).find((x) => x.sourceId === o.id)!;
      expect(hold).toMatchObject({ heldQty: 0, closed: true });
      expect(
        (await call(cv, 'GET', '/api/v1/rec/board')).json.columns.approved.some(
          (x: Row) => x.id === o.id,
        ),
      ).toBe(false);
    });

    it('FR-REC-021: after parts were issued the order cancels only when every part is returned AND a manager approves', async () => {
      const o = await assignAll(await openedOrder());
      const it1 = item(o, 1);
      const line = it1.lines.find((l: Row) => l.kind === 'part');
      const req = await act(th, `/api/v1/rec/orders/${o.id}/part-requests`, {
        itemId: it1.id,
        lineKey: line.lineKey,
        qty: 2,
      });
      const iss = await act(tk, `/api/v1/rec/part-requests/${req.json.id}/decide`, {
        decision: 'issue',
        version: 1,
      });
      expect(iss.status, iss.text).toBe(200);
      const cur = await order(o.id);
      const body = { version: cur.version, reason: 'Khách bán xe' };
      // an advisor cannot cancel an order with issued parts
      const byCv = await act(cv, `/api/v1/rec/orders/${o.id}/cancel`, body);
      expect(byCv.status).toBe(409);
      expect(byCv.json.code).toBe('cancel_needs_manager');
      // the manager still needs the parts back in stock
      const early = await act(ql, `/api/v1/rec/orders/${o.id}/cancel`, body);
      expect(early.status).toBe(409);
      expect(early.json.code).toBe('returns_pending');
      // the storekeeper returns them (RTN against the issue) and posts it
      const rtn = await call(tk, 'POST', '/api/v1/inv/documents', {
        warehouseId: Q7,
        type: 'RTN',
        source: { type: 'repair-order', id: o.id },
        originalDocumentId: iss.json.issueDocumentId,
        lines: [{ partId: P_FILTER, qty: 2, originalLineNo: 1 }],
      });
      expect(rtn.status, rtn.text).toBe(201);
      const posted = await call(tk, 'POST', `/api/v1/inv/documents/${rtn.json.id}/post`, {
        version: rtn.json.version,
      });
      expect(posted.status, posted.text).toBe(200);
      const ok = await act(ql, `/api/v1/rec/orders/${o.id}/cancel`, body);
      expect(ok.status, ok.text).toBe(200);
      expect((await order(o.id)).status).toBe('cancelled');
      const balance = (await rows('stockBalances')).find(
        (b) => b.partId === P_FILTER && b.warehouseId === Q7,
      )!;
      expect(balance.reserved).toBeLessThanOrEqual(balance.onHand);
      // the ledger and the order agree: nothing is left held for the cancelled order
      const hold = (await rows('stockReservations')).find((x) => x.sourceId === o.id)!;
      expect(hold.heldQty).toBe(0);
    });
  });

  describe('R30 permission top-up and R34 / R29 settings', () => {
    it('R30: the top-up adds missing permissions once, audited, and never takes any away; only the owner may run it', async () => {
      const owner = await h.login('u_owner');
      // simulate a role created before this slice: remove the new grants and forget the top-ups
      const roles = h.container.sys.roles;
      const [cvRole] = await roles.getMany(['CV']);
      await h.container.sys.uow.run(async (tx) => {
        roles.upsert(
          tx,
          {
            ...cvRole!,
            permissions: cvRole!.permissions.filter(
              (p) => !p.startsWith('repair-') && p !== 'quote:approve',
            ),
            appliedTopUps: [],
          },
          { at: new Date(), by: 'test' },
        );
      });
      expect((await call(cv, 'POST', '/api/v1/sys/roles/top-up', {})).status).toBe(403);
      const r1 = await call(owner, 'POST', '/api/v1/sys/roles/top-up', {});
      expect(r1.status, r1.text).toBe(200);
      expect(r1.json.added.CV).toEqual(
        expect.arrayContaining(['quote:approve', 'repair-order:create']),
      );
      const [after] = await roles.getMany(['CV']);
      expect(after!.permissions).toEqual(
        expect.arrayContaining(['quote:approve', 'repair-order:update']),
      );
      const r2 = await call(owner, 'POST', '/api/v1/sys/roles/top-up', {});
      expect(r2.json.added).toEqual({});
      expect((await rows('auditLogs')).filter((x) => x.action === 'role.topup')).toHaveLength(1);
    });

    it('R34: the link limits come from the effective-dated config when one is in force (default 60 per minute otherwise)', async () => {
      const { token } = await sentQuote();
      const eff = businessDate(new Date(h.clock.now().getTime() + 3 * 86_400_000));
      const prop = await h.call('POST', '/api/v1/sys/config/public-rate-limit', {
        as: 'u_ad',
        key: key('cfg'),
        body: {
          scopeKey: 'company',
          effectiveFrom: eff,
          reason: 'Siết giới hạn trang khách khi đo ở staging',
          payload: {
            viewLimit: 5,
            viewWindowSeconds: 600,
            decideLimit: 3,
            decideWindowMinutes: 30,
          },
        },
      });
      expect(prop.status, prop.text).toBe(201);
      const ok = await h.call(
        'POST',
        `/api/v1/sys/config/public-rate-limit/${encodeURIComponent(prop.json.id)}/decide`,
        { as: 'u_owner', key: key('cfg'), body: { decision: 'approve' } },
      );
      expect(ok.status, ok.text).toBe(200);
      const real = h.clock.now().toISOString();
      try {
        // before the effective date the built-in numbers apply
        let n429 = 0;
        for (let i = 0; i < 8; i++)
          await viewPublicQuote(h.container.rec, token, { address: '198.51.100.7' }).catch(
            () => n429++,
          );
        expect(n429).toBe(0);
        h.clock.set(new Date(h.clock.now().getTime() + 3 * 86_400_000).toISOString());
        const results = [];
        for (let i = 0; i < 8; i++)
          results.push(
            await viewPublicQuote(h.container.rec, token, { address: '198.51.100.8' }).then(
              () => 200,
              (e: { status?: number }) => e.status,
            ),
          );
        expect(results.filter((x) => x === 429).length).toBeGreaterThan(0);
        expect(results.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
      } finally {
        h.clock.set(real);
      }
    });
  });
});
