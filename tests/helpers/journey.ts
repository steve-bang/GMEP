import { expect } from 'vitest';
import type { Harness } from '../integration/harness';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export const SV_DAU = 'svc_tnt_demo_SV-DAU';
export const SV_PHANH = 'svc_tnt_demo_SV-PHANH';
export const P_FILTER = 'part_seed_01';

let seq = 0;
export const uniqueKey = (p: string) => `${p}-${String(++seq).padStart(6, '0')}-xxxxxxxx`;
let ip = 0;
let odo = 600_000;

/** Cookies of the people who run one branch's counter (a role per cookie, all with the same working branch). */
export interface Staff {
  cv: string; // service advisor: intake, quote, handover
  qd: string; // workshop manager: assign, QC
  th: string; // technician (only Q7 has one in the demo data)
  tn: string; // cashier
  tk?: string; // storekeeper
  kt?: string; // accountant (invoice read)
}

/**
 * Shared end-to-end building blocks for the cross-module integration tests (isolation matrix, performance
 * regression, security checklist). Same API calls as the slice suites, no private shortcuts: every record is
 * created through the public routes so the tests exercise the real permission and scope checks.
 */
export function journey(h: Harness) {
  const call = (cookie: string, method: string, path: string, body?: unknown, k = uniqueKey('j')) =>
    h.call(method, path, { cookie, key: k, ...(body !== undefined ? { body } : {}) });
  const post = (cookie: string, path: string, body: unknown = {}) =>
    call(cookie, 'POST', path, body);
  const get = (cookie: string, path: string) => h.call('GET', path, { cookie });
  const pub = (path: string, body: unknown) =>
    h.call('POST', path, {
      body,
      key: uniqueKey('pub'),
      headers: { 'x-forwarded-for': `203.0.113.${(ip++ % 200) + 10}` },
    });

  async function customerWithVehicle(cookie: string, tag: string, plate: string) {
    const c = await post(cookie, '/api/v1/crm/customers', {
      type: 'individual',
      name: `Khach ${tag}`,
      phone: `09${String(Math.floor(10_000_000 + Math.random() * 89_000_000))}`,
    });
    expect(c.status, c.text).toBe(201);
    const v = await post(cookie, '/api/v1/crm/vehicles', {
      customerId: c.json.id,
      plate,
      make: 'Kia',
      model: 'Morning',
      year: 2019,
      lastKm: 1000,
    });
    expect(v.status, v.text).toBe(201);
    return { customerId: c.json.id as string, vehicleId: v.json.id as string };
  }

  async function sentQuote(cv: string, vehicleId: string, items?: Row[]) {
    const c = await post(cv, '/api/v1/rec/intakes', { vehicleId });
    expect(c.status, c.text).toBe(201);
    const p = await call(cv, 'PATCH', `/api/v1/rec/intakes/${c.json.id}`, {
      version: c.json.version,
      step: 5,
      km: (odo += 100),
      customerRequest: 'Bảo dưỡng',
      serviceType: 'maintenance',
      promisedDate: '2099-01-01',
    });
    expect(p.status, p.text).toBe(200);
    const done = await post(cv, `/api/v1/rec/intakes/${c.json.id}/complete`, {
      version: p.json.version,
    });
    expect(done.status, done.text).toBe(200);
    const created = await post(cv, '/api/v1/rec/quotes', { intakeId: done.json.id });
    const edited = await call(cv, 'PATCH', `/api/v1/rec/quotes/${created.json.id}`, {
      version: created.json.version,
      items: items ?? [
        { name: 'Thay dầu', necessity: 'required', lines: [{ kind: 'labor', serviceId: SV_DAU }] },
        {
          name: 'Thay má phanh',
          necessity: 'required',
          lines: [{ kind: 'labor', serviceId: SV_PHANH }],
        },
      ],
    });
    expect(edited.status, edited.text).toBe(200);
    const sent = await post(cv, `/api/v1/rec/quotes/${created.json.id}/send`, {
      version: edited.json.version,
    });
    expect(sent.status, sent.text).toBe(200);
    const link = await post(cv, `/api/v1/rec/quotes/${created.json.id}/link`, {
      version: sent.json.version,
    });
    const q = (await get(cv, `/api/v1/rec/quotes/${created.json.id}`)).json as Row;
    return { q, token: link.json.token as string, intakeId: done.json.id as string };
  }

  const order = async (cv: string, id: string) =>
    (await get(cv, `/api/v1/rec/orders/${id}`)).json as Row;

  /** quote approved by the customer link: the approval opens the repair order (RULE-007) */
  async function openedOrder(cv: string, vehicleId: string, items?: Row[]) {
    const { q, token, intakeId } = await sentQuote(cv, vehicleId, items);
    const r = await pub('/api/v1/rec/public/quote/approve', {
      token,
      selectedItemNos: q.shown.items.map((x: Row) => x.no),
    });
    expect(r.status, r.text).toBe(200);
    const head = (await get(cv, `/api/v1/rec/quotes/${q.id}`)).json;
    const o = await order(cv, head.orderId);
    return { order: o, quoteId: q.id as string, intakeId, token };
  }

  async function finishAll(staff: Staff, o: Row, technicianId = 'u_th_q7') {
    for (const it of o.items) {
      const cur = (await order(staff.cv, o.id)).items.find((x: Row) => x.id === it.id);
      const a = await post(staff.qd, `/api/v1/rec/items/${it.id}/assign`, {
        version: cur.version,
        technicianId,
      });
      expect(a.status, a.text).toBe(200);
      for (const ev of ['start', 'finish']) {
        const c2 = (await order(staff.cv, o.id)).items.find((x: Row) => x.id === it.id);
        const r = await post(staff.th, `/api/v1/rec/items/${it.id}/${ev}`, { version: c2.version });
        expect(r.status, r.text).toBe(200);
      }
    }
  }

  async function passQc(staff: Staff, o: Row) {
    let cur = await order(staff.cv, o.id);
    expect(
      (await post(staff.cv, `/api/v1/rec/orders/${o.id}/submit-qc`, { version: cur.version }))
        .status,
    ).toBe(200);
    const list = (await get(staff.qd, `/api/v1/rec/orders/${o.id}/qc-checklist`)).json;
    cur = await order(staff.cv, o.id);
    const r = await post(staff.qd, `/api/v1/rec/orders/${o.id}/qc`, {
      version: cur.version,
      checks: list.checks.map((c: Row) => ({ code: c.code, ok: true })),
    });
    expect(r.status, r.text).toBe(200);
  }

  async function readyOrder(staff: Staff, vehicleId: string, items?: Row[], technicianId?: string) {
    const o = await openedOrder(staff.cv, vehicleId, items);
    await finishAll(staff, o.order, technicianId);
    await passQc(staff, o.order);
    return { ...o, order: await order(staff.cv, o.order.id) };
  }

  async function ensureShift(tn: string) {
    const r = await post(tn, '/api/v1/acc/shifts', {});
    expect([201, 409], r.text).toContain(r.status);
  }

  async function payFull(tn: string, orderId: string) {
    await ensureShift(tn);
    const bal = (await get(tn, `/api/v1/acc/orders/${orderId}`)).json.balance;
    const r = await call(tn, 'POST', `/api/v1/acc/orders/${orderId}/payments`, {
      kind: 'receipt',
      lines: [{ method: 'cash', amountVnd: bal.outstandingVnd }],
    });
    expect(r.status, r.text).toBe(201);
    return r.json as Row;
  }

  async function issueInvoice(tn: string, orderId: string) {
    const r = await post(tn, `/api/v1/ein/orders/${orderId}/invoices`, {});
    expect(r.status, r.text).toBe(201);
    return r.json as Row;
  }

  return {
    call,
    post,
    get,
    pub,
    customerWithVehicle,
    sentQuote,
    openedOrder,
    finishAll,
    passQc,
    readyOrder,
    ensureShift,
    payFull,
    issueInvoice,
    order,
  };
}

