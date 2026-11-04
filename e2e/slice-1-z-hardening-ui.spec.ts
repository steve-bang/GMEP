import { expect, test } from '@playwright/test';
import { as, asCashier, ensureShift, getJson, post, readyOrder, startKmAt } from './acc-helpers';
import { noHorizontalOverflow } from './helpers';

const PHONE = { width: 375, height: 800 };
// 1x1 transparent PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * Phase-1 hardening screens: customer refund request (FR-ACC-016), reopen-day panel visibility (FR-ACC-005),
 * photos on a repair order (FR-REC-003/014), warehouse report reachable by the storekeeper (FR-RPT-005).
 */
test.describe('phase 1 hardening UI', () => {
  test.beforeAll(() => startKmAt(2_800_000));
  test.setTimeout(120_000);

  test('refund request and photo upload on a paid order, phone width without overflow', async ({
    browser,
  }) => {
    const cv = await as(browser, 'cv.q7');
    const tn = await asCashier(browser);
    const o = await readyOrder(browser, cv.page);
    await ensureShift(tn.page.request);
    const bal = (await getJson(tn.page.request, `/api/v1/acc/orders/${o.id}`)).balance;
    await post(tn.page.request, `/api/v1/acc/orders/${o.id}/payments`, {
      kind: 'receipt',
      lines: [{ method: 'cash', amountVnd: bal.outstandingVnd }],
    });

    const ql = await as(browser, 'ql.q7', PHONE);
    await ql.page.goto(`/acc/orders/${o.id}`);
    await expect(ql.page.getByTestId('refund')).toBeVisible();
    await noHorizontalOverflow(ql.page);
    await ql.page.getByLabel('Số tiền hoàn (VND)').fill('1000');
    await ql.page.getByLabel(/Lý do hoàn/).fill('Khách yêu cầu hoàn một phần');
    await ql.page.getByTestId('refund-send').click();
    // a fully paid, valid order has nothing refundable: the server's refusal (FR-ACC-016) reaches the screen
    await expect(ql.page.getByTestId('refund-error')).toContainText('vượt phần tiền đã thu');

    await ql.page.goto('/acc/day-close');
    await expect(ql.page.getByRole('heading', { name: 'Chốt ngày chi nhánh' })).toBeVisible();
    await noHorizontalOverflow(ql.page);

    await ql.page.goto(`/rec/orders/${o.id}`);
    await expect(ql.page.getByTestId('photos-empty')).toBeVisible();
    await ql.page
      .getByTestId('photo-file')
      .setInputFiles({ name: 'hien-trang.png', mimeType: 'image/png', buffer: PNG });
    await ql.page.getByTestId('photo-upload').click();
    await expect(ql.page.getByTestId('photo-list').locator('li')).toHaveCount(1);
    await noHorizontalOverflow(ql.page);
    await Promise.all([cv.ctx.close(), tn.ctx.close(), ql.ctx.close()]);
  });

  test('the storekeeper reaches the warehouse report from the menu', async ({ browser }) => {
    const tk = await as(browser, 'tk.q7', PHONE);
    await tk.page.goto('/rpt');
    await expect(tk.page.getByRole('link', { name: 'Báo cáo kho' })).toBeVisible();
    await tk.page.goto('/rpt/warehouse');
    await expect(tk.page.getByRole('heading', { level: 1 })).toBeVisible();
    await noHorizontalOverflow(tk.page);
    await tk.ctx.close();
  });
});
