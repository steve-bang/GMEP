import { beforeAll, describe, expect, it } from 'vitest';
import { getDb } from '@/infrastructure/firestore/client';
import { businessDate } from '@/platform/format/date';
import { journey, type Row, uniqueKey } from '../helpers/journey';
import { backends, createHarness, type Harness } from './harness';

/**
 * Slice 2.8b: FR-REC-019 (capacity per day is effective-dated configuration; over capacity warns and the advisor may go
 * on), FR-REC-027 (calendar by day/week per branch, states pending/arrived/cancelled with a reason/no-show, advisor,
 * "Đã đến" opens the pre-filled intake once, walk-ins need no appointment), Discovery 13 (feature switched per branch:
 * no configuration = off), NFR-ISO-01 (branch and tenant), FR-SYS-003 (audit in the same transaction). The capacity
 * values come from the seed and are SAMPLES (minh họa): Q7 has 2 cars a day, the company 20, the second tenant none.
 */
const plusDays = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00.000Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

describe.each(backends)('REC appointments [%s]', (backend) => {
  let h: Harness;
  let j: ReturnType<typeof journey>;
  let cv: string;
  let ql: string;
  let qlTd: string;
  let th: string;
  let ownerB: string;
  let today: string;
  let seq = 0;

  beforeAll(async () => {
    h = await createHarness(backend);
    j = journey(h);
    cv = await h.loginAt('u_cv_q7', 'br_q7');
    ql = await h.loginAt('u_ql_q7', 'br_q7');
    qlTd = await h.loginAt('u_ql_td', 'br_td');
    th = await h.loginAt('u_th_q7', 'br_q7');
    ownerB = await h.loginAt('u_owner_b', 'br_d2_q7');
    today = businessDate(h.clock.now());
  });

  const rows = async (name: string): Promise<Row[]> =>
    backend === 'memory'
      ? ([...h.container.memory!.db.col(name).entries()].map(([id, v]) => ({ id, ...v })) as Row[])
      : ((await getDb(h.container.env).collection(name).get()).docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Row[]);

  const vehicle = async (cookie = cv) => {
    const n = ++seq;
    return j.customerWithVehicle(cookie, `APT${n}`, `51K-${String(300 + n)}.${String(10 + n)}`);
  };
  const book = (cookie: string, body: Row, key = uniqueKey('apt')) =>
    h.call('POST', '/api/v1/rec/appointments', { cookie, key, body });

  it('FR-REC-019/027: book at the working branch (LH number, pending), audited; the day calendar shows it with the capacity', async () => {
    const v = await vehicle();
    const date = plusDays(today, 1);
    const r = await book(cv, {
      vehicleId: v.vehicleId,
      date,
      time: '08:30',
      serviceType: 'maintenance',
      advisorId: 'u_cv_q7',
      note: 'Bảo dưỡng 10.000 km',
    });
    expect(r.status, r.text).toBe(201);
    expect(r.json).toMatchObject({
      status: 'pending',
      branchId: 'br_q7',
      date,
      overCapacity: false,
    });
    expect(r.json.number).toMatch(/^LH-/);
    const audit = (await rows('auditLogs')).filter(
      (a) => a.entityId === r.json.id && a.action === 'appointment.create',
    );
    expect(audit).toHaveLength(1);
    const cal = await j.get(cv, `/api/v1/rec/appointments?from=${date}&days=1`);
    expect(cal.status, cal.text).toBe(200);
    expect(cal.json).toMatchObject({ enabled: true, dailyCapacity: 2, branchId: 'br_q7' });
    expect(cal.json.items.map((x: Row) => x.id)).toContain(r.json.id);
    expect(cal.json.days[0]).toMatchObject({ date, booked: 1, capacity: 2, full: false });
    // the week view covers 7 days
    const week = await j.get(cv, `/api/v1/rec/appointments?from=${today}&days=7`);
    expect(week.json.days).toHaveLength(7);
  });

  it('FR-REC-019: over the configured capacity warns (capacity_exceeded) and the advisor may go on (flagged)', async () => {
    const date = plusDays(today, 3);
    for (let i = 0; i < 2; i++) {
      const v = await vehicle();
      const r = await book(cv, { vehicleId: v.vehicleId, date, time: `0${8 + i}:00` });
      expect(r.status, r.text).toBe(201);
    }
    const v = await vehicle();
    const warn = await book(cv, { vehicleId: v.vehicleId, date, time: '10:00' });
    expect(warn.status, warn.text).toBe(409);
    expect(warn.json.code ?? warn.json.type).toMatch(/capacity_exceeded/);
    const go = await book(cv, {
      vehicleId: v.vehicleId,
      date,
      time: '10:00',
      acknowledgeOverCapacity: true,
    });
    expect(go.status, go.text).toBe(201);
    expect(go.json.overCapacity).toBe(true);
    const cal = await j.get(cv, `/api/v1/rec/appointments?from=${date}&days=1`);
    expect(cal.json.days[0]).toMatchObject({ booked: 3, capacity: 2, over: true });
  });

  it('FR-REC-027: "Đã đến" opens ONE pre-filled intake (repeat by anyone returns the same one); walk-ins need no appointment', async () => {
    const v = await vehicle();
    const r = await book(cv, {
      vehicleId: v.vehicleId,
      date: today,
      time: '09:00',
      serviceType: 'maintenance',
      advisorId: 'u_ql_q7',
      note: 'Khách báo kêu phanh',
    });
    expect(r.status, r.text).toBe(201);
    const a1 = await h.call('POST', `/api/v1/rec/appointments/${r.json.id}/arrive`, {
      cookie: cv,
      key: uniqueKey('arr'),
      body: { version: r.json.version },
    });
    expect(a1.status, a1.text).toBe(200);
    expect(a1.json.appointment.status).toBe('arrived');
    expect(a1.json.intake).toMatchObject({
      status: 'draft',
      appointmentId: r.json.id,
      vehicleId: v.vehicleId,
      advisorId: 'u_ql_q7',
      serviceType: 'maintenance',
      customerRequest: 'Khách báo kêu phanh',
    });
    // another person presses again with another key: same intake, no second one
    const a2 = await h.call('POST', `/api/v1/rec/appointments/${r.json.id}/arrive`, {
      cookie: ql,
      key: uniqueKey('arr'),
      body: { version: r.json.version },
    });
    expect(a2.status, a2.text).toBe(200);
    expect(a2.json.intake.id).toBe(a1.json.intake.id);
    const intakes = (await rows('intakes')).filter((i) => i.appointmentId === r.json.id);
    expect(intakes).toHaveLength(1);
    expect(
      (await rows('auditLogs')).filter(
        (a) => a.entityId === r.json.id && a.action === 'appointment.arrive',
      ),
    ).toHaveLength(1);
    // final: cannot cancel an arrived appointment
    const c = await h.call('POST', `/api/v1/rec/appointments/${r.json.id}/cancel`, {
      cookie: cv,
      key: uniqueKey('c'),
      body: { version: a1.json.appointment.version, reason: 'Khách đổi ý' },
    });
    expect(c.status, c.text).toBe(409);
    // walk-in: an intake without appointment
    const w = await vehicle();
    const walk = await j.post(cv, '/api/v1/rec/intakes', { vehicleId: w.vehicleId });
    expect(walk.status, walk.text).toBe(201);
    expect(walk.json.appointmentId).toBeNull();
  });

  it('FR-REC-027: cancel needs a reason; no-show only from the day on; move and change advisor', async () => {
    const v = await vehicle();
    const future = plusDays(today, 5);
    const r = await book(cv, { vehicleId: v.vehicleId, date: future, time: '14:00' });
    expect(r.status, r.text).toBe(201);
    const ns = await h.call('POST', `/api/v1/rec/appointments/${r.json.id}/no-show`, {
      cookie: cv,
      key: uniqueKey('ns'),
      body: { version: r.json.version },
    });
    expect(ns.status, ns.text).toBe(409);
    const badAdvisor = await h.call('PATCH', `/api/v1/rec/appointments/${r.json.id}`, {
      cookie: cv,
      key: uniqueKey('p'),
      body: { version: r.json.version, advisorId: 'u_th_q7' },
    });
    expect(badAdvisor.status, badAdvisor.text).toBe(422);
    const moved = await h.call('PATCH', `/api/v1/rec/appointments/${r.json.id}`, {
      cookie: cv,
      key: uniqueKey('p'),
      body: { version: r.json.version, date: today, time: '16:00', advisorId: 'u_cv_q7' },
    });
    expect(moved.status, moved.text).toBe(200);
    expect(moved.json).toMatchObject({ date: today, time: '16:00', advisorId: 'u_cv_q7' });
    const noReason = await h.call('POST', `/api/v1/rec/appointments/${r.json.id}/cancel`, {
      cookie: cv,
      key: uniqueKey('c'),
      body: { version: moved.json.version },
    });
    expect(noReason.status).toBe(422);
    const ns2 = await h.call('POST', `/api/v1/rec/appointments/${r.json.id}/no-show`, {
      cookie: cv,
      key: uniqueKey('ns'),
      body: { version: moved.json.version },
    });
    expect(ns2.status, ns2.text).toBe(200);
    expect(ns2.json.status).toBe('no_show');

    const v2 = await vehicle();
    const r2 = await book(cv, { vehicleId: v2.vehicleId, date: future, time: '15:00' });
    const c = await h.call('POST', `/api/v1/rec/appointments/${r2.json.id}/cancel`, {
      cookie: cv,
      key: uniqueKey('c'),
      body: { version: r2.json.version, reason: 'Khách bận việc' },
    });
    expect(c.status, c.text).toBe(200);
    expect(c.json).toMatchObject({ status: 'cancelled', cancelReason: 'Khách bận việc' });
    // a past date cannot be booked
    const past = await book(cv, {
      vehicleId: v2.vehicleId,
      date: plusDays(today, -1),
      time: '08:00',
    });
    expect(past.status).toBe(422);
  });

  it('NFR-ISO-01 / RULE-012: another branch and another tenant never read or write a Q7 appointment; TH has no access', async () => {
    const v = await vehicle();
    const r = await book(cv, { vehicleId: v.vehicleId, date: plusDays(today, 2), time: '11:00' });
    expect(r.status, r.text).toBe(201);
    expect((await j.get(qlTd, `/api/v1/rec/appointments/${r.json.id}`)).status).toBe(404);
    expect((await j.get(qlTd, '/api/v1/rec/appointments?branchId=br_q7')).status).toBe(404);
    const tdCal = await j.get(qlTd, `/api/v1/rec/appointments?from=${plusDays(today, 2)}&days=1`);
    expect(tdCal.status, tdCal.text).toBe(200);
    expect(tdCal.text).not.toContain(r.json.id);
    const tdCancel = await h.call('POST', `/api/v1/rec/appointments/${r.json.id}/cancel`, {
      cookie: qlTd,
      key: uniqueKey('c'),
      body: { version: 1, reason: 'Thử chéo chi nhánh' },
    });
    expect(tdCancel.status).toBe(404);
    expect((await j.get(ownerB, `/api/v1/rec/appointments/${r.json.id}`)).status).toBe(404);
    expect((await j.get(th, '/api/v1/rec/appointments')).status).toBe(403);
  });

  it('Discovery 13: no appointment-policy in force = appointments off for that tenant/branch (no hard-coded default)', async () => {
    const cal = await j.get(ownerB, '/api/v1/rec/appointments');
    expect(cal.status, cal.text).toBe(200);
    expect(cal.json).toMatchObject({ enabled: false, items: [] });
    const r = await book(ownerB, { vehicleId: 'veh_x', date: plusDays(today, 1), time: '09:00' });
    expect(r.status, r.text).toBe(409);
    expect(r.text).toContain('appointments_disabled');
  });
});
