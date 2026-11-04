import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { loginOk, noHorizontalOverflow } from './helpers';

const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
const serious = (r: Awaited<ReturnType<typeof axe>>) =>
  r.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));

const ORIGIN = 'http://localhost:3100';
let n = 0;
const headers = () => ({
  origin: ORIGIN,
  'idempotency-key': `e2e-ord-${Date.now()}-${++n}-xxxxxxxx`,
});
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function post(req: APIRequestContext, path: string, data: unknown): Promise<Row> {
  const r = await req.post(path, { data, headers: headers() });
  const body = (await r.json()) as Row;
  expect(r.ok(), `${path}: ${JSON.stringify(body)}`).toBe(true);
  return body;
}
async function patch(req: APIRequestContext, path: string, data: unknown): Promise<Row> {
  const r = await req.patch(path, { data, headers: headers() });
  const body = (await r.json()) as Row;
  expect(r.ok(), `${path}: ${JSON.stringify(body)}`).toBe(true);
  return body;
}

let km = 1_200_000;
/** The advisor's side through the API: intake -> quote with two required items -> sent -> approved at the counter -> order. */
async function approvedOrder(req: APIRequestContext): Promise<Row> {
  const intake = await post(req, '/api/v1/rec/intakes', { vehicleId: 'veh_biz' });
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
        name: 'Thay dầu và lọc',
        necessity: 'required',
        lines: [
          { kind: 'labor', serviceId: 'svc_cmp_demo_SV-DAU' },
          { kind: 'part', partId: 'part_seed_04', qty: 1 },
        ],
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
  const head = await (await req.get(`/api/v1/rec/quotes/${q.id}`)).json();
  expect(head.orderId, 'the approval opens the order (R37)').toBeTruthy();
  return head;
}

