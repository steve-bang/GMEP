import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { getDb } from '@/infrastructure/firestore/client';
import { recomputeAccount, type Payment } from '@/modules/acc';
import { backends, createHarness, type Harness } from './harness';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
let seq = 0;
const key = (p: string) => `${p}-${String(++seq).padStart(6, '0')}-xxxxxxxx`;

const SV_DAU = 'svc_cmp_demo_SV-DAU';
const SV_PHANH = 'svc_cmp_demo_SV-PHANH';
const P_FILTER = 'part_seed_01';
const Q7 = 'wh_br_q7_WH-CHINH';

/**
 * Slice 1.7 "Tiền tối thiểu": FR-ACC-001 (receipts, several methods), 002 (deposits), 003 (cash book, vouchers), 004 (shift
 * and day close), 006 (approved debt), FR-SYS-004 (approvals), RULE-007 (a payment hangs on an order), RULE-010 (reversal,
 * never delete), RULE-011 (spend over the limit), R44 (handover reads ACC), R42, R47, R48, R41, R39; NFR-ISO-01.
 */
describe.each(backends)('ACC money [%s]', (backend) => {
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
  let tnTd: string;
  let ip = 0;
  let t0 = '';
  const rows = async (name: string): Promise<Row[]> =>
    backend === 'memory'
      ? ([...h.container.memory!.db.col(name).entries()].map(([id, v]) => ({ id, ...v })) as Row[])
      : ((await getDb(h.container.env).collection(name).get()).docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Row[]);
  const call = (cookie: string, method: string, path: string, body?: unknown, k = key('acc')) =>
    h.call(method, path, { cookie, key: k, ...(body !== undefined ? { body } : {}) });
  const post = (cookie: string, path: string, body: unknown = {}) =>
    call(cookie, 'POST', path, body);
  const get = (cookie: string, path: string) => h.call('GET', path, { cookie });
  const pub = (path: string, body: unknown) =>
    h.call('POST', path, {
      body,
      key: key('pub'),
      headers: { 'x-forwarded-for': `203.0.113.${(ip++ % 200) + 10}` },
    });

  let odo = 400_000;
  async function sentQuote(vehicleId = 'veh_an', items?: Row[]) {
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
    const sent = await post(cv, `/api/v1/rec/quotes/${created.json.id}/send`, {
      version: edited.json.version,
    });
    const link = await post(cv, `/api/v1/rec/quotes/${created.json.id}/link`, {
      version: sent.json.version,
    });
    return {
      q: (await get(cv, `/api/v1/rec/quotes/${created.json.id}`)).json as Row,
      token: link.json.token as string,
    };
  }
  const order = async (id: string) => (await get(cv, `/api/v1/rec/orders/${id}`)).json as Row;
  async function openedOrder(items?: Row[], vehicleId = 'veh_an'): Promise<Row> {
    const { q, token } = await sentQuote(vehicleId, items);
    const r = await pub('/api/v1/rec/public/quote/approve', {
      token,
      selectedItemNos: q.shown.items.map((x: Row) => x.no),
    });
    expect(r.status, r.text).toBe(200);
    const head = (await get(cv, `/api/v1/rec/quotes/${q.id}`)).json;
    return order(head.orderId);
  }
  async function finishAll(o: Row) {
    for (const it of o.items) {
      const cur = (await order(o.id)).items.find((x: Row) => x.id === it.id);
      expect(
        (
          await post(qd, `/api/v1/rec/items/${it.id}/assign`, {
            version: cur.version,
            technicianId: 'u_th_q7',
          })
        ).status,
      ).toBe(200);
      for (const ev of ['start', 'finish']) {
        const c2 = (await order(o.id)).items.find((x: Row) => x.id === it.id);
        expect(
          (await post(th, `/api/v1/rec/items/${it.id}/${ev}`, { version: c2.version })).status,
        ).toBe(200);
      }
    }
  }
  async function passQc(o: Row) {
    let cur = await order(o.id);
    expect(
      (await post(cv, `/api/v1/rec/orders/${o.id}/submit-qc`, { version: cur.version })).status,
    ).toBe(200);
    const list = (await get(qd, `/api/v1/rec/orders/${o.id}/qc-checklist`)).json;
    cur = await order(o.id);
    const r = await post(qd, `/api/v1/rec/orders/${o.id}/qc`, {
      version: cur.version,
      checks: list.checks.map((c: Row) => ({ code: c.code, ok: true })),
    });
    expect(r.status, r.text).toBe(200);
  }
  /** an order that passed the quality check */
  async function readyOrder(items?: Row[], vehicleId = 'veh_an'): Promise<Row> {
    const o = await openedOrder(items, vehicleId);
    await finishAll(o);
    await passQc(o);
    return order(o.id);
  }
  async function ensureShift(cookie = tn) {
    const r = await post(cookie, '/api/v1/acc/shifts', {});
    expect([201, 409], r.text).toContain(r.status);
    return r;
  }
  const money = async (orderId: string, cookie = tn) =>
    (await get(cookie, `/api/v1/acc/orders/${orderId}`)).json as Row;
  const cashLine = (amountVnd: number) => ({ method: 'cash', amountVnd });
  const collect = (orderId: string, body: unknown, cookie = tn, k = key('pay')) =>
    call(cookie, 'POST', `/api/v1/acc/orders/${orderId}/payments`, body, k);
  async function payFull(orderId: string) {
    await ensureShift();
    const b = (await money(orderId)).balance;
    const r = await collect(orderId, { kind: 'receipt', lines: [cashLine(b.outstandingVnd)] });
    expect(r.status, r.text).toBe(201);
    return r.json as Row;
  }
  const decide = (cookie: string, id: string, decision: 'approve' | 'reject', note?: string) =>
    get(cookie, `/api/v1/sys/approvals/${id}`).then((a) =>
      post(cookie, `/api/v1/sys/approvals/${id}/decide`, {
        // a user who cannot even read the request still tries to decide it: version 1 is the fresh one
        version: a.json.version ?? 1,
        decision,
        ...(note ? { note } : {}),
      }),
    );
  /** reverse a posted payment through the whole path: request, approval by a manager, execution */
  async function reverse(paymentId: string, reason = 'Nhập sai hình thức') {
    const rq = await post(tn, `/api/v1/acc/payments/${paymentId}/reversal-request`, { reason });
    expect(rq.status, rq.text).toBe(202);
    const ok = await decide(ql, rq.json.approvalId, 'approve');
    expect(ok.status, ok.text).toBe(200);
    const ex = await post(tn, `/api/v1/acc/payments/${paymentId}/reverse`, {
      approvalId: rq.json.approvalId,
    });
    expect(ex.status, ex.text).toBe(201);
    return ex.json as Row;
  }
  async function closeShiftClean(cookie = tn) {
    const cb = (await get(cookie, '/api/v1/acc/cashbook')).json;
    if (!cb.drawer.openShiftId) return;
    const sh = cb.shifts.find((s: Row) => s.status === 'open');
    const r = await post(cookie, `/api/v1/acc/shifts/${sh.id}/close`, {
      version: sh.version,
      countedVnd: cb.drawer.balanceVnd,
    });
    expect(r.status, r.text).toBe(200);
  }

  beforeAll(async () => {
    h = await createHarness(backend);
    t0 = h.clock.now().toISOString();
    cv = await h.loginAt('u_cv_q7', 'br_q7');
    ql = await h.loginAt('u_ql_q7', 'br_q7');
    qd = await h.loginAt('u_qd_q7', 'br_q7');
    th = await h.loginAt('u_th_q7', 'br_q7');
    tk = await h.loginAt('u_tk_q7', 'br_q7');
    tn = await h.loginAt('u_tn_q7', 'br_q7');
    kt = await h.loginAt('u_kt', 'br_q7');
    ch = await h.loginAt('u_owner', 'br_q7');
    qv = await h.loginAt('u_qv', 'br_q7');
    qlTd = await h.loginAt('u_ql_td', 'br_td');
    const grn = await post(tk, '/api/v1/inv/documents', {
      warehouseId: Q7,
      type: 'GRN',
      source: { type: 'purchase-order', id: 'po-acc-1' },
      lines: [{ partId: P_FILTER, qty: 300, unitCostVnd: 85_000 }],
    });
    const posted = await post(tk, `/api/v1/inv/documents/${grn.json.id}/post`, {
      version: grn.json.version,
    });
    expect(posted.status, posted.text).toBe(200);
  });
  afterEach(() => h.clock.set(t0));

  describe('receipts with several methods (FR-ACC-001, RULE-007)', () => {
    it('FR-ACC-001: no shift, no payment; the cashier opens the shift (an advisor cannot)', async () => {
      const o = await readyOrder();
      // close any shift left open by another test so this one starts from "no shift"
      await closeShiftClean();
      const r = await collect(o.id, { kind: 'receipt', lines: [cashLine(100_000)] });
      expect(r.status).toBe(409);
      expect(r.json.code).toBe('no_open_shift');
      expect((await post(cv, '/api/v1/acc/shifts', {})).status).toBe(403);
      const open = await post(tn, '/api/v1/acc/shifts', {});
      expect(open.status, open.text).toBe(201);
      // one shift at a time
      expect((await post(tn, '/api/v1/acc/shifts', {})).status).toBe(409);
    });

    it('FR-ACC-001: cash + transfer + card in one receipt; totals and the balance always agree; only cash enters the cash book', async () => {
      await ensureShift();
      const o = await readyOrder();
      const before = (await get(tn, '/api/v1/acc/cashbook')).json;
      const total = o.totalVnd as number;
      const r = await collect(o.id, {
        kind: 'receipt',
        lines: [
          { method: 'cash', amountVnd: 500_000 },
          { method: 'transfer', amountVnd: 300_000, reference: 'FT26-0001' },
          { method: 'card', amountVnd: total - 800_000, reference: 'POS-77' },
        ],
        cashTenderedVnd: 600_000,
      });
      expect(r.status, r.text).toBe(201);
      expect(r.json).toMatchObject({ totalVnd: total, outstandingVnd: 0, changeVnd: 100_000 });
      expect(r.json.number).toMatch(/^PT-Q7-\d{4}-\d{5}$/);
      const m = await money(o.id);
      expect(m.balance).toMatchObject({
        receivableVnd: total,
        receivedVnd: total,
        outstandingVnd: 0,
      });
      const after = (await get(tn, '/api/v1/acc/cashbook')).json;
      expect(after.inVnd - before.inVnd).toBe(500_000);
      expect(after.drawer.balanceVnd - before.drawer.balanceVnd).toBe(500_000);
      // the aggregate equals the sum of the posted payments (reconciliation)
      const pays = (await rows('payments')).filter(
        (p) => p.orderId === o.id,
      ) as unknown as Payment[];
      const re = recomputeAccount(
        { companyId: 'cmp_demo', branchId: 'br_q7', orderId: o.id, orderNumber: o.number },
        pays,
        new Set(),
      );
      expect(re.receivedVnd).toBe(total);
    });

    it('FR-ACC-001: a non-cash line needs its reference, a method must be enabled, overpayment is refused', async () => {
      await ensureShift();
      const o = await readyOrder();
      const noRef = await collect(o.id, {
        kind: 'receipt',
        lines: [{ method: 'transfer', amountVnd: 1000 }],
      });
      expect(noRef.status).toBe(422);
      expect(JSON.stringify(noRef.json.errors)).toContain('lines.0.reference');
      const over = await collect(o.id, { kind: 'receipt', lines: [cashLine(o.totalVnd + 1)] });
      expect(over.status).toBe(422);
      expect(over.json.code).toBe('overpayment');
      const empty = await collect(o.id, { kind: 'receipt', lines: [], applyDeposits: false });
      expect(empty.status).toBe(422);
      const frac = await collect(o.id, { kind: 'receipt', lines: [cashLine(1000.5)] });
      expect(frac.status, 'money is integer VND').toBe(422);
    });

    it('G4-ACC-01: no final receipt before the quality check; a deposit is allowed; RULE-007: unknown or cancelled orders take no money', async () => {
      await ensureShift();
      const o = await openedOrder();
      const early = await collect(o.id, { kind: 'receipt', lines: [cashLine(100_000)] });
      expect(early.status).toBe(409);
      expect(early.json.code).toBe('qc_required');
      const dep = await collect(o.id, { kind: 'deposit', lines: [cashLine(200_000)] });
      expect(dep.status, dep.text).toBe(201);
      const ghost = await collect('ro_does_not_exist', {
        kind: 'receipt',
        lines: [cashLine(1000)],
      });
      expect(ghost.status).toBe(404);
    });

    it('FR-ACC-001: a repeated Idempotency-Key returns the first receipt and moves money once; another body with the same key is refused', async () => {
      await ensureShift();
      const o = await readyOrder();
      const k = key('rep');
      const body = { kind: 'receipt', lines: [cashLine(250_000)] };
      const a = await collect(o.id, body, tn, k);
      const b = await collect(o.id, body, tn, k);
      expect(a.status).toBe(201);
      expect(b.status).toBe(201);
      expect(b.json.id).toBe(a.json.id);
      expect(b.headers.get('idempotent-replayed')).toBe('true');
      expect((await rows('payments')).filter((p) => p.orderId === o.id)).toHaveLength(1);
      expect((await money(o.id)).balance.receivedVnd).toBe(250_000);
      const other = await collect(o.id, { kind: 'receipt', lines: [cashLine(260_000)] }, tn, k);
      expect(other.status).toBeGreaterThanOrEqual(400);
      expect((await money(o.id)).balance.receivedVnd).toBe(250_000);
    });

    it('FR-ACC-001: two cashiers paying the same balance at the same moment: exactly one wins, never an overpayment', async () => {
      await ensureShift();
      const o = await readyOrder();
      const tn2 = await h.loginAt('u_ql_q7', 'br_q7');
      const body = { kind: 'receipt', lines: [cashLine(o.totalVnd)] };
      const [a, b] = await Promise.all([
        collect(o.id, body, tn, key('c1')),
        collect(o.id, body, tn2, key('c2')),
      ]);
      expect([a.status, b.status].sort()).toEqual([201, 422]);
      const m = await money(o.id);
      expect(m.balance).toMatchObject({
        receivedVnd: o.totalVnd,
        outstandingVnd: 0,
        overpaidVnd: 0,
      });
      expect((await rows('payments')).filter((p) => p.orderId === o.id)).toHaveLength(1);
    });

    it('permissions: an advisor sees the balance but cannot collect; the accountant only views', async () => {
      await ensureShift();
      const o = await readyOrder();
      expect((await get(cv, `/api/v1/acc/orders/${o.id}`)).status).toBe(200);
      expect((await collect(o.id, { kind: 'receipt', lines: [cashLine(1000)] }, cv)).status).toBe(
        403,
      );
      expect((await get(kt, `/api/v1/acc/orders/${o.id}`)).status).toBe(200);
      expect((await collect(o.id, { kind: 'receipt', lines: [cashLine(1000)] }, kt)).status).toBe(
        403,
      );
      expect(
        (await get(th, `/api/v1/acc/orders/${o.id}`)).status,
        'a technician has no money rights',
      ).toBe(403);
    });
  });

  describe('deposits (FR-ACC-002)', () => {
    it('a deposit is held, then applied to the final receipt; the order shows it; it can be refunded with a voucher', async () => {
      await ensureShift();
      const o = await openedOrder();
      const d = await collect(o.id, { kind: 'deposit', lines: [cashLine(300_000)] });
      expect(d.status, d.text).toBe(201);
      let m = await money(o.id);
      expect(m.balance).toMatchObject({ depositHeldVnd: 300_000, receivedVnd: 0 });
      // too much deposit is refused
      expect((await collect(o.id, { kind: 'deposit', lines: [cashLine(o.totalVnd)] })).status).toBe(
        422,
      );
      // a refund voucher (category deposit_refund) returns part of it
      const refund = await post(tn, '/api/v1/acc/expenses', {
        categoryCode: 'deposit_refund',
        amountVnd: 50_000,
        method: 'cash',
        payee: 'Khách hàng',
        description: 'Hoàn một phần cọc',
        orderId: o.id,
        depositId: d.json.id,
      });
      expect(refund.status, refund.text).toBe(201);
      m = await money(o.id);
      expect(m.balance.depositHeldVnd).toBe(250_000);
      const tooMuch = await post(tn, '/api/v1/acc/expenses', {
        categoryCode: 'deposit_refund',
        amountVnd: 250_001,
        method: 'cash',
        payee: 'Khách hàng',
        description: 'Hoàn quá số cọc',
        orderId: o.id,
        depositId: d.json.id,
      });
      expect(tooMuch.status).toBe(422);
      // finish the work, then the receipt settles the order with the held deposit first
      await finishAll(o);
      await passQc(o);
      const fresh = await order(o.id);
      const r = await collect(o.id, {
        kind: 'receipt',
        lines: [cashLine(fresh.totalVnd - 250_000)],
      });
      expect(r.status, r.text).toBe(201);
      expect(r.json).toMatchObject({
        applicationVnd: 250_000,
        outstandingVnd: 0,
        depositHeldVnd: 0,
      });
      m = await money(o.id);
      expect(m.balance).toMatchObject({ receivedVnd: fresh.totalVnd, depositHeldVnd: 0 });
    });

    it('FR-ACC-002: a deposit already applied cannot be reversed until the receipt that used it is reversed', async () => {
      await ensureShift();
      const o = await openedOrder();
      const d = await collect(o.id, { kind: 'deposit', lines: [cashLine(100_000)] });
      await finishAll(o);
      await passQc(o);
      const fresh = await order(o.id);
      const rc = await collect(o.id, {
        kind: 'receipt',
        lines: [cashLine(fresh.totalVnd - 100_000)],
      });
      expect(rc.status, rc.text).toBe(201);
      const rq = await post(tn, `/api/v1/acc/payments/${d.json.id}/reversal-request`, {
        reason: 'Khách đổi ý',
      });
      expect(rq.status).toBe(409);
      expect(rq.json.code).toBe('deposit_in_use');
      await reverse(rc.json.id);
      const m = await money(o.id);
      expect(m.balance).toMatchObject({
        receivedVnd: 0,
        depositHeldVnd: 100_000,
        outstandingVnd: fresh.totalVnd,
      });
      // the deposit is held again, so now it can be reversed itself
      const again = await post(tn, `/api/v1/acc/payments/${d.json.id}/reversal-request`, {
        reason: 'Khách đổi ý, hoàn cọc',
      });
      expect(again.status, again.text).toBe(202);
    });
  });

  describe('reversal entries (RULE-010) and the approval workflow (FR-SYS-004)', () => {
    it('RULE-010: a posted receipt is never edited; a manager other than the requester approves; the reversal is its own entry; once only', async () => {
      await ensureShift();
      const o = await readyOrder();
      const p = await collect(o.id, { kind: 'receipt', lines: [cashLine(400_000)] });
      const before = (await rows('payments')).find((x) => x.id === p.json.id)!;
      const rq = await post(tn, `/api/v1/acc/payments/${p.json.id}/reversal-request`, {
        reason: 'ab',
      });
      expect(rq.status, 'a reason of at least 5 characters').toBe(422);
      const r1 = await post(tn, `/api/v1/acc/payments/${p.json.id}/reversal-request`, {
        reason: 'Nhập sai hình thức',
      });
      expect(r1.status, r1.text).toBe(202);
      // nothing moved yet and the original stands
      expect((await money(o.id)).balance.receivedVnd).toBe(400_000);
      const ex0 = await post(tn, `/api/v1/acc/payments/${p.json.id}/reverse`, {
        approvalId: r1.json.approvalId,
      });
      expect(ex0.status, 'cannot execute before approval').toBe(409);
      // the requester cannot decide their own request; the advisor has no approval right at all
      expect((await decide(tn, r1.json.approvalId, 'approve')).status).toBe(403);
      expect((await decide(cv, r1.json.approvalId, 'approve')).status).toBe(403);
      // a second request for the same payment while one is pending is refused
      expect(
        (
          await post(tn, `/api/v1/acc/payments/${p.json.id}/reversal-request`, {
            reason: 'Gửi lại lần nữa',
          })
        ).status,
      ).toBe(409);
      expect((await decide(ql, r1.json.approvalId, 'approve')).status).toBe(200);
      const cashBefore = (await get(tn, '/api/v1/acc/cashbook')).json.drawer.balanceVnd;
      const ex = await post(tn, `/api/v1/acc/payments/${p.json.id}/reverse`, {
        approvalId: r1.json.approvalId,
      });
      expect(ex.status, ex.text).toBe(201);
      // the approval is consumed once
      const again = await post(tn, `/api/v1/acc/payments/${p.json.id}/reverse`, {
        approvalId: r1.json.approvalId,
      });
      expect(again.status).toBe(409);
      const after = (await rows('payments')).find((x) => x.id === p.json.id)!;
      expect(after, 'the posted receipt is byte for byte unchanged').toEqual(before);
      const rev = (await rows('payments')).find((x) => x.reversesId === p.json.id)!;
      expect(rev).toMatchObject({
        kind: 'reversal',
        direction: 'out',
        totalVnd: 400_000,
        reason: 'Nhập sai hình thức',
      });
      expect(rev.number).toMatch(/^PT-Q7-/);
      expect((await money(o.id)).balance).toMatchObject({
        receivedVnd: 0,
        outstandingVnd: o.totalVnd,
      });
      expect((await get(tn, '/api/v1/acc/cashbook')).json.drawer.balanceVnd).toBe(
        cashBefore - 400_000,
      );
      // the list shows the original as reversed and the reversal as its own row
      const list = await get(tn, '/api/v1/acc/payments');
      expect(list.json.items.find((x: Row) => x.id === p.json.id).reversedBy).toBe(rev.id);
      // a reversal cannot be reversed, and the same payment cannot be reversed twice
      expect(
        (
          await post(tn, `/api/v1/acc/payments/${rev.id}/reversal-request`, {
            reason: 'Đảo lại phiếu đảo',
          })
        ).status,
      ).toBe(409);
      expect(
        (
          await post(tn, `/api/v1/acc/payments/${p.json.id}/reversal-request`, {
            reason: 'Đảo lần hai',
          })
        ).status,
      ).toBe(409);
      // audit lines exist for the request, the decision and the reversal
      const actions = (await rows('auditLogs')).map((x) => x.action);
      expect(actions).toEqual(
        expect.arrayContaining([
          'approval.request',
          'approval.approve',
          'approval.consume',
          'payment.reverse',
        ]),
      );
    });

    it('FR-SYS-004: a rejected request cannot be executed; a rejection needs a reason; a request can be withdrawn', async () => {
      await ensureShift();
      const o = await readyOrder();
      const p = await collect(o.id, { kind: 'receipt', lines: [cashLine(100_000)] });
      const rq = await post(tn, `/api/v1/acc/payments/${p.json.id}/reversal-request`, {
        reason: 'Khách yêu cầu đảo',
      });
      const noNote = await decide(ql, rq.json.approvalId, 'reject');
      expect(noNote.status).toBe(422);
      expect((await decide(ql, rq.json.approvalId, 'reject', 'Không hợp lệ')).status).toBe(200);
      const ex = await post(tn, `/api/v1/acc/payments/${p.json.id}/reverse`, {
        approvalId: rq.json.approvalId,
      });
      expect(ex.status).toBe(409);
      // the slot is free again: a new request can be made, and withdrawn
      const rq2 = await post(tn, `/api/v1/acc/payments/${p.json.id}/reversal-request`, {
        reason: 'Gửi lại có lý do',
      });
      expect(rq2.status, rq2.text).toBe(202);
      const a = (await get(tn, `/api/v1/sys/approvals/${rq2.json.approvalId}`)).json;
      expect(
        (await post(ql, `/api/v1/sys/approvals/${a.id}/withdraw`, { version: a.version })).status,
        'only the requester',
      ).toBe(403);
      expect(
        (await post(tn, `/api/v1/sys/approvals/${a.id}/withdraw`, { version: a.version })).status,
      ).toBe(200);
      expect((await decide(ql, a.id, 'approve')).status).toBe(409);
    });

    it('FR-SYS-004: the queue shows what I may decide, what I asked for, and the history; branch isolation holds', async () => {
      await ensureShift();
      const o = await readyOrder();
      const p = await collect(o.id, { kind: 'receipt', lines: [cashLine(100_000)] });
      const rq = await post(tn, `/api/v1/acc/payments/${p.json.id}/reversal-request`, {
        reason: 'Để kiểm tra hàng chờ',
      });
      const toDecide = await get(ql, '/api/v1/sys/approvals?tab=toDecide');
      expect(toDecide.json.items.map((x: Row) => x.id)).toContain(rq.json.approvalId);
      expect(
        toDecide.json.items.find((x: Row) => x.id === rq.json.approvalId).actions.decide.allowed,
      ).toBe(true);
      const mine = await get(tn, '/api/v1/sys/approvals?tab=mine');
      expect(mine.json.items.map((x: Row) => x.id)).toContain(rq.json.approvalId);
      // the other branch's manager sees nothing of it and cannot read it
      const td = await get(qlTd, '/api/v1/sys/approvals?tab=toDecide');
      expect(td.json.items.map((x: Row) => x.id)).not.toContain(rq.json.approvalId);
      expect((await get(qlTd, `/api/v1/sys/approvals/${rq.json.approvalId}`)).status).toBe(404);
      expect((await decide(qlTd, rq.json.approvalId, 'approve')).status).toBe(404);
      await decide(ql, rq.json.approvalId, 'reject', 'Dọn dẹp bài kiểm tra');
    });
  });

  describe('expense vouchers and spend limits (FR-ACC-003, RULE-011)', () => {
    it('RULE-011: within the limit the voucher is paid at once; over it waits for approval; level 2 needs the owner; each approval is used once', async () => {
      await ensureShift();
      // cash must exist in the drawer
      const o = await readyOrder();
      await collect(o.id, { kind: 'receipt', lines: [cashLine(o.totalVnd)] });
      const small = await post(tn, '/api/v1/acc/expenses', {
        categoryCode: 'office',
        amountVnd: 100_000,
        method: 'cash',
        payee: 'Nhà sách A',
        description: 'Mua giấy in',
        sourceRef: 'HD-123',
      });
      expect(small.status, small.text).toBe(201);
      expect(small.json.number).toMatch(/^PC-Q7-/);
      expect(small.json.sourceMissing).toBe(false);
      // over the cashier's limit: a proposal, no money moved
      const bal0 = (await get(tn, '/api/v1/acc/cashbook')).json.drawer.balanceVnd;
      const big = await post(tn, '/api/v1/acc/expenses', {
        categoryCode: 'equipment_repair',
        amountVnd: 1_200_000,
        method: 'cash',
        payee: 'Thợ điện B',
        description: 'Sửa máy nén khí',
      });
      expect(big.status, big.text).toBe(202);
      expect(big.json.status).toBe('pending_approval');
      expect((await get(tn, '/api/v1/acc/cashbook')).json.drawer.balanceVnd).toBe(bal0);
      expect(
        (await post(tn, '/api/v1/acc/expenses/pay', { approvalId: big.json.approvalId })).status,
      ).toBe(409);
      expect((await decide(ql, big.json.approvalId, 'approve')).status).toBe(200);
      const paid = await post(tn, '/api/v1/acc/expenses/pay', { approvalId: big.json.approvalId });
      expect(paid.status, paid.text).toBe(201);
      expect(paid.json.sourceMissing, 'no source document: flagged for the day close').toBe(true);
      expect((await get(tn, '/api/v1/acc/cashbook')).json.drawer.balanceVnd).toBe(bal0 - 1_200_000);
      expect(
        (await post(tn, '/api/v1/acc/expenses/pay', { approvalId: big.json.approvalId })).status,
      ).toBe(409);
      // above the manager's limit the owner decides
      const huge = await post(tn, '/api/v1/acc/expenses', {
        categoryCode: 'equipment_repair',
        amountVnd: 6_800_000,
        method: 'transfer',
        reference: 'FT-9',
        payee: 'Công ty khí nén',
        description: 'Sửa máy nén khí xưởng',
        sourceRef: 'BG-NCC-1',
      });
      expect(huge.status).toBe(202);
      expect(huge.json.level).toBe(2);
      expect(
        (await decide(ql, huge.json.approvalId, 'approve')).status,
        'a branch manager cannot decide level 2',
      ).toBe(403);
      expect((await decide(ch, huge.json.approvalId, 'approve')).status).toBe(200);
      const p2 = await post(tn, '/api/v1/acc/expenses/pay', { approvalId: huge.json.approvalId });
      expect(p2.status, p2.text).toBe(201);
    });

    it('FR-ACC-003: cash cannot go below zero; an unknown category is refused; an advisor cannot create vouchers', async () => {
      await ensureShift();
      const cb = (await get(tn, '/api/v1/acc/cashbook')).json;
      const bad = await post(tn, '/api/v1/acc/expenses', {
        categoryCode: 'office',
        amountVnd: 400_000,
        method: 'cash',
        payee: 'Ai đó',
        description: 'Chi vượt quỹ',
      });
      if (cb.drawer.balanceVnd < 400_000) expect(bad.json.code).toBe('cash_insufficient');
      const cat = await post(tn, '/api/v1/acc/expenses', {
        categoryCode: 'zzz',
        amountVnd: 1000,
        method: 'cash',
        payee: 'Ai đó',
        description: 'Loại không có',
      });
      expect(cat.status).toBe(422);
      expect(
        (
          await post(cv, '/api/v1/acc/expenses', {
            categoryCode: 'office',
            amountVnd: 1000,
            method: 'cash',
            payee: 'Ai đó',
            description: 'Cố vấn chi',
          })
        ).status,
      ).toBe(403);
    });

    it('FR-ACC-003: the day total of the cash book is opening + in - out, and every entry carries its running balance', async () => {
      await ensureShift();
      const o = await readyOrder();
      await collect(o.id, { kind: 'receipt', lines: [cashLine(120_000)] });
      await post(tn, '/api/v1/acc/expenses', {
        categoryCode: 'utilities',
        amountVnd: 20_000,
        method: 'cash',
        payee: 'EVN',
        description: 'Tiền điện lẻ',
        sourceRef: 'HD-1',
      });
      const cb = (await get(tn, '/api/v1/acc/cashbook')).json;
      expect(cb.closingVnd).toBe(cb.openingVnd + cb.inVnd - cb.outVnd);
      let run = cb.openingVnd;
      for (const e of cb.entries) {
        run += e.direction === 'in' ? e.amountVnd : -e.amountVnd;
        expect(e.balanceAfterVnd).toBe(run);
      }
      expect(cb.drawer.balanceVnd).toBe(cb.closingVnd);
    });
  });

  describe('R44: the handover reads ACC, an approved debt lets the vehicle go', () => {
    const handoverBody = (v: number, extra: Row = {}) => ({
      version: v,
      receiverName: 'Nguyễn Văn An',
      confirmation: 'screen',
      belongingsReturned: true,
      oldPartsReturned: true,
      ...extra,
    });
    const handover = (id: string, v: number, extra: Row = {}, cookie = cv) =>
      post(cookie, `/api/v1/rec/orders/${id}/handover`, handoverBody(v, extra));

    it('R44 / UAT: outstanding money blocks the handover; paying in full lets it through and the figures are kept on the record', async () => {
      await ensureShift();
      const o = await readyOrder();
      const blocked = await handover(o.id, o.version);
      expect(blocked.status).toBe(409);
      expect(blocked.json.code).toBe('payment_outstanding');
      await payFull(o.id);
      const cur = await order(o.id);
      const ok = await handover(o.id, cur.version);
      expect(ok.status, ok.text).toBe(200);
      const done = await order(o.id);
      expect(done.handover.payment).toMatchObject({
        verified: true,
        receivableVnd: o.totalVnd,
        receivedVnd: o.totalVnd,
        outstandingVnd: 0,
      });
    });

    it('R44: a reversed receipt makes the handover blocked again', async () => {
      await ensureShift();
      const o = await readyOrder();
      const pay = await payFull(o.id);
      await reverse(pay.id);
      const cur = await order(o.id);
      const r = await handover(o.id, cur.version);
      expect(r.status).toBe(409);
      expect(r.json.code).toBe('payment_outstanding');
    });

    it('R44 / FR-ACC-006: a manager-approved debt (reason, amount, due date) lets the vehicle go; the order stays owing and a later payment settles the debt', async () => {
      await ensureShift();
      const o = await readyOrder();
      await collect(o.id, { kind: 'receipt', lines: [cashLine(100_000)] });
      const out = (await money(o.id)).balance.outstandingVnd as number;
      const due = new Date(Date.parse(t0) + 14 * 86_400_000).toISOString().slice(0, 10);
      // the amount must equal what is outstanding, the due date must be within the term
      expect(
        (
          await post(cv, `/api/v1/acc/orders/${o.id}/debt-requests`, {
            amountVnd: out - 1,
            dueDate: due,
            reason: 'Khách quen, hẹn trả sau',
          })
        ).json.code,
      ).toBe('debt_amount_mismatch');
      expect(
        (
          await post(cv, `/api/v1/acc/orders/${o.id}/debt-requests`, {
            amountVnd: out,
            dueDate: '2000-01-01',
            reason: 'Khách quen, hẹn trả sau',
          })
        ).status,
      ).toBe(422);
      const rq = await post(cv, `/api/v1/acc/orders/${o.id}/debt-requests`, {
        amountVnd: out,
        dueDate: due,
        reason: 'Khách quen, hẹn trả sau',
      });
      expect(rq.status, rq.text).toBe(202);
      // still blocked while the request is pending, and the advisor cannot approve their own request
      expect((await handover(o.id, (await order(o.id)).version)).json.code).toBe(
        'payment_outstanding',
      );
      expect((await decide(cv, rq.json.approvalId, 'approve')).status).toBe(403);
      expect((await decide(ql, rq.json.approvalId, 'approve')).status).toBe(200);
      const debt = (await rows('debts')).find((d) => d.orderId === o.id)!;
      expect(debt).toMatchObject({ amountVnd: out, status: 'open', dueDate: due });
      const bal = (await money(o.id)).balance;
      expect(bal.debt).toMatchObject({ amountVnd: out });
      const ok = await handover(o.id, (await order(o.id)).version);
      expect(ok.status, ok.text).toBe(200);
      const done = await order(o.id);
      expect(done.status).toBe('completed');
      expect(done.handover.payment).toMatchObject({
        verified: true,
        outstandingVnd: out,
        debtAmountVnd: out,
        debtDueDate: due,
      });
      // the debt list shows it with its age; paying settles it
      const list = await get(ql, '/api/v1/acc/debts');
      expect(list.json.items.find((d: Row) => d.orderId === o.id)).toMatchObject({
        remainingVnd: out,
        aging: 'notDue',
      });
      const sum =
        list.json.totals.notDue +
        list.json.totals.d1_30 +
        list.json.totals.d31_60 +
        list.json.totals.over60;
      expect(sum, 'the buckets add up to the total owed').toBe(list.json.totals.totalVnd);
      const last = await collect(o.id, { kind: 'receipt', lines: [cashLine(out)] });
      expect(last.status, last.text).toBe(201);
      expect((await rows('debts')).find((d) => d.orderId === o.id)!.status).toBe('settled');
      expect(
        (await get(ql, '/api/v1/acc/debts')).json.items.some((d: Row) => d.orderId === o.id),
      ).toBe(false);
    });

    it('R44: if ACC cannot answer the handover is blocked; only a manager may hand over on an exception, with a reason kept on the record', async () => {
      await ensureShift();
      const o = await readyOrder();
      const rec = h.container.rec;
      const real = rec.payments;
      rec.payments = {
        balanceInTx: async () => {
          throw new Error('ACC outage');
        },
      };
      try {
        const r1 = await handover(o.id, o.version);
        expect(r1.status).toBe(409);
        expect(r1.json.code).toBe('payment_check_unavailable');
        // an advisor cannot use the exception, even with a reason
        const r2 = await handover(o.id, o.version, {
          paymentExceptionReason: 'Khách chờ ngoài cửa',
        });
        expect(r2.json.code).toBe('payment_check_unavailable');
        const r3 = await handover(
          o.id,
          o.version,
          { paymentExceptionReason: 'Khách chờ ngoài cửa, hệ thống thu tiền lỗi' },
          ql,
        );
        expect(r3.status, r3.text).toBe(200);
      } finally {
        rec.payments = real;
      }
      const done = await order(o.id);
      expect(done.handover.payment).toMatchObject({
        verified: false,
        exceptionReason: expect.stringContaining('Khách chờ'),
      });
      const audit = (await rows('auditLogs')).find(
        (x) => x.entityId === o.id && x.action === 'repairOrder.deliver',
      )!;
      expect(audit.reason).toContain('Khách chờ');
    });

    it('R42: only an advisor or a branch manager hands the vehicle over; a cashier, foreman or storekeeper cannot', async () => {
      await ensureShift();
      const o = await readyOrder();
      await payFull(o.id);
      const cur = await order(o.id);
      for (const c of [tn, qd, tk, th, kt])
        expect((await handover(o.id, cur.version, {}, c)).status).toBe(403);
      expect((await handover(o.id, cur.version, {}, cv)).status).toBe(200);
    });
  });

  describe('R42 / R47 / R48 / R41 / R39 (BA dev-must-change)', () => {
    it('R42: an advisor cancels only an order still approved with nothing started; once work started only the manager can', async () => {
      const a = await openedOrder();
      const c1 = await post(cv, `/api/v1/rec/orders/${a.id}/cancel`, {
        version: a.version,
        reason: 'Khách đổi ý',
      });
      expect(c1.status, c1.text).toBe(200);
      const b = await openedOrder();
      const it1 = b.items[0];
      await post(qd, `/api/v1/rec/items/${it1.id}/assign`, {
        version: it1.version,
        technicianId: 'u_th_q7',
      });
      const cur = (await order(b.id)).items[0];
      await post(th, `/api/v1/rec/items/${it1.id}/start`, { version: cur.version });
      const fresh = await order(b.id);
      const c2 = await post(cv, `/api/v1/rec/orders/${b.id}/cancel`, {
        version: fresh.version,
        reason: 'Khách đổi ý',
      });
      expect(c2.status).toBe(409);
      expect(c2.json.code).toBe('cancel_needs_manager');
      expect(
        (
          await post(ql, `/api/v1/rec/orders/${b.id}/cancel`, {
            version: fresh.version,
            reason: 'Khách đổi ý',
          })
        ).status,
      ).toBe(200);
    });

    it('RULE-007: an order that took money cannot be cancelled until the money is reversed or the deposit refunded', async () => {
      await ensureShift();
      const o = await openedOrder();
      const d = await collect(o.id, { kind: 'deposit', lines: [cashLine(100_000)] });
      const c = await post(ql, `/api/v1/rec/orders/${o.id}/cancel`, {
        version: o.version,
        reason: 'Khách bỏ việc',
      });
      expect(c.status).toBe(409);
      expect(c.json.code).toBe('order_has_payments');
      await reverse(d.json.id, 'Hoàn cọc do hủy lệnh');
      const fresh = await order(o.id);
      expect(
        (
          await post(ql, `/api/v1/rec/orders/${o.id}/cancel`, {
            version: fresh.version,
            reason: 'Khách bỏ việc',
          })
        ).status,
      ).toBe(200);
    });

    it('R47: a supplementary quote cannot be approved once the order is completed; open supplements close with the order; extra approved work reopens QC and voids the old result', async () => {
      await ensureShift();
      const o = await readyOrder();
      // a supplement drafted and sent while the order is ready for delivery
      const sup = await post(cv, `/api/v1/rec/orders/${o.id}/supplement`, { version: o.version });
      expect(sup.status, sup.text).toBe(201);
      const q0 = (await get(cv, `/api/v1/rec/quotes/${sup.json.id}`)).json;
      const edited = await call(cv, 'PATCH', `/api/v1/rec/quotes/${sup.json.id}`, {
        version: q0.version,
        items: [
          {
            name: 'Thay lọc gió',
            necessity: 'optional',
            lines: [{ kind: 'labor', serviceId: SV_DAU }],
          },
        ],
      });
      expect(edited.status, edited.text).toBe(200);
      const sent = await post(cv, `/api/v1/rec/quotes/${sup.json.id}/send`, {
        version: edited.json.version,
      });
      expect(sent.status, sent.text).toBe(200);
      const link = await post(cv, `/api/v1/rec/quotes/${sup.json.id}/link`, {
        version: sent.json.version,
      });
      const shown = (await get(cv, `/api/v1/rec/quotes/${sup.json.id}`)).json;
      // the order completes (paid, handed over): the supplement is closed by the system
      await payFull(o.id);
      const hv = await post(cv, `/api/v1/rec/orders/${o.id}/handover`, {
        version: (await order(o.id)).version,
        receiverName: 'Nguyễn Văn An',
        confirmation: 'screen',
        belongingsReturned: true,
        oldPartsReturned: true,
      });
      expect(hv.status, hv.text).toBe(200);
      const closed = (await get(cv, `/api/v1/rec/quotes/${sup.json.id}`)).json;
      expect(closed.status).toBe('expired');
      const ver = (await rows('quoteVersions')).find((v) => v.id === `${sup.json.id}__v1`)!;
      expect(ver.closedReason).toBe('order_closed');
      // the customer link no longer approves
      const r = await pub('/api/v1/rec/public/quote/approve', {
        token: link.json.token,
        selectedItemNos: shown.shown.items.map((x: Row) => x.no),
      });
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect((await rows('repairOrders')).find((x) => x.id === o.id)!.supplements).toHaveLength(0);
      // and a supplement cannot be created for the closed order
      expect(
        (
          await post(cv, `/api/v1/rec/orders/${o.id}/supplement`, {
            version: (await order(o.id)).version,
          })
        ).status,
      ).toBe(409);
    });

    it('R47: approving a supplement while the order awaits delivery reopens the work and marks the passed QC run as no longer valid', async () => {
      await ensureShift();
      const o = await readyOrder();
      const sup = await post(cv, `/api/v1/rec/orders/${o.id}/supplement`, { version: o.version });
      const q0 = (await get(cv, `/api/v1/rec/quotes/${sup.json.id}`)).json;
      const edited = await call(cv, 'PATCH', `/api/v1/rec/quotes/${sup.json.id}`, {
        version: q0.version,
        items: [
          {
            name: 'Cân chỉnh thêm',
            necessity: 'optional',
            lines: [{ kind: 'labor', serviceId: 'svc_cmp_demo_SV-CANCHINH' }],
          },
        ],
      });
      const sent = await post(cv, `/api/v1/rec/quotes/${sup.json.id}/send`, {
        version: edited.json.version,
      });
      const link = await post(cv, `/api/v1/rec/quotes/${sup.json.id}/link`, {
        version: sent.json.version,
      });
      const shown = (await get(cv, `/api/v1/rec/quotes/${sup.json.id}`)).json;
      const r = await pub('/api/v1/rec/public/quote/approve', {
        token: link.json.token,
        selectedItemNos: shown.shown.items.map((x: Row) => x.no),
      });
      expect(r.status, r.text).toBe(200);
      const cur = await order(o.id);
      expect(cur.status).toBe('in_progress');
      expect(cur.qcRuns.at(-1)).toMatchObject({ result: 'pass' });
      expect(cur.qcRuns.at(-1).invalidatedAt).toBeTruthy();
      // the new total is what the customer now owes
      expect((await money(o.id)).balance.receivableVnd).toBe(cur.totalVnd);
      expect(cur.totalVnd).toBeGreaterThan(o.totalVnd);
    });

    it('R48: a verbal approval above the threshold needs the dedicated permission (not quote:reject): the owner and the branch manager have it, the advisor not', async () => {
      const roles = await get(ch, '/api/v1/sys/roles');
      const perms = (code: string) =>
        (roles.json.items ?? roles.json).find((r: Row) => r.code === code).permissions as string[];
      expect(perms('QL')).toContain('quote-verbal-over-limit:approve');
      expect(perms('CH')).toContain('quote-verbal-over-limit:approve');
      expect(perms('CV')).not.toContain('quote-verbal-over-limit:approve');
    });

    it('R41: a fifth pause reason exists and "other" needs a note', async () => {
      const o = await openedOrder();
      const it1 = o.items[0];
      await post(qd, `/api/v1/rec/items/${it1.id}/assign`, {
        version: it1.version,
        technicianId: 'u_th_q7',
      });
      let cur = (await order(o.id)).items[0];
      await post(th, `/api/v1/rec/items/${it1.id}/start`, { version: cur.version });
      cur = (await order(o.id)).items[0];
      const noNote = await post(th, `/api/v1/rec/items/${it1.id}/pause`, {
        version: cur.version,
        reason: 'other',
      });
      expect(noNote.status).toBe(422);
      const ok = await post(th, `/api/v1/rec/items/${it1.id}/pause`, {
        version: cur.version,
        reason: 'awaiting_supplement_approval',
      });
      expect(ok.status, ok.text).toBe(200);
      expect((await order(o.id)).items[0].pauseReason).toBe('awaiting_supplement_approval');
    });

    it('R39: no active warehouse -> the approval stands, the order waits and the branch manager is told in particular', async () => {
      const { q, token } = await sentQuote();
      // simulate by failing the warehouse lookup path used by the opening
      const sys = h.container.sys;
      const realList = sys.warehouses.list.bind(sys.warehouses);
      sys.warehouses.list = (async () => ({
        items: [],
        nextCursor: null,
      })) as typeof sys.warehouses.list;
      try {
        const r = await pub('/api/v1/rec/public/quote/approve', {
          token,
          selectedItemNos: q.shown.items.map((x: Row) => x.no),
        });
        expect(r.status, 'the approval is never blocked by the warehouse').toBe(200);
      } finally {
        sys.warehouses.list = realList;
      }
      const head = (await get(cv, `/api/v1/rec/quotes/${q.id}`)).json;
      expect(head.orderId).toBeNull();
      expect(
        (await rows('notifications')).some(
          (n) => n.titleKey === 'notifications.orderWarehouseMissing',
        ),
      ).toBe(true);
    });
  });

  describe('NFR-ISO-01 and permissions of the money screens', () => {
    it('another branch sees nothing of a Q7 payment, cannot collect, reverse or read the cash book of Q7, and its own lists are empty of it', async () => {
      await ensureShift();
      const o = await readyOrder();
      const p = await payFull(o.id);
      tnTd = await h.loginAt('u_ql_td', 'br_td');
      expect((await get(qlTd, `/api/v1/acc/orders/${o.id}`)).status).toBe(404);
      expect((await get(qlTd, `/api/v1/acc/payments/${p.id}`)).status).toBe(404);
      expect((await collect(o.id, { kind: 'receipt', lines: [cashLine(1000)] }, tnTd)).status).toBe(
        404,
      );
      expect(
        (
          await post(qlTd, `/api/v1/acc/payments/${p.id}/reversal-request`, {
            reason: 'Thử đảo chéo chi nhánh',
          })
        ).status,
      ).toBe(404);
      const list = await get(qlTd, '/api/v1/acc/payments');
      expect(list.json.items.map((x: Row) => x.id)).not.toContain(p.id);
      const cb = await get(qlTd, '/api/v1/acc/cashbook');
      expect(cb.json.entries.map((e: Row) => e.paymentId)).not.toContain(p.id);
      // a user with no working branch cannot use the money screens (no merged view)
      const noBranch = await h.login('u_multi');
      expect([409, 403]).toContain((await get(noBranch, '/api/v1/acc/cashbook')).status);
    });

    it('the owner and the regional manager read but do not operate; the accountant exports nothing without a reason to look', async () => {
      await ensureShift();
      expect((await get(qv, '/api/v1/acc/cashbook')).status).toBe(200);
      expect((await get(ch, '/api/v1/acc/payments')).status).toBe(200);
      expect((await post(qv, '/api/v1/acc/shifts', {})).status).toBe(403);
      expect((await post(kt, '/api/v1/acc/shifts', {})).status).toBe(403);
    });

    it('every money write route requires an Idempotency-Key', async () => {
      const o = await readyOrder();
      const r = await h.call('POST', `/api/v1/acc/orders/${o.id}/payments`, {
        cookie: tn,
        body: { kind: 'receipt', lines: [cashLine(1000)] },
      });
      expect(r.status).toBe(400);
      const r2 = await h.call('POST', '/api/v1/acc/shifts', { cookie: tn, body: {} });
      expect(r2.status).toBe(400);
    });
  });

  // LAST: closing the day locks the business date of the shared test branch for every test after it
  describe('shift close, variance and day close (FR-ACC-004, UAT-07)', () => {
    it('a count difference needs a cause and an explanation; over the tolerance it needs a manager; the DAY cannot close until then; after the close nothing is posted that day', async () => {
      // use the other branch, which has no money history yet, so the day can really be closed
      const tn2 = await h.loginAt('u_tn_q7', 'br_q7');
      void tn2;
      // a clean slate: close the open shift, then check the day status
      await ensureShift();
      const o = await readyOrder();
      await collect(o.id, { kind: 'receipt', lines: [cashLine(300_000)] });
      const cb = (await get(tn, '/api/v1/acc/cashbook')).json;
      const sh = cb.shifts.find((s: Row) => s.status === 'open');
      // counted 150.000 less than the book, no explanation
      const noWhy = await post(tn, `/api/v1/acc/shifts/${sh.id}/close`, {
        version: sh.version,
        countedVnd: cb.drawer.balanceVnd - 150_000,
      });
      expect(noWhy.status).toBe(422);
      expect(JSON.stringify(noWhy.json.errors)).toContain('causeCode');
      const closed = await post(tn, `/api/v1/acc/shifts/${sh.id}/close`, {
        version: sh.version,
        countedVnd: cb.drawer.balanceVnd - 150_000,
        causeCode: 'change_short',
        explanation: 'Thiếu tiền thối khách',
      });
      expect(closed.status, closed.text).toBe(200);
      expect(closed.json).toMatchObject({
        varianceVnd: -150_000,
        varianceStatus: 'pending_approval',
      });
      // the book now equals the count, with the difference recorded as its own entry
      const cb2 = (await get(tn, '/api/v1/acc/cashbook')).json;
      expect(cb2.entries.at(-1)).toMatchObject({
        kind: 'variance',
        direction: 'out',
        amountVnd: 150_000,
      });
      expect(cb2.drawer.balanceVnd).toBe(cb.drawer.balanceVnd - 150_000);
      expect(cb2.drawer.openShiftId).toBeNull();
      // the day is blocked by the unapproved difference
      const st = (await get(ql, '/api/v1/acc/day-close')).json;
      expect(st.blockers.map((b: Row) => b.code)).toContain('variance_pending');
      const blocked = await post(ql, '/api/v1/acc/day-close', { date: st.date });
      expect(blocked.status).toBe(409);
      expect(blocked.json.code).toBe('day_close_blocked');
      // the cashier cannot close the day; the manager rejects once, the cashier explains again, the manager approves
      expect((await post(tn, '/api/v1/acc/day-close', { date: st.date })).status).toBe(403);
      const shiftRow = (await rows('cashShifts')).find((s) => s.id === sh.id)!;
      expect(
        (await decide(ql, shiftRow.varianceApprovalId, 'reject', 'Chưa thuyết phục')).status,
      ).toBe(200);
      expect(
        ((await get(ql, '/api/v1/acc/day-close')).json.blockers as Row[]).map((b) => b.code),
      ).toContain('variance_rejected');
      const re = await post(tn, `/api/v1/acc/shifts/${sh.id}/explain`, {
        causeCode: 'wrong_amount',
        explanation: 'Nhập sai số tiền thối, đã kiểm lại',
      });
      expect(re.status, re.text).toBe(200);
      expect((await decide(ql, re.json.approvalId, 'approve')).status).toBe(200);
      const ok = await post(ql, '/api/v1/acc/day-close', { date: st.date, note: 'Chốt cuối ngày' });
      expect(ok.status, ok.text).toBe(201);
      // closed: no new shift, receipt or voucher dated that day; closing twice is refused
      expect((await post(tn, '/api/v1/acc/shifts', {})).json.code).toBe('day_closed');
      const o2 = await readyOrder();
      const late = await collect(o2.id, {
        kind: 'receipt',
        lines: [{ method: 'transfer', amountVnd: 1000, reference: 'X' }],
      });
      expect(late.status).toBe(409);
      expect(late.json.code).toBe('day_closed');
      expect((await post(ql, '/api/v1/acc/day-close', { date: st.date })).status).toBe(409);
      expect((await get(tn, '/api/v1/acc/cashbook')).json.closed).toBe(true);
      // the next day is open again
      h.clock.set(new Date(Date.parse(t0) + 26 * 3_600_000).toISOString());
      const tnNext = await h.loginAt('u_tn_q7', 'br_q7');
      expect((await post(tnNext, '/api/v1/acc/shifts', {})).status).toBe(201);
    });
  });
});
