import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { approvedOrder, as, getJson, post, startKmAt, type Row } from './acc-helpers';
import { noHorizontalOverflow } from './helpers';

const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
const serious = (r: Awaited<ReturnType<typeof axe>>) =>
  r.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));
/** Set TECH_SHOTS=<dir> to save the real page as screenshots (docs/ui-ux/screenshots/technician-my-work). */
const shots = process.env.TECH_SHOTS;

/**
 * "Việc của tôi" for the technician (G1-DSH-07, FR-REC-013/014, NFR-USA-01, RULE-005/006, NFR-ISO-01): `/` lands on the
 * page, cards carry a short customer name and never a phone, locked proposals can't start, big buttons, undo, empty state,
 * connection loss only warns; WCAG 2.2 AA in light and dark; no horizontal overflow on tablet and phone.
 */
test.describe('technician: Việc của tôi', () => {
  test('lands from /, shows own work, states, undo, offline warning; axe light and dark; no overflow', async ({
    browser,
  }) => {
    test.setTimeout(240_000);
    startKmAt(3_100_000);
    const cv = await as(browser, 'cv.q7');
    const qd = await as(browser, 'qd.q7');
    const th = await as(browser, 'th.q7', { width: 1024, height: 768 });
    const errors: string[] = [];
    th.page.on('pageerror', (e) => errors.push(e.message));
    try {
      await th.page.emulateMedia({ reducedMotion: 'reduce' });
      // two orders, every item of both assigned to the technician
      const heads = [
        await approvedOrder(cv.page.request),
        await approvedOrder(cv.page.request, 'veh_an'),
      ];
      const orders: Row[] = [];
      for (const h of heads) {
        const o = await getJson(qd.page.request, `/api/v1/rec/orders/${h.orderId}`);
        for (const it of o.items)
          await post(qd.page.request, `/api/v1/rec/items/${it.id}/assign`, {
            version: it.version,
            technicianId: 'u_th_q7',
          });
        orders.push(await getJson(qd.page.request, `/api/v1/rec/orders/${h.orderId}`));
      }
      // item 1 of order 1 running, item 1 of order 2 paused (waiting for the customer), the rest not started
      await post(th.page.request, `/api/v1/rec/items/${orders[0]!.items[0].id}/start`, {
        version: orders[0]!.items[0].version,
      });
      const i2 = orders[1]!.items[0];
      const st = await post(th.page.request, `/api/v1/rec/items/${i2.id}/start`, {
        version: i2.version,
      });
      await post(th.page.request, `/api/v1/rec/items/${i2.id}/pause`, {
        version: st.version,
        reason: 'waiting_customer',
      });
      // the technician reports extra work on order 1: it waits, locked
      const o1 = await getJson(qd.page.request, `/api/v1/rec/orders/${heads[0]!.orderId}`);
      await post(th.page.request, `/api/v1/rec/orders/${heads[0]!.orderId}/proposals`, {
        version: o1.version,
        title: 'Thay dây curoa (phát sinh)',
      });

      // `/` sends the technician to the real page
      await th.page.goto('/');
      await expect(th.page).toHaveURL(/\/rec\/work$/);
      await expect(
        th.page.getByRole('heading', { level: 1, name: 'Việc của tôi hôm nay' }),
      ).toBeVisible();
      await expect(th.page.getByTestId('work-summary')).toContainText('Hoa hồng không hiện ở đây');
      await expect(th.page.getByTestId('sum-done')).toContainText('/');
      await expect(th.page.getByTestId('work-cards')).toBeVisible();
      await expect(th.page.getByTestId('work-locked')).toContainText('Thay dây curoa');
      await expect(th.page.getByTestId('work-locked')).toContainText('Chờ cố vấn báo giá');
      await expect(th.page.getByTestId('work-locked').getByRole('button')).toBeDisabled();
      const running = th.page.locator('[data-testid=work-card][data-status=in_progress]').first();
      await expect(running).toBeVisible();
      // no phone, no full name, no address anywhere on the page
      const text = await th.page.locator('main').innerText();
      expect(text).not.toMatch(/0\d{9}|Trần Văn Bình|phone|địa chỉ/i);
      await expect(running).toContainText('Khách:');

      // touch targets at least 52 px
      const finish = await running.getByTestId('work-finish').boundingBox();
      expect(finish!.height).toBeGreaterThanOrEqual(52);
      const todo = th.page.locator('[data-testid=work-card][data-status=not_started]').first();
      const start = await todo.getByTestId('work-start').boundingBox();
      expect(start!.height).toBeGreaterThanOrEqual(52);

      // filter
      await th.page.getByTestId('work-filter-paused').click();
      await expect(th.page.getByTestId('work-filter-paused')).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(th.page.locator('[data-testid=work-card][data-status=in_progress]')).toHaveCount(
        0,
      );
      await expect(
        th.page.locator('[data-testid=work-card][data-status=paused]').first(),
      ).toContainText('Chờ khách');
      await th.page.getByTestId('work-filter-all').click();

      // axe in light and dark, no overflow on tablet landscape, 768 and the phone
      for (const theme of ['light', 'dark']) {
        await th.page.evaluate(
          (t) => document.documentElement.setAttribute('data-theme', t),
          theme,
        );
        expect(serious(await axe(th.page)), theme).toEqual([]);
        if (shots)
          await th.page.screenshot({
            path: `${shots}/my-work-tablet-landscape-${theme}.png`,
            fullPage: true,
          });
      }
      await th.page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
      for (const [w, h, name] of [
        [1024, 768, 'tablet-landscape'],
        [768, 1024, 'tablet-portrait'],
        [375, 800, 'phone'],
      ] as const) {
        await th.page.setViewportSize({ width: w, height: h });
        await th.page.goto('/rec/work');
        await expect(th.page.getByTestId('work-cards')).toBeVisible();
        await noHorizontalOverflow(th.page);
        expect(serious(await axe(th.page)), name).toEqual([]);
        if (shots && name !== 'tablet-landscape')
          await th.page.screenshot({ path: `${shots}/my-work-${name}.png`, fullPage: true });
        if (name === 'phone') {
          await th.page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
          expect(serious(await axe(th.page)), 'phone dark').toEqual([]);
          await th.page.evaluate(() =>
            document.documentElement.setAttribute('data-theme', 'light'),
          );
        }
      }

      // finish with one tap, then take it back
      await th.page.setViewportSize({ width: 1024, height: 768 });
      await th.page.goto('/rec/work');
      const run2 = th.page.locator('[data-testid=work-card][data-status=in_progress]').first();
      const planned = (await run2.getByRole('heading').innerText()).trim();
      await run2.getByTestId('work-finish').click();
      const done = th.page.locator('[data-testid=work-card][data-status=done]').first();
      await expect(done).toContainText(planned);
      await done.getByTestId('work-undo').click();
      await expect(
        th.page
          .locator('[data-testid=work-card][data-status=in_progress]')
          .filter({ hasText: planned }),
      ).toBeVisible();

      // connection loss only warns: the three buttons lock with the reason in words, the list stays readable
      await th.ctx.setOffline(true);
      await expect(th.page.getByTestId('work-offline')).toContainText('Mất kết nối');
      await expect(th.page.getByTestId('work-finish').first()).toBeDisabled();
      await expect(th.page.getByTestId('work-offline-lock').first()).toBeVisible();
      if (shots) await th.page.screenshot({ path: `${shots}/my-work-offline.png`, fullPage: true });
      await th.ctx.setOffline(false);
      await expect(th.page.getByTestId('work-offline')).toHaveCount(0);

      // empty state (the foreman has no item of his own)
      await qd.page.setViewportSize({ width: 1024, height: 768 });
      await qd.page.goto('/rec/work');
      await expect(qd.page.getByText('Chưa có việc được giao')).toBeVisible();
      await noHorizontalOverflow(qd.page);
      expect(serious(await axe(qd.page))).toEqual([]);
      if (shots) {
        await qd.page.screenshot({
          path: `${shots}/my-work-empty-tablet-landscape.png`,
          fullPage: true,
        });
        await qd.page.setViewportSize({ width: 375, height: 800 });
        await qd.page.goto('/rec/work');
        await qd.page.screenshot({ path: `${shots}/my-work-empty-phone.png`, fullPage: true });
      }
      expect(errors).toEqual([]);
    } finally {
      await th.ctx.close();
      await qd.ctx.close();
      await cv.ctx.close();
    }
  });
});
