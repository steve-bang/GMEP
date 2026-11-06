import { beforeAll, describe, expect, it } from 'vitest';
import { DEMO_PASSWORD } from '@/infrastructure/seed/demo';
import { getDb } from '@/infrastructure/firestore/client';
import { branchesScope } from '@/platform/scope/scope';
import { businessDate } from '@/platform/format/date';
import { prepareCancel, prepareQcPass } from '@/modules/hrm';
import type { Actor } from '@/platform/rbac/rbac';
import { journey, type Row, type Staff, uniqueKey } from '../helpers/journey';
import { backends, createHarness, type Harness } from './harness';

/**
 * Slice 2.6a: FR-HRM-001 (staff record, personal data by role), 005/007 (labor only after QC, hours from the time
 * events), 006/015/020 (method resolved from effective-dated configuration, priority order, rule version kept on the
 * line), 008 (rework, cancel after recording), RULE-010 (lines are appended, a cancel reverses), RULE-038, NFR-ISO-01
 * (branch and tenant), FR-SYS-003 (audit in the same transaction). The configuration rows come from the seed and are
 * SAMPLES ("minh họa"): the client's formula is open (Q73), so UAT-11 stays open and these tests prove the mechanism.
 */
describe.each(backends)('HRM labor core [%s]', (backend) => {
  let h: Harness;
  let j: ReturnType<typeof journey>;
  let staff: Staff;
  let ql: string;
  let owner: string;
  let ownerB: string;
  let plateSeq = 0;

  beforeAll(async () => {
    h = await createHarness(backend);
    j = journey(h);
    staff = {
      cv: await h.loginAt('u_cv_q7', 'br_q7'),
      qd: await h.loginAt('u_qd_q7', 'br_q7'),
      th: await h.loginAt('u_th_q7', 'br_q7'),
      tn: await h.loginAt('u_tn_q7', 'br_q7'),
      tk: await h.loginAt('u_tk_q7', 'br_q7'),
      kt: await h.loginAt('u_kt', 'br_q7'),
    };
    ql = await h.loginAt('u_ql_q7', 'br_q7');
    owner = await h.loginAt('u_owner', 'br_q7');
    ownerB = await h.loginAt('u_owner_b', 'br_d2_q7');
  });

  const rows = async (name: string): Promise<Row[]> =>
    backend === 'memory'
      ? ([...h.container.memory!.db.col(name).entries()].map(([id, v]) => ({ id, ...v })) as Row[])
      : ((await getDb(h.container.env).collection(name).get()).docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Row[]);

  async function newVehicle() {
    const n = ++plateSeq;
    return j.customerWithVehicle(staff.cv, `HRM${n}`, `51H-${String(100 + n)}.${String(10 + n)}`);
  }
  const labor = async (orderId: string, cookie = ql) =>
    (await j.get(cookie, `/api/v1/hrm/labor/orders/${orderId}`)).json as Row;

  async function qcBody(orderId: string, failFirst = false, returnItemIds: string[] = []) {
    const list = (await j.get(staff.qd, `/api/v1/rec/orders/${orderId}/qc-checklist`)).json;
    const cur = await j.order(staff.cv, orderId);
    return {
      version: cur.version,
      checks: list.checks.map((c: Row, i: number) =>
        failFirst && i === 0
          ? { code: c.code, ok: false, note: 'Chưa đạt' }
          : { code: c.code, ok: true },
      ),
      returnItemIds,
    };
  }

  it('FR-HRM-007: a finished item waits for QC ("chờ QC") and earns nothing; QC pass records labor from the sample rule (minh họa)', async () => {
    const v = await newVehicle();
    const o = await j.openedOrder(staff.cv, v.vehicleId);
    await j.finishAll(staff, o.order);
    const before = await labor(o.order.id);
    expect(before.lines).toEqual([]);
    expect(before.pending.map((p: Row) => p.status)).toEqual(['pending_qc', 'pending_qc']);

    await j.passQc(staff, o.order);
    const after = await labor(o.order.id);
    expect(after.pending).toEqual([]);
    expect(after.lines).toHaveLength(2);
    const byNo = Object.fromEntries(after.lines.map((l: Row) => [l.itemNo, l]));
    // sample rule: standard_hours at 100.000 VND/h, position coefficient 1,2 (mechanic4); standard 30 and 90 minutes
    expect(byNo[1]).toMatchObject({
      kind: 'earned',
      status: 'recorded',
      method: 'standard_hours',
      standardMinutes: 30,
      convertedMinutes: 36,
      amountVnd: 60_000,
      technicianId: 'u_th_q7',
      positionCode: 'mechanic4',
      warnings: [],
    });
    expect(byNo[2]).toMatchObject({ convertedMinutes: 108, amountVnd: 180_000 });
    expect(byNo[1].ruleVersionId).toContain('labor-method');
    expect(after.totals).toMatchObject({ amountVnd: 240_000, convertedMinutes: 144 });
    // FR-SYS-003: the recording is in the audit trail of the same QC transaction
    const audits = (await rows('auditLogs')).filter(
      (a) => a.entityType === 'laborSheet' && a.entityId === o.order.id,
    );
    expect(audits.map((a) => a.action)).toEqual(['labor.record']);
  });

  it('RULE-038 / idempotency: a replayed QC request writes no second set of lines', async () => {
    const v = await newVehicle();
    const o = await j.openedOrder(staff.cv, v.vehicleId);
    await j.finishAll(staff, o.order);
    const cur = await j.order(staff.cv, o.order.id);
    expect(
      (
        await j.post(staff.cv, `/api/v1/rec/orders/${o.order.id}/submit-qc`, {
          version: cur.version,
        })
      ).status,
    ).toBe(200);
    const body = await qcBody(o.order.id);
    const key = uniqueKey('qc-replay');
    const first = await j.call(staff.qd, 'POST', `/api/v1/rec/orders/${o.order.id}/qc`, body, key);
    expect(first.status, first.text).toBe(200);
    const again = await j.call(staff.qd, 'POST', `/api/v1/rec/orders/${o.order.id}/qc`, body, key);
    expect(again.headers.get('idempotent-replayed')).toBe('true');
    const l = await labor(o.order.id);
    expect(l.lines).toHaveLength(2);
    expect(new Set(l.lines.map((x: Row) => x.id)).size).toBe(2);
    // a second QC on an order already past QC is refused, labor stays
    const late = await j.call(staff.qd, 'POST', `/api/v1/rec/orders/${o.order.id}/qc`, body);
    expect(late.status).toBeGreaterThanOrEqual(400);
    expect((await labor(o.order.id)).lines).toHaveLength(2);
  });

  it('FR-HRM-007/008: a QC return earns nothing and leaves a marker; the next pass pays once and links to the earlier line', async () => {
    const v = await newVehicle();
    const o = await j.openedOrder(staff.cv, v.vehicleId);
    await j.finishAll(staff, o.order);
    const cur0 = await j.order(staff.cv, o.order.id);
    await j.post(staff.cv, `/api/v1/rec/orders/${o.order.id}/submit-qc`, { version: cur0.version });
    const item1 = (await j.order(staff.cv, o.order.id)).items.find((x: Row) => x.no === 1) as Row;
    const fail = await j.post(
      staff.qd,
      `/api/v1/rec/orders/${o.order.id}/qc`,
      await qcBody(o.order.id, true, [item1.id]),
    );
    expect(fail.status, fail.text).toBe(200);
    const afterFail = await labor(o.order.id);
    expect(afterFail.lines).toHaveLength(1);
    expect(afterFail.lines[0]).toMatchObject({
      kind: 'qc_returned',
      status: 'qc_returned',
      amountVnd: 0,
      itemNo: 1,
    });
    expect(afterFail.totals.amountVnd).toBe(0);

    // the technician redoes item 1, the order goes back to QC and passes
    for (const ev of ['start', 'finish']) {
      const cur = (await j.order(staff.cv, o.order.id)).items.find((x: Row) => x.no === 1) as Row;
      const r = await j.post(staff.th, `/api/v1/rec/items/${cur.id}/${ev}`, {
        version: cur.version,
      });
      expect(r.status, r.text).toBe(200);
    }
    await j.passQc(staff, o.order);
    const done = await labor(o.order.id);
    const earned = done.lines.filter((l: Row) => l.kind === 'earned');
    expect(earned).toHaveLength(2);
    const e1 = earned.find((l: Row) => l.itemNo === 1);
    expect(e1.reworkOfLineId).toBe(afterFail.lines[0].id);
    expect(e1.qcRun).toBe(2);
    expect(done.totals.amountVnd).toBe(240_000);
  });

  it('FR-HRM-008 / RULE-010: cancelling after labor was recorded appends opposite lines; the originals stay; replay adds nothing', async () => {
    const v = await newVehicle();
    const ro = await j.readyOrder(staff, v.vehicleId);
    const before = await labor(ro.order.id);
    expect(before.totals.amountVnd).toBe(240_000);
    const order = (await h.container.rec.orders.get(
      branchesScope('tnt_demo', ['br_q7']),
      ro.order.id,
    ))!;
    const actor = {
      userId: 'u_ql_q7',
      tenantId: 'tnt_demo',
      displayName: 'Quản lý Quận 7',
      assignments: [],
      rolePermissions: {},
      canConsolidate: false,
      workingBranchId: 'br_q7',
    } as Actor;
    const scope = branchesScope('tnt_demo', ['br_q7']);
    const cancel = () =>
      h.container.hrm.sys.uow.run(async (tx) => {
        const view = (await h.container.hrm.orders.getInTx(tx, scope, order.id))!;
        const staged = await prepareCancel(h.container.hrm, {
          tx,
          scope,
          actor,
          ctx: { requestId: 'req-cancel' },
          order: view,
          items: view.items,
          at: new Date(),
          businessDate: businessDate(new Date()),
          reason: 'Hủy lệnh sau khi ghi công',
        });
        staged.commit();
        return staged.lines;
      });
    expect(await cancel()).toBe(2);
    const after = await labor(order.id);
    expect(after.lines).toHaveLength(4);
    expect(after.totals.amountVnd).toBe(0);
    expect(after.lines.filter((l: Row) => l.status === 'reversed')).toHaveLength(2);
    expect(
      after.lines.filter((l: Row) => l.kind === 'reversal').every((l: Row) => l.amountVnd < 0),
    ).toBe(true);
    // the original earned lines were not edited
    expect(
      after.lines
        .filter((l: Row) => l.kind === 'earned')
        .map((l: Row) => l.amountVnd)
        .sort((a: number, b: number) => a - b),
    ).toEqual([60_000, 180_000]);
    expect(await cancel()).toBe(0);
    expect((await labor(order.id)).lines).toHaveLength(4);
  });

  it('FR-HRM-020 manual adjustment: within the threshold the manager records it, above it the owner decides (requester never decides); never below zero', async () => {
    const v = await newVehicle();
    const ro = await j.readyOrder(staff, v.vehicleId);
    const l0 = await labor(ro.order.id);
    const target = l0.lines.find((l: Row) => l.itemNo === 1) as Row;
    const adjust = (cookie: string, body: Row) =>
      j.post(cookie, '/api/v1/hrm/labor/adjustments', {
        orderId: ro.order.id,
        lineId: target.id,
        reason: 'Điều chỉnh theo thực tế',
        ...body,
      });

    // permission: only the manager (and not the advisor or technician) may adjust
    expect((await adjust(staff.cv, { deltaMinutes: 5, deltaVnd: 1000 })).status).toBe(403);
    expect((await adjust(staff.th, { deltaMinutes: 5, deltaVnd: 1000 })).status).toBe(403);

    const small = await adjust(ql, { deltaMinutes: 10, deltaVnd: 20_000 }); // sample threshold: 60 minutes / 300.000
    expect(small.status, small.text).toBe(201);
    expect(small.json.applied).toBe(true);
    expect((await labor(ro.order.id)).totals.amountVnd).toBe(240_000 + 20_000);

    const big = await adjust(ql, { deltaMinutes: 0, deltaVnd: 500_000 });
    expect(big.status, big.text).toBe(202);
    expect(big.json.applied).toBe(false);
    expect((await labor(ro.order.id)).totals.amountVnd).toBe(260_000); // pending: nothing changed yet
    const ap = (await j.get(owner, `/api/v1/sys/approvals/${big.json.approvalId}`)).json as Row;
    expect(ap.kind).toBe('labor_adjustment');
    // the requester cannot decide, the owner can; the effect is applied in the decision's transaction
    const own = await j.post(ql, `/api/v1/sys/approvals/${ap.id}/decide`, {
      version: ap.version,
      decision: 'approve',
    });
    expect(own.status).toBeGreaterThanOrEqual(400);
    const ok = await j.post(owner, `/api/v1/sys/approvals/${ap.id}/decide`, {
      version: ap.version,
      decision: 'approve',
    });
    expect(ok.status, ok.text).toBe(200);
    const after = await labor(ro.order.id);
    expect(after.totals.amountVnd).toBe(760_000);
    const adj = after.lines.filter((l: Row) => l.kind === 'adjustment');
    expect(adj).toHaveLength(2);
    expect(adj.every((l: Row) => l.adjustsLineId === target.id)).toBe(true);
    expect(adj.some((l: Row) => l.approvalId === ap.id)).toBe(true);

    const below = await adjust(ql, { deltaMinutes: 0, deltaVnd: -999_999_999 });
    expect(below.status).toBe(409);
    // the original line is still exactly what QC wrote
    expect(after.lines.find((l: Row) => l.id === target.id).amountVnd).toBe(60_000);
  });

  it('FR-HRM-020: a technician sees only their own lines; roles without labor rights are refused; branch scope holds', async () => {
    const mine = await j.get(staff.th, '/api/v1/hrm/labor');
    expect(mine.status, mine.text).toBe(200);
    expect(mine.json.items.length).toBeGreaterThan(0);
    expect(mine.json.items.every((l: Row) => l.technicianId === 'u_th_q7')).toBe(true);
    expect((await j.get(staff.tn, '/api/v1/hrm/labor')).status).toBe(403);
    expect((await j.get(staff.cv, '/api/v1/hrm/labor')).status).toBe(403);
    expect((await j.get(staff.kt!, '/api/v1/hrm/labor')).status).toBe(200);
    // tenant isolation (NFR-ISO-01): the other tenant's owner cannot read this tenant's labor
    const any = (await j.get(ql, '/api/v1/hrm/labor')).json.items[0] as Row;
    expect((await j.get(ownerB, `/api/v1/hrm/labor/orders/${any.orderId}`)).status).toBe(404);
    expect((await j.get(ownerB, '/api/v1/hrm/labor?branchId=br_q7')).status).toBe(404);
    const theirs = await j.get(ownerB, '/api/v1/hrm/labor');
    expect(theirs.status).toBe(200);
    expect(theirs.json.items).toEqual([]);
  });

  describe('FR-HRM-001 staff records and personal data by role (Phụ lục D)', () => {
    let empId = '';
    it('QL creates a record in the working branch; a duplicate code is refused; the same code is free in another tenant; unknown position is refused', async () => {
      const created = await j.post(ql, '/api/v1/hrm/employees', {
        code: 'nv9001',
        fullName: 'Nguyễn Văn Kiểm Thử',
        positionCode: 'mechanic3',
        joinedOn: '2024-03-01',
        phone: '0987654321',
        nationalId: '079123456789',
        address: '12 Nguyễn Huệ, Quận 1, TP Hồ Chí Minh',
        birthDate: '1990-05-17',
        certificates: [{ name: 'Sửa chữa động cơ bậc 3', expiresOn: '2027-06-30' }],
      });
      expect(created.status, created.text).toBe(201);
      empId = created.json.id;
      expect(created.json.code).toBe('NV9001');
      const dup = await j.post(ql, '/api/v1/hrm/employees', {
        code: 'NV9001',
        fullName: 'Trùng mã',
        positionCode: 'mechanic3',
        joinedOn: '2024-03-01',
      });
      expect(dup.status).toBe(409);
      // the same code in the other tenant is a different person (RULE-034: two tenants, two records)
      const other = await j.post(ownerB, '/api/v1/hrm/employees', {
        code: 'NV9001',
        fullName: 'Người ở tenant khác',
        positionCode: 'mechanic3',
        joinedOn: '2024-03-01',
      });
      expect(other.status, other.text).toBe(201);
      expect((await j.get(ownerB, `/api/v1/hrm/employees/${empId}`)).status).toBe(404);
      const nopos = await j.post(ql, '/api/v1/hrm/employees', {
        code: 'NV9002',
        fullName: 'Sai chức danh',
        positionCode: 'ghost',
        joinedOn: '2024-03-01',
      });
      expect(nopos.status).toBe(422);
      // one login account, one profile (the seeded technician is already linked)
      const linked = await j.post(ql, '/api/v1/hrm/employees', {
        code: 'NV9003',
        fullName: 'Trùng tài khoản',
        positionCode: 'mechanic3',
        joinedOn: '2024-03-01',
        userId: 'u_th_q7',
      });
      expect(linked.status).toBe(409);
    });

    it('personal data leaves the server only as the role allows; "Hiện" is logged without the value', async () => {
      const as = async (cookie: string) =>
        (await j.get(cookie, `/api/v1/hrm/employees/${empId}`)).json as Row;
      const byQl = await as(ql);
      expect(byQl.pii.phone).toMatchObject({ value: '0987654321', masked: false });
      expect(byQl.pii.nationalId).toMatchObject({ masked: true, reveal: true });
      expect(byQl.pii.nationalId.value).not.toContain('0791');
      const byKt = await as(staff.kt!);
      expect(byKt.pii.phone.masked).toBe(true);
      expect(byKt.pii.phone.reveal).toBe(false);
      expect(byKt.pii.nationalId).toEqual({ masked: true, reveal: false }); // hidden: no value key at all
      expect(JSON.stringify(byKt)).not.toContain('079123456789');
      expect(JSON.stringify(byKt)).not.toContain('0987654321');
      const byQd = await as(staff.qd);
      expect(byQd.pii.phone).toEqual({ masked: true, reveal: false });
      expect(byQd.fullName).toBeTruthy();
      // no permission: the advisor and the cashier get 403, not the record
      expect((await j.get(staff.cv, `/api/v1/hrm/employees/${empId}`)).status).toBe(403);
      expect((await j.get(staff.tn, '/api/v1/hrm/employees')).status).toBe(403);
      // the list carries the same cut (no full id number anywhere)
      const list = await j.get(staff.kt!, '/api/v1/hrm/employees');
      expect(list.status).toBe(200);
      expect(list.text).not.toContain('079123456789');

      const denied = await j.post(staff.kt!, `/api/v1/hrm/employees/${empId}/reveal`, {
        field: 'nationalId',
      });
      expect(denied.status).toBe(403);
      const rev = await j.post(ql, `/api/v1/hrm/employees/${empId}/reveal`, {
        field: 'nationalId',
      });
      expect(rev.status, rev.text).toBe(200);
      expect(rev.json.value).toBe('079123456789');
      const logs = (await rows('accessLogs')).filter(
        (l) => l.entityType === 'employee' && l.entityId === empId,
      );
      expect(logs.some((l) => l.purpose === 'reveal' && l.result === 'allowed')).toBe(true);
      expect(logs.some((l) => l.purpose === 'denied')).toBe(true);
      expect(JSON.stringify(logs)).not.toContain('079123456789');
      // the audit trail names changed fields, never personal values
      const audit = (await rows('auditLogs')).filter(
        (a) => a.entityType === 'employee' && a.entityId === empId,
      );
      expect(JSON.stringify(audit)).not.toContain('0987654321');
      expect(JSON.stringify(audit)).not.toContain('Nguyễn Văn Kiểm Thử');
    });

    it('a technician opens only their own linked record; position change keeps history; leaving keeps the record', async () => {
      const own = await j.get(staff.th, '/api/v1/hrm/employees/emp_demo_th_q7');
      expect(own.status, own.text).toBe(200);
      expect(own.json.pii.phone.value).toBe('0900000105');
      expect((await j.get(staff.th, `/api/v1/hrm/employees/${empId}`)).status).toBe(403);

      const cur = (await j.get(ql, `/api/v1/hrm/employees/${empId}`)).json as Row;
      const up = await j.call(ql, 'PATCH', `/api/v1/hrm/employees/${empId}`, {
        version: cur.version,
        positionCode: 'mechanic4',
        positionFrom: '2099-01-01',
      });
      expect(up.status, up.text).toBe(200);
      const after = (await j.get(ql, `/api/v1/hrm/employees/${empId}`)).json as Row;
      expect(after.positions).toEqual([
        { positionCode: 'mechanic3', from: '2024-03-01', to: '2098-12-31' },
        { positionCode: 'mechanic4', from: '2099-01-01', to: null },
      ]);
      const stale = await j.call(ql, 'PATCH', `/api/v1/hrm/employees/${empId}`, {
        version: cur.version,
        fullName: 'Cũ',
      });
      expect(stale.status).toBe(409);
      const left = await j.post(ql, `/api/v1/hrm/employees/${empId}/leave`, {
        version: after.version,
        leftOn: '2026-10-31',
        reason: 'Nghỉ việc theo nguyện vọng',
      });
      expect(left.status, left.text).toBe(200);
      const gone = (await j.get(ql, `/api/v1/hrm/employees/${empId}`)).json as Row;
      expect(gone.status).toBe('left');
      expect(gone.leftOn).toBe('2026-10-31');
    });
  });

  it('FR-HRM-006/015: the simulation and the rules view use the same engine and never edit a version', async () => {
    const sim = await j.post(ql, '/api/v1/hrm/labor/simulate', {
      method: { method: 'flat', amountVnd: 20_000 },
      standardMinutes: 60,
      laborAmountVnd: 100_000,
      techs: [{ key: 'a', actualMinutes: 30, coefficientBp: 10_000 }],
    });
    expect(sim.status, sim.text).toBe(200);
    expect(sim.json.lines[0].amountVnd).toBe(20_000);
    const bad = await j.post(ql, '/api/v1/hrm/labor/simulate', {
      method: { method: 'flat' },
      standardMinutes: 1,
      laborAmountVnd: 0,
      techs: [{ key: 'a', actualMinutes: 1 }],
    });
    expect(bad.status).toBe(422);
    const rules = await j.get(ql, '/api/v1/hrm/labor/rules');
    expect(rules.status, rules.text).toBe(200);
    expect(rules.json.methods.map((m: Row) => m.scopeKey)).toEqual(
      expect.arrayContaining(['svc:maintenance', 'svc:tire_wheel']),
    );
    expect(rules.json.positions.find((p: Row) => p.code === 'mechanic4').coefficientBp).toBe(
      12_000,
    );
    expect((await j.get(staff.tn, '/api/v1/hrm/labor/rules')).status).toBe(403);
  });
});

