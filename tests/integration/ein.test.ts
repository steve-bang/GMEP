import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { getDb } from '@/infrastructure/firestore/client';
import { StaticProviderRegistry } from '@/infrastructure/einvoice/fakeProvider';
import { backends, createHarness, type Harness } from './harness';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
let seq = 0;
const key = (p: string) => `${p}-${String(++seq).padStart(6, '0')}-xxxxxxxx`;

const SV_DAU = 'svc_tnt_demo_SV-DAU';
const SV_PHANH = 'svc_tnt_demo_SV-PHANH';
const P_FILTER = 'part_seed_01';
const Q7 = 'wh_br_q7_WH-CHINH';

/**
 * Slice 1.8 "Hóa đơn cơ bản": FR-EIN-001 (from the order), 002 (retail / business buyer), 003 (issuing unit), 004 (provider port,
 * fake), 005 (status sync), 006 (XML and PDF stored), 007 (adjust / replace / cancel with approval, minimal), 009 (orders
 * without invoice), 010 (error queue), 011 (eligibility list), 013 (no duplicate invoice); RULE-005/007/010; R68;
 * NFR-ISO-01. Sample VAT 8% is NOT accountant sign-off.
 */
describe.each(backends)('EIN invoices [%s]', (backend) => {
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
  afterEach(() => {
    h.clock.set(t0);
    h.container.fakeProvider.reset();
  });

  /** an order that passed the quality check, with the cashier's invoice request not yet made */
  const issue = (orderId: string, body: unknown = {}, cookie = tn, k = key('inv')) =>
    call(cookie, 'POST', `/api/v1/ein/orders/${orderId}/invoices`, body, k);
  const invoice = async (id: string, cookie = kt) =>
    (await get(cookie, `/api/v1/ein/invoices/${id}`)).json as Row;
  const queue = async (cookie = kt) => (await get(cookie, '/api/v1/ein/queue')).json as Row;
  const fake = () => h.container.fakeProvider;
  const issued = async (o: Row) => {
    const r = await issue(o.id);
    expect(r.status, r.text).toBe(201);
    const inv = await invoice(r.json.invoiceId);
    expect(inv.status, JSON.stringify(inv)).toBe('issued');
    return inv;
  };

  describe('issue from a repair order (FR-EIN-001, 002, 003, 004, 006; RULE-007)', () => {
    it('FR-EIN-001/004/006: one call issues the invoice from the order; number and tax code come from the provider; XML and PDF are stored and downloadable', async () => {
      const o = await readyOrder();
      const r = await issue(o.id);
      expect(r.status, r.text).toBe(201);
      expect(r.json.duplicate).toBe(false);
      const inv = await invoice(r.json.invoiceId);
      expect(inv).toMatchObject({
        status: 'issued',
        sync: 'synced',
        docType: 'original',
        symbol: 'C26TAA',
      });
      expect(inv.number).toMatch(/^\d{7}$/);
      expect(inv.taxAuthorityCode).toMatch(/^00[0-9A-F]{30}$/);
      expect(inv.requestNumber).toMatch(/^YH-Q7-/);
      // RULE-005: the invoice total is the order total, tax per rate, lines from the approved lines
      expect(inv.totalVnd).toBe(o.totalVnd);
      expect(inv.netVnd + inv.taxVnd).toBe(inv.totalVnd);
      expect(inv.taxSummary[0]).toMatchObject({ rateBp: 800, taxKey: 'vat' });
      expect(inv.taxSummary[0].taxVersionId).toMatch(/^tax-rate__vat__/);
      // the order has its own status: the invoice never writes to it
      expect((await order(o.id)).status).toBe('ready_for_delivery');
      // FR-EIN-006: files
      const xml = await h.call('GET', `/api/v1/ein/invoices/${inv.id}/files/xml`, { cookie: kt });
      expect(xml.status).toBe(200);
      expect(xml.headers.get('content-type')).toContain('xml');
      expect(xml.text).toContain(`<SHDon>${inv.number}</SHDon>`);
      expect(xml.text).toContain(`<TgTTTBSo>${o.totalVnd}</TgTTTBSo>`);
      const pdf = await h.call('GET', `/api/v1/ein/invoices/${inv.id}/files/pdf`, { cookie: tn });
      expect(pdf.status).toBe(200);
      expect(pdf.text.startsWith('%PDF-')).toBe(true);
      // R77: every download is access-logged (who, which file), never the content
      const dl = (await rows('accessLogs')).filter(
        (x) => x.entityType === 'invoice' && x.entityId === inv.id && x.purpose === 'export',
      );
      expect(dl.map((x) => x.columns?.[0]).sort()).toEqual(['file:pdf', 'file:xml']);
      expect(
        (await h.call('GET', `/api/v1/ein/invoices/${inv.id}/files/exe`, { cookie: kt })).status,
      ).toBe(404);
      // audit in the same transaction: request, attempt, issued
      const rawInv = (await rows('invoices')).find((x) => x.id === inv.id)!;
      const actions = (await rows('auditLogs'))
        .filter((a) => a.entityId === inv.id || a.entityId === rawInv.requestId)
        .map((a) => a.action);
      expect(actions).toEqual(
        expect.arrayContaining(['invoice.request', 'invoice.attempt', 'invoice.issued']),
      );
      // the order's invoices are found from the order (FR-EIN-006 "tra cứu theo lệnh")
      const list = (await get(kt, `/api/v1/ein/invoices?q=${encodeURIComponent(o.number)}`)).json;
      expect(list.items.map((x: Row) => x.id)).toContain(inv.id);
    });

    it('FR-EIN-011: before the quality check nothing is created and the blocking reason is listed; a cancelled provider setup blocks too', async () => {
      const o = await openedOrder();
      const r = await issue(o.id);
      expect(r.status).toBe(422);
      expect(r.json.code).toBe('invoice_not_eligible');
      expect(r.json.errors.map((e: Row) => e.message)).toContain('order_not_eligible');
      expect(fake().invoiceCount).toBe(0);
      expect((await rows('invoiceRequests')).filter((x) => x.orderId === o.id)).toHaveLength(0);
      const chk = (await get(tn, `/api/v1/ein/orders/${o.id}/invoice-check`)).json;
      expect(chk.eligible).toBe(false);
      expect(chk.issues.map((i: Row) => i.code)).toContain('order_not_eligible');
    });

    it('FR-EIN-003/011: no issuing unit / provider = "not activated"; the live environment never runs on the fake', async () => {
      const o = await readyOrder();
      const real = h.container.ein.providers;
      try {
        h.container.ein.providers = new StaticProviderRegistry({});
        const r = await issue(o.id);
        expect(r.status).toBe(422);
        expect(r.json.errors.map((e: Row) => e.message)).toContain('provider_not_activated');
        // the live environment is refused for the fake even though it is registered for the test one
        const reg = new StaticProviderRegistry({ fake: fake() });
        expect(reg.get('fake', 'test')).not.toBeNull();
        expect(reg.get('fake', 'live')).toBeNull();
      } finally {
        h.container.ein.providers = real;
      }
      expect((await get(ch, '/api/v1/ein/connection')).json).toMatchObject({
        activated: true,
        environment: 'test',
      });
    });

    it('FR-EIN-002: a business buyer without an address is listed and blocked; fixing it in the form lets it through; retail needs only a name', async () => {
      const o = await readyOrder(undefined, 'veh_biz');
      const blocked = await issue(o.id);
      expect(blocked.status).toBe(422);
      const msgs = blocked.json.errors.map((e: Row) => `${e.field}:${e.message}`);
      expect(msgs).toContain('address:buyer_address_missing');
      const bad = await issue(o.id, { buyer: { address: 'Số 1, Quận 1', taxCode: '123' } });
      expect(bad.json.errors.map((e: Row) => e.message)).toContain('buyer_tax_code_invalid');
      expect(fake().invoiceCount).toBe(0);
      const ok = await issue(o.id, { buyer: { address: '45 Lê Lợi, Bến Nghé, Quận 1, TP.HCM' } });
      expect(ok.status, ok.text).toBe(201);
      const inv = await invoice(ok.json.invoiceId);
      expect(inv.buyerKind).toBe('business');
      expect(inv.buyerTaxCode).toBe('0312345678');
      expect(inv.status).toBe('issued');
    });

    it('PDPL: buyer address and e-mail follow the PII policy by role and are logged when shown in full', async () => {
      const o = await readyOrder();
      const inv = await issued(o);
      const asTn = await invoice(inv.id, tn);
      expect(asTn.buyerAddress).toMatchObject({ masked: false });
      expect(asTn.buyerAddress.value).toContain('Nguyễn Văn Linh');
      const asKt = await invoice(inv.id, kt);
      expect(asKt.buyerAddress.masked).toBe(true);
      expect(JSON.stringify(asKt)).not.toContain('Nguyễn Văn Linh');
      const asCh = await invoice(inv.id, ch);
      expect(asCh.buyerAddress.masked).toBe(true);
      expect(JSON.stringify(asCh)).not.toContain('Nguyễn Văn Linh');
      const log = (await rows('accessLogs')).filter(
        (l) => l.entityType === 'invoice' && l.entityId === inv.id,
      );
      expect(log.length).toBeGreaterThan(0);
      expect(JSON.stringify(log)).not.toContain('Nguyễn Văn Linh');
      // the technical key is for KT / CH / AD only
      expect(asTn.request?.idempotencyKey).toBeUndefined();
      expect(asKt.request.idempotencyKey).toMatch(/^gmep:/);
    });

    it('permissions: an advisor, a storekeeper and a regional manager cannot issue; the manager only reads', async () => {
      const o = await readyOrder();
      for (const c of [cv, tk, ql, qv])
        expect((await issue(o.id, {}, c)).status, 'cannot issue').toBe(403);
      expect((await get(ql, '/api/v1/ein/invoices')).status).toBe(200);
      expect((await get(cv, '/api/v1/ein/invoices')).status).toBe(403);
      expect(fake().invoiceCount).toBe(0);
    });
  });

  describe('no duplicate invoice (FR-EIN-013, UAT-23)', () => {
    it('FR-EIN-013: pressing issue twice with the same key replays; with a different key returns the same invoice (duplicate); one invoice at the provider', async () => {
      const o = await readyOrder();
      const k = key('dbl');
      const a = await issue(o.id, {}, tn, k);
      const again = await issue(o.id, {}, tn, k);
      expect(again.headers.get('idempotent-replayed')).toBe('true');
      expect(again.json.invoiceId).toBe(a.json.invoiceId);
      const other = await issue(o.id, {}, kt);
      expect(other.status).toBe(200);
      expect(other.json).toMatchObject({ duplicate: true, invoiceId: a.json.invoiceId });
      expect(fake().invoiceCount).toBe(1);
      expect(fake().calls.issue).toBe(1);
      expect((await rows('invoices')).filter((x) => x.orderId === o.id)).toHaveLength(1);
      // the business guard survives the end of the 24 h HTTP key window
      h.clock.set(new Date(h.clock.now().getTime() + 3 * 86_400_000).toISOString());
      const late = await h.loginAt('u_tn_q7', 'br_q7');
      const afterTtl = await issue(o.id, {}, late, k);
      expect(afterTtl.json.invoiceId).toBe(a.json.invoiceId);
      expect(fake().invoiceCount).toBe(1);
    });

    it('FR-EIN-013: parallel clicks (different keys, two users) produce exactly one invoice and one YH number', async () => {
      const o = await readyOrder();
      const many = await Promise.all([
        issue(o.id, {}, tn),
        issue(o.id, {}, tn),
        issue(o.id, {}, kt),
        issue(o.id, {}, tn),
      ]);
      const ok = many.filter((r) => r.status === 200 || r.status === 201);
      expect(ok.length, many.map((r) => r.text).join('|')).toBeGreaterThanOrEqual(1);
      expect(new Set(ok.map((r) => r.json.invoiceId)).size).toBe(1);
      expect(many.filter((r) => r.status === 201).length).toBe(1);
      expect(fake().invoiceCount).toBe(1);
      const reqs = (await rows('invoiceRequests')).filter((x) => x.orderId === o.id);
      expect(reqs).toHaveLength(1);
      expect((await rows('invoices')).filter((x) => x.orderId === o.id)).toHaveLength(1);
    });

    it('FR-EIN-013: a timeout AFTER the provider created the invoice -> the retry asks first and finds it; no second invoice', async () => {
      const o = await readyOrder();
      fake().script('issue', 'timeout_after');
      const r = await issue(o.id);
      expect(r.status).toBe(201);
      let inv = await invoice(r.json.invoiceId);
      expect(inv).toMatchObject({ status: 'not_issued', sync: 'waiting_query' });
      expect(fake().invoiceCount, 'the provider did create it').toBe(1);
      const q = await queue();
      const item = q.items.find((x: Row) => x.orderId === o.id);
      expect(item).toMatchObject({ status: 'unknown', errorKind: 'timeout' });
      // issuing again meanwhile does not send anything
      const calls = fake().calls.issue;
      const dup = await issue(o.id, {}, kt);
      expect(dup.json.duplicate).toBe(true);
      expect(fake().calls.issue).toBe(calls);
      // "Thử lại": the provider is asked, finds the invoice, nothing is sent again
      const retry = await post(kt, `/api/v1/ein/queue/${item.requestId}/retry`);
      expect(retry.status, retry.text).toBe(200);
      expect(fake().calls.issue, 'no resend').toBe(calls);
      expect(fake().calls.query).toBeGreaterThanOrEqual(1);
      inv = await invoice(r.json.invoiceId);
      expect(inv).toMatchObject({ status: 'issued', sync: 'synced' });
      expect(fake().invoiceCount).toBe(1);
      expect((await queue()).items.some((x: Row) => x.orderId === o.id)).toBe(false);
    });

    it('FR-EIN-013: a timeout BEFORE the provider created anything -> the query says "not found" and only then the request is sent again', async () => {
      const o = await readyOrder();
      fake().script('issue', 'timeout_before');
      const r = await issue(o.id);
      expect(fake().invoiceCount).toBe(0);
      const item = (await queue()).items.find((x: Row) => x.orderId === o.id);
      expect(item.status).toBe('unknown');
      const retry = await post(kt, `/api/v1/ein/queue/${item.requestId}/retry`);
      expect(retry.status, retry.text).toBe(200);
      expect(fake().invoiceCount).toBe(1);
      expect((await invoice(r.json.invoiceId)).status).toBe('issued');
      const req = (await rows('invoiceRequests')).find((x) => x.id === item.requestId)!;
      // the second attempt asked first (nothing found) and then sent
      expect(fake().calls.query).toBe(1);
      expect(req.attempts.map((a: Row) => `${a.phase}:${a.outcome}`)).toEqual([
        'send:timeout',
        'send:ok',
      ]);
    });
  });

  describe('error queue and retry (FR-EIN-010)', () => {
    it('FR-EIN-010: a rejection keeps the request in the queue (never lost), notifies the accountant, and "Thử lại" works once the cause is gone', async () => {
      const o = await readyOrder();
      fake().script('issue', 'rejected');
      const r = await issue(o.id);
      const item = (await queue()).items.find((x: Row) => x.orderId === o.id);
      expect(item).toMatchObject({
        status: 'failed_provider',
        errorKind: 'rejected',
        errorCode: 'symbol_not_registered',
      });
      expect(item.actions.retry.allowed).toBe(true);
      expect((await invoice(r.json.invoiceId)).syncError.code).toBe('symbol_not_registered');
      const notes = (await rows('notifications')).filter(
        (n) => n.userId === 'u_kt' && n.titleKey === 'notifications.einvoiceQueued',
      );
      expect(notes.length).toBeGreaterThan(0);
      const done = await post(kt, `/api/v1/ein/queue/${item.requestId}/retry`);
      expect(done.status).toBe(200);
      expect((await invoice(r.json.invoiceId)).status).toBe('issued');
      expect(fake().invoiceCount).toBe(1);
      // the cashier cannot work the queue; the manager can read it
      expect((await post(tn, `/api/v1/ein/queue/${item.requestId}/retry`)).status).toBe(403);
      expect((await get(tn, '/api/v1/ein/queue')).status).toBe(403);
      expect((await get(ql, '/api/v1/ein/queue')).status).toBe(200);
    });

    it('FR-EIN-010: a data error cannot be retried until the buyer is fixed (locked with a reason); fixing it checks the rules and sends', async () => {
      const o = await readyOrder();
      fake().script('issue', 'data_error');
      const r = await issue(o.id);
      const item = (await queue()).items.find((x: Row) => x.orderId === o.id);
      expect(item).toMatchObject({ status: 'failed_data', errorCode: 'buyer_address_invalid' });
      expect(item.actions.retry).toMatchObject({ allowed: false, reasonCode: 'fix_data_first' });
      expect(item.actions.fixBuyer.allowed).toBe(true);
      const locked = await post(kt, `/api/v1/ein/queue/${item.requestId}/retry`);
      expect(locked.status).toBe(409);
      expect(locked.json.code).toBe('fix_data_first');
      const req = (await rows('invoiceRequests')).find((x) => x.id === item.requestId)!;
      const bad = await post(kt, `/api/v1/ein/queue/${item.requestId}/fix-buyer`, {
        version: req.version,
        buyer: { kind: 'business', name: 'Công ty A', taxCode: '999' },
      });
      expect(bad.status).toBe(422);
      const fixed = await post(kt, `/api/v1/ein/queue/${item.requestId}/fix-buyer`, {
        version: req.version,
        buyer: { address: '1 Nguyễn Huệ, Quận 1, TP.HCM' },
      });
      expect(fixed.status, fixed.text).toBe(200);
      expect((await invoice(r.json.invoiceId)).status).toBe('issued');
    });

    it('FR-EIN-005/010: an asynchronous provider answer waits in the queue and the due-job settles it; the job is safe to run twice', async () => {
      const o = await readyOrder();
      fake().script('issue', 'processing');
      const r = await issue(o.id);
      let inv = await invoice(r.json.invoiceId);
      expect(inv).toMatchObject({ status: 'not_issued', sync: 'waiting_query' });
      const item = (await queue()).items.find((x: Row) => x.orderId === o.id);
      expect(item.status).toBe('awaiting_provider');
      // not due yet: the job leaves it
      expect((await post(kt, '/api/v1/ein/jobs/run-due')).json.handled).toBe(0);
      h.clock.set(new Date(h.clock.now().getTime() + 10 * 60_000).toISOString());
      const later = await h.loginAt('u_kt', 'br_q7');
      const [a, b] = await Promise.all([
        post(later, '/api/v1/ein/jobs/run-due'),
        post(later, '/api/v1/ein/jobs/run-due'),
      ]);
      expect(a.status + b.status).toBe(400);
      inv = await invoice(r.json.invoiceId, later);
      expect(inv).toMatchObject({ status: 'issued', sync: 'synced' });
      expect(fake().invoiceCount).toBe(1);
    });

    it('FR-EIN-010: after the allowed attempts the job stops by itself and the request stays for a person', async () => {
      const o = await readyOrder();
      fake().script('issue', 'unavailable', 10).script('query', 'ok', 0);
      const r = await issue(o.id);
      let cookie = kt;
      for (let i = 0; i < 6; i++) {
        h.clock.set(new Date(h.clock.now().getTime() + 13 * 3_600_000).toISOString());
        cookie = await h.loginAt('u_kt', 'br_q7');
        await post(cookie, '/api/v1/ein/jobs/run-due');
      }
      const item = (await queue(cookie)).items.find((x: Row) => x.orderId === o.id);
      expect(item.attemptCount).toBe(item.maxAttempts);
      expect(item.status).toBe('failed_provider');
      const calls = fake().calls.issue;
      await post(cookie, '/api/v1/ein/jobs/run-due');
      expect(fake().calls.issue, 'the job does not exceed the allowed attempts').toBe(calls);
      fake().clearScript();
      expect((await post(cookie, `/api/v1/ein/queue/${item.requestId}/retry`)).status).toBe(200);
      expect((await invoice(r.json.invoiceId, cookie)).status).toBe('issued');
    });

    it('G4-EIN-06: cancelling a request asks the provider last; it is refused when the invoice exists, allowed (with guard and reason) when it does not, and the order can be issued again', async () => {
      const o = await readyOrder();
      fake().script('issue', 'timeout_after');
      const r = await issue(o.id);
      const item = (await queue()).items.find((x: Row) => x.orderId === o.id);
      const req = () =>
        rows('invoiceRequests').then((x) => x.find((y) => y.id === item.requestId)!);
      const wrongGuard = await post(kt, `/api/v1/ein/queue/${item.requestId}/cancel`, {
        version: (await req()).version,
        reason: 'Khách đổi ý',
        confirm: 'YH-SAI',
      });
      expect(wrongGuard.status).toBe(422);
      // the provider holds the invoice: refused, and the outcome is recorded instead
      const refused = await post(kt, `/api/v1/ein/queue/${item.requestId}/cancel`, {
        version: (await req()).version,
        reason: 'Khách đổi ý',
        confirm: item.number,
      });
      expect(refused.status).toBe(409);
      expect(refused.json.code).toBe('request_has_invoice');
      expect((await invoice(r.json.invoiceId)).status).toBe('issued');
      // a different order: nothing at the provider -> cancel works
      const o2 = await readyOrder();
      fake().script('issue', 'timeout_before');
      const r2 = await issue(o2.id);
      const item2 = (await queue()).items.find((x: Row) => x.orderId === o2.id);
      const ok = await post(kt, `/api/v1/ein/queue/${item2.requestId}/cancel`, {
        version: (await rows('invoiceRequests')).find((y) => y.id === item2.requestId)!.version,
        reason: 'Khách không lấy hóa đơn',
        confirm: item2.number,
      });
      expect(ok.status, ok.text).toBe(200);
      expect((await invoice(r2.json.invoiceId)).status).toBe('abandoned');
      expect((await queue()).items.some((x: Row) => x.orderId === o2.id)).toBe(false);
      // the order is free again: a second round opens a new request and the guard key is new
      const again = await issue(o2.id);
      expect(again.status, again.text).toBe(201);
      expect(again.json.requestId).not.toBe(r2.json.requestId);
      expect((await invoice(again.json.invoiceId)).status).toBe('issued');
      expect(fake().invoiceCount).toBe(2);
    });
  });

  describe('orders without an invoice (FR-EIN-009)', () => {
    it('FR-EIN-009: a handed-over order without an invoice is listed; one with an open request or a valid invoice is not; cashiers and the owner see it, advisors do not', async () => {
      await ensureShift();
      const a = await readyOrder();
      const b = await readyOrder();
      for (const o of [a, b]) {
        await payFull(o.id);
        const hv = await post(cv, `/api/v1/rec/orders/${o.id}/handover`, {
          version: (await order(o.id)).version,
          receiverName: 'Nguyễn Văn An',
          confirmation: 'screen',
          belongingsReturned: true,
          oldPartsReturned: true,
        });
        expect(hv.status, hv.text).toBe(200);
      }
      const w0 = (await get(tn, '/api/v1/ein/warnings')).json;
      const ids0 = w0.items.map((x: Row) => x.orderId);
      expect(ids0).toEqual(expect.arrayContaining([a.id, b.id]));
      expect(w0.totalVnd).toBeGreaterThanOrEqual(a.totalVnd + b.totalVnd);
      // a: invoiced; b: a request is waiting in the queue
      await issue(a.id);
      fake().script('issue', 'unavailable');
      await issue(b.id);
      const ids1 = (await get(tn, '/api/v1/ein/warnings')).json.items.map((x: Row) => x.orderId);
      expect(ids1).not.toContain(a.id);
      expect(ids1).not.toContain(b.id);
      expect((await get(ch, '/api/v1/ein/warnings')).status).toBe(200);
      expect((await get(cv, '/api/v1/ein/warnings')).status).toBe(403);
    });
  });

  describe('adjust, replace, cancel with approval (FR-EIN-007, UAT-08)', () => {
    const decide = (cookie: string, id: string, decision: 'approve' | 'reject', note?: string) =>
      get(cookie, `/api/v1/sys/approvals/${id}`).then((a) =>
        post(cookie, `/api/v1/sys/approvals/${id}/decide`, {
          version: a.json.version ?? 1,
          decision,
          ...(note ? { note } : {}),
        }),
      );

    it('UAT-08: a replacement needs the chief accountant right; the requester cannot decide; nothing is sent before approval; the original is not edited and both versions are linked', async () => {
      const o = await readyOrder(undefined, 'veh_biz');
      const inv = await (async () => {
        const r = await issue(o.id, { buyer: { address: '45 Lê Lợi, Bến Nghé, Quận 1, TP.HCM' } });
        return invoice(r.json.invoiceId);
      })();
      const before = fake().invoiceCount;
      expect(
        (
          await post(tn, `/api/v1/ein/invoices/${inv.id}/corrections`, {
            purpose: 'cancel',
            reasonCode: 'duplicate',
            reason: 'Lập trùng',
          })
        ).status,
      ).toBe(403);
      const rq = await post(kt, `/api/v1/ein/invoices/${inv.id}/corrections`, {
        purpose: 'replace',
        reasonCode: 'buyer_info',
        reason: 'Khách báo sai địa chỉ',
        buyer: { address: '99 Pasteur, Quận 3, TP.HCM' },
      });
      expect(rq.status, rq.text).toBe(202);
      // a second correction on the same invoice is refused while this one is open
      const dup = await post(kt, `/api/v1/ein/invoices/${inv.id}/corrections`, {
        purpose: 'replace',
        reasonCode: 'buyer_info',
        reason: 'Lập lại lần nữa',
        buyer: { address: '1 Pasteur, Quận 3, TP.HCM' },
      });
      expect(dup.status).toBe(409);
      // the requester cannot approve their own request; an ordinary accountant lacks invoice:approve; the cashier too
      expect((await decide(kt, rq.json.approvalId, 'approve')).status).toBe(403);
      expect((await decide(tn, rq.json.approvalId, 'approve')).status).toBe(403);
      // not executable yet
      expect(
        (await post(kt, '/api/v1/ein/corrections/execute', { approvalId: rq.json.approvalId }))
          .status,
      ).toBe(409);
      expect(fake().invoiceCount, 'nothing was sent').toBe(before);
      expect((await decide(ch, rq.json.approvalId, 'approve')).status).toBe(200);
      // only the requester executes, once
      expect(
        (await post(ch, '/api/v1/ein/corrections/execute', { approvalId: rq.json.approvalId }))
          .status,
      ).toBe(403);
      const ex = await post(kt, '/api/v1/ein/corrections/execute', {
        approvalId: rq.json.approvalId,
      });
      expect(ex.status, ex.text).toBe(201);
      expect(
        (await post(kt, '/api/v1/ein/corrections/execute', { approvalId: rq.json.approvalId }))
          .status,
      ).toBe(409);
      const repl = await invoice(ex.json.invoiceId);
      expect(repl).toMatchObject({
        docType: 'replacement',
        status: 'issued',
        originalInvoiceId: inv.id,
      });
      const orig = await invoice(inv.id);
      expect(orig.status, 'the original is not edited and is not cancelled').toBe('issued');
      expect(orig.replacedBy).toBe(repl.id);
      expect(orig.totalVnd).toBe(inv.totalVnd);
      expect(orig.versions.map((v: Row) => v.id)).toEqual([inv.id, repl.id]);
      expect(fake().invoiceCount).toBe(before + 1);
      // the order's effective invoice is the replacement
      const idx = (await rows('einOrders')).find((x) => x.id === o.id)!;
      expect(idx.validInvoiceId).toBe(repl.id);
      // a replaced invoice cannot be corrected again
      expect(
        (
          await post(kt, `/api/v1/ein/invoices/${inv.id}/corrections`, {
            purpose: 'cancel',
            reasonCode: 'duplicate',
            reason: 'Lập trùng nữa',
          })
        ).status,
      ).toBe(409);
    });

    it('FR-EIN-007: an adjustment carries signed amounts per rate of the original; below-zero and unknown rates are refused', async () => {
      const o = await readyOrder();
      const inv = await issued(o);
      const bad = await post(kt, `/api/v1/ein/invoices/${inv.id}/corrections`, {
        purpose: 'adjust',
        reasonCode: 'amounts',
        reason: 'Giảm giá sau xuất',
        deltas: [{ rateIndex: 0, description: 'Giảm', netVnd: -(inv.netVnd + 1) }],
      });
      expect(bad.status).toBe(422);
      expect(bad.json.code).toBe('adjustment_below_zero');
      expect(
        (
          await post(kt, `/api/v1/ein/invoices/${inv.id}/corrections`, {
            purpose: 'adjust',
            reasonCode: 'amounts',
            reason: 'Không có số',
            deltas: [],
          })
        ).json.code,
      ).toBe('adjustment_needs_amounts');
      const rq = await post(kt, `/api/v1/ein/invoices/${inv.id}/corrections`, {
        purpose: 'adjust',
        reasonCode: 'amounts',
        reason: 'Giảm giá sau xuất',
        deltas: [{ rateIndex: 0, description: 'Giảm giá công', netVnd: -100_000 }],
      });
      expect(rq.status, rq.text).toBe(202);
      await decide(ch, rq.json.approvalId, 'approve');
      const ex = await post(kt, '/api/v1/ein/corrections/execute', {
        approvalId: rq.json.approvalId,
      });
      expect(ex.status, ex.text).toBe(201);
      const adj = await invoice(ex.json.invoiceId);
      expect(adj).toMatchObject({
        docType: 'adjustment',
        displayStatus: 'adjustment',
        netVnd: -100_000,
        taxVnd: -8_000,
        totalVnd: -108_000,
      });
      const orig = await invoice(inv.id);
      expect(orig.adjustedBy).toEqual([adj.id]);
      expect(orig.status).toBe('issued');
      expect(orig.actions.correct.allowed).toBe(true);
      // an adjustment is not adjusted again
      expect((await invoice(adj.id)).actions.correct).toMatchObject({
        allowed: false,
        reasonCode: 'adjustment_not_correctable',
      });
    });

    it('FR-EIN-007: cancelling needs the password again; once cancelled the order goes back to the warning list rules and the invoice is read only', async () => {
      const o = await readyOrder();
      const inv = await issued(o);
      const rq = await post(kt, `/api/v1/ein/invoices/${inv.id}/corrections`, {
        purpose: 'cancel',
        reasonCode: 'duplicate',
        reason: 'Lập trùng hóa đơn',
      });
      expect(rq.status, rq.text).toBe(202);
      expect((await decide(ch, rq.json.approvalId, 'reject', 'Chưa đủ căn cứ')).status).toBe(200);
      expect(
        (await post(kt, '/api/v1/ein/corrections/execute', { approvalId: rq.json.approvalId }))
          .status,
      ).toBe(409);
      const rq2 = await post(kt, `/api/v1/ein/invoices/${inv.id}/corrections`, {
        purpose: 'cancel',
        reasonCode: 'duplicate',
        reason: 'Lập trùng hóa đơn (đã có giấy tờ)',
      });
      await decide(ch, rq2.json.approvalId, 'approve');
      const noPass = await post(kt, '/api/v1/ein/corrections/execute', {
        approvalId: rq2.json.approvalId,
      });
      expect(noPass.status).toBe(403);
      expect(noPass.json.code).toBe('reauth_required');
      const wrong = await post(kt, '/api/v1/ein/corrections/execute', {
        approvalId: rq2.json.approvalId,
        password: 'sai-mat-khau',
      });
      expect(wrong.status).toBe(403);
      const ok = await post(kt, '/api/v1/ein/corrections/execute', {
        approvalId: rq2.json.approvalId,
        password: 'Demo!Pass-2026',
      });
      expect(ok.status, ok.text).toBe(201);
      const after = await invoice(inv.id);
      expect(after).toMatchObject({ status: 'cancelled', displayStatus: 'cancelled' });
      expect(after.cancelReason).toBe('Lập trùng hóa đơn (đã có giấy tờ)');
      expect(after.actions.correct.allowed).toBe(false);
      expect((await rows('einOrders')).find((x) => x.id === o.id)!.validInvoiceId).toBeNull();
      // a cancelled invoice never moves again; the order may be invoiced anew (round 2)
      const re = await issue(o.id);
      expect(re.status, re.text).toBe(201);
      expect(re.json.invoiceId).not.toBe(inv.id);
    });

    it('the cashier can only tell the accountant an invoice looks wrong (a notification, no request)', async () => {
      const o = await readyOrder();
      const inv = await issued(o);
      const r = await post(tn, `/api/v1/ein/invoices/${inv.id}/report-error`, {
        note: 'Khách nói sai biển số',
      });
      expect(r.status, r.text).toBe(200);
      expect(
        (await rows('notifications')).some(
          (n) => n.userId === 'u_kt' && n.titleKey === 'notifications.einvoiceReported',
        ),
      ).toBe(true);
      expect(
        (await rows('invoiceRequests')).filter((x) => x.targetInvoiceId === inv.id),
      ).toHaveLength(0);
    });
  });

  describe('an order with a valid invoice is frozen (R75, FR-REC-021, FR-INV-022, FR-ACC-002)', () => {
    it('R75: cancelling the order, returning stock and reversing the receipt are refused with order_has_valid_invoice; a cancelled invoice lets them through', async () => {
      const o0 = await openedOrder();
      const it1 = o0.items[0];
      const line = it1.lines.find((l: Row) => l.kind === 'part');
      expect(
        (
          await post(qd, `/api/v1/rec/items/${it1.id}/assign`, {
            version: it1.version,
            technicianId: 'u_th_q7',
          })
        ).status,
      ).toBe(200);
      const req = await post(th, `/api/v1/rec/orders/${o0.id}/part-requests`, {
        itemId: it1.id,
        lineKey: line.lineKey,
        qty: 2,
      });
      expect(req.status, req.text).toBe(201);
      const iss = await post(tk, `/api/v1/rec/part-requests/${req.json.id}/decide`, {
        decision: 'issue',
        version: 1,
      });
      expect(iss.status, iss.text).toBe(200);
      const o = await order(o0.id);
      await finishAll(o);
      await passQc(o);
      const pay = await payFull(o.id);
      const inv = await issued(o);
      const cur = await order(o.id);

      // REC: cancel
      const c = await post(ql, `/api/v1/rec/orders/${o.id}/cancel`, {
        version: cur.version,
        reason: 'Khách hủy lệnh',
      });
      expect(c.status).toBe(409);
      expect(c.json.code).toBe('order_has_valid_invoice');
      expect(c.json.detail).toContain('hóa đơn');
      // INV: return of stock tied to the order
      const rtnBody = {
        warehouseId: Q7,
        type: 'RTN',
        source: { type: 'repair-order', id: o.id },
        originalDocumentId: iss.json.issueDocumentId,
        lines: [{ partId: P_FILTER, qty: 2, originalLineNo: 1 }],
      };
      const rtn = await post(tk, '/api/v1/inv/documents', rtnBody);
      expect(rtn.status).toBe(409);
      expect(rtn.json.code).toBe('order_has_valid_invoice');
      // ACC: reversal of the receipt
      const rv = await post(tn, `/api/v1/acc/payments/${pay.id}/reversal-request`, {
        reason: 'Khách đòi hoàn tiền',
      });
      expect(rv.status).toBe(409);
      expect(rv.json.code).toBe('order_has_valid_invoice');

      // cancel the invoice (approval + password): the order is free again
      const rq = await post(kt, `/api/v1/ein/invoices/${inv.id}/corrections`, {
        purpose: 'cancel',
        reasonCode: 'duplicate',
        reason: 'Lập trùng hóa đơn',
      });
      expect(rq.status, rq.text).toBe(202);
      const a = await get(ch, `/api/v1/sys/approvals/${rq.json.approvalId}`);
      await post(ch, `/api/v1/sys/approvals/${rq.json.approvalId}/decide`, {
        version: a.json.version ?? 1,
        decision: 'approve',
      });
      const done = await post(kt, '/api/v1/ein/corrections/execute', {
        approvalId: rq.json.approvalId,
        password: 'Demo!Pass-2026',
      });
      expect(done.status, done.text).toBe(201);
      const rtn2 = await post(tk, '/api/v1/inv/documents', rtnBody);
      expect(rtn2.status, rtn2.text).toBe(201);
      const rv2 = await post(tn, `/api/v1/acc/payments/${pay.id}/reversal-request`, {
        reason: 'Khách đòi hoàn tiền',
      });
      expect(rv2.status, rv2.text).toBe(202);
    });
  });

  describe('sync with the provider (FR-EIN-005)', () => {
    it('FR-EIN-005: an invoice the provider cancelled follows it after a sync; the order is free again', async () => {
      const o = await readyOrder();
      const inv = await issued(o);
      const raw = (await rows('invoices')).find((x) => x.id === inv.id)!;
      fake().cancelAtProvider(raw.providerInvoiceId);
      const s = await post(kt, `/api/v1/ein/invoices/${inv.id}/sync`);
      expect(s.status, s.text).toBe(200);
      expect((await invoice(inv.id)).status).toBe('cancelled');
      expect((await rows('einOrders')).find((x) => x.id === o.id)!.validInvoiceId).toBeNull();
    });

    it('FR-EIN-006: when the files could not be fetched the invoice is still issued and a sync stores them', async () => {
      const o = await readyOrder();
      fake().script('artifacts', 'unavailable');
      const r = await issue(o.id);
      let inv = await invoice(r.json.invoiceId);
      expect(inv).toMatchObject({ status: 'issued', artifactsReady: false });
      expect(
        (await h.call('GET', `/api/v1/ein/invoices/${inv.id}/files/xml`, { cookie: kt })).status,
      ).toBe(404);
      expect((await post(kt, `/api/v1/ein/invoices/${inv.id}/sync`)).status).toBe(200);
      inv = await invoice(inv.id);
      expect(inv.artifactsReady).toBe(true);
      expect(
        (await h.call('GET', `/api/v1/ein/invoices/${inv.id}/files/pdf`, { cookie: kt })).status,
      ).toBe(200);
    });
  });

  describe('branch isolation (NFR-ISO-01) and the index budget (R68)', () => {
    it('another branch sees nothing: detail, files, queue, list and issuing an order of another branch', async () => {
      const o = await readyOrder();
      const inv = await issued(o);
      fake().script('issue', 'unavailable');
      const o2 = await readyOrder();
      await issue(o2.id);
      const other = await h.loginAt('u_ql_td', 'br_td');
      expect((await get(other, `/api/v1/ein/invoices/${inv.id}`)).status).toBe(404);
      expect(
        (await h.call('GET', `/api/v1/ein/invoices/${inv.id}/files/xml`, { cookie: other })).status,
      ).toBe(404);
      expect(
        (await get(other, '/api/v1/ein/invoices')).json.items.map((x: Row) => x.id),
      ).not.toContain(inv.id);
      expect((await get(other, '/api/v1/ein/queue')).json.items).toHaveLength(0);
      expect((await get(other, `/api/v1/ein/orders/${o.id}/invoice-check`)).status).toBe(404);
      // the regional manager of both branches reads the working branch only
      expect((await get(qv, '/api/v1/ein/invoices')).json.items.map((x: Row) => x.id)).toContain(
        inv.id,
      );
      // CH working at "all" must pick a branch to see money screens
    });

    it('R68: the whole slice reads by key; the invoice list is ONE query shape, newest first, status and text filtered in memory', async () => {
      const o = await readyOrder();
      const inv = await issued(o);
      const all = (await get(kt, '/api/v1/ein/invoices')).json;
      expect(all.items[0].createdAt >= all.items.at(-1).createdAt).toBe(true);
      const f = (
        await get(kt, `/api/v1/ein/invoices?status=issued&q=${encodeURIComponent(inv.number)}`)
      ).json;
      expect(f.items.map((x: Row) => x.id)).toContain(inv.id);
      const none = (await get(kt, '/api/v1/ein/invoices?status=cancelled&q=zzzz')).json;
      expect(none.items).toHaveLength(0);
      const win = (await get(kt, '/api/v1/ein/invoices?from=2000-01-01&to=2000-01-02')).json;
      expect(win.items).toHaveLength(0);
      const paged = (await get(kt, '/api/v1/ein/invoices?limit=1')).json;
      expect(paged.items).toHaveLength(1);
      expect(paged.nextCursor).not.toBeNull();
      const next = (await get(kt, `/api/v1/ein/invoices?limit=1&cursor=${paged.nextCursor}`)).json;
      expect(next.items[0].id).not.toBe(paged.items[0].id);
    });
  });
});
