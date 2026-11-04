import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { as, asCashier, hdr, readyOrder, startKmAt, type Row } from './acc-helpers';
import { noHorizontalOverflow } from './helpers';

const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
const serious = (r: Awaited<ReturnType<typeof axe>>) =>
  r.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));

/** Users with all-branch roles pick the working branch first (scope picker, BA §4). */
async function atQ7(browser: Browser, user: string, viewport?: { width: number; height: number }) {
  const s = await as(browser, user, viewport);
  const r = await s.page.request.put('/api/v1/sys/scope', {
    data: { branchId: 'br_q7' },
    headers: hdr(),
  });
  expect(r.ok(), await r.text()).toBe(true);
  return s;
}

/** LOCAL/TEST only: script the fake provider (404 outside GMEP_ENV=local). */
async function script(page: Page, body: Row) {
  const r = await page.request.post('/api/v1/ein/dev/fake', { data: body, headers: hdr() });
  expect(r.ok(), await r.text()).toBe(true);
  return (await r.json()) as Row;
}

/**
 * Slice 1.8 (FR-EIN-001..006, 009..011, 013; RULE-005/007): issue from the order through the screens, the checklist that blocks,
 * a timeout whose answer was lost and the queue that finds the invoice without a second one, the files, print and a11y.
 */
