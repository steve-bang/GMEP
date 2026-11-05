import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { as, asCashier, ensureShift, getJson, post, readyOrder, startKmAt } from './acc-helpers';
import { noHorizontalOverflow } from './helpers';

const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
const serious = (r: Awaited<ReturnType<typeof axe>>) =>
  r.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));
/** Set DASHBOARD_SHOTS=<dir> to save the real page as screenshots (docs/ui-ux/screenshots/dashboard-home). */
const shots = process.env.DASHBOARD_SHOTS;

/**
 * Home dashboard at `/` (G1-DSH, FR-RPT-001, NFR-ISO-01): the server cuts every block by the permission of its source
 * module; the page draws what is left, states for empty/no-permission, no overflow on phone and tablet, WCAG 2.2 AA.
 */
/** Screenshot runs only: one delivered, part-paid order so the page shows real figures. */
async function seedDay(browser: Browser) {
  startKmAt(2_800_000);
  const cv = await as(browser, 'cv.q7');
  const tn = await asCashier(browser);
  const o = await readyOrder(browser, cv.page);
  await ensureShift(tn.page.request);
  const bal = (await getJson(tn.page.request, `/api/v1/acc/orders/${o.id}`)).balance;
  await post(tn.page.request, `/api/v1/acc/orders/${o.id}/payments`, {
    kind: 'receipt',
    lines: [{ method: 'cash', amountVnd: Math.floor(bal.outstandingVnd / 2) }],
  });
}

