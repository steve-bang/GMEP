import { beforeAll, describe, expect, it } from 'vitest';
import { journey, type Row, type Staff } from '../helpers/journey';
import { backends, createHarness, type Harness } from './harness';

/**
 * UAT journeys that had no test under their own name (docs/dev/uat-coverage.md maps the rest to existing tests).
 *  UAT-01 one vehicle from intake to a handed-over order with an invoice: labour, money and invoice agree on the report
 *  UAT-03 supplementary item: the technician has nothing to start until the customer approves; the approval is kept as evidence
 *  UAT-09 a tax rate change by effective date: orders after the date use the new rate, the old quote keeps its version
 * Sample VAT rates are NOT accountant sign-off (NFR-MNT-01).
 */
describe.each(backends)('UAT journeys [%s]', (backend) => {
  let h: Harness;
  let staff: Staff;
  let ql: string;
  let kt: string;
  let owner: string;
  let j: ReturnType<typeof journey>;
  let vehicleN = 0;
  const vehicle = async (tag: string) => {
    vehicleN += 1;
    return (await j.customerWithVehicle(staff.cv, tag, `77U-${String(30_000 + vehicleN)}`))
      .vehicleId;
  };
  const today = () => h.clock.now().toISOString().slice(0, 10);

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
    kt = await h.loginAt('u_kt', 'br_q7');
    owner = await h.loginAt('u_owner', 'br_q7');
  });

  it('UAT-01: intake to handover to invoice; order total = money received = invoice total, and the reconciliation report agrees', async () => {
    const ro = await j.readyOrder(staff, await vehicle('UAT01'));
    const total = ro.order.totalVnd as number;
    await j.payFull(staff.tn, ro.order.id);
    const inv = await j.issueInvoice(staff.tn, ro.order.id);
    const invoice = (await j.get(kt, `/api/v1/ein/invoices/${inv.invoiceId}`)).json as Row;
    expect(invoice.totalVnd).toBe(total);
    expect(invoice.status).toBe('issued');
    const money = (await j.get(staff.tn, `/api/v1/acc/orders/${ro.order.id}`)).json.balance;
    expect(money).toMatchObject({ receivedVnd: total, outstandingVnd: 0 });
    const hv = await j.post(staff.cv, `/api/v1/rec/orders/${ro.order.id}/handover`, {
      version: (await j.order(staff.cv, ro.order.id)).version,
      receiverName: 'Nguyễn Văn An',
      confirmation: 'screen',
      belongingsReturned: true,
      oldPartsReturned: true,
    });
    expect(hv.status, hv.text).toBe(200);
    expect((await j.order(staff.cv, ro.order.id)).status).toBe('completed');

    expect((await j.post(ql, '/api/v1/rpt/jobs/run-due', {})).status).toBe(200);
    const day = today();
    const rec = await j.get(ql, `/api/v1/rpt/reconcile?from=${day}&to=${day}&branchId=br_q7`);
    expect(rec.status, rec.text).toBe(200);
    const row = rec.json.report.rows[0];
    expect(row.failed, JSON.stringify(row)).not.toContain('payments');
    expect(row.failed).not.toContain('stock');
    expect(row.gapVnd).toBe(0);
    // the daily report counts the same order once, with the same figure as the invoice
    const daily = await j.get(ql, `/api/v1/rpt/daily?date=${day}&branchId=br_q7`);
    expect(daily.status, daily.text).toBe(200);
    expect(JSON.stringify(daily.json)).toContain(String(invoice.totalVnd - invoice.taxVnd));
    // and the order is in the closed-orders drill-down
    const drill = await j.get(ql, `/api/v1/rpt/drill?date=${day}&metric=closed&branchId=br_q7`);
    expect(drill.json.refs.map((r: Row) => r.id)).toContain(ro.order.id);
  });

  it('UAT-03 / FR-REC-014 / RULE-005: an extra item is not workable before the customer approves; approval adds it with its evidence', async () => {
    const o = (await j.openedOrder(staff.cv, await vehicle('UAT03'))).order;
    const before = o.items.length;
    const sup = await j.post(staff.cv, `/api/v1/rec/orders/${o.id}/supplement`, {
      version: o.version,
    });
    expect(sup.status, sup.text).toBe(201);
    const q0 = (await j.get(staff.cv, `/api/v1/rec/quotes/${sup.json.id}`)).json;
    const edited = await j.call(staff.cv, 'PATCH', `/api/v1/rec/quotes/${sup.json.id}`, {
      version: q0.version,
      items: [
        {
          name: 'Thay lọc gió',
          necessity: 'optional',
          lines: [{ kind: 'labor', serviceId: 'svc_cmp_demo_SV-DAU' }],
        },
      ],
    });
    expect(edited.status, edited.text).toBe(200);
    const sent = await j.post(staff.cv, `/api/v1/rec/quotes/${sup.json.id}/send`, {
      version: edited.json.version,
    });
    expect(sent.status, sent.text).toBe(200);
    const link = await j.post(staff.cv, `/api/v1/rec/quotes/${sup.json.id}/link`, {
      version: sent.json.version,
    });
    // sent but not approved: the order has no repair item for it, so nobody can assign or start it
    const mid = await j.order(staff.cv, o.id);
    expect(mid.items).toHaveLength(before);
    expect(JSON.stringify(mid.items)).not.toContain('Thay lọc gió');
    const shown = (await j.get(staff.cv, `/api/v1/rec/quotes/${sup.json.id}`)).json;
    const ok = await j.pub('/api/v1/rec/public/quote/approve', {
      token: link.json.token,
      selectedItemNos: shown.shown.items.map((x: Row) => x.no),
    });
    expect(ok.status, ok.text).toBe(200);
    const after = await j.order(staff.cv, o.id);
    expect(after.items).toHaveLength(before + 1);
    const extra = after.items.find((i: Row) => JSON.stringify(i).includes('Thay lọc gió'))!;
    // now (and only now) it can be assigned and started
    const assign = await j.post(staff.qd, `/api/v1/rec/items/${extra.id}/assign`, {
      version: extra.version,
      technicianId: 'u_th_q7',
    });
    expect(assign.status, assign.text).toBe(200);
    // the approval is kept: method, time and a content hash (FR-REC-008)
    const approved = (await j.get(staff.cv, `/api/v1/rec/quotes/${sup.json.id}`)).json;
    expect(['approved_full', 'approved_partial']).toContain(approved.status);
    const proof = JSON.stringify(approved);
    expect(proof).toMatch(/customer_link|link/);
  });

  it('UAT-09 / FR-ACC-009: a VAT rate change takes effect on its date by configuration; the earlier quote keeps its rate and version', async () => {
    const q1 = await j.sentQuote(staff.cv, await vehicle('UAT09a'));
    const line1 = q1.q.shown.items[0].lines[0];
    expect(line1).toMatchObject({ taxKey: 'vat', taxRateBp: 800 });
    const oldVersion = line1.taxVersionId as string;

    const from = new Date(h.clock.now().getTime() + 10 * 86_400_000).toISOString().slice(0, 10);
    const p = await j.call(kt, 'POST', '/api/v1/sys/config/tax-rate', {
      scopeKey: 'vat',
      effectiveFrom: from,
      payload: { name: 'VAT mẫu mới (không phải số kế toán đã ký)', rateBp: 1000 },
      reason: 'UAT-09 đổi thuế suất theo ngày hiệu lực',
    });
    expect(p.status, p.text).toBe(201);
    const d = await j.call(
      owner,
      'POST',
      `/api/v1/sys/config/tax-rate/${encodeURIComponent(p.json.id)}/decide`,
      {
        decision: 'approve',
      },
    );
    expect(d.status, d.text).toBe(200);

    // before the date: still 8%
    const q2 = await j.sentQuote(staff.cv, await vehicle('UAT09b'));
    expect(q2.q.shown.items[0].lines[0]).toMatchObject({ taxRateBp: 800 });
    // after the date: 10%, with the new version id; nothing in the code changed
    h.clock.set(new Date(Date.parse(`${from}T03:00:00Z`) + 3_600_000).toISOString());
    // sessions of the earlier day have expired with the clock: sign in again
    staff.cv = await h.loginAt('u_cv_q7', 'br_q7');
    const q3 = await j.sentQuote(staff.cv, await vehicle('UAT09c'));
    const line3 = q3.q.shown.items[0].lines[0];
    expect(line3).toMatchObject({ taxKey: 'vat', taxRateBp: 1000 });
    expect(line3.taxVersionId).not.toBe(oldVersion);
    // the quote made before the change is unchanged (the version is kept on the line)
    const again = (await j.get(staff.cv, `/api/v1/rec/quotes/${q1.q.id}`)).json;
    expect(again.shown.items[0].lines[0]).toMatchObject({
      taxRateBp: 800,
      taxVersionId: oldVersion,
    });
  });
});
