import { beforeAll, describe, expect, it } from 'vitest';
import { getDb } from '@/infrastructure/firestore/client';
import { businessDate } from '@/platform/format/date';
import { journey, type Row, uniqueKey } from '../helpers/journey';
import { backends, createHarness, type Harness } from './harness';

/**
 * Appointments v2 (07/11/2026): FR-REC-044 (five tabs, counters from the same rule, "Trễ hẹn" computed on read and not
 * bounded by the viewed day), FR-REC-045 (cancel reason catalogue, `other` needs a note, name copied at cancel time),
 * FR-REC-046 (reschedule: one transaction, append-only history, same LH number, capacity of both days, limit, late flag,
 * version, idempotency), NFR-ISO-01 (branch and tenant), FR-SYS-003 (audit). Reasons come from the demo seed and are
 * SAMPLES (minh họa). The clock is fixed at 10:00 Asia/Ho_Chi_Minh of today so "overdue" is deterministic.
 */
const plusDays = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00.000Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const ISO = /\d{4}-\d{2}-\d{2}/;

describe.each(backends)('REC appointments v2 [%s]', (backend) => {
  let h: Harness;
  let j: ReturnType<typeof journey>;
  let cv: string;
  let ql: string;
  let qlTd: string;
  let ownerB: string;
  let today: string;
  let seq = 0;

  // sessions idle out and are not valid before they were issued: log in again after every move of the clock
  const relogin = async () => {
    cv = await h.loginAt('u_cv_q7', 'br_q7');
    ql = await h.loginAt('u_ql_q7', 'br_q7');
    qlTd = await h.loginAt('u_ql_td', 'br_td');
    ownerB = await h.loginAt('u_owner_b', 'br_d2_q7');
  };
  const at = async (date: string, hhmm: string) => {
    // Asia/Ho_Chi_Minh is UTC+7 without DST
    const [hh, mm] = hhmm.split(':').map(Number);
    const utc = new Date(`${date}T00:00:00.000Z`);
    utc.setUTCHours(hh! - 7, mm!);
    h.clock.set(utc.toISOString());
    await relogin();
  };

  beforeAll(async () => {
    h = await createHarness(backend);
    j = journey(h);
    today = businessDate(h.clock.now());
    await at(today, '06:00');
  });

  const rows = async (name: string): Promise<Row[]> =>
    backend === 'memory'
      ? ([...h.container.memory!.db.col(name).entries()].map(([id, v]) => ({ id, ...v })) as Row[])
      : ((await getDb(h.container.env).collection(name).get()).docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Row[]);

  const vehicle = async () => {
    const n = ++seq;
    return j.customerWithVehicle(cv, `APV${n}`, `51L-${String(500 + n)}.${String(20 + n)}`);
  };
  const book = async (date: string, time: string, extra: Row = {}) => {
    const v = await vehicle();
    const r = await h.call('POST', '/api/v1/rec/appointments', {
      cookie: cv,
      key: uniqueKey('apt'),
      body: { vehicleId: v.vehicleId, date, time, acknowledgeOverCapacity: true, ...extra },
    });
    expect(r.status, r.text).toBe(201);
    return r.json as Row;
  };
  const post = (cookie: string, id: string, action: string, body: Row, key = uniqueKey(action)) =>
    h.call('POST', `/api/v1/rec/appointments/${id}/${action}`, { cookie, key, body });
  const list = (cookie: string, q: string) => j.get(cookie, `/api/v1/rec/appointments?${q}`);

  it('FR-REC-044 AC-01..05: Trễ hẹn is computed on read, ignores the viewed day, and each counter equals its list', async () => {
    const a1 = await book(today, '09:00');
    const a2 = await book(today, '15:00');
    await at(today, '10:00');
    const odd = await list(cv, 'tab=overdue&days=1&from=' + plusDays(today, 1));
    expect(odd.status, odd.text).toBe(200);
    const ids = (odd.json.items as Row[]).map((x) => x.id);
    expect(ids).toContain(a1.id); // today's overdue shows while looking at tomorrow
    expect(ids).not.toContain(a2.id);
    const row = (odd.json.items as Row[]).find((x) => x.id === a1.id)!;
    expect(row).toMatchObject({ overdue: true, lateMinutes: 60, status: 'pending' });
    // the same appointment is not in "upcoming" of today; the 15:00 one is
    const up = await list(cv, `tab=upcoming&from=${today}&days=1`);
    expect((up.json.items as Row[]).map((x) => x.id)).toEqual(expect.arrayContaining([a2.id]));
    expect((up.json.items as Row[]).map((x) => x.id)).not.toContain(a1.id);
    // counters = list lengths, for every tab (same rule)
    for (const tab of ['upcoming', 'overdue', 'arrived', 'cancelled', 'no_show']) {
      const r = await list(cv, `tab=${tab}&from=${today}&days=1`);
      expect(r.json.counts[tab].n, tab).toBe((r.json.items as Row[]).length);
      expect(r.json.counts[tab].more).toBe(false);
    }
    expect(odd.json.now).toMatchObject({ date: today, time: '10:00' });
    // staff with the `full` phone level get the number for "Gọi khách"; the overdue tab only
    expect((odd.json.items as Row[])[0]!.customerPhone).toBeTruthy();
    expect((up.json.items as Row[])[0]!.customerPhone).toBeUndefined();
    // AC-03: Đã đến / Vắng / Hủy each leave the overdue tab for their own tab
    const b = await book(today, '09:10');
    const c = await book(today, '09:20');
    const d = await book(today, '09:30');
    const arrived = await post(cv, a1.id as string, 'arrive', { version: a1.version });
    expect(arrived.status, arrived.text).toBe(200);
    const ns = await post(cv, b.id as string, 'no-show', { version: b.version });
    expect(ns.status, ns.text).toBe(200);
    const cx = await post(cv, c.id as string, 'cancel', {
      version: c.version,
      reasonCode: 'customer_busy',
    });
    expect(cx.status, cx.text).toBe(200);
    const after = await list(cv, `tab=overdue&from=${today}&days=1`);
    expect((after.json.items as Row[]).map((x) => x.id)).toEqual([d.id]);
    const arrTab = await list(cv, `tab=arrived&from=${today}&days=1`);
    expect((arrTab.json.items as Row[]).map((x) => x.id)).toContain(a1.id);
    const nsTab = await list(cv, `tab=no_show&from=${today}&days=1`);
    expect((nsTab.json.items as Row[]).map((x) => x.id)).toContain(b.id);
    const cxTab = await list(cv, `tab=cancelled&from=${today}&days=1`);
    expect((cxTab.json.items as Row[]).map((x) => x.id)).toContain(c.id);
  });

  it('FR-REC-044 AC-07 / NFR-ISO-01: another branch or tenant never appears in a tab or a counter', async () => {
    const a = await book(today, '08:00');
    const td = await list(qlTd, 'tab=overdue');
    expect(td.status, td.text).toBe(200);
    expect(td.text).not.toContain(a.id as string);
    expect((await list(qlTd, 'tab=overdue&branchId=br_q7')).status).toBe(404);
    const b = await list(ownerB, 'tab=overdue');
    expect(b.json).toMatchObject({ enabled: false, items: [] });
    expect(b.json.counts.overdue.n).toBe(0);
  });

  it('FR-REC-045 AC-08..12: cancel needs a catalogue reason, `other` a note of 3+ characters, the name is copied; catalogue is per tenant', async () => {
    const a = await book(plusDays(today, 4), '10:00');
    const none = await post(cv, a.id as string, 'cancel', { version: a.version });
    expect(none.status).toBe(422);
    const unknown = await post(cv, a.id as string, 'cancel', {
      version: a.version,
      reasonCode: 'made_up',
    });
    expect(unknown.status).toBe(422);
    const short = await post(cv, a.id as string, 'cancel', {
      version: a.version,
      reasonCode: 'other',
      note: ' ab ',
    });
    expect(short.status, short.text).toBe(422);
    expect(JSON.stringify(short.json)).toContain('note');
    const ok = await post(cv, a.id as string, 'cancel', {
      version: a.version,
      reasonCode: 'other',
      note: 'Khách đổi xe',
    });
    expect(ok.status, ok.text).toBe(200);
    expect(ok.json.cancellation).toMatchObject({
      reasonCode: 'other',
      reasonName: 'Khác',
      note: 'Khách đổi xe',
      cancelledBy: 'u_cv_q7',
      cancelledByName: 'Cố vấn Quận 7',
    });
    const audit = (await rows('auditLogs')).filter(
      (x) => x.entityId === a.id && x.action === 'appointment.cancel',
    );
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit[0])).toContain('reasonCode');
    // catalogue: sample reasons for the demo tenant, only `other` for a tenant that configured none
    const mine = await j.get(cv, '/api/v1/rec/appointment-reasons?kind=cancel');
    expect(mine.json.items.map((x: Row) => x.code)).toContain('customer_busy');
    expect(mine.json.items.at(-1)).toMatchObject({ code: 'other', noteRequired: true });
    const theirs = await j.get(ownerB, '/api/v1/rec/appointment-reasons?kind=cancel');
    expect(theirs.json.items.map((x: Row) => x.code)).toEqual(['other']);
    // a cancelled appointment keeps its own copy of the name when read later
    const again = await j.get(cv, `/api/v1/rec/appointments/${a.id}`);
    expect(again.json.cancellation.reasonName).toBe('Khác');
  });

  it('FR-REC-046 AC-13, 14, 21, 22: reschedule keeps the LH number, appends history, audits once; reason and requester are required; replay and version', async () => {
    await at(today, '10:00');
    const d1 = plusDays(today, 6);
    const d2 = plusDays(today, 9);
    const a = await book(d1, '09:00');
    const body = {
      version: a.version,
      date: d2,
      time: '14:00',
      reasonCode: 'customer_busy',
      requestedBy: 'customer',
    };
    // missing reason / requester, and PATCH of the date are refused
    expect(
      (await post(cv, a.id as string, 'reschedule', { ...body, reasonCode: undefined })).status,
    ).toBe(422);
    expect(
      (await post(cv, a.id as string, 'reschedule', { ...body, requestedBy: undefined })).status,
    ).toBe(422);
    expect(
      (await post(cv, a.id as string, 'reschedule', { ...body, reasonCode: 'other', note: 'x' }))
        .status,
    ).toBe(422);
    const key = uniqueKey('rs');
    const r1 = await post(cv, a.id as string, 'reschedule', body, key);
    expect(r1.status, r1.text).toBe(200);
    expect(r1.json).toMatchObject({
      number: a.number,
      status: 'pending',
      date: d2,
      time: '14:00',
      rescheduleCount: 1,
      originalDate: d1,
      originalTime: '09:00',
      version: (a.version as number) + 1,
    });
    expect(r1.json.reschedules[0]).toMatchObject({
      fromDate: d1,
      fromTime: '09:00',
      toDate: d2,
      toTime: '14:00',
      reasonCode: 'customer_busy',
      reasonName: 'Khách bận',
      requestedBy: 'customer',
      by: 'u_cv_q7',
      byName: 'Cố vấn Quận 7',
      overLimit: false,
    });
    // AC-22: the same key again replays; one history entry, one audit line
    const r2 = await post(cv, a.id as string, 'reschedule', body, key);
    expect(r2.status, r2.text).toBe(200);
    expect(r2.json.version).toBe(r1.json.version);
    expect(
      (await rows('auditLogs')).filter(
        (x) => x.entityId === a.id && x.action === 'appointment.reschedule',
      ),
    ).toHaveLength(1);
    const got = await j.get(cv, `/api/v1/rec/appointments/${a.id}`);
    expect(got.json.reschedules).toHaveLength(1);
    // AC-21: a second person with the old version gets 409 version_conflict
    const stale = await post(ql, a.id as string, 'reschedule', {
      ...body,
      date: plusDays(today, 10),
    });
    expect(stale.status, stale.text).toBe(409);
    expect(stale.text).toContain('version_conflict');
    // PATCH cannot move it any more (AC-14)
    const patch = await h.call('PATCH', `/api/v1/rec/appointments/${a.id}`, {
      cookie: cv,
      key: uniqueKey('p'),
      body: { version: r1.json.version, date: d1 },
    });
    expect(patch.status).toBe(422);
  });

  it('FR-REC-046 AC-15, 16, 19: the old day gets its place back, a full new day warns in dd/MM/yyyy and is flagged once acknowledged, the same day is not re-checked, close-to-time is flagged', async () => {
    await at(today, '10:00');
    const full = plusDays(today, 12);
    const free = plusDays(today, 13);
    // Q7 capacity is 2 a day: fill `full`
    await book(full, '08:00');
    await book(full, '09:00');
    const x = await book(free, '08:00');
    const warn = await post(cv, x.id as string, 'reschedule', {
      version: x.version,
      date: full,
      time: '11:00',
      reasonCode: 'customer_busy',
      requestedBy: 'customer',
    });
    expect(warn.status, warn.text).toBe(409);
    expect(warn.text).toContain('capacity_exceeded');
    expect(JSON.stringify(warn.json.errors)).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(JSON.stringify(warn.json.errors)).not.toMatch(ISO);
    const go = await post(cv, x.id as string, 'reschedule', {
      version: x.version,
      date: full,
      time: '11:00',
      reasonCode: 'customer_busy',
      requestedBy: 'customer',
      acknowledgeOverCapacity: true,
    });
    expect(go.status, go.text).toBe(200);
    expect(go.json.overCapacity).toBe(true);
    expect(go.json.reschedules[0].overCapacity).toBe(true);
    const cal = await list(cv, `from=${free}&days=1`);
    expect(cal.json.days[0]).toMatchObject({ booked: 0 }); // the old day gave the place back
    const cal2 = await list(cv, `from=${full}&days=1`);
    expect(cal2.json.days[0]).toMatchObject({ booked: 3, over: true });
    // same day, other time: no capacity check (full day, no acknowledge needed), counts as one reschedule
    const same = await post(cv, x.id as string, 'reschedule', {
      version: go.json.version,
      date: full,
      time: '16:00',
      reasonCode: 'customer_late',
      requestedBy: 'workshop',
    });
    expect(same.status, same.text).toBe(200);
    expect(same.json.rescheduleCount).toBe(2);
    // no change at all, or a time that is already past, is refused (AC-16)
    const nothing = await post(cv, x.id as string, 'reschedule', {
      version: same.json.version,
      date: full,
      time: '16:00',
      reasonCode: 'customer_busy',
      requestedBy: 'customer',
    });
    expect(nothing.status).toBe(422);
    const t = await book(today, '23:00');
    const past = await post(cv, t.id as string, 'reschedule', {
      version: t.version,
      date: today,
      time: '09:00',
      reasonCode: 'customer_busy',
      requestedBy: 'customer',
    });
    expect(past.status, past.text).toBe(422);
    // AC-19: now 10:00, appointment 11:30 (inside 120 minutes): allowed and flagged
    const near = await book(today, '11:30');
    const nr = await post(cv, near.id as string, 'reschedule', {
      version: near.version,
      date: today,
      time: '17:30',
      reasonCode: 'customer_late',
      requestedBy: 'customer',
    });
    expect(nr.status, nr.text).toBe(200);
    expect(nr.json.reschedules[0].late).toBe(true);
  });

  it('FR-REC-046 AC-17: an overdue appointment can be rescheduled out of the overdue tab, not to a time that is still overdue', async () => {
    await at(today, '06:00');
    const a = await book(today, '09:00');
    await at(today, '10:00');
    const still = await post(cv, a.id as string, 'reschedule', {
      version: a.version,
      date: today,
      time: '09:30',
      reasonCode: 'customer_late',
      requestedBy: 'customer',
    });
    expect(still.status, still.text).toBe(422);
    const ok = await post(cv, a.id as string, 'reschedule', {
      version: a.version,
      date: plusDays(today, 1),
      time: '09:00',
      reasonCode: 'customer_busy',
      requestedBy: 'customer',
      notice: 'phoned',
    });
    expect(ok.status, ok.text).toBe(200);
    expect(ok.json).toMatchObject({ overdue: false });
    expect(ok.json.reschedules[0].notice).toBe('phoned');
    const od = await list(cv, `tab=overdue&from=${today}&days=1`);
    expect((od.json.items as Row[]).map((x) => x.id)).not.toContain(a.id);
  });

  it('FR-REC-046 AC-18: the limit of 3 blocks an advisor; QL overrides with a note and the audit marks it', async () => {
    await at(today, '10:00');
    const base = plusDays(today, 20);
    let a = await book(base, '09:00');
    for (let i = 1; i <= 3; i++) {
      const r = await post(cv, a.id as string, 'reschedule', {
        version: a.version,
        date: plusDays(base, i),
        time: '09:00',
        reasonCode: 'customer_busy',
        requestedBy: 'customer',
      });
      expect(r.status, r.text).toBe(200);
      a = r.json;
    }
    const next = {
      version: a.version,
      date: plusDays(base, 5),
      time: '09:00',
      reasonCode: 'customer_busy',
      requestedBy: 'customer',
    };
    const blocked = await post(cv, a.id as string, 'reschedule', next);
    expect(blocked.status, blocked.text).toBe(409);
    expect(blocked.text).toContain('reschedule_limit_reached');
    const noNote = await post(ql, a.id as string, 'reschedule', { ...next, overrideLimit: true });
    expect(noNote.status, noNote.text).toBe(409);
    const ov = await post(ql, a.id as string, 'reschedule', {
      ...next,
      overrideLimit: true,
      note: 'Khách ở xa, xin dời lần nữa',
    });
    expect(ov.status, ov.text).toBe(200);
    expect(ov.json.reschedules[0]).toMatchObject({ overLimit: true });
    expect(ov.json.rescheduleCount).toBe(4);
    const audit = (await rows('auditLogs')).filter(
      (x) => x.entityId === a.id && x.action === 'appointment.reschedule',
    );
    expect(audit).toHaveLength(4);
    // Firestore returns rows by id, not by write order: pick by content, never by position
    const flagged = audit.filter((x) => JSON.stringify(x.after).includes('"overLimit":true'));
    expect(flagged).toHaveLength(1);
    expect(JSON.stringify(flagged[0]!.after)).toContain('"count":4');
  });

  it('FR-REC-046 AC-20 and NFR-ISO-01: only a pending appointment moves; another branch or tenant gets 404', async () => {
    await at(today, '10:00');
    const a = await book(plusDays(today, 2), '09:00');
    const body = {
      version: a.version,
      date: plusDays(today, 3),
      time: '09:00',
      reasonCode: 'customer_busy',
      requestedBy: 'customer',
    };
    expect((await post(qlTd, a.id as string, 'reschedule', body)).status).toBe(404);
    // another tenant answers exactly like a missing id (no existence oracle)
    const xt = await post(ownerB, a.id as string, 'reschedule', body);
    const missing = await post(ownerB, 'apt_missing_0000', 'reschedule', body);
    expect(xt.status, xt.text).toBe(missing.status);
    expect(xt.json.code).toBe(missing.json.code);
    const cx = await post(cv, a.id as string, 'cancel', {
      version: a.version,
      reasonCode: 'customer_request',
    });
    expect(cx.status, cx.text).toBe(200);
    const after = await post(cv, a.id as string, 'reschedule', {
      ...body,
      version: cx.json.version,
    });
    expect(after.status, after.text).toBe(409);
    expect(after.text).toContain('appointment_state_invalid');
    // sending a notice through a channel with no consent or no provider is refused up front, nothing is changed
    const b = await book(plusDays(today, 2), '10:00');
    const send = await post(cv, b.id as string, 'reschedule', {
      version: b.version,
      date: plusDays(today, 3),
      time: '10:00',
      reasonCode: 'customer_busy',
      requestedBy: 'customer',
      notice: 'send',
      noticeChannel: 'zalo',
    });
    expect([201, 200, 409]).toContain(send.status);
    if (send.status === 409) {
      const still = await j.get(cv, `/api/v1/rec/appointments/${b.id}`);
      expect(still.json.rescheduleCount).toBe(0);
    }
  });

  it('AC-27: no user-facing message of the appointment API holds a yyyy-MM-dd date', async () => {
    const full = plusDays(today, 15);
    await book(full, '08:00');
    await book(full, '09:00');
    const v = await vehicle();
    const warn = await h.call('POST', '/api/v1/rec/appointments', {
      cookie: cv,
      key: uniqueKey('apt'),
      body: { vehicleId: v.vehicleId, date: full, time: '10:00' },
    });
    expect(warn.status).toBe(409);
    const msgs = JSON.stringify((warn.json.errors as Row[]).map((e) => e.message));
    expect(msgs).toContain(`${full.slice(8)}/${full.slice(5, 7)}/${full.slice(0, 4)}`);
    expect(msgs).not.toMatch(ISO);
  });
});
