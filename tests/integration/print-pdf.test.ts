import { beforeAll, describe, expect, it } from 'vitest';
import type { PdfRenderer, PrintModel } from '@/platform/print/types';
import { backends, createHarness, type Harness } from './harness';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
let seq = 0;
const key = (p: string) => `${p}-${String(++seq).padStart(6, '0')}-xxxxxxxx`;

const SV_DAU = 'svc_cmp_demo_SV-DAU';
const SV_PHANH = 'svc_cmp_demo_SV-PHANH';
const SV_CAN = 'svc_cmp_demo_SV-CANCHINH';

/**
 * FR-REC-008 / FR-ACC-001 print: the server PDF of the quote (A4) and the receipt (A5) is rendered from the same
 * print model as the browser sheet; scope (NFR-ISO-01) and permission are those of viewing the document; the print log
 * is an explicit idempotent POST (GET stays side-effect free); RULE-010: a print never changes a posted payment.
 * Labor-only items keep the setup free of stock.
 */
describe.each(backends)('quote and receipt PDF [%s]', (backend) => {
  let h: Harness;
  let cv: string;
  let tn: string;
  let th: string;
  let qlTd: string;
  let ql: string;
  let qd: string;
  let ip = 0;
  const seen: PrintModel[] = [];

  const call = (cookie: string, method: string, path: string, body?: unknown, k = key('prt')) =>
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
  const bytesOf = (r: { text: string }) => r.text;

  let odo = 600_000;
  async function sentQuote(items: Row[], send = true, withLink = true) {
    const c = await post(cv, '/api/v1/rec/intakes', { vehicleId: 'veh_an' });
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
      items,
    });
    expect(edited.status, edited.text).toBe(200);
    if (!send) return { q: (await get(cv, `/api/v1/rec/quotes/${created.json.id}`)).json as Row };
    const sent = await post(cv, `/api/v1/rec/quotes/${created.json.id}/send`, {
      version: edited.json.version,
    });
    expect(sent.status, sent.text).toBe(200);
    const link = withLink
      ? await post(cv, `/api/v1/rec/quotes/${created.json.id}/link`, {
          version: sent.json.version,
        })
      : null;
    return {
      q: (await get(cv, `/api/v1/rec/quotes/${created.json.id}`)).json as Row,
      token: (link?.json.token ?? '') as string,
    };
  }
  const items = (): Row[] => [
    {
      name: 'Thay dầu và lọc',
      necessity: 'required',
      lines: [{ kind: 'labor', serviceId: SV_DAU }],
    },
    {
      name: 'Thay má phanh',
      necessity: 'required',
      lines: [{ kind: 'labor', serviceId: SV_PHANH }],
    },
    {
      name: 'Cân chỉnh góc đặt bánh',
      necessity: 'optional',
      lines: [{ kind: 'labor', serviceId: SV_CAN }],
    },
  ];

  beforeAll(async () => {
    h = await createHarness(backend);
    cv = await h.loginAt('u_cv_q7', 'br_q7');
    ql = await h.loginAt('u_ql_q7', 'br_q7');
    qd = await h.loginAt('u_qd_q7', 'br_q7');
    th = await h.loginAt('u_th_q7', 'br_q7');
    tn = await h.loginAt('u_tn_q7', 'br_q7');
    qlTd = await h.loginAt('u_ql_td', 'br_td');
    // record what the renderer is given: the PDF must come from the model the page reads
    const real: PdfRenderer = h.container.pdf;
    h.container.pdf = {
      render: (m) => {
        seen.push(m);
        return real.render(m);
      },
    };
  });

  describe('quote (FR-REC-008)', () => {
    it('FR-REC-008: GET .../pdf is a PDF built from the quote snapshot; numbers equal the quote and the printed totals add up', async () => {
      const { q } = await sentQuote(items());
      const before = seen.length;
      const r = await get(cv, `/api/v1/rec/quotes/${q.id}/pdf`);
      expect(r.status, r.text).toBe(200);
      expect(r.headers.get('content-type')).toBe('application/pdf');
      expect(r.headers.get('content-disposition')).toContain(`${q.number}-v1.pdf`);
      expect(bytesOf(r).startsWith('%PDF-')).toBe(true);
      const m = seen[before]!;
      expect(m.kind).toBe('quote');
      if (m.kind !== 'quote') return;
      expect(m.amounts.totalVnd).toBe(q.shown.totals.totalVnd);
      expect(m.amounts.netVnd + m.amounts.taxVnd).toBe(m.amounts.totalVnd);
      expect(m.items).toHaveLength(3);
      expect(m.reprintLabel).toBeNull();
      // phone and address never reach the model (PDPL)
      expect(JSON.stringify(m)).not.toMatch(/0900000|@demo/);
    });

    it('FR-REC-008: GET has no side effect; the explicit print log counts, sets sentVia=print once and the second print is BẢN IN LẠI', async () => {
      const { q } = await sentQuote(items(), true, false);
      const audit = async () =>
        (await get(ql, `/api/v1/sys/audit?entityType=quote&entityId=${q.id}&limit=100`)).json
          .items as Row[];
      const printed = async () => (await audit()).filter((e) => e.action === 'quote.printed');
      await get(cv, `/api/v1/rec/quotes/${q.id}/pdf`);
      await get(cv, `/api/v1/rec/quotes/${q.id}/pdf`);
      expect(await printed()).toHaveLength(0);

      const k1 = key('log');
      const first = await call(cv, 'POST', `/api/v1/rec/quotes/${q.id}/print-log`, {}, k1);
      expect(first.status, first.text).toBe(200);
      expect(first.json).toMatchObject({ n: 1, count: 1, reprint: false });
      expect(
        (await get(cv, `/api/v1/rec/quotes/${q.id}`)).json.shown.sentVia,
        'sentVia moves from none to print',
      ).toBe('print');
      // a retry with the same key counts once
      const replay = await call(cv, 'POST', `/api/v1/rec/quotes/${q.id}/print-log`, {}, k1);
      expect(replay.json).toMatchObject({ count: 1 });
      expect(await printed()).toHaveLength(1);

      const second = await post(cv, `/api/v1/rec/quotes/${q.id}/print-log`);
      expect(second.json).toMatchObject({ count: 2, reprint: true });
      const before = seen.length;
      await get(cv, `/api/v1/rec/quotes/${q.id}/pdf`);
      const m = seen[before]!;
      expect(m.reprintLabel).toBe('BẢN IN LẠI');
      expect(await printed()).toHaveLength(2);
    });

    it('FR-REC-008: a draft is not printed to a customer (409); the PDF of a draft is still viewable', async () => {
      const { q } = await sentQuote(items(), false);
      expect((await post(cv, `/api/v1/rec/quotes/${q.id}/print-log`)).status).toBe(409);
      expect((await get(cv, `/api/v1/rec/quotes/${q.id}/pdf`)).status).toBe(200);
    });

    it('FR-REC-009: a partially approved quote prints the evidence and the approved total', async () => {
      const { q, token } = await sentQuote(items());
      const ap = await pub('/api/v1/rec/public/quote/approve', {
        token,
        selectedItemNos: [1, 2],
      });
      expect(ap.status, ap.text).toBe(200);
      const before = seen.length;
      expect((await get(cv, `/api/v1/rec/quotes/${q.id}/pdf`)).status).toBe(200);
      const m = seen[before]!;
      if (m.kind !== 'quote') throw new Error('quote model expected');
      expect(m.items.map((i) => i.decision)).toEqual(['approved', 'approved', 'declined']);
      expect(m.amounts.approvedTotalVnd).toBeGreaterThan(0);
      expect(m.amounts.approvedTotalVnd).toBeLessThan(m.amounts.totalVnd);
      expect(m.evidence).toContain('…');
    });

    it('NFR-ISO-01: another branch gets 404 for the PDF and the print log; a role without quote:view gets 403', async () => {
      const { q } = await sentQuote(items());
      expect((await get(qlTd, `/api/v1/rec/quotes/${q.id}/pdf`)).status).toBe(404);
      expect((await post(qlTd, `/api/v1/rec/quotes/${q.id}/print-log`)).status).toBe(404);
      expect((await get(th, `/api/v1/rec/quotes/${q.id}/pdf`)).status).toBe(403);
      expect((await post(th, `/api/v1/rec/quotes/${q.id}/print-log`)).status).toBe(403);
      expect((await get(cv, `/api/v1/rec/quotes/nope/pdf`)).status).toBe(404);
      const anon = await h.call('GET', `/api/v1/rec/quotes/${q.id}/pdf`);
      expect(anon.status).toBe(401);
    });
  });

  describe('receipt (FR-ACC-001)', () => {
    const order = async (id: string) => (await get(cv, `/api/v1/rec/orders/${id}`)).json as Row;
    async function paidReceipt(): Promise<Row> {
      const { q, token } = await sentQuote(items().slice(0, 2));
      const ap = await pub('/api/v1/rec/public/quote/approve', { token, selectedItemNos: [1, 2] });
      expect(ap.status, ap.text).toBe(200);
      const head = (await get(cv, `/api/v1/rec/quotes/${q.id}`)).json;
      const o = await order(head.orderId);
      for (const it of o.items) {
        const cur = (await order(o.id)).items.find((x: Row) => x.id === it.id);
        await post(qd, `/api/v1/rec/items/${it.id}/assign`, {
          version: cur.version,
          technicianId: 'u_th_q7',
        });
        for (const ev of ['start', 'finish']) {
          const c2 = (await order(o.id)).items.find((x: Row) => x.id === it.id);
          await post(th, `/api/v1/rec/items/${it.id}/${ev}`, { version: c2.version });
        }
      }
      let cur = await order(o.id);
      await post(cv, `/api/v1/rec/orders/${o.id}/submit-qc`, { version: cur.version });
      const list = (await get(qd, `/api/v1/rec/orders/${o.id}/qc-checklist`)).json;
      cur = await order(o.id);
      const qc = await post(qd, `/api/v1/rec/orders/${o.id}/qc`, {
        version: cur.version,
        checks: list.checks.map((c: Row) => ({ code: c.code, ok: true })),
      });
      expect(qc.status, qc.text).toBe(200);
      const sh = await post(tn, '/api/v1/acc/shifts', {});
      expect([201, 409], sh.text).toContain(sh.status);
      const bal = (await get(tn, `/api/v1/acc/orders/${o.id}`)).json.balance;
      const pay = await post(tn, `/api/v1/acc/orders/${o.id}/payments`, {
        kind: 'receipt',
        lines: [
          { method: 'cash', amountVnd: 200_000 },
          { method: 'transfer', amountVnd: bal.outstandingVnd - 200_000, reference: 'FT2611-001' },
        ],
      });
      expect(pay.status, pay.text).toBe(201);
      return pay.json as Row;
    }

    it('FR-ACC-001: the receipt PDF comes from the receipt model; the log is an audit entry and the posted payment is untouched (RULE-010)', async () => {
      const p = await paidReceipt();
      const before = seen.length;
      const r = await get(tn, `/api/v1/acc/payments/${p.id}/pdf`);
      expect(r.status, r.text).toBe(200);
      expect(bytesOf(r).startsWith('%PDF-')).toBe(true);
      expect(r.headers.get('content-disposition')).toContain(`${p.number}.pdf`);
      const m = seen[before]!;
      expect(m.kind).toBe('receipt');
      if (m.kind !== 'receipt') return;
      expect(m.paper).toBe('A5');
      expect(m.amounts.totalVnd).toBe(p.totalVnd);
      expect(m.lines).toHaveLength(2);
      expect(m.reprintLabel).toBeNull();

      const payBefore = JSON.stringify((await get(tn, `/api/v1/acc/payments/${p.id}`)).json);
      const k = key('log');
      const l1 = await call(tn, 'POST', `/api/v1/acc/payments/${p.id}/print-log`, {}, k);
      expect(l1.status, l1.text).toBe(200);
      expect(l1.json).toMatchObject({ count: 1, reprint: false });
      expect(
        (await call(tn, 'POST', `/api/v1/acc/payments/${p.id}/print-log`, {}, k)).json,
      ).toMatchObject({
        count: 1,
      });
      const l2 = await post(tn, `/api/v1/acc/payments/${p.id}/print-log`);
      expect(l2.json).toMatchObject({ count: 2, reprint: true });
      expect(JSON.stringify((await get(tn, `/api/v1/acc/payments/${p.id}`)).json)).toBe(payBefore);
      const again = seen.length;
      await get(tn, `/api/v1/acc/payments/${p.id}/pdf`);
      expect(seen[again]!.reprintLabel).toBe('BẢN IN LẠI');
    });

    it('NFR-ISO-01: another branch gets 404 for the receipt PDF and the log; a role without payment:view gets 403', async () => {
      const p = await paidReceipt();
      expect((await get(qlTd, `/api/v1/acc/payments/${p.id}/pdf`)).status).toBe(404);
      expect((await post(qlTd, `/api/v1/acc/payments/${p.id}/print-log`)).status).toBe(404);
      expect((await get(th, `/api/v1/acc/payments/${p.id}/pdf`)).status).toBe(403);
      expect((await post(th, `/api/v1/acc/payments/${p.id}/print-log`)).status).toBe(403);
    });
  });
});