/**
 * FR-HRM-020 priority and RULE-038 versioning, on a fresh data set (the rules are changed here through the real
 * propose/approve API, so the shared suite above stays on the seeded sample rules).
 */
describe.each(backends)('HRM labor rule priority and versions [%s]', (backend) => {
  let h: Harness;
  let j: ReturnType<typeof journey>;
  let staff: Staff;
  let ql: string;
  let owner: string;
  let ownerAll: string;
  let n = 0;
  const today = () => businessDate(new Date());

  beforeAll(async () => {
    h = await createHarness(backend);
    j = journey(h);
    staff = {
      cv: await h.loginAt('u_cv_q7', 'br_q7'),
      qd: await h.loginAt('u_qd_q7', 'br_q7'),
      th: await h.loginAt('u_th_q7', 'br_q7'),
      tn: await h.loginAt('u_tn_q7', 'br_q7'),
      tk: await h.loginAt('u_tk_q7', 'br_q7'),
    };
    ql = await h.loginAt('u_ql_q7', 'br_q7');
    owner = await h.loginAt('u_owner', 'br_q7');
    ownerAll = await h.loginAt('u_owner', 'all');
  });

  async function setRule(proposer: string, scopeKey: string, payload: Row) {
    const p = await j.post(proposer, '/api/v1/sys/config/labor-method', {
      scopeKey,
      effectiveFrom: today(),
      payload,
      reason: 'Quy tắc mẫu cho kiểm thử',
    });
    expect(p.status, p.text).toBe(201);
    const d = await h.call(
      'POST',
      `/api/v1/sys/config/labor-method/${encodeURIComponent(p.json.id)}/decide`,
      {
        cookie: owner,
        key: uniqueKey('cfg'),
        body: { decision: 'approve', reauthPassword: DEMO_PASSWORD },
      },
    );
    expect(d.status, d.text).toBe(200);
  }
  const ready = async () => {
    const v = await j.customerWithVehicle(staff.cv, `PRI${++n}`, `51P-${200 + n}.${20 + n}`);
    return j.readyOrder(staff, v.vehicleId);
  };
  const lines = async (orderId: string) =>
    ((await j.get(ql, `/api/v1/hrm/labor/orders/${orderId}`)).json as Row).lines as Row[];

  it('the branch override beats the company rule with a position; a rule change never edits earlier lines', async () => {
    const first = await ready();
    const l1 = await lines(first.order.id);
    expect(l1.map((l) => l.amountVnd).sort((a, b) => a - b)).toEqual([60_000, 180_000]);
    const ruleBefore = l1[0]!.ruleVersionId;

    // company rule for the position (priority 3) AND a branch rule for the service (priority 2): the branch one wins
    await setRule(ownerAll, 'svc:maintenance:pos:mechanic4', { method: 'flat', amountVnd: 11_111 });
    const second = await ready();
    // the branch has no rule yet, so the company rule with the position (priority 3) now beats the company rule (4)
    expect((await lines(second.order.id)).every((l) => l.amountVnd === 11_111)).toBe(true);

    await setRule(ql, 'branch:br_q7:svc:maintenance', { method: 'flat', amountVnd: 77_000 });
    const third = await ready();
    const l3 = await lines(third.order.id);
    expect(l3.every((l) => l.amountVnd === 77_000 && l.method === 'flat')).toBe(true);
    expect(l3[0]!.ruleScopeKey).toBe('branch:br_q7:svc:maintenance');

    // the first order's lines are exactly what they were (the line keeps the rule version it was computed with)
    const again = await lines(first.order.id);
    expect(again.map((l) => l.amountVnd).sort((a, b) => a - b)).toEqual([60_000, 180_000]);
    expect(again[0]!.ruleVersionId).toBe(ruleBefore);
    expect(again[0]!.ruleScopeKey).toBe('svc:maintenance');
  });

  it('NFR-MNT-01: a service type with no rule still records the line: a no_rule warning and zero labor, never a guess', async () => {
    const hrm = h.container.hrm;
    const scope = branchesScope('tnt_demo', ['br_q7']);
    const at = new Date();
    const t = (m: number) => new Date(at.getTime() + m * 60_000);
    const actor = {
      userId: 'u_qd_q7',
      tenantId: 'tnt_demo',
      displayName: 'Quản đốc',
      assignments: [],
      rolePermissions: {},
      canConsolidate: false,
      workingBranchId: 'br_q7',
    } as Actor;
    const record = () =>
      hrm.sys.uow.run(async (tx) => {
        const staged = await prepareQcPass(hrm, {
          tx,
          scope,
          actor,
          ctx: { requestId: 'req-norule' },
          order: {
            id: 'ro_synthetic_norule',
            tenantId: 'tnt_demo',
            branchId: 'br_q7',
            number: 'LSC-NORULE',
            serviceType: 'body_paint_unconfigured',
          },
          items: [
            {
              itemId: 'ro_synthetic_norule__i1',
              no: 1,
              name: 'Hạng mục không có quy tắc',
              status: 'done',
              technicianId: 'u_th_q7',
              assignments: [{ technicianId: 'u_th_q7', at }],
              events: [
                { type: 'start', at: t(1) },
                { type: 'finish', at: t(31) },
              ],
              standardMinutes: 30,
              laborAmountVnd: 90_000,
              hoursVersionIds: [],
            },
          ],
          at: t(40),
          businessDate: businessDate(t(40)),
          qcRun: 1,
        });
        staged.commit();
        return staged.lines;
      });
    expect(await record()).toBe(1);
    const sheet = (await hrm.sheets.get(scope, 'ro_synthetic_norule'))!;
    expect(sheet.lines[0]).toMatchObject({
      amountVnd: 0,
      method: null,
      rule: null,
      warnings: ['no_rule'],
      actualMinutes: 0,
    });
    // a replay of the same QC run meets the same deterministic line id: nothing is added
    expect(await record()).toBe(0);
    expect((await hrm.sheets.get(scope, 'ro_synthetic_norule'))!.lines).toHaveLength(1);
  });

  it('2.6a-1 FR-HRM-020/021: a percent line is "chờ thu đủ": shown in its own column, not in the recorded total; 2.6a-9 the REAL cancel path (after a supplement reopens the order) reverses it', async () => {
    await setRule(ql, 'branch:br_q7:svc:maintenance:pos:mechanic4', {
      method: 'percent',
      rateBp: 1_000,
    });
    const ro = await ready();
    const view = (await j.get(ql, `/api/v1/hrm/labor/orders/${ro.order.id}`)).json as Row;
    const earned = (view.lines as Row[]).filter((l) => l.kind === 'earned');
    expect(earned.length).toBeGreaterThan(0);
    expect(earned.every((l) => l.method === 'percent' && l.status === 'awaiting_payment')).toBe(
      true,
    );
    expect(earned.every((l) => l.amountVnd > 0)).toBe(true); // computed and the rule version kept
    expect(view.totals.amountVnd).toBe(0); // not in the recorded total
    expect(view.totals.awaitingPaymentVnd).toBe(earned.reduce((a, l) => a + l.amountVnd, 0));
    const list = (
      await j.get(
        ql,
        `/api/v1/hrm/labor?branchId=br_q7&status=awaiting_payment&from=${today()}&to=${today()}`,
      )
    ).json as Row;
    expect(list.items.some((l: Row) => l.orderId === ro.order.id)).toBe(true);
    expect(list.totals.awaitingPaymentVnd).toBeGreaterThan(0);

    // a supplementary quote approved on the passed order reopens the work (R47) ...
    const sup = await j.post(staff.cv, `/api/v1/rec/orders/${ro.order.id}/supplement`, {
      version: ro.order.version,
    });
    expect(sup.status, sup.text).toBe(201);
    const q0 = (await j.get(staff.cv, `/api/v1/rec/quotes/${sup.json.id}`)).json as Row;
    const edited = await j.call(staff.cv, 'PATCH', `/api/v1/rec/quotes/${sup.json.id}`, {
      version: q0.version,
      items: [
        {
          name: 'Cân chỉnh thêm',
          necessity: 'optional',
          lines: [{ kind: 'labor', serviceId: 'svc_tnt_demo_SV-CANCHINH' }],
        },
      ],
    });
    const sent = await j.post(staff.cv, `/api/v1/rec/quotes/${sup.json.id}/send`, {
      version: edited.json.version,
    });
    const link = await j.post(staff.cv, `/api/v1/rec/quotes/${sup.json.id}/link`, {
      version: sent.json.version,
    });
    const shown = (await j.get(staff.cv, `/api/v1/rec/quotes/${sup.json.id}`)).json as Row;
    const ok = await j.pub('/api/v1/rec/public/quote/approve', {
      token: link.json.token,
      selectedItemNos: shown.shown.items.map((x: Row) => x.no),
    });
    expect(ok.status, ok.text).toBe(200);
    const reopened = await j.order(staff.cv, ro.order.id);
    expect(reopened.status).toBe('in_progress');

    // ... and the order is then cancelled through the real REC route: the labor gate reverses the lines
    const c = await j.post(ql, `/api/v1/rec/orders/${ro.order.id}/cancel`, {
      version: reopened.version,
      reason: 'Khách hủy sau khi duyệt bổ sung',
    });
    expect(c.status, c.text).toBe(200);
    const after = (await j.get(ql, `/api/v1/hrm/labor/orders/${ro.order.id}`)).json as Row;
    expect((after.lines as Row[]).filter((l) => l.kind === 'reversal')).toHaveLength(earned.length);
    expect(
      (after.lines as Row[])
        .filter((l) => l.kind === 'earned')
        .every((l) => l.status === 'reversed'),
    ).toBe(true);
    expect(after.totals.amountVnd).toBe(0);
    expect(after.totals.awaitingPaymentVnd).toBe(0); // the reversal nets the awaiting pair out
    // replaying the same cancel adds nothing
    const again = await j.post(ql, `/api/v1/rec/orders/${ro.order.id}/cancel`, {
      version: reopened.version,
      reason: 'Khách hủy sau khi duyệt bổ sung',
    });
    expect([200, 409]).toContain(again.status);
    expect(
      ((await j.get(ql, `/api/v1/hrm/labor/orders/${ro.order.id}`)).json as Row).lines,
    ).toHaveLength((after.lines as Row[]).length);
  });

  it('2.6a-8 FR-HRM-008: the branch of a labor line is the branch of the ORDER, not the branch of the staff record (a technician helping another branch)', async () => {
    const hrm = h.container.hrm;
    const scope = branchesScope('tnt_demo', ['br_td']);
    const at = new Date();
    const t = (m: number) => new Date(at.getTime() + m * 60_000);
    const actor = {
      userId: 'u_ql_td',
      tenantId: 'tnt_demo',
      displayName: 'Quản lý Thủ Đức',
      assignments: [],
      rolePermissions: {},
      canConsolidate: false,
      workingBranchId: 'br_td',
    } as Actor;
    await hrm.sys.uow.run(async (tx) => {
      const staged = await prepareQcPass(hrm, {
        tx,
        scope,
        actor,
        ctx: { requestId: 'req-helper' },
        order: {
          id: 'ro_synthetic_helper',
          tenantId: 'tnt_demo',
          branchId: 'br_td', // the order is at Thủ Đức ...
          number: 'LSC-HELPER',
          serviceType: 'maintenance',
        },
        items: [
          {
            itemId: 'ro_synthetic_helper__i1',
            no: 1,
            name: 'Hạng mục hỗ trợ chi nhánh khác',
            status: 'done',
            technicianId: 'u_th_q7', // ... the technician's staff record is at Quận 7
            assignments: [{ technicianId: 'u_th_q7', at }],
            events: [
              { type: 'start', at: t(1) },
              { type: 'finish', at: t(31) },
            ],
            standardMinutes: 30,
            laborAmountVnd: 90_000,
            hoursVersionIds: [],
          },
        ],
        at: t(40),
        businessDate: businessDate(t(40)),
        qcRun: 1,
      });
      staged.commit();
    });
    const sheet = (await hrm.sheets.get(scope, 'ro_synthetic_helper'))!;
    expect(sheet.branchId).toBe('br_td');
    expect(sheet.lines.length).toBeGreaterThan(0);
    expect(sheet.lines.every((l) => l.branchId === 'br_td')).toBe(true);
    // the Quận 7 scope cannot see it (NFR-ISO-01)
    expect(
      await hrm.sheets.get(branchesScope('tnt_demo', ['br_q7']), 'ro_synthetic_helper'),
    ).toBeNull();
  });
});