/** Slice 1.6: FR-REC-010, 012, 013, 015, 016, 017, 022, 028 (approval -> order -> technician -> QC -> handover -> print). */
test.describe('slice 1.6 REC: executing the order', () => {
  test('approval opens the order; the foreman assigns; the technician works with one tap; QC passes; handover and print A5/thermal', async ({
    browser,
  }) => {
    const ctxCv = await browser.newContext();
    const cv = await ctxCv.newPage();
    await loginOk(cv, 'cv.q7@demo.gmep.test');
    const quote = await approvedOrder(cv.request);

    // the advisor sees the order opened by the approval, from the quote page
    await cv.goto(`/rec/quotes/${quote.id}`);
    await expect(cv.getByTestId('quote-order-opened')).toBeVisible();
    await cv.getByTestId('quote-order-opened').getByRole('link', { name: 'Mở lệnh' }).click();
    await expect(cv.getByRole('heading', { level: 1 })).toContainText('RO-Q7-');
    await expect(cv.locator('.badge', { hasText: 'Đã duyệt' }).first()).toBeVisible();
    await expect(cv.getByTestId('order-item')).toHaveCount(2);
    expect(serious(await axe(cv))).toEqual([]);
    const orderUrl = cv.url();

    // the foreman assigns both items to the technician
    const ctxQd = await browser.newContext();
    const qd = await ctxQd.newPage();
    await loginOk(qd, 'qd.q7@demo.gmep.test');
    await qd.goto(orderUrl);
    for (const i of [0, 1]) {
      const row = qd.getByTestId('order-item').nth(i);
      await row
        .locator('select')
        .selectOption({ label: 'Thợ Quận 7 (0)' })
        .catch(async () => {
          await row.locator('select').selectOption({ index: 1 });
        });
      await row.getByRole('button', { name: 'Lưu' }).click();
      await expect(row.getByTestId('assign')).toBeVisible();
    }
    await qd.reload();
    await expect(qd.getByTestId('order-item').first().locator('select')).not.toHaveValue('');

    // the technician's tablet: only their own work, one tap to start and to finish
    const ctxTh = await browser.newContext({ viewport: { width: 820, height: 1180 } });
    const th = await ctxTh.newPage();
    await loginOk(th, 'th.q7@demo.gmep.test');
    await th.goto('/rec/work');
    const card = th.getByTestId('work-card').filter({ hasText: 'Thay dầu và lọc' }).first();
    await expect(card).toBeVisible();
    expect(serious(await axe(th))).toEqual([]);
    await noHorizontalOverflow(th);
    const box = await card.getByTestId('work-start').boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44); // touch target
    await card.getByTestId('work-start').click(); // tap 1
    await expect(card).toHaveAttribute('data-status', 'in_progress');
    await card.getByTestId('work-pause').click(); // pause = 2 taps (reason)
    await card.getByTestId('pause-break').click();
    await expect(card).toHaveAttribute('data-status', 'paused');
    await card.getByTestId('work-start').click();
    await expect(card).toHaveAttribute('data-status', 'in_progress');
    await card.getByTestId('work-finish').click(); // tap 1
    await expect(th.getByTestId('work-card').filter({ hasText: 'Thay dầu và lọc' })).toHaveCount(0);
    const brake = th.getByTestId('work-card').filter({ hasText: 'Thay má phanh' }).first();
    await brake.getByTestId('work-start').click();
    await expect(brake).toHaveAttribute('data-status', 'in_progress');
    await brake.getByTestId('work-finish').click();
    await expect(th.getByTestId('work-card')).toHaveCount(0);
    // the technician cannot open the order screens of the foreman
    expect((await th.request.get('/api/v1/rec/orders')).status()).toBe(403);

    // the advisor sends the finished order to QC; the foreman passes it
    await cv.goto(orderUrl);
    await expect(cv.getByTestId('order-progress')).toHaveText('2/2');
    await cv.getByTestId('order-submit-qc').click();
    await expect(cv.locator('.badge', { hasText: 'Chờ kiểm tra' }).first()).toBeVisible();
    await qd.goto(`${orderUrl}/qc`);
    await expect(qd.getByTestId('qc-form')).toBeVisible();
    expect(serious(await axe(qd))).toEqual([]);
    await qd.getByTestId('qc-submit').click();
    await qd.waitForURL(orderUrl);
    await expect(qd.locator('.badge', { hasText: 'Sẵn sàng giao' }).first()).toBeVisible();

    // handover by the advisor, then the printed record in A5 and in 80 mm
    await cv.goto(`${orderUrl}/handover`);
    await cv.getByLabel(/Người nhận xe/).fill('Trần Văn Bình');
    await expect(cv.getByTestId('hv-submit')).toBeEnabled();
    await cv.waitForTimeout(400); // let the button colour transition (disabled -> enabled) finish before axe measures contrast
    expect(serious(await axe(cv))).toEqual([]);
    await cv.getByTestId('hv-submit').click();
    await cv.waitForURL(/handover\/print/);
    const sheet = cv.getByTestId('handover-sheet');
    await expect(sheet).toContainText('Trần Văn Bình');
    await expect(sheet).not.toContainText(/0900000|@demo/);
    await cv.emulateMedia({ media: 'print' });
    const a5 = await sheet.evaluate((el) => el.getBoundingClientRect().width);
    expect(Math.round(a5)).toBeGreaterThan(550); // 148 mm = 559 px
    await cv.emulateMedia({ media: 'screen' });
    await cv.goto(`${orderUrl}/handover/print?f=thermal`);
    await cv.emulateMedia({ media: 'print' });
    const thermal = await cv
      .getByTestId('handover-sheet')
      .evaluate((el) => el.getBoundingClientRect().width);
    expect(Math.round(thermal)).toBeLessThan(300); // 72 mm = 272 px
    await cv.emulateMedia({ media: 'screen' });
    await cv.goto(orderUrl);
    await expect(cv.locator('.badge', { hasText: 'Hoàn tất' }).first()).toBeVisible();
    await expect(cv.getByTestId('order-handover')).toContainText('Trần Văn Bình');
    await ctxCv.close();
    await ctxQd.close();
    await ctxTh.close();
  });

  test('the dispatch board shows open orders by state and works on a phone', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await loginOk(page, 'ql.q7@demo.gmep.test');
    const quote = await approvedOrder(page.request);
    await page.goto('/rec/board');
    await expect(page.getByTestId('board')).toBeVisible();
    await expect(
      page.getByTestId('board-card').filter({ hasText: 'RO-Q7-' }).first(),
    ).toBeVisible();
    expect(serious(await axe(page))).toEqual([]);
    await noHorizontalOverflow(page);
    await page.goto(`/rec/orders/${quote.orderId}`);
    await page.getByTestId('order-cancel').click();
    await page.getByLabel('Lý do').fill('Khách không làm nữa');
    await page.getByTestId('order-reason-confirm').click();
    await expect(page.locator('.badge', { hasText: 'Đã hủy' }).first()).toBeVisible();
    await ctx.close();
  });
});
