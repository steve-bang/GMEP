import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { as } from './acc-helpers';
import { noHorizontalOverflow } from './helpers';

const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
const serious = (r: Awaited<ReturnType<typeof axe>>) =>
  r.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));

/** dd/MM/yyyy and yyyy-MM-dd of today + n days (Vietnam time; the server books by that business date). */
function day(n: number) {
  const d = new Date(Date.now() + 7 * 3_600_000 + n * 86_400_000);
  const iso = d.toISOString().slice(0, 10);
  return { iso, vi: `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` };
}

/**
 * FR-REC-019, 027 / G2-APT-01, 02: the advisor of Quận 7 (capacity 2 a day in the demo data) books an appointment from the
 * calendar, sees it on the day, is warned at the third booking of the same day and confirms, then presses "Đã đến" and lands
 * on the pre-filled intake. The manager cancels another one with a mandatory reason.
 */
test.describe('FR-REC-019, 027 appointment screens', () => {
  test('book, see on the calendar, over-capacity warning with confirmation, arrive opens the intake, cancel needs a reason', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const cv = await as(browser, 'cv.q7');
    const page = cv.page;
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const d = day(5);
    try {
      await page.goto('/rec/appointments');
      await expect(page.getByRole('link', { name: '+ Tạo lịch hẹn' })).toBeVisible();
      await page.getByRole('link', { name: '+ Tạo lịch hẹn' }).click();
      await expect(page).toHaveURL(/\/rec\/appointments\/new$/);
      await expect(page.getByRole('heading', { name: 'Tạo lịch hẹn', level: 1 })).toBeVisible();
      expect(serious(await axe(page))).toEqual([]);
      await noHorizontalOverflow(page);

      const book = async (note: string) => {
        await page.goto('/rec/appointments/new');
        await page.getByLabel(/^Xe \(tìm theo/).fill('51h123');
        await page.getByTestId('apt-hit').first().getByRole('button').click();
        await expect(page.getByTestId('apt-picked')).toContainText('51H');
        await page.getByLabel(/^Ngày hẹn/).fill(d.vi);
        await page.getByLabel(/^Khung giờ/).selectOption('09:00');
        await page.getByLabel('Ghi chú').fill(note);
        await page.getByTestId('apt-save').click();
      };

      // validation first: nothing picked, no time
      await page.goto('/rec/appointments/new');
      await page.getByTestId('apt-save').click();
      await expect(page.getByText('Chọn xe để đặt lịch.')).toBeVisible();
      await expect(page.getByText('Chọn khung giờ.')).toBeVisible();

      await book('E2E lịch 1');
      await expect(page).toHaveURL(new RegExp(`/rec/appointments\\?from=${d.iso}`));
      await expect(page.getByTestId(`apt-day-${d.iso}`)).toContainText('1/2');
      await expect(page.getByTestId(/^apt-row-/).first()).toContainText('09:00');
      await book('E2E lịch 2');
      await expect(page).toHaveURL(new RegExp(`/rec/appointments\\?from=${d.iso}`));
      await expect(page.getByTestId(`apt-day-${d.iso}`)).toContainText('2/2');

      // third booking on a full day: warning with the figures, then confirm
      await book('E2E lịch 3');
      await expect(page.getByTestId('apt-over')).toBeVisible();
      await expect(page.getByTestId('apt-over')).toContainText('2/2');
      expect(serious(await axe(page))).toEqual([]);
      await page.getByTestId('apt-over-confirm').click();
      await expect(page).toHaveURL(new RegExp(`/rec/appointments\\?from=${d.iso}`));
      await expect(page.getByText('Đặt khi vượt công suất')).toBeVisible();
      await expect(page.getByTestId(`apt-day-${d.iso}`)).toContainText('Vượt công suất');
      expect(serious(await axe(page))).toEqual([]);
      await noHorizontalOverflow(page);

      // edit: the screen no longer moves the date (FR-REC-046); it points to Dời lịch and still saves the note
      await page.getByTestId('apt-open').first().click();
      await page.getByTestId('apt-edit').click();
      await expect(page.getByRole('heading', { name: 'Sửa lịch hẹn', level: 1 })).toBeVisible();
      await expect(page.getByLabel(/^Ngày hẹn/)).toHaveCount(0);
      await expect(page.getByLabel(/^Khung giờ/)).toHaveCount(0);
      await expect(page.getByTestId('apt-go-resched')).toBeVisible();
      await page.getByLabel('Ghi chú').fill('E2E sửa ghi chú');
      await page.getByTestId('apt-save').click();
      await expect(page).toHaveURL(new RegExp(`/rec/appointments\\?from=${d.iso}`));

      // cancel needs a reason from the catalogue (the dialog is shared by the rows, the button names carry the number)
      await page.getByTestId('apt-cancel').last().click();
      const dlg = page.getByTestId('apt-cancel-dialog');
      await expect(dlg).toBeVisible();
      await expect(dlg.getByTestId('apt-cancel-dialog-go')).toBeDisabled();
      await dlg.locator('label.radio', { hasText: 'Khách yêu cầu hủy' }).click();
      await dlg.getByTestId('apt-cancel-dialog-go').click();
      await expect(page.getByTestId('apt-flash')).toBeVisible();
      await page.goto(`/rec/appointments?tab=cancelled&from=${d.iso}`);
      await expect(page.getByTestId('apt-cancel-info').first()).toContainText('Khách yêu cầu hủy');

      // arrive opens the pre-filled intake
      await page.goto(`/rec/appointments?from=${d.iso}`);
      await page.getByTestId('apt-arrive').first().click();
      await expect(page).toHaveURL(/\/rec\/intakes\/[^/]+$/);
    } finally {
      await cv.ctx.close();
    }
  });

  test('phone widths: the form does not overflow at 390 and 320', async ({ browser }) => {
    for (const width of [390, 320]) {
      const cv = await as(browser, 'cv.q7', { width, height: 800 });
      try {
        await cv.page.goto('/rec/appointments/new');
        await expect(cv.page.getByTestId('appointment-form')).toBeVisible();
        await noHorizontalOverflow(cv.page);
        await cv.page.goto('/rec/appointments');
        await noHorizontalOverflow(cv.page);
      } finally {
        await cv.ctx.close();
      }
    }
  });

  test('platform name is GMEP and the ranking formula is in Vietnamese', async ({ browser }) => {
    const owner = await as(browser, 'chu');
    try {
      await owner.page.goto('/rpt/ranking');
      await expect(owner.page).toHaveTitle(/GMEP/);
      await expect(owner.page.getByText(/Tổng \(tiền công \+ phụ tùng\)/)).toBeVisible();
      await expect(owner.page.getByText(/sum\(/)).toHaveCount(0);
    } finally {
      await owner.ctx.close();
    }
  });
});
