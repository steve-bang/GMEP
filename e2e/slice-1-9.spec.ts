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
  startKmAt,
} from './acc-helpers';
import { noHorizontalOverflow } from './helpers';

const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
const serious = (r: Awaited<ReturnType<typeof axe>>) =>
  r.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));

/**
 * Slice 1.9 (FR-RPT-001, 003, 011, 013; RULE-007; NFR-ISO-01): a delivered and paid order reaches the day report after
 * the rollup job runs; every number opens its source documents; the cashier gets her own cut of the dashboard; CSV export.
 */
test.describe('slice 1.9 RPT: single-branch reports', () => {
  test.beforeAll(() => startKmAt(2_600_000));

  test('manager runs the rollup, reads the day, drills down to the order, exports CSV; the cashier sees her own view', async ({
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
    const cur = await getJson(cv.page.request, `/api/v1/rec/orders/${o.id}`);
    await post(cv.page.request, `/api/v1/rec/orders/${o.id}/handover`, {
      version: cur.version,
      receiverName: 'Nguyễn Văn An',
      confirmation: 'screen',
      belongingsReturned: true,
      oldPartsReturned: true,
    });

    const ql = await as(browser, 'ql.q7');
    await ql.page.goto('/rpt');
    await expect(ql.page.getByTestId('lens')).toContainText('quản lý chi nhánh');
    // first visit of the day: no rollup yet (or an older one): the job button builds it from the source documents
    const run = ql.page.getByTestId('run-due');
    if (await run.isVisible().catch(() => false)) await run.click();
    else {
      const r = await ql.page.request.post('/api/v1/rpt/jobs/run-due', {
        data: {},
        headers: hdr(),
      });
      expect(r.ok(), await r.text()).toBe(true);
    }
    await ql.page.goto('/rpt');
    await expect(ql.page.getByTestId('day-state')).toContainText('Số tạm');
    await expect(ql.page.getByTestId('kpi-revenue')).toContainText('₫');
    const closed = Number(await ql.page.getByTestId('kpi-closed').innerText());
    expect(closed).toBeGreaterThanOrEqual(1);
    await expect(ql.page.getByTestId('kpi-stock')).toHaveText('0');
    expect(serious(await axe(ql.page))).toEqual([]);
    await noHorizontalOverflow(ql.page);

    // FR-RPT-011: the number opens the orders that make it, and a row opens the order
    await ql.page.getByTestId('kpi-closed').click();
    await expect(ql.page).toHaveURL(/\/rpt\/daily\/drill\?.*metric=closed/);
    await expect(ql.page.getByTestId('drill-link').first()).toBeVisible();
    await expect(ql.page.getByText(o.number)).toBeVisible();
    await ql.page.getByRole('link', { name: new RegExp(o.number) }).click();
    await expect(ql.page).toHaveURL(new RegExp(`/rec/orders/${o.id}`));

    // FR-RPT-003 / 013: the day report prints the formula next to the figure and reconciles to the order totals
    await ql.page.goto('/rpt/daily');
    await expect(ql.page.getByTestId('d-revenue')).toContainText('₫');
    await expect(ql.page.getByTestId('reconcile')).toContainText('Khớp số liệu');
    await expect(ql.page.getByTestId('split')).toContainText('Tiền công');
    await expect(ql.page.getByTestId('by-method')).toContainText('Tiền mặt');
    expect(serious(await axe(ql.page))).toEqual([]);

    // CSV export: permission, scope, audit (the file is a real download)
    const [dl] = await Promise.all([
      ql.page.waitForEvent('download'),
      ql.page.getByTestId('export-csv').click(),
    ]);
    expect(dl.suggestedFilename()).toMatch(/^bao-cao-ngay-Q7-\d{4}-\d{2}-\d{2}\.csv$/);

    // the exception list renders for the manager
    await ql.page.goto('/rpt/alerts');
    await expect(ql.page.getByTestId('count-not_invoiced')).toBeVisible();
    expect(serious(await axe(ql.page))).toEqual([]);

    // the cashier: her own lens, no revenue figure (no report-daily:view), no daily report page
    await tn.page.goto('/rpt');
    await expect(tn.page.getByTestId('lens')).toContainText('thu ngân');
    await expect(tn.page.getByTestId('kpi-inflow')).toBeVisible();
    await expect(tn.page.getByTestId('kpi-revenue')).toHaveCount(0);
    const denied = await tn.page.goto('/rpt/daily');
    expect(denied?.status()).toBeLessThan(500);
    await expect(tn.page.getByText('Bạn chưa có quyền xem mục này')).toBeVisible();

    // phone width (managers read on phones): no horizontal overflow
    const phone = await as(browser, 'ql.q7', { width: 390, height: 844 });
    await phone.page.goto('/rpt');
    await expect(phone.page.getByTestId('kpi-revenue')).toBeVisible();
    await noHorizontalOverflow(phone.page);
    await phone.page.goto('/rpt/daily');
    await noHorizontalOverflow(phone.page);
    for (const x of [cv, tn, ql, phone]) await x.ctx.close();
  });
});
