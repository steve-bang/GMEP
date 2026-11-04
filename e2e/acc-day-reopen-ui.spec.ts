import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { as, asCashier, ensureShift, getJson, hdr, post } from './acc-helpers';
import { PASSWORD } from './helpers';

const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
const serious = (r: Awaited<ReturnType<typeof axe>>) =>
  r.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));

/**
 * FR-ACC-005 / R106 / security checklist #19: reopening a closed day through the SCREENS. The manager closes the day, asks to
 * reopen it from /acc/day-close (ApprovedActionPanel), the owner approves with the password again, the manager executes
 * with a confirmation dialog, and money can be taken again. The file name sorts before every slice spec, so it runs on the
 * untouched demo database and leaves today OPEN again (later specs take money).
 *
 * The owner's decision goes through the API on purpose: the approvals screen has no password field yet, so the UI cannot
 * approve a day reopening (docs/dev/stream-a-findings.md F-3).
 */
test.describe('FR-ACC-005 reopen a closed day through the screens', () => {
  test('the manager closes the day, requests the reopening, the owner approves with the password, the manager reopens; the cashier can open a shift again', async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const tn = await asCashier(browser);
    const ql = await as(browser, 'ql.q7');
    const owner = await as(browser, 'chu');
    // axe reads colours while CSS transitions run (the dialog fades in): measure the settled state
    await ql.page.emulateMedia({ reducedMotion: 'reduce' });
    try {
      // nothing open: the cashier opens and closes an empty shift so the day has no blocker
      await ensureShift(tn.page.request);
      const cb = await getJson(tn.page.request, '/api/v1/acc/cashbook');
      const open = cb.shifts.find((s: { status: string }) => s.status === 'open');
      await post(tn.page.request, `/api/v1/acc/shifts/${open.id}/close`, {
        version: open.version,
        countedVnd: cb.drawer.balanceVnd,
      });

      // the manager closes the day on screen
      await ql.page.goto('/acc/day-close');
      await ql.page.waitForLoadState('networkidle');
      await expect(ql.page.getByTestId('blockers')).toContainText('Đủ điều kiện');
      await ql.page.getByTestId('day-open').click();
      await ql.page.getByTestId('day-confirm').getByTestId('day-confirm-go').click();
      await expect(ql.page.getByTestId('day-done')).toBeVisible();
      const blocked = await tn.page.request.post('/api/v1/acc/shifts', {
        data: {},
        headers: { origin: 'http://localhost:3100', 'idempotency-key': 'e2e-reopen-blocked-00001' },
      });
      expect(blocked.status()).toBe(409);

      // reload: the reopen panel appears for the manager; a reason is required before the button works
      await ql.page.goto('/acc/day-close');
      await ql.page.waitForLoadState('networkidle');
      const panel = ql.page.getByTestId('reopen');
      await expect(panel).toBeVisible();
      await expect(panel.getByTestId('reopen-send')).toBeDisabled();
      await panel
        .locator('#reopen-reason')
        .fill('Mở lại ngày để ghi nốt phiếu thu bị sót, cần chủ duyệt');
      expect(serious(await axe(ql.page))).toEqual([]);
      await panel.getByTestId('reopen-send').click();
      await expect(panel.getByTestId('reopen-sent')).toBeVisible();

      // the owner decides: the password is required again (R106); a wrong password is refused
      const pick = await owner.page.request.put('/api/v1/sys/scope', {
        data: { branchId: 'br_q7' },
        headers: hdr(),
      });
      expect(pick.ok()).toBe(true);
      const mine = await getJson(owner.page.request, '/api/v1/sys/approvals?tab=toDecide');
      const req = (mine.items as { id: string; kind: string; version: number }[]).find(
        (a) => a.kind === 'day_reopen',
      );
      expect(req, 'the day reopening is in the owner queue').toBeTruthy();
      const wrong = await owner.page.request.post(`/api/v1/sys/approvals/${req!.id}/decide`, {
        data: { version: req!.version, decision: 'approve', reauthPassword: 'sai-mat-khau-1' },
        headers: { origin: 'http://localhost:3100', 'idempotency-key': 'e2e-reopen-wrong-00001' },
      });
      expect(wrong.ok()).toBe(false);
      await post(owner.page.request, `/api/v1/sys/approvals/${req!.id}/decide`, {
        version: req!.version,
        decision: 'approve',
        reauthPassword: PASSWORD,
      });

      // the manager sees the approved request and executes it once, with a confirmation
      await ql.page.goto('/acc/day-close');
      await ql.page.waitForLoadState('networkidle');
      const p2 = ql.page.getByTestId('reopen');
      await expect(p2.getByTestId('reopen-approved')).toBeVisible();
      await p2.getByTestId('reopen-execute').click();
      const dialog = ql.page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      // the page behind the modal overlay is dimmed (and inert): audit the dialog itself
      expect(
        serious(
          await new AxeBuilder({ page: ql.page })
            .include('[role=dialog]')
            .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
            .analyze(),
        ),
      ).toEqual([]);
      // Esc closes the dialog and the action stays available (keyboard, WCAG 2.2)
      await ql.page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await p2.getByTestId('reopen-execute').click();
      await dialog.getByRole('button', { name: 'Mở lại ngày' }).click();
      await expect(p2.getByTestId('reopen-done')).toBeVisible();

      // the day is open again: the cashier can take money (a second execution is refused by the server)
      await ensureShift(tn.page.request);
      const again = await ql.page.request.post('/api/v1/acc/day-close/reopen', {
        data: { approvalId: req!.id },
        headers: { origin: 'http://localhost:3100', 'idempotency-key': 'e2e-reopen-twice-00001' },
      });
      expect(again.ok()).toBe(false);
    } finally {
      await owner.ctx.close();
      await tn.ctx.close();
      await ql.ctx.close();
    }
  });
});
