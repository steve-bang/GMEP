import { expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { login, loginOk, PASSWORD } from './helpers';

export const ORIGIN = 'http://localhost:3100';
let n = 0;
export const hdr = () => ({
  origin: ORIGIN,
  'idempotency-key': `e2e-acc-${Date.now()}-${++n}-xxxxxxxx`,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export async function post(req: APIRequestContext, path: string, data: unknown = {}): Promise<Row> {
  const r = await req.post(path, { data, headers: hdr() });
  const body = (await r.json()) as Row;
  expect(r.ok(), `${path}: ${JSON.stringify(body)}`).toBe(true);
  return body;
}
export async function patch(req: APIRequestContext, path: string, data: unknown): Promise<Row> {
  const r = await req.patch(path, { data, headers: hdr() });
  const body = (await r.json()) as Row;
  expect(r.ok(), `${path}: ${JSON.stringify(body)}`).toBe(true);
  return body;
}
export const getJson = async (req: APIRequestContext, path: string): Promise<Row> =>
  (await req.get(path)).json();

export async function as(
  browser: Browser,
  user: string,
  viewport?: { width: number; height: number },
) {
  const ctx = await browser.newContext(viewport ? { viewport } : {});
  const page = await ctx.newPage();
  await loginOk(page, `${user}@demo.gmep.test`);
  return { ctx, page };
}

let km = 1_900_000;
/** Specs that run in one worker against one database must not reuse each other's odometer range. */
export const startKmAt = (n: number) => {
  km = n;
};
/** An approved quote with two items -> its order (counter approval by the advisor). Returns the quote header with `orderId`. */
export async function approvedOrder(req: APIRequestContext, vehicleId = 'veh_biz'): Promise<Row> {
  const intake = await post(req, '/api/v1/rec/intakes', { vehicleId });
  const filled = await patch(req, `/api/v1/rec/intakes/${intake.id}`, {
    version: intake.version,
    step: 5,
    km: (km += 100),
    customerRequest: 'Bảo dưỡng và kiểm tra phanh',
    serviceType: 'maintenance',
    promisedDate: '2099-01-01',
  });
  const done = await post(req, `/api/v1/rec/intakes/${intake.id}/complete`, {
    version: filled.version,
  });
  const q = await post(req, '/api/v1/rec/quotes', { intakeId: done.id });
  const e = await patch(req, `/api/v1/rec/quotes/${q.id}`, {
    version: q.version,
    items: [
      {
        name: 'Thay dầu',
        necessity: 'required',
        lines: [{ kind: 'labor', serviceId: 'svc_cmp_demo_SV-DAU' }],
      },
      {
        name: 'Thay má phanh',
        necessity: 'required',
        lines: [{ kind: 'labor', serviceId: 'svc_cmp_demo_SV-PHANH' }],
      },
    ],
  });
  const sent = await post(req, `/api/v1/rec/quotes/${q.id}/send`, { version: e.version });
  await post(req, `/api/v1/rec/quotes/${q.id}/approve`, {
    version: sent.version,
    method: 'counter_signature',
    selectedItemNos: [1, 2],
    signerName: 'Trần Văn Bình',
  });
  const head = await getJson(req, `/api/v1/rec/quotes/${q.id}`);
  expect(head.orderId).toBeTruthy();
  return head;
}

/** Drives an order to "ready for delivery" through the API: assign, work, QC pass. */
export async function readyOrder(browser: Browser, cv: Page): Promise<Row> {
  const head = await approvedOrder(cv.request);
  const qd = await as(browser, 'qd.q7');
  const th = await as(browser, 'th.q7');
  const o = await getJson(qd.page.request, `/api/v1/rec/orders/${head.orderId}`);
  for (const it of o.items) {
    await post(qd.page.request, `/api/v1/rec/items/${it.id}/assign`, {
      version: it.version,
      technicianId: 'u_th_q7',
    });
  }
  const itemNow = async (id: string, itemId: string) =>
    (await getJson(qd.page.request, `/api/v1/rec/orders/${id}`)).items.find(
      (x: Row) => x.id === itemId,
    );
  for (const it of o.items) {
    for (const ev of ['start', 'finish']) {
      const cur = await itemNow(head.orderId, it.id);
      await post(th.page.request, `/api/v1/rec/items/${it.id}/${ev}`, { version: cur.version });
    }
  }
  const o3 = await getJson(cv.request, `/api/v1/rec/orders/${head.orderId}`);
  await post(cv.request, `/api/v1/rec/orders/${head.orderId}/submit-qc`, { version: o3.version });
  const list = await getJson(qd.page.request, `/api/v1/rec/orders/${head.orderId}/qc-checklist`);
  const o4 = await getJson(qd.page.request, `/api/v1/rec/orders/${head.orderId}`);
  await post(qd.page.request, `/api/v1/rec/orders/${head.orderId}/qc`, {
    version: o4.version,
    checks: list.checks.map((c: Row) => ({ code: c.code, ok: true })),
  });
  await qd.ctx.close();
  await th.ctx.close();
  return getJson(cv.request, `/api/v1/rec/orders/${head.orderId}`);
}

export async function ensureShift(req: APIRequestContext) {
  const r = await req.post('/api/v1/acc/shifts', { data: {}, headers: hdr() });
  expect([201, 409]).toContain(r.status());
}

/**
 * The cashier. The slice 1.1 spec resets this user's password during a full run, so the demo password is tried first and the
 * reset one second; a failed attempt counts once towards the lockout (limit 5), never more.
 */
export async function asCashier(browser: Browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  for (const pw of [PASSWORD, 'mat-khau-moi-an-toan-1']) {
    await login(page, 'tn.q7@demo.gmep.test', pw);
    const ok = await page
      .waitForURL((u) => u.pathname === '/', { timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (ok) return { ctx, page };
  }
  throw new Error('the cashier could not sign in with either known password');
}
