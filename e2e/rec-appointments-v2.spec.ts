import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { as, getJson, post, type Row } from './acc-helpers';
import { noHorizontalOverflow } from './helpers';

const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
const serious = (r: Awaited<ReturnType<typeof axe>>) =>
  r.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));

const vn = () => new Date(Date.now() + 7 * 3_600_000);
/** dd/MM/yyyy and yyyy-MM-dd of today + n days (Vietnam time). */
function day(n: number) {
  const iso = new Date(vn().getTime() + n * 86_400_000).toISOString().slice(0, 10);
  return { iso, vi: `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` };
}
/** an overdue appointment today needs the first slot (07:00) to be behind us */
const tooEarly = () => vn().getUTCHours() * 60 + vn().getUTCMinutes() < 7 * 60 + 5;

/**
 * Appointments v2 (FR-REC-044..047, UAT-P2-12): the five tabs with counters and keyboard, "Trễ hẹn" (computed on the
 * server clock, not bounded by the viewed day, with the call link), the date bar, cancel with a quick reason (and "Khác"
 * needing a note), reschedule with requester and reason and its history, no-show and advisor change, phones, axe.
 * Setup goes through the API (as the advisor of Quận 7); the behaviour under test is driven through the screen.
 */
test.describe('FR-REC-044..047 appointment tabs, reschedule, cancel reasons', () => {
  async function booker(browser: Parameters<typeof as>[0], user = 'cv.q7') {
    const s = await as(browser, user);
    const req = s.page.request;
    const v = (await getJson(req, '/api/v1/crm/vehicles?limit=8&q=51h123')) as Row;
    const book = async (date: string, time: string) =>
      (await post(req, '/api/v1/rec/appointments', {
        vehicleId: v.items[0].id,
        date,
        time,
        acknowledgeOverCapacity: true,
      })) as Row;
    return { ...s, book };
  }
  const check = async (page: Page) => {
    expect(serious(await axe(page))).toEqual([]);
    await noHorizontalOverflow(page);
  };

  test('overdue tab, counters, keyboard, date bar, reschedule history, no-show', async ({
    browser,
  }) => {
    test.skip(tooEarly(), 'needs the 07:00 slot to be in the past (server clock, Vietnam time)');
    test.setTimeout(180_000);
    const s = await booker(browser);
    const page = s.page;
    await page.emulateMedia({ reducedMotion: 'reduce' });
    try {
      const today = day(0);
      const od = await s.book(today.iso, '07:00');
      const od2 = await s.book(today.iso, '07:00');
      await page.goto('/rec/appointments');
      // the alert is on every tab, the default tab is Sắp tới
      await expect(page.getByTestId('apt-overdue-alert')).toContainText(/Có \d+\+? lịch trễ hẹn/);
      await expect(page.getByTestId('apt-tab-upcoming')).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByTestId('apt-count-overdue')).not.toHaveText(/^0/);
      await expect(page.getByTestId(`apt-row-${od.number}`)).toHaveCount(0);
      await check(page);

      // keyboard: arrows, Home and End move AND open the tab
      await page.getByTestId('apt-tab-upcoming').focus();
      await page.keyboard.press('ArrowRight');
      await expect(page).toHaveURL(/tab=overdue/);
      await expect(page.getByTestId('apt-tab-overdue')).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('tabpanel')).toBeVisible();
      await page.keyboard.press('End');
      await expect(page).toHaveURL(/tab=no_show/);
      await page.keyboard.press('Home');
      await expect(page.getByTestId('apt-tab-upcoming')).toHaveAttribute('aria-selected', 'true');

      // overdue: not bounded by the viewed day, no date bar, call link and quick actions
      await page.goto(`/rec/appointments?tab=overdue&from=${day(3).iso}`);
      await expect(page.getByTestId('apt-datebar')).toHaveCount(0);
      const row = page.getByTestId(`apt-row-${od.number}`);
      await expect(row).toBeVisible();
      await expect(row.getByText('Trễ hẹn', { exact: true })).toBeVisible();
      await expect(row.getByTestId('apt-late')).toContainText(/^Trễ \d+ (phút|giờ)/);
      await expect(row.getByRole('link', { name: /^Gọi khách/ })).toHaveAttribute(
        'href',
        /^tel:\d+/,
      );
      await expect(row.getByRole('button', { name: `Dời lịch ${od.number}` })).toBeVisible();
      await expect(
        row.getByRole('button', { name: `Đánh dấu vắng lịch ${od.number}` }),
      ).toBeVisible();
      await check(page);

      // reschedule the overdue one: requester follows the reason, history and "Đã dời 1 lần" appear
      const target = day(20);
      await row.getByRole('button', { name: `Dời lịch ${od.number}` }).click();
      const dlg = page.getByTestId('apt-resched-dialog');
      await expect(dlg).toBeVisible();
      await expect(dlg.getByTestId('apt-resched-dialog-go')).toBeDisabled();
      await dlg.getByLabel(/^Ngày mới/).fill(target.vi);
      await dlg.getByLabel(/^Giờ mới/).selectOption('14:00');
      await expect(dlg.getByTestId('apt-resched-to')).toContainText(`${target.vi} 14:00`);
      await check(page);
      await dlg.locator('label.radio', { hasText: 'Khách bận' }).click();
      await expect(dlg.getByTestId('apt-party-customer')).toBeChecked();
      if (await dlg.getByTestId('apt-resched-over-ok').isVisible())
        await dlg.getByTestId('apt-resched-over-ok').check({ force: true });
      await dlg.getByTestId('apt-resched-dialog-go').click();
      await expect(page.getByTestId('apt-flash')).toContainText(
        `Lịch ${od.number} đã dời sang ${target.vi} 14:00`,
      );
      await expect(page.getByTestId(`apt-row-${od.number}`)).toHaveCount(0);

      await page.goto(`/rec/appointments?from=${target.iso}`);
      const moved = page.getByTestId(`apt-row-${od.number}`);
      await expect(moved.getByTestId('apt-resched-count')).toHaveText('Đã dời 1 lần');
      await expect(moved).toContainText(`Hẹn ban đầu ${today.vi} 07:00`);
      await moved.getByTestId('apt-open').click();
      const hist = page.getByTestId('apt-history');
      await expect(hist).toContainText(`${today.vi} 07:00 → ${target.vi} 14:00`);
      await expect(hist).toContainText('Khách bận');
      await expect(hist).toContainText('Khách đề nghị');
      await check(page);
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('apt-drawer')).toHaveCount(0);

      // no-show from the overdue tab: the row leaves it and lands on the Vắng tab
      await page.goto('/rec/appointments?tab=overdue');
      await page.getByRole('button', { name: `Đánh dấu vắng lịch ${od2.number}` }).click();
      await page.getByTestId('apt-no-show-dialog-go').click();
      await expect(page.getByTestId('apt-flash')).toContainText(od2.number);
      await expect(page.getByTestId(`apt-row-${od2.number}`)).toHaveCount(0);
      await page.goto(`/rec/appointments?tab=no_show&from=${today.iso}`);
      await expect(page.getByTestId(`apt-row-${od2.number}`)).toBeVisible();
      await expect(page.getByTestId(`apt-row-${od2.number}`).getByRole('button')).toHaveCount(1); // only the plate (view only)
    } finally {
      await s.ctx.close();
    }
  });

  test('date bar: title, chips, week from Monday, a non-existent date is refused', async ({
    browser,
  }) => {
    const s = await booker(browser);
    const page = s.page;
    try {
      await page.goto('/rec/appointments');
      await expect(page.getByTestId('apt-date-title')).toContainText(
        /(Thứ (Hai|Ba|Tư|Năm|Sáu|Bảy)|Chủ nhật), \d{2}\/\d{2}\/\d{4}/,
      );
      await expect(page.getByTestId('apt-date-chip')).toHaveText('Hôm nay');
      await expect(page.getByTestId('apt-today')).toBeDisabled();
      await page.getByTestId('apt-next').click();
      await expect(page.getByTestId('apt-date-chip')).toHaveText('Ngày mai');
      await expect(page.getByTestId('apt-next')).toHaveAttribute(
        'aria-label',
        new RegExp(`^Ngày sau, ${day(2).vi}$`),
      );
      await page.getByTestId('apt-today').click();
      await expect(page.getByTestId('apt-date-chip')).toHaveText('Hôm nay');
      await page.getByTestId('apt-prev').click();
      await expect(page.getByTestId('apt-date-chip')).toHaveText('Hôm qua');
      // typed date: a real one moves the day, 31/02/2026 is refused in words and the day stays
      const input = page.getByTestId('apt-date-input');
      await input.fill('31/02/2026');
      await input.press('Enter');
      await expect(page.getByTestId('apt-date-error')).toContainText('Ngày không có thật');
      await input.fill('05/11/2026');
      await input.press('Enter');
      await expect(page.getByTestId('apt-date-title')).toContainText('Thứ Năm, 05/11/2026');
      await expect(page.getByTestId('apt-date-chip')).toHaveCount(0);
      // week: Monday to Sunday, ISO number
      await page.getByTestId('apt-view-week').click();
      await expect(page.getByTestId('apt-date-title')).toContainText(
        'Tuần 45 (02/11 – 08/11/2026)',
      );
      await check(page);
    } finally {
      await s.ctx.close();
    }
  });

  test('cancel by quick reason, "Khác" needs a note; advisor change; the other tabs show the result', async ({
    browser,
  }) => {
    test.setTimeout(150_000);
    const s = await booker(browser);
    const page = s.page;
    try {
      const d = day(25);
      const a1 = await s.book(d.iso, '10:00');
      const a2 = await s.book(d.iso, '11:00');
      const a3 = await s.book(d.iso, '12:00');
      await page.goto(`/rec/appointments?from=${d.iso}`);

      // quick reason
      await page.getByRole('button', { name: `Hủy lịch ${a1.number}` }).click();
      const dlg = page.getByTestId('apt-cancel-dialog');
      await expect(dlg.getByTestId('apt-cancel-dialog-go')).toBeDisabled();
      await expect(dlg.getByTestId('apt-cancel-why')).toContainText('Chọn một lý do hủy');
      await dlg.locator('label.radio', { hasText: 'Khách bận hoặc đổi kế hoạch' }).click();
      await expect(dlg.getByText('Khách chỉ muốn đổi giờ?')).toBeVisible(); // hint towards Dời lịch
      await check(page);
      await dlg.getByTestId('apt-cancel-dialog-go').click();
      await expect(page.getByTestId('apt-flash')).toContainText(a1.number);

      // "Khác": a note of 3+ characters is required
      await page.getByRole('button', { name: `Hủy lịch ${a2.number}` }).click();
      await dlg.locator('label.radio', { hasText: /^Khác$/ }).click();
      await expect(dlg.getByTestId('apt-cancel-dialog-go')).toBeDisabled();
      await dlg.getByTestId('apt-cancel-note').fill('ab');
      await expect(dlg.getByTestId('apt-cancel-dialog-go')).toBeDisabled();
      await expect(dlg.getByText(/Nhập ghi chú tối thiểu 3 ký tự/)).toBeVisible();
      await dlg.getByTestId('apt-cancel-note').fill('Khách đổi xe');
      await expect(dlg.getByTestId('apt-cancel-dialog-go')).toBeEnabled();
      await dlg.getByTestId('apt-cancel-dialog-go').click();
      await expect(page.getByTestId('apt-flash')).toContainText(a2.number);

      // advisor change (drawer)
      await page.getByTestId(`apt-row-${a3.number}`).getByTestId('apt-open').click();
      await page.getByTestId('apt-drawer-advisor').click();
      await page.getByTestId('apt-advisor-select').selectOption({ label: 'Quản lý Quận 7' });
      await page.getByTestId('apt-advisor-dialog-go').click();
      await expect(page.getByTestId('apt-flash')).toContainText('Đã đổi cố vấn');
      await expect(page.getByTestId(`apt-row-${a3.number}`)).toContainText(
        'Cố vấn: Quản lý Quận 7',
      );

      // the cancelled tab shows both reasons, and the counter equals the list
      await page.goto(`/rec/appointments?tab=cancelled&from=${d.iso}`);
      const c1 = page.getByTestId(`apt-row-${a1.number}`);
      await expect(c1.getByTestId('apt-cancel-info')).toContainText('Khách bận hoặc đổi kế hoạch');
      await expect(
        page.getByTestId(`apt-row-${a2.number}`).getByTestId('apt-cancel-info'),
      ).toContainText('Khác (Khách đổi xe)');
      const n = await page.getByTestId(/^apt-row-/).count();
      await expect(page.getByTestId('apt-count-cancelled')).toContainText(String(n));
      await check(page);
    } finally {
      await s.ctx.close();
    }
  });

  test('view-only roles see the tabs but no action buttons; phones do not overflow with the overdue tab and a dialog', async ({
    browser,
  }) => {
    const tn = await as(browser, 'tn.q7');
    try {
      await tn.page.goto('/rec/appointments?tab=overdue');
      await expect(tn.page.getByRole('tab')).toHaveCount(5);
      await expect(tn.page.getByText('Bạn chỉ xem lịch')).toBeVisible();
      await expect(
        tn.page.getByRole('button', { name: /^(Dời lịch|Hủy lịch|Đánh dấu vắng)/ }),
      ).toHaveCount(0);
      await expect(tn.page.getByTestId('apt-new')).toHaveCount(0);
    } finally {
      await tn.ctx.close();
    }
    for (const width of [390, 320]) {
      const s = await booker(browser);
      try {
        await s.page.setViewportSize({ width, height: 800 });
        if (!tooEarly()) await s.book(day(0).iso, '07:00');
        await s.page.goto('/rec/appointments?tab=overdue');
        await noHorizontalOverflow(s.page);
        await s.page.goto(`/rec/appointments?from=${day(3).iso}`);
        await noHorizontalOverflow(s.page);
        await s.page.goto('/rec/appointments?view=week');
        await noHorizontalOverflow(s.page);
        await s.page.goto('/rec/appointments?tab=overdue');
        const dlgBtn = s.page.getByTestId('apt-resched').first();
        if (await dlgBtn.count()) {
          await dlgBtn.click();
          await expect(s.page.getByTestId('apt-resched-dialog')).toBeVisible();
          await noHorizontalOverflow(s.page);
        }
      } finally {
        await s.ctx.close();
      }
    }
  });
});