test.describe('slice 1.8 EIN: e-invoice', () => {
  test.beforeAll(() => startKmAt(2_300_000));

  test('the cashier sees why a business buyer cannot be invoiced, fixes it, confirms once, and the invoice is issued with its files', async ({
    browser,
  }) => {
    const cv = await as(browser, 'cv.q7');
    const tn = await asCashier(browser);
    const o = await readyOrder(browser, cv.page);

    // the order page offers the invoice as its OWN object (never merged into the order status)
    await tn.page.goto(`/rec/orders/${o.id}`);
    await expect(tn.page.getByTestId('order-invoice')).toContainText('Chưa có hóa đơn');
    await tn.page.getByTestId('order-invoice-issue').click();
    await expect(tn.page).toHaveURL(new RegExp(`/ein/orders/${o.id}/issue`));
    await tn.page.waitForLoadState('networkidle');

    // FR-EIN-011: a business buyer without a tax code is listed with the field to fix and the button is locked
    // (earlier specs may have changed who owns the demo vehicle, so the buyer is set explicitly here)
    await tn.page.locator('#iss-kind').selectOption('business');
    await tn.page.locator('#iss-name').fill('Công ty TNHH Vận tải Demo');
    await tn.page.locator('#iss-tax').fill('');
    await tn.page.getByTestId('issue-recheck').click();
    await expect(tn.page.getByTestId('issue-buyer_tax_code_missing')).toBeVisible();
    await expect(tn.page.getByTestId('issue-open')).toBeDisabled();
    expect(serious(await axe(tn.page))).toEqual([]);
    await noHorizontalOverflow(tn.page);

    await tn.page.locator('#iss-tax').fill('0312345678');
    await tn.page.locator('#iss-addr').fill('45 Lê Lợi, Bến Nghé, Quận 1, TP.HCM');
    await tn.page.getByTestId('issue-recheck').click();
    await expect(tn.page.getByTestId('issue-checks')).toContainText('Đủ điều kiện phát hành');
    await expect(tn.page.getByTestId('issue-open')).toBeEnabled();
    const total = await tn.page.getByTestId('issue-total').innerText();

    // the confirmation needs the tick; nothing is written before it
    await tn.page.getByTestId('issue-open').click();
    const dlg = tn.page.getByTestId('issue-confirm');
    await expect(dlg.getByTestId('issue-confirm-go')).toBeDisabled();
    await tn.page.getByTestId('issue-ack').check();
    await dlg.getByTestId('issue-confirm-go').click();

    await expect(tn.page).toHaveURL(/\/ein\/invoices\//);
    await expect(tn.page.getByTestId('inv-number')).toHaveText(/^\d{7}$/);
    await expect(tn.page.getByTestId('inv-total')).toContainText(
      total.replace(/\s+/g, ' ').trim().slice(0, 4),
    );
    await expect(tn.page.getByTestId('inv-buyer')).toContainText('Công ty TNHH Vận tải Demo');
    expect(serious(await axe(tn.page))).toEqual([]);

    // FR-EIN-006: the stored files open from the invoice (server side download, scope checked)
    const href = await tn.page.getByTestId('dl-pdf').getAttribute('href');
    const pdf = await tn.page.request.get(href!);
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
    const xml = await tn.page.request.get(
      (await tn.page.getByTestId('dl-xml').getAttribute('href'))!,
    );
    expect(await xml.text()).toContain('<MCCQT>');

    // the order shows the invoice; a second issue is impossible from the screen and from the API
    await tn.page.goto(`/rec/orders/${o.id}`);
    await expect(tn.page.getByTestId('order-invoice-link')).toBeVisible();
    await expect(tn.page.getByTestId('order-invoice-issue')).toHaveCount(0);
    const dup = await tn.page.request.post(`/api/v1/ein/orders/${o.id}/invoices`, {
      data: {},
      headers: hdr(),
    });
    expect(dup.status()).toBe(200);
    expect((await dup.json()).duplicate).toBe(true);

    // the list finds it (FR-EIN-006) with the effective total
    await tn.page.goto(`/ein?q=${encodeURIComponent(o.number)}`);
    await expect(tn.page.getByTestId('inv-no')).toHaveCount(1);
    await expect(tn.page.getByTestId('effective-total')).toContainText('₫');
    await cv.ctx.close();
    await tn.ctx.close();
  });

  test('a timeout whose answer was lost goes to the queue; the accountant queries, finds the invoice and nothing is issued twice (UAT-23)', async ({
    browser,
  }) => {
    const cv = await as(browser, 'cv.q7');
    const tn = await asCashier(browser);
    const kt = await atQ7(browser, 'kt');
    const ch = await as(browser, 'chu');
    const o = await readyOrder(browser, cv.page);
    const before = await script(ch.page, {});

    // the invoice is created at the provider but the answer is lost
    await script(ch.page, { op: 'issue', outcome: 'timeout_after' });
    await tn.page.goto(`/ein/orders/${o.id}/issue`);
    await tn.page.waitForLoadState('networkidle');
    await tn.page.locator('#iss-addr').fill('45 Lê Lợi, Bến Nghé, Quận 1, TP.HCM');
    await tn.page.getByTestId('issue-recheck').click();
    await expect(tn.page.getByTestId('issue-open')).toBeEnabled();
    await tn.page.getByTestId('issue-open').click();
    await tn.page.getByTestId('issue-ack').check();
    await tn.page.getByTestId('issue-confirm').getByTestId('issue-confirm-go').click();
    await expect(tn.page).toHaveURL(/\/ein\/invoices\//);
    await expect(tn.page.getByTestId('banner-waiting')).toContainText('không gửi lại');
    const invoiceUrl = tn.page.url();
    const afterTimeout = await script(ch.page, {});
    expect(afterTimeout.invoices).toBe(before.invoices + 1);

    // the cashier cannot work the queue; the accountant can
    expect((await tn.page.request.get('/api/v1/ein/queue')).status()).toBe(403);
    await kt.page.goto('/ein/queue');
    await kt.page.waitForLoadState('networkidle');
    const row = kt.page.getByTestId('queue-row').filter({ hasText: o.number });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Timeout');
    expect(serious(await axe(kt.page))).toEqual([]);
    await row.getByTestId('queue-retry').click();
    await expect(kt.page.getByTestId('queue-row').filter({ hasText: o.number })).toHaveCount(0);

    // it asked the provider first: still exactly one new invoice, and the invoice is issued now
    const after = await script(ch.page, {});
    expect(after.invoices).toBe(before.invoices + 1);
    await tn.page.goto(invoiceUrl);
    await expect(tn.page.getByTestId('inv-number')).toHaveText(/^\d{7}$/);
    await expect(tn.page.getByTestId('banner-waiting')).toHaveCount(0);
    await script(ch.page, { reset: true });
    await Promise.all([cv.ctx.close(), tn.ctx.close(), kt.ctx.close(), ch.ctx.close()]);
  });

  test('the invoice screens fit a phone and the permission states are honest', async ({
    browser,
  }) => {
    const kt = await atQ7(browser, 'kt', { width: 390, height: 844 });
    for (const path of ['/ein', '/ein/warnings', '/ein/queue', '/ein/connection']) {
      await kt.page.goto(path);
      await kt.page.waitForLoadState('networkidle');
      await noHorizontalOverflow(kt.page);
      expect(serious(await axe(kt.page)), path).toEqual([]);
    }
    await kt.ctx.close();
    // an advisor has no invoice access at all (403 state, not a broken page)
    const cv = await as(browser, 'cv.q7');
    const r = await cv.page.goto('/ein');
    expect(r?.status()).toBeLessThan(500);
    await expect(cv.page.getByText(/chưa có quyền/i).first()).toBeVisible();
    // the technician cannot reach the dev scripting endpoint and the endpoint is not a public surface
    const probe = await cv.page.request.post('/api/v1/ein/dev/fake', { data: {}, headers: hdr() });
    expect(probe.status()).toBe(403);
    await cv.ctx.close();
  });
});
