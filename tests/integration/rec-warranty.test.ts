import { beforeAll, describe, expect, it } from 'vitest';
import { getDb } from '@/infrastructure/firestore/client';
import { businessDate } from '@/platform/format/date';
import { warrantyRecordId } from '@/modules/rec';
import { journey, type Row, type Staff, uniqueKey } from '../helpers/journey';
import { backends, createHarness, type Harness } from './harness';

/**
 * Slice 2.8b: FR-REC-018 (warranty record per delivered order, term per item from the effective-dated `warranty-term`
 * in force on the handover day, warranty intake linked to the origin order), FR-REC-036 (cross-branch: projection P4
 * white list, origin order never opened, cross-branch opening only when `warranty-policy` allows it; Q77 open: the
 * strict default refuses), FR-CRM-016 (coverage valid/expired), RULE-012, FR-SYS-003. Terms and the Thủ Đức policy come
 * from the seed and are SAMPLES (minh họa): maintenance 90 days or 5,000 km; Thủ Đức may open, bearer = origin branch.
 */
const plusDays = (d: string, n: number) => {
  const x = new Date(`${d}T00:00:00.000Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

describe.each(backends)('REC warranty [%s]', (backend) => {
  let h: Harness;
  let j: ReturnType<typeof journey>;
  let staff: Staff;
  let qlTd: string;
  let ownerB: string;
  let today: string;
  let delivered: { orderId: string; vehicleId: string; customerId: string; recordId: string };

  const rows = async (name: string): Promise<Row[]> =>
    backend === 'memory'
      ? ([...h.container.memory!.db.col(name).entries()].map(([id, v]) => ({ id, ...v })) as Row[])
      : ((await getDb(h.container.env).collection(name).get()).docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Row[]);

  beforeAll(async () => {
    h = await createHarness(backend);
    j = journey(h);
    staff = {
      cv: await h.loginAt('u_cv_q7', 'br_q7'),
      qd: await h.loginAt('u_qd_q7', 'br_q7'),
      th: await h.loginAt('u_th_q7', 'br_q7'),
      tn: await h.loginAt('u_tn_q7', 'br_q7'),
    };
    qlTd = await h.loginAt('u_ql_td', 'br_td');
    ownerB = await h.loginAt('u_owner_b', 'br_d2_q7');
    today = businessDate(h.clock.now());
    const c = await j.customerWithVehicle(staff.cv, 'WAR1', '51W-901.01');
    const ro = await j.readyOrder(staff, c.vehicleId);
    await j.payFull(staff.tn, ro.order.id);
    const cur = await j.order(staff.cv, ro.order.id);
    const hv = await j.post(staff.cv, `/api/v1/rec/orders/${ro.order.id}/handover`, {
      version: cur.version,
      receiverName: 'Nguyễn Văn An',
      confirmation: 'screen',
      belongingsReturned: true,
      oldPartsReturned: true,
      km: 900_000,
    });
    expect(hv.status, hv.text).toBe(200);
    delivered = {
      orderId: ro.order.id,
      vehicleId: c.vehicleId,
      customerId: c.customerId,
      recordId: warrantyRecordId('tnt_demo', ro.order.id),
    };
  });

  it('FR-REC-018 / RULE-019: handover writes ONE warranty record with the term in force that day (90 days or 5,000 km, minh họa)', async () => {
    const recs = (await rows('warranties')).filter((r) => r.orderId === delivered.orderId);
    expect(recs).toHaveLength(1);
    const r = recs[0]!;
    expect(r).toMatchObject({ branchId: 'br_q7', startDate: today, startKm: 900_000 });
    expect(r.items).toHaveLength(2);
    for (const i of r.items as Row[]) {
      expect(i.expiresOn).toBe(plusDays(today, 90));
      expect(i.expiresAtKm).toBe(905_000);
      expect(i.termVersionId).toBeTruthy();
      expect(i.technicianId).toBe('u_th_q7');
    }
    // white list: no money, contact or note on the projection
    expect(Object.keys(r).some((k) => /vnd|phone|note|price|discount/i.test(k))).toBe(false);
  });

  it('FR-CRM-016: the origin branch sees the coverage in full (order id, technician) and status valid', async () => {
    const r = await j.get(staff.cv, `/api/v1/rec/warranties?vehicleId=${delivered.vehicleId}`);
    expect(r.status, r.text).toBe(200);
    expect(r.json.items).toHaveLength(1);
    expect(r.json.items[0]).toMatchObject({ own: true, orderId: delivered.orderId });
    expect(r.json.items[0].items[0]).toMatchObject({ status: 'valid', technicianId: 'u_th_q7' });
  });

  it('FR-REC-036 / P4: another branch sees nothing until the car is related, then the white list only (no order id, no technician)', async () => {
    expect(
      (await j.get(qlTd, `/api/v1/rec/warranties?vehicleId=${delivered.vehicleId}`)).status,
    ).toBe(404);
    const rel = await h.call('POST', `/api/v1/crm/customers/${delivered.customerId}/relate`, {
      cookie: qlTd,
      key: uniqueKey('rel'),
      body: {},
    });
    expect(rel.status, rel.text).toBe(200);
    const r = await j.get(qlTd, `/api/v1/rec/warranties?vehicleId=${delivered.vehicleId}`);
    expect(r.status, r.text).toBe(200);
    const rec = r.json.items[0];
    expect(rec).toMatchObject({ own: false, orderId: null, branchName: expect.any(String) });
    expect(rec.items[0].technicianId).toBeNull();
    expect(r.text).not.toContain(delivered.orderId);
    // the origin order itself stays closed to the other branch
    expect((await j.get(qlTd, `/api/v1/rec/orders/${delivered.orderId}`)).status).toBe(404);
  });

  it('FR-REC-018/036: warranty intake linked to the origin order; strict default refuses another branch, a branch policy allows it and records the bearer (Q77)', async () => {
    const rec0 = (await rows('warranties')).find((r) => r.orderId === delivered.orderId)!;
    const itemId = rec0.items[0].itemId as string;
    // origin branch: always allowed, bearer = performing branch (no policy version at Q7 = strict default)
    const own = await h.call('POST', '/api/v1/rec/warranties/open', {
      cookie: staff.cv,
      key: uniqueKey('w'),
      body: { recordId: delivered.recordId, itemKeys: ['1'], note: 'Kêu lại sau thay' },
    });
    expect(own.status, own.text).toBe(201);
    expect(own.json.warranty).toMatchObject({
      originOrderId: delivered.orderId,
      crossBranch: false,
      costBearer: 'performing_branch',
      itemIds: [itemId],
    });
    expect(own.json.customerRequest).toContain('Bảo hành');
    expect(
      (await rows('auditLogs')).filter(
        (a) => a.entityId === own.json.id && a.action === 'intake.warranty_open',
      ),
    ).toHaveLength(1);
    // Thủ Đức has a sample branch policy allowing cross-branch work, bearer = origin branch
    const td = await h.call('POST', '/api/v1/rec/warranties/open', {
      cookie: qlTd,
      key: uniqueKey('w'),
      body: { recordId: delivered.recordId, itemKeys: ['1'] },
    });
    expect(td.status, td.text).toBe(201);
    expect(td.json.warranty).toMatchObject({
      crossBranch: true,
      costBearer: 'origin_branch',
      originOrderId: null,
    });
    expect(td.text).not.toContain(delivered.orderId);
    // unknown item = not found; another tenant = not found
    const bad = await h.call('POST', '/api/v1/rec/warranties/open', {
      cookie: staff.cv,
      key: uniqueKey('w'),
      body: { recordId: delivered.recordId, itemKeys: ['99'] },
    });
    expect(bad.status).toBe(404);
    const other = await h.call('POST', '/api/v1/rec/warranties/open', {
      cookie: ownerB,
      key: uniqueKey('w'),
      body: { recordId: delivered.recordId, itemKeys: ['1'] },
    });
    expect([403, 404]).toContain(other.status);
  });

  it('FR-REC-036 / Q77: without a branch policy the strict default refuses cross-branch warranty work', async () => {
    // Q7 has no warranty-policy version: a Q7 advisor opening a record of Thủ Đức is cross-branch (record placed directly)
    const recs = await rows('warranties');
    const fake: Row = {
      ...recs.find((r) => r.orderId === delivered.orderId)!,
      branchId: 'br_td',
      branchName: 'Thủ Đức',
      orderId: 'ro_fake_td',
    };
    const data: Row = { ...fake };
    delete data.id;
    if (backend === 'memory') h.container.memory!.db.col('warranties').set('war_fake_td', data);
    else await getDb(h.container.env).collection('warranties').doc('war_fake_td').set(data);
    const r = await h.call('POST', '/api/v1/rec/warranties/open', {
      cookie: staff.cv,
      key: uniqueKey('w'),
      body: { recordId: 'war_fake_td', itemKeys: ['1'] },
    });
    expect(r.status, r.text).toBe(409);
    expect(r.text).toContain('warranty_cross_branch_not_allowed');
  });
});
