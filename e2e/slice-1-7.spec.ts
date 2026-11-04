import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  as,
  asCashier,
  ensureShift,
  getJson,
  hdr,
  post,
  readyOrder,
  type Row,
} from './acc-helpers';
import { noHorizontalOverflow, PASSWORD } from './helpers';

const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
const serious = (r: Awaited<ReturnType<typeof axe>>) =>
  r.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));

/**
 * Slice 1.7 (FR-ACC-001..004, 006, FR-SYS-004; RULE-007, 010, 011; R44): shift, deposit, multi-method receipt with the deposit
 * applied, handover, reversal through the approval queue, approved debt, shift close with a variance and the day close.
 */
test.describe('slice 1.7 ACC: money', () => {
  test('the cashier opens the shift, takes a deposit and a two-method receipt through the screens; the advisor then hands the vehicle over', async ({
    browser,
  }) => {
    const cv = await as(browser, 'cv.q7');
    const tn = await asCashier(browser);
    const o = await readyOrder(browser, cv.page);
    const orderUrl = `/acc/orders/${o.id}`;

    // no shift yet (or one left open by an earlier run): the screen says so, then the cashier opens it from the cash book
    await tn.page.goto('/acc/cashbook');
    await tn.page.waitForLoadState('networkidle');
    const shiftOpen = tn.page.getByTestId('shift-open');
    // the click may land before React has hydrated the button: retry until the shift shows
    await expect(async () => {
      if (!(await shiftOpen.isVisible())) await tn.page.getByTestId('open-shift').click();
      await expect(shiftOpen).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15_000 });
    expect(serious(await axe(tn.page))).toEqual([]);

    await tn.page.goto(orderUrl);
    await tn.page.waitForLoadState('networkidle');
    await expect(tn.page.getByTestId('kpi-outstanding')).toContainText('₫');
    const total = await tn.page.getByTestId('kpi-receivable').innerText();
    expect(serious(await axe(tn.page))).toEqual([]);

    // a deposit first: the button only opens the confirmation, nothing is written until the tick and "Ghi sổ"
    await tn.page.getByTestId('mode-deposit').click();
    await tn.page.locator('#a-0').fill('200000');
    await tn.page.getByTestId('pay-open-confirm').click();
    const dlg = tn.page.getByTestId('pay-confirm');
    await expect(dlg).toBeVisible();
    await expect(dlg.getByTestId('pay-confirm-go')).toBeDisabled(); // needs the "I checked" tick
    await tn.page.getByTestId('pay-ack').check();
    await dlg.getByTestId('pay-confirm-go').click();
    await expect(tn.page.getByTestId('pay-done')).toContainText('PT-Q7-');
    await expect(tn.page.getByTestId('kpi-deposit')).toHaveText('200.000 ₫');

    // the final receipt: cash + transfer, the held deposit applied (default on). Pay exactly what is left.
    await tn.page.reload();
    await tn.page.waitForLoadState('networkidle');
    await tn.page.getByTestId('mode-receipt').click();
    const out = (await getJson(tn.page.request, `/api/v1/acc/orders/${o.id}`)).balance as Row;
    const left = out.outstandingVnd - 200_000;
    await tn.page.locator('#a-0').fill(String(100_000));
    await tn.page.getByTestId('add-line').click();
    await tn.page.locator('#a-1').fill(String(left - 100_000));
    // a transfer line needs its reference: the button stays disabled until it is typed
    await expect(tn.page.getByTestId('pay-open-confirm')).toBeDisabled();
    await tn.page.locator('#r-1').fill('FT26-0001');
    await expect(tn.page.getByTestId('pay-after')).toHaveText('0 ₫');
    await tn.page.getByTestId('pay-open-confirm').click();
    await tn.page.getByTestId('pay-ack').check();
    await tn.page.getByTestId('pay-confirm').getByTestId('pay-confirm-go').click();
    await expect(tn.page.getByTestId('pay-done')).toBeVisible();
    await expect(tn.page.getByTestId('kpi-outstanding')).toHaveText('0 ₫');
    await expect(tn.page.getByTestId('kpi-received')).toHaveText(total);
    expect(serious(await axe(tn.page))).toEqual([]);

    // the payments list shows the three documents; the cash book carries only the cash parts
    await tn.page.goto('/acc/payments');
    await expect(tn.page.getByTestId('pay-no').first()).toBeVisible();
    const mine = (await getJson(tn.page.request, '/api/v1/acc/payments')).items.filter(
      (x: Row) => x.orderId === o.id,
    );
    expect(mine).toHaveLength(2); // the deposit and the final receipt
    expect(serious(await axe(tn.page))).toEqual([]);
    await tn.page.goto('/acc/cashbook');
    const cb = await getJson(tn.page.request, '/api/v1/acc/cashbook');
    expect(cb.closingVnd).toBe(cb.openingVnd + cb.inVnd - cb.outVnd);

    // R44: the advisor's handover screen shows the money is settled and the vehicle can go
    await cv.page.goto(`/rec/orders/${o.id}/handover`);
    await expect(cv.page.getByTestId('hv-outstanding')).toHaveText('0 ₫');
    await cv.page.getByLabel(/Người nhận xe/).fill('Trần Văn Bình');
    await expect(cv.page.getByTestId('hv-submit')).toBeEnabled();
    await cv.page.getByTestId('hv-submit').click();
    await cv.page.waitForURL(/handover\/print/);
    await cv.ctx.close();
    await tn.ctx.close();
  });

  test('a payment is reversed through the approval queue: request, a manager approves, the cashier executes; nothing is deleted', async ({
    browser,
  }) => {
    const cv = await as(browser, 'cv.q7');
    const tn = await asCashier(browser);
    const ql = await as(browser, 'ql.q7', { width: 390, height: 844 });
    const o = await readyOrder(browser, cv.page);
    await ensureShift(tn.page.request);
    const pay = await post(tn.page.request, `/api/v1/acc/orders/${o.id}/payments`, {
      kind: 'receipt',
      lines: [{ method: 'cash', amountVnd: 150_000 }],
    });
    // request on the payment screen
    await tn.page.goto(`/acc/payments/${pay.id}`);
    await tn.page.locator('#rev-reason').fill('Nhập sai hình thức thanh toán');
    await tn.page.getByTestId('rev-send').click();
    await expect(tn.page.getByTestId('rev-sent')).toBeVisible();
    // the requester can see it but cannot decide it; the manager can, on a phone
    await tn.page.goto('/approvals?tab=mine');
    await expect(tn.page.getByText('Chờ duyệt').first()).toBeVisible();
    await expect(tn.page.getByTestId('apr-approve')).toHaveCount(0);
    await ql.page.goto('/approvals');
    await ql.page.waitForLoadState('networkidle');
    await expect(ql.page.getByTestId('apr-approve').first()).toBeVisible();
    expect(serious(await axe(ql.page))).toEqual([]);
    await noHorizontalOverflow(ql.page);
    const row = ql.page
      .locator('tr', { hasText: pay.number.slice(0, 3) === 'PT-' ? 'Đảo bút toán' : '' })
      .first();
    await row.getByTestId('apr-approve').click();
    await expect(ql.page.getByTestId('apr-approve')).toHaveCount(0);
    // the cashier executes once
    await tn.page.goto(`/acc/payments/${pay.id}`);
    await expect(tn.page.getByTestId('rev-approved')).toBeVisible();
    await tn.page.getByTestId('rev-execute').click();
    await tn.page.getByRole('dialog').getByRole('button', { name: 'Thực hiện đảo' }).click();
    await expect(tn.page.getByTestId('reversed-note')).toBeVisible();
    const money = (await getJson(tn.page.request, `/api/v1/acc/orders/${o.id}`)).balance as Row;
    expect(money.receivedVnd).toBe(0);
    const list = await getJson(tn.page.request, '/api/v1/acc/payments');
    expect(list.items.filter((x: Row) => x.reversesId === pay.id || x.id === pay.id)).toHaveLength(
      2,
    );
    await cv.ctx.close();
    await tn.ctx.close();
    await ql.ctx.close();
  });

  test('R44: an order with money owed is blocked at handover until a manager approves a debt; then the vehicle goes and the debt is listed', async ({
    browser,
  }) => {
    const cv = await as(browser, 'cv.q7');
    const ql = await as(browser, 'ql.q7');
    const o = await readyOrder(browser, cv.page);
    await cv.page.goto(`/rec/orders/${o.id}/handover`);
    await expect(cv.page.getByTestId('hv-blocked')).toBeVisible();
    await cv.page.getByLabel(/Người nhận xe/).fill('Trần Văn Bình');
    await expect(cv.page.getByTestId('hv-submit')).toBeDisabled();
    // the advisor asks for a debt on the money screen
    await cv.page.goto(`/acc/orders/${o.id}`);
    await cv.page.waitForLoadState('networkidle');
    await cv.page.getByTestId('debt-open').click();
    const due = new Date(Date.now() + 10 * 86_400_000);
    const vi = `${String(due.getDate()).padStart(2, '0')}${String(due.getMonth() + 1).padStart(2, '0')}${due.getFullYear()}`;
    await cv.page.locator('#debt-due').fill(vi);
    await cv.page.locator('#debt-reason').fill('Khách quen, hẹn trả cuối tuần');
    await cv.page.getByTestId('debt-send').click();
    await expect(cv.page.getByTestId('debt-done')).toBeVisible();
    // the advisor cannot approve their own request
    await cv.page.goto('/approvals?tab=mine');
    await expect(cv.page.getByTestId('apr-approve')).toHaveCount(0);
    // the manager approves
    await ql.page.goto('/approvals');
    await ql.page.locator('tr', { hasText: o.number }).getByTestId('apr-approve').click();
    await expect(ql.page.locator('tr', { hasText: o.number })).toHaveCount(0);
    // now the handover is open
    await cv.page.goto(`/rec/orders/${o.id}/handover`);
    await expect(cv.page.getByTestId('hv-debt-ok')).toBeVisible();
    await cv.page.getByLabel(/Người nhận xe/).fill('Trần Văn Bình');
    await expect(cv.page.getByTestId('hv-submit')).toBeEnabled();
    await cv.page.getByTestId('hv-submit').click();
    await cv.page.waitForURL(/handover\/print/);
    await ql.page.goto('/acc/debts');
    await expect(ql.page.locator('tr', { hasText: o.number })).toBeVisible();
    expect(serious(await axe(ql.page))).toEqual([]);
    await cv.ctx.close();
    await ql.ctx.close();
  });

  test('shift close with a count difference needs a cause; the manager approves it; only then the day closes and takes no more money (UAT-07)', async ({
    browser,
  }) => {
    const tn = await asCashier(browser);
    const ql = await as(browser, 'ql.q7');
    await ensureShift(tn.page.request);
    const cb = await getJson(tn.page.request, '/api/v1/acc/cashbook');
    // count 20.000 short: the form demands a cause and an explanation
    await tn.page.goto('/acc/cashbook/close');
    await tn.page.waitForLoadState('networkidle');
    await expect(tn.page.getByTestId('close-shift-form')).toBeVisible();
    const ack = tn.page.getByTestId('close-ack');
    if (await ack.isVisible().catch(() => false)) await ack.check();
    await tn.page.getByTestId('counted').fill(String(cb.drawer.balanceVnd - 20_000));
    await expect(tn.page.getByTestId('variance')).toContainText('20.000');
    await expect(tn.page.getByTestId('close-open-confirm')).toBeDisabled();
    await tn.page.getByTestId('cause').selectOption('change_short');
    await tn.page.getByTestId('why').fill('Thiếu tiền thối cho khách');
    await expect(tn.page.getByTestId('close-open-confirm')).toBeEnabled();
    expect(serious(await axe(tn.page))).toEqual([]);
    await tn.page.getByTestId('close-open-confirm').click();
    await tn.page.getByTestId('close-confirm').getByTestId('close-confirm-go').click();
    await expect(tn.page.getByTestId('close-done')).toBeVisible();
    // the day is blocked until the manager approves the difference
    await ql.page.goto('/acc/day-close');
    await expect(ql.page.getByTestId('blockers')).toContainText('chưa được quản lý duyệt');
    await expect(ql.page.getByTestId('day-open')).toBeDisabled();
    await ql.page.goto('/approvals');
    await ql.page.waitForLoadState('networkidle');
    const varRow = ql.page.locator('tr', { hasText: 'Chênh lệch quỹ' });
    await varRow.first().getByTestId('apr-approve').click();
    await expect(varRow).toHaveCount(0); // the decision is written before we leave the page
    await ql.page.goto('/acc/day-close');
    await ql.page.waitForLoadState('networkidle');
    await expect(ql.page.getByTestId('blockers')).toContainText('Đủ điều kiện');
    expect(serious(await axe(ql.page))).toEqual([]);
    await ql.page.getByTestId('day-open').click();
    await ql.page.getByTestId('day-confirm').getByTestId('day-confirm-go').click();
    await expect(ql.page.getByTestId('day-done')).toBeVisible();
    // the closed day takes no shift and no payment
    const r = await tn.page.request.post('/api/v1/acc/shifts', { data: {}, headers: hdr() });
    expect(r.status()).toBe(409);
    expect((await r.json()).code).toBe('day_closed');
    // The demo database is shared by every spec in the run: leave today open again through the real path (FR-ACC-005:
    // the manager asks, the owner approves with his password, the manager reopens) so later specs can take money.
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const ask = await post(ql.page.request, '/api/v1/acc/day-close/reopen-request', {
      date: today,
      reason: 'Mở lại ngày để các kịch bản sau còn thu tiền',
    });
    const owner = await as(browser, 'chu');
    const pending = await getJson(owner.page.request, `/api/v1/sys/approvals/${ask.approvalId}`);
    await post(owner.page.request, `/api/v1/sys/approvals/${ask.approvalId}/decide`, {
      version: pending.version,
      decision: 'approve',
      reauthPassword: PASSWORD,
    });
    await post(ql.page.request, '/api/v1/acc/day-close/reopen', { approvalId: ask.approvalId });
    await owner.ctx.close();
    await tn.ctx.close();
    await ql.ctx.close();
  });
});
