import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { loginOk, noHorizontalOverflow } from './helpers';

const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
const serious = (r: Awaited<ReturnType<typeof axe>>) =>
  r.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));

/** Slice 1.5 (first part): FR-REC-001, 002, 003, 004, 005, 007; RULE-007; the journey intake -> quote -> sent. */
test.describe('slice 1.5 REC: intake wizard and quote', () => {
  test('advisor: intake in 5 steps (km warning), quote with labor and part lines, send, new version', async ({
    page,
  }) => {
    await loginOk(page, 'cv.q7@demo.gmep.test');
    await page.goto('/rec/intakes');
    await expect(page.getByRole('heading', { name: 'Tiếp nhận xe', level: 1 })).toBeVisible();
    expect(serious(await axe(page))).toEqual([]);
    await noHorizontalOverflow(page);

    // step 1: the plate finds the vehicle and its owner (FR-REC-001)
    await page.goto('/rec/intakes/new');
    expect(serious(await axe(page))).toEqual([]);
    await page.getByLabel('Biển số xe').fill('51h12345');
    const found = page.getByTestId('vehicle-found');
    await expect(found).toContainText('Toyota Vios 1.5G 2019');
    await expect(found).toContainText('Nguyễn Văn An');
    await page.getByTestId('intake-start-btn').click();
    await expect(page).toHaveURL(/\/rec\/intakes\/tx_/);

    // step 2: odometer and the customer's own words are required (FR-REC-002)
    await expect(page.getByTestId('step-title')).toContainText('Bước 2/5');
    expect(serious(await axe(page))).toEqual([]);
    await noHorizontalOverflow(page);
    await page.getByTestId('wizard-next').click();
    await expect(page.getByText('Nhập số km trên đồng hồ để tiếp tục.')).toBeVisible();
    await expect(page.getByText('Ghi yêu cầu của khách để tiếp tục.')).toBeVisible();
    // FR-REC-003: below the last reading (64.200 km) asks for a reason
    await page.getByLabel('Số km hiện tại').fill('60000');
    await expect(page.getByTestId('km-warning')).toBeVisible();
    expect(serious(await axe(page))).toEqual([]);
    await page.getByTestId('wizard-next').click();
    await expect(page.locator('#kmReason-e')).toBeVisible();
    await page.locator('#km-reason').selectOption({ label: 'Đã thay đồng hồ' });
    await page
      .getByLabel('Yêu cầu của khách (theo lời khách)')
      .fill('Thay nhớt định kỳ, xe kêu khi đạp phanh');
    await page.getByTestId('wizard-next').click();

    // step 3 and 4
    await expect(page.getByTestId('step-title')).toContainText('Bước 3/5');
    await page.getByLabel('Camera hành trình').check();
    await page.getByTestId('wizard-next').click();
    await expect(page.getByTestId('step-title')).toContainText('Bước 4/5');
    await page.getByLabel('Loại dịch vụ').selectOption({ label: 'Bảo dưỡng' });
    await page.getByLabel('Ngày hẹn giao').fill('31122099');
    await page.getByTestId('wizard-next').click();

    // step 5: review, then complete
    await expect(page.getByTestId('intake-review')).toContainText('60.000 km');
    await expect(page.getByTestId('intake-review')).toContainText('Camera hành trình');
    await page.getByTestId('wizard-finish').click();
    await expect(page.getByTestId('intake-summary')).toContainText('Thay nhớt định kỳ');

    // quote: from the completed intake only (RULE-007)
    await page.getByTestId('quote-start').click();
    await expect(page).toHaveURL(/\/rec\/quotes\/qt_/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/BG-Q7-\d{4}-\d{5}-v1/);
    await expect(page.getByTestId('quote-send')).toBeDisabled();
    await page.getByTestId('add-item').click();
    await page.getByTestId('pick-service-0').fill('bao');
    await page.getByRole('option', { name: /SV-DAU/ }).click();
    await page.getByTestId('pick-part-0').fill('loc');
    await page.getByRole('option', { name: /LOC-DAU-TY01/ }).click();
    await expect(page.getByTestId('available')).toContainText('Khả dụng');
    expect(serious(await axe(page))).toEqual([]);
    await noHorizontalOverflow(page);
    await page.getByTestId('quote-save').click();
    // 30 phút x 300.000 / 60 = 150.000 + 1 x 130.000 = 280.000; sample VAT 8% = 22.400
    await expect(page.getByTestId('total-subtotal')).toContainText('280.000');
    await expect(page.getByTestId('total-tax')).toContainText('22.400');
    await expect(page.getByTestId('total-grand')).toContainText('302.400');

    // a discount above the advisor's limit is refused with a field message (FR-INV-025)
    await page.getByLabel(/Giá thực tế Lọc dầu Toyota/).fill('100000');
    await page.getByTestId('quote-save').click();
    await expect(page.getByText(/vượt hạn mức/)).toBeVisible();
    await page.getByLabel(/Giá thực tế Lọc dầu Toyota/).fill('');
    await page.getByTestId('quote-save').click();
    await expect(page.getByText(/Có thay đổi chưa lưu/)).toHaveCount(0); // saved
    await page.reload(); // fresh version for the next action

    await page.getByTestId('quote-send').click();
    await expect(page.locator('.badge', { hasText: 'Chờ khách duyệt' })).toBeVisible();
    // a sent quote is edited as the next version
    await expect(page.getByText(/tạo phiên bản v2/)).toBeVisible();
    await page.getByLabel(/Số lượng Lọc dầu Toyota/).fill('2');
    await page.getByTestId('quote-save').click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('-v2');
    await expect(page.getByTestId('total-subtotal')).toContainText('410.000');
    await expect(page.getByRole('link', { name: /v1 · Chờ khách duyệt/ })).toBeVisible();

    await page.goto('/rec/quotes');
    await expect(page.getByTestId('quote-no').first()).toBeVisible();
    expect(serious(await axe(page))).toEqual([]);
    await noHorizontalOverflow(page);
  });

  test('branch isolation and roles: Thu Duc manager sees none of the Q7 quotes; the storekeeper only reads quotes', async ({
    page,
  }) => {
    await loginOk(page, 'ql.td@demo.gmep.test');
    await page.goto('/rec/quotes');
    await expect(page.getByRole('heading', { name: 'Báo giá', level: 1 })).toBeVisible();
    await expect(page.getByText(/BG-Q7-/)).toHaveCount(0);
    await page.context().clearCookies();
    await loginOk(page, 'tk.q7@demo.gmep.test');
    await page.goto('/rec/quotes');
    await expect(page.getByTestId('quote-no').first()).toBeVisible();
    await page.goto('/rec/intakes');
    await expect(page.getByText('Bạn chưa có quyền xem mục này')).toBeVisible();
  });

  test('phone width: intake and quote screens do not overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginOk(page, 'cv.q7@demo.gmep.test');
    for (const path of ['/rec/intakes', '/rec/intakes/new', '/rec/quotes']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await noHorizontalOverflow(page);
    }
  });
});