let inviteSeq = 0;
/**
 * A brand-new single-branch user created through the real invite and activation flow (FR-SYS-001), so a test has
 * staff that hold ONE assignment only. Returns the session cookie of a login at that branch.
 */
export async function newStaffUser(
  h: Harness,
  ownerCookie: string,
  role: string,
  branchId: string,
  tag: string,
) {
  const n = ++inviteSeq;
  const email = `${tag}${n}@iso.gmep.test`.toLowerCase();
  const password = 'valid-password-123';
  const made = await h.call('POST', '/api/v1/sys/users', {
    cookie: ownerCookie,
    key: uniqueKey('invite'),
    body: {
      email,
      employeeCode: `NV9${String(n).padStart(3, '0')}`,
      displayName: `${tag} ${role} ${branchId}`,
      assignments: [{ roleCode: role, branchId }],
    },
  });
  expect(made.status, made.text).toBe(201);
  const token = await h.latestToken(email, 'invitation');
  const act = await h.call('POST', '/api/v1/auth/activate', {
    body: { token, password, consent: true },
    headers: { 'x-forwarded-for': `10.77.${n}.1` },
  });
  expect(act.status, act.text).toBe(200);
  const login = await h.call('POST', '/api/v1/auth/login', {
    body: { identifier: email, password },
    headers: { 'x-forwarded-for': `10.77.${n}.2` },
  });
  expect(login.status, login.text).toBe(200);
  const cookie = login.headers
    .getSetCookie()
    .find((x) => x.startsWith('__Host-gmep_session='))!
    .split(';')[0]!;
  const pick = await h.call('PUT', '/api/v1/sys/scope', { cookie, body: { branchId } });
  expect([200, 409]).toContain(pick.status);
  return { cookie, userId: made.json.id as string };
}