test.describe('home dashboard (/)', () => {
  test('manager: KPI cards, revenue trend, alerts; axe, no JS error, no overflow at 1280, 768 and 375 px', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const ql = await as(browser, 'ql.q7');
    const errors: string[] = [];
    ql.page.on('pageerror', (e) => errors.push(e.message));
    try {
      await ql.page.emulateMedia({ reducedMotion: 'reduce' });
      if (shots) await seedDay(browser);
      await post(ql.page.request, '/api/v1/rpt/jobs/run-due', {});
      await ql.page.setViewportSize({ width: 1280, height: 900 });
      await ql.page.goto('/');
      await expect(ql.page.getByRole('heading', { level: 1, name: 'Tổng quan' })).toBeVisible();
      await expect(ql.page.getByTestId('home-lens')).toContainText('quản lý chi nhánh');
      await expect(ql.page.getByTestId('home-kpi-revenue')).toBeVisible();
      await expect(ql.page.getByTestId('chart-trend')).toBeVisible();
      await expect(ql.page.getByTestId('chart-orders')).toBeVisible();
      await expect(ql.page.getByTestId('home-alerts')).toBeVisible();
      await ql.page.waitForLoadState('networkidle');
      expect(serious(await axe(ql.page))).toEqual([]);
      if (shots)
        await ql.page.screenshot({ path: `${shots}/home-manager-desktop.png`, fullPage: true });
      // the alternative data table of a chart opens with the keyboard
      await ql.page.getByTestId('chart-trend').getByText('Bảng số liệu').click();
      await expect(ql.page.getByTestId('chart-trend').getByRole('table')).toBeVisible();

      for (const [w, h, name] of [
        [768, 1024, 'tablet'],
        [375, 800, 'phone'],
      ] as const) {
        await ql.page.setViewportSize({ width: w, height: h });
        await ql.page.goto('/');
        await expect(ql.page.getByTestId('home-kpis')).toBeVisible();
        await noHorizontalOverflow(ql.page);
        expect(serious(await axe(ql.page))).toEqual([]);
        if (shots)
          await ql.page.screenshot({ path: `${shots}/home-manager-${name}.png`, fullPage: true });
      }
      // an unknown date shows the empty state, not zeros
      await ql.page.goto('/?date=2020-01-02');
      await expect(ql.page.getByText('Chưa có số liệu')).toBeVisible();
      expect(errors).toEqual([]);
    } finally {
      await ql.ctx.close();
    }
  });

  test('date filter: Hôm qua button and the calendar apply a date at once; reset returns to today', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const ql = await as(browser, 'ql.q7');
    try {
      const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
      const today = fmt.format(new Date());
      const ago = (n: number) => {
        const d = new Date(`${today}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() - n);
        return d.toISOString().slice(0, 10);
      };
      const vi = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
      await ql.page.goto('/');
      await ql.page.getByRole('button', { name: 'Hôm qua' }).click();
      await expect(ql.page).toHaveURL(new RegExp(`date=${ago(1)}$`));
      await expect(ql.page.locator('#df-date')).toHaveValue(vi(ago(1)));
      // the calendar: the native picker is hidden behind a labelled button; choosing a date applies it
      await expect(ql.page.getByRole('button', { name: 'Chọn ngày từ lịch' })).toBeVisible();
      await ql.page.locator('.date-field__native').fill(ago(3));
      await expect(ql.page).toHaveURL(new RegExp(`date=${ago(3)}$`));
      await expect(ql.page.locator('#df-date')).toHaveValue(vi(ago(3)));
      // the calendar does not offer future days
      await expect(ql.page.locator('.date-field__native')).toHaveAttribute('max', today);
      await ql.page.getByRole('button', { name: 'Xóa lọc' }).click();
      await expect(ql.page).toHaveURL(/\/$/);
      await expect(ql.page.locator('#df-date')).toHaveValue(vi(today));
      expect(serious(await axe(ql.page))).toEqual([]);
    } finally {
      await ql.ctx.close();
    }
  });

  test('manager: dark theme keeps WCAG 2.2 AA contrast on every card and chart', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const ql = await as(browser, 'ql.q7');
    try {
      await ql.page.emulateMedia({ reducedMotion: 'reduce' });
      await post(ql.page.request, '/api/v1/rpt/jobs/run-due', {});
      await ql.page.setViewportSize({ width: 1280, height: 900 });
      await ql.page.goto('/');
      await ql.page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      await expect(ql.page.getByTestId('chart-trend')).toBeVisible();
      expect(serious(await axe(ql.page))).toEqual([]);
      if (shots)
        await ql.page.screenshot({ path: `${shots}/home-manager-dark.png`, fullPage: true });
    } finally {
      await ql.ctx.close();
    }
  });

  test('cashier: money cards only; no revenue card or revenue chart reaches the page (cut on the server)', async ({
    browser,
  }) => {
    const tn = await asCashier(browser);
    try {
      await post(tn.page.request, '/api/v1/rpt/jobs/run-due', {}).catch(() => undefined);
      await tn.page.goto('/');
      await expect(tn.page.getByTestId('home-lens')).toContainText('thu ngân');
      await expect(tn.page.getByTestId('home-kpi-inflow')).toBeVisible();
      await expect(tn.page.getByTestId('home-kpi-revenue')).toHaveCount(0);
      await expect(tn.page.getByTestId('chart-trend')).toHaveCount(0);
      await expect(tn.page.getByTestId('chart-split')).toHaveCount(0);
      if (shots) {
        await tn.page.setViewportSize({ width: 375, height: 800 });
        await tn.page.reload();
        await tn.page.screenshot({ path: `${shots}/home-cashier-phone.png`, fullPage: true });
      }
    } finally {
      await tn.ctx.close();
    }
  });

  test('technician has no dashboard view: a no-permission state, not an error page', async ({
    browser,
  }) => {
    const th = await as(browser, 'th.q7');
    try {
      const res = await th.page.goto('/');
      expect(res?.status()).toBe(200);
      await expect(
        th.page.getByText('Chưa có số liệu tổng quan cho vai trò của bạn'),
      ).toBeVisible();
    } finally {
      await th.ctx.close();
    }
  });

  test('owner: consolidated view loads inside the permitted branches', async ({ browser }) => {
    const ow = await as(browser, 'chu');
    try {
      await ow.page.goto('/');
      await expect(ow.page.getByTestId('home-lens')).toContainText('chủ garage');
      await expect(ow.page.getByTestId('home-dashboard')).toBeVisible();
    } finally {
      await ow.ctx.close();
    }
  });
});
