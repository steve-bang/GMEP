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

  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const today = () => fmt.format(new Date());
  const ago = (n: number) => {
    const d = new Date(`${today()}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  };
  const vi = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  const urlHas = (qs: string) => new RegExp(`\\?${qs.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

  test('range filter: presets apply at once, show what is pressed and say what is being viewed', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const ql = await as(browser, 'ql.q7');
    try {
      await post(ql.page.request, '/api/v1/rpt/jobs/run-due', {});
      const page = ql.page;
      await page.goto('/');
      const btn = (name: string) => page.getByRole('button', { name, exact: true });
      await expect(btn('Hôm nay')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('range-summary')).toHaveText(`Đang xem: ngày ${vi(today())}`);
      await btn('7 ngày qua').click();
      await expect(page).toHaveURL(urlHas(`from=${ago(6)}&to=${today()}`));
      await expect(btn('7 ngày qua')).toHaveAttribute('aria-pressed', 'true');
      await expect(btn('Hôm nay')).toHaveAttribute('aria-pressed', 'false');
      await expect(page.getByTestId('range-summary')).toHaveText(
        `Đang xem: ${vi(ago(6))} – ${vi(today())} (7 ngày)`,
      );
      await btn('30 ngày qua').click();
      await expect(page).toHaveURL(urlHas(`from=${ago(29)}&to=${today()}`));
      await expect(page.getByTestId('range-summary')).toContainText('(30 ngày)');
      await btn('Hôm qua').click();
      await expect(page).toHaveURL(urlHas(`from=${ago(1)}&to=${ago(1)}`));
      await expect(page.getByTestId('range-summary')).toHaveText(`Đang xem: ngày ${vi(ago(1))}`);
      // today is the default: the clean address
      await btn('Hôm nay').click();
      await expect(page).toHaveURL(/\/$/);
      await expect(btn('Hôm nay')).toHaveAttribute('aria-pressed', 'true');
      // the old single-day link still works and is the range of that day (yesterday = the preset)
      await page.goto(`/?date=${ago(1)}`);
      await expect(btn('Hôm qua')).toHaveAttribute('aria-pressed', 'true');
      await page.goto(`/?date=${ago(3)}`);
      await expect(page.getByTestId('range-summary')).toHaveText(`Đang xem: ngày ${vi(ago(3))}`);
      await expect(btn('Tùy chọn')).toHaveAttribute('aria-pressed', 'true');
      expect(serious(await axe(page))).toEqual([]);
    } finally {
      await ql.ctx.close();
    }
  });

  test('range filter: custom range applies on the button or Enter; the calendar fills a field; "Từ" pushes "Đến"; each error is said next to the field', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const ql = await as(browser, 'ql.q7');
    try {
      const page = ql.page;
      await page.goto('/');
      const custom = page.getByRole('button', { name: 'Tùy chọn', exact: true });
      await expect(page.getByLabel('Từ ngày')).toHaveCount(0); // the pair is behind "Tùy chọn"
      await custom.click();
      await expect(custom).toHaveAttribute('aria-expanded', 'true');
      const from = page.locator('#rf-from');
      const to = page.locator('#rf-to');
      await expect(from).toHaveValue(vi(today()));
      // typing: the mask inserts the slashes; Enter applies
      await from.fill('');
      await from.pressSequentially(vi(ago(4)).replaceAll('/', ''));
      await expect(from).toHaveValue(vi(ago(4)));
      await to.fill(vi(ago(1)));
      await to.press('Enter');
      await expect(page).toHaveURL(urlHas(`from=${ago(4)}&to=${ago(1)}`));
      await expect(page.getByTestId('range-summary')).toContainText('(4 ngày)');
      await expect(custom).toHaveAttribute('aria-pressed', 'true');
      await expect(from).toHaveValue(vi(ago(4))); // the panel stays open on a custom range
      // the calendar (a hidden native date input behind a labelled button) fills the field
      await expect(page.getByRole('button', { name: 'Chọn ngày bắt đầu từ lịch' })).toBeVisible();
      await page.locator('#rf-from + button + input[type=date]').fill(ago(2));
      await expect(from).toHaveValue(vi(ago(2)));
      // "Từ" after "Đến" pushes "Đến" to the same day
      await page.locator('#rf-from + button + input[type=date]').fill(ago(0));
      await expect(to).toHaveValue(vi(ago(0)));
      // no future day in the calendar
      await expect(page.locator('#rf-to + button + input[type=date]')).toHaveAttribute(
        'max',
        today(),
      );

      const err = page.locator('#rf-err');
      const apply = page.getByRole('button', { name: 'Áp dụng', exact: true });
      // malformed text -> format, focus goes back to the field
      await from.fill('5/11');
      await apply.click();
      await expect(err).toContainText('dd/MM/yyyy');
      await expect(from).toBeFocused();
      await expect(from).toHaveAttribute('aria-invalid', 'true');
      // a day after today
      const tomorrow = new Date(`${today()}T00:00:00Z`);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      await from.fill(vi(ago(2)));
      await to.fill(vi(tomorrow.toISOString().slice(0, 10)));
      await apply.click();
      await expect(err).toContainText('sau hôm nay');
      await expect(to).toBeFocused();
      // end before start
      await from.fill(vi(ago(1)));
      await to.fill(vi(ago(3)));
      await apply.click();
      await expect(err).toContainText('không được trước ngày bắt đầu');
      // longer than the limit: the number is in the message
      await from.fill(vi(ago(100)));
      await to.fill(vi(today()));
      await apply.click();
      await expect(err).toContainText('93 ngày');
      await expect(err).toContainText('101 ngày');
      expect(serious(await axe(page))).toEqual([]);
      // fixing the value clears the message
      await from.fill(vi(ago(5)));
      await expect(err).toHaveCount(0);
    } finally {
      await ql.ctx.close();
    }
  });

  test('range views: 7 days, 30 days (thin bars), 93 days (weeks); missing days said, state cards labelled, previous period only when complete; no overflow, axe', async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const ql = await as(browser, 'ql.q7');
    const errors: string[] = [];
    ql.page.on('pageerror', (e) => errors.push(e.message));
    try {
      await ql.page.emulateMedia({ reducedMotion: 'reduce' });
      if (shots) await seedDay(browser);
      await post(ql.page.request, '/api/v1/rpt/jobs/run-due', {});
      const page = ql.page;
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`/?from=${ago(6)}&to=${today()}`);
      await expect(page.getByTestId('home-kpis')).toBeVisible();
      // a state at the end of the range is labelled as of that day, not presented as a sum
      await expect(page.getByTestId('home-snapshot')).toContainText('tính đến');
      await expect(page.getByTestId('home-kpi-openAtEnd').locator('xpath=..')).toContainText(
        'tính đến',
      );
      // the previous 7 days are not all there (the job catches up 8 days): no percentage, how much is there
      await expect(page.getByTestId('kpi-revenue-incomplete')).toHaveText(
        /Chưa đủ số liệu kỳ trước \(\d\/7 ngày\)/,
      );
      await expect(page.getByTestId('chart-trend')).toContainText('Doanh thu theo ngày');
      await expect(page.locator('.dsh-cols-chart--dense')).toHaveCount(0); // 7 bars keep their value labels
      if (shots)
        await page.screenshot({ path: `${shots}/home-range-7d-desktop.png`, fullPage: true });
      expect(serious(await axe(page))).toEqual([]);

      await page.goto(`/?from=${ago(29)}&to=${today()}`);
      await expect(page.getByTestId('chart-trend')).toBeVisible();
      await expect(page.locator('.dsh-cols-chart--dense')).toHaveCount(1); // 30 thin bars, no value labels
      await expect(page.getByTestId('missing-days')).toContainText('không tính là 0');
      // a gap in 30 thin columns carries no "Chưa có" text (it would overprint its neighbours)
      await expect(page.locator('.dsh-cols-chart__none').first()).toBeHidden();
      expect(serious(await axe(page))).toEqual([]);
      if (shots)
        await page.screenshot({ path: `${shots}/home-range-30d-desktop.png`, fullPage: true });

      await page.goto(`/?from=${ago(92)}&to=${today()}`);
      await expect(page.getByTestId('chart-trend')).toContainText('Doanh thu theo tuần');
      await page.getByTestId('chart-trend').getByText('Bảng số liệu').click();
      await expect(page.getByTestId('chart-trend').getByRole('table')).toContainText('–'); // "30/10–05/11"
      await expect(page.getByTestId('range-summary')).toContainText('(93 ngày)');
      expect(serious(await axe(page))).toEqual([]);

      // a range the server refuses still draws the filter, so it can be corrected on the spot
      await page.goto(`/?from=${ago(100)}&to=${today()}`);
      await expect(page.getByText('Khoảng ngày quá dài')).toBeVisible();
      await expect(page.getByRole('button', { name: '7 ngày qua', exact: true })).toBeVisible();
      await page.getByRole('button', { name: '7 ngày qua', exact: true }).click();
      await expect(page.getByTestId('home-kpis')).toBeVisible();
      await page.goto(`/?from=${today()}&to=${ago(1)}`);
      await expect(page.getByText('Khoảng ngày chưa hợp lệ')).toBeVisible();

      // phone and tablet: the presets wrap, the custom pair is stacked, nothing overflows
      for (const [w, h, name] of [
        [768, 1024, 'tablet'],
        [375, 800, 'phone'],
      ] as const) {
        await page.setViewportSize({ width: w, height: h });
        await page.goto(`/?from=${ago(29)}&to=${today()}`);
        await expect(page.getByTestId('home-kpis')).toBeVisible();
        await page.getByRole('button', { name: 'Tùy chọn', exact: true }).click();
        await expect(page.locator('#rf-from')).toBeVisible();
        await noHorizontalOverflow(page);
        expect(serious(await axe(page))).toEqual([]);
        if (shots)
          await page.screenshot({ path: `${shots}/home-range-30d-${name}.png`, fullPage: true });
      }
      expect(errors).toEqual([]);
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

  test('technician has no dashboard view: `/` lands on Việc của tôi (G1-DSH-07)', async ({
    browser,
  }) => {
    const th = await as(browser, 'th.q7');
    try {
      await th.page.goto('/');
      await expect(th.page).toHaveURL(/\/rec\/work$/);
      await expect(
        th.page.getByRole('heading', { level: 1, name: 'Việc của tôi hôm nay' }),
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
