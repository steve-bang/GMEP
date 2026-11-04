import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { approvedOrder, as } from './acc-helpers';

const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
const serious = (r: Awaited<ReturnType<typeof axe>>) =>
  r.violations
    .filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 4),
    }));

/**
 * WCAG 2.2 AA (NFR-ACC) for the screens added in the phase-1 hardening round that no older spec audits: the report screens
 * (daily, monthly, reconciliation, warehouse, technicians, alerts), the import workbench, the order screens with their photo
 * and money panels, plus keyboard behaviour of the confirmation dialog (Esc, focus trap, focus returns to the trigger) and a
 * phone viewport. Read-only: nothing here changes money or stock, so later specs find the demo data as they expect.
 * The file name sorts first (before every slice spec). Findings of this spec go to docs/dev/stream-a-findings.md.
 */
test.describe('WCAG 2.2 AA of the phase-1 hardening screens', () => {
  test('report, import and order screens: no serious or critical axe violation, no JS error, no overflow at 375 px', async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const ql = await as(browser, 'ql.q7');
    const cv = await as(browser, 'cv.q7');
    const errors: string[] = [];
    ql.page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
    try {
      await ql.page.emulateMedia({ reducedMotion: 'reduce' });
      const head = await approvedOrder(cv.page.request);
      const month = new Date().toISOString().slice(0, 7);
      const today = new Date().toISOString().slice(0, 10);
      const screens: [string, string][] = [
        ['report home', '/rpt'],
        ['daily report', `/rpt/daily?date=${today}`],
        ['monthly report', `/rpt/monthly?month=${month}`],
        ['reconciliation', '/rpt/reconcile'],
        ['warehouse report', '/rpt/warehouse'],
        ['technician report', '/rpt/technicians'],
        ['alerts', '/rpt/alerts'],
        ['import workbench', '/sys/imports'],
        ['day close', '/acc/day-close'],
        ['cash book', '/acc/cashbook'],
        ['repair order (photos)', `/rec/orders/${head.orderId}`],
        ['order money panel', `/acc/orders/${head.orderId}`],
      ];
      const failures: string[] = [];
      for (const [name, url] of screens) {
        const res = await ql.page.goto(url);
        await ql.page.waitForLoadState('networkidle');
        if (!res || res.status() >= 400) {
          failures.push(`${name}: HTTP ${res?.status()}`);
          continue;
        }
        const v = serious(await axe(ql.page));
        if (v.length) failures.push(`${name}: ${JSON.stringify(v)}`);
        await ql.page.setViewportSize({ width: 375, height: 800 });
        const overflow = await ql.page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        if (overflow > 0) failures.push(`${name}: horizontal overflow ${overflow}px at 375 px`);
        await ql.page.setViewportSize({ width: 1280, height: 800 });
      }
      expect(failures, failures.join('\n')).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await ql.ctx.close();
      await cv.ctx.close();
    }
  });

  test('confirmation dialog by keyboard: focus moves into it, Tab stays inside, Esc closes it and focus returns to the trigger', async ({
    browser,
  }) => {
    const ql = await as(browser, 'ql.q7');
    try {
      await ql.page.emulateMedia({ reducedMotion: 'reduce' });
      await ql.page.goto('/acc/day-close');
      await ql.page.waitForLoadState('networkidle');
      const trigger = ql.page.getByTestId('day-open');
      if (await trigger.isDisabled())
        test.info().annotations.push({ type: 'note', description: 'day not closable now' });
      await expect(trigger).toBeEnabled();
      await trigger.focus();
      await ql.page.keyboard.press('Enter');
      const dialog = ql.page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      // focus is inside the dialog, and stays there while tabbing around
      const inside = () =>
        ql.page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
      await expect
        .poll(inside, { message: 'focus moved into the dialog', timeout: 2000 })
        .toBe(true);
      for (let i = 0; i < 6; i++) {
        await ql.page.keyboard.press('Tab');
        expect(await inside(), `focus escaped the dialog after ${i + 1} Tab presses`).toBe(true);
      }
      await ql.page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(trigger, 'focus returns to the control that opened the dialog').toBeFocused();
      // nothing was submitted: the day is still open
      const r = await ql.page.request.get('/api/v1/acc/cashbook');
      expect((await r.json()).closed).toBe(false);
    } finally {
      await ql.ctx.close();
    }
  });
});
