import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { loginOk, noHorizontalOverflow } from './helpers';

const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
const serious = (r: Awaited<ReturnType<typeof axe>>) =>
  r.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));

const SETTINGS = [
  '/sys/users',
  '/sys/audit',
  '/sys/config',
  '/sys/config/tax-rate',
  '/sys/config/discount-limit',
  '/sys/branches',
  '/sys/warehouses',
  '/sys/services',
  '/sys/price-lists',
];

test.describe('UI alignment with design G4-SYS-* (settings frame, users, config, audit)', () => {
  test('settings pages share the frame, pass axe and do not overflow on desktop and phone', async ({
    page,
  }) => {
    await loginOk(page, 'chu@demo.gmep.test');
    for (const [w, h] of [
      [1280, 800],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width: w, height: h });
      for (const path of SETTINGS) {
        await page.goto(path);
        await expect(page.getByRole('navigation', { name: 'Đường dẫn' })).toContainText('Cài đặt');
        await expect(
          page.getByRole('status').filter({ hasText: 'Phạm vi cấu hình' }),
        ).toContainText('Cập nhật lúc');
        await expect(page.getByRole('button', { name: 'Làm mới' })).toBeVisible();
        expect(serious(await axe(page)), `${path} @${w}`).toEqual([]);
        await noHorizontalOverflow(page);
      }
    }
  });

  test('user list: unaccented search, filters, summary line, sort, masked phone', async ({
    page,
  }) => {
    await loginOk(page, 'chu@demo.gmep.test');
    await page.goto('/sys/users');
    await expect(page.getByTestId('user-summary')).toHaveText(
      /\d+ người dùng · 1 chờ kích hoạt · 1 bị khóa/,
    );
    await page.getByLabel('Tìm tên hoặc email').fill('quan ly quan 7');
    await page.getByRole('button', { name: 'Áp dụng' }).click();
    await expect(page.getByTestId('user-code')).toHaveCount(1);
    await expect(page.getByTestId('user-summary')).toHaveText(/^1 người dùng/);
    await page.getByRole('link', { name: 'Đặt lại' }).click();
    await page.getByLabel('Trạng thái').selectOption('invited');
    await page.getByRole('button', { name: 'Áp dụng' }).click();
    await expect(page.getByTestId('user-code')).toHaveText(['NV0701']);
    await expect(page.getByText('Chưa đăng nhập')).toBeVisible();
    // no match -> filtered empty state with a reset action
    await page.getByLabel('Tìm tên hoặc email').fill('khong ton tai');
    await page.getByRole('button', { name: 'Áp dụng' }).click();
    await expect(page.getByText('Không có người dùng khớp', { exact: true })).toBeVisible();
    // sort header toggles and is announced
    await page.goto('/sys/users?sort=name&dir=asc');
    await expect(page.getByRole('columnheader', { name: /Họ và tên/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    // the seeded phone numbers are masked for the owner too: never a full number in the list
    await expect(page.getByText(/09\d{8}/)).toHaveCount(0);
  });

  test('dates are dd/MM/yyyy and no technical code reaches the audit screen', async ({ page }) => {
    await loginOk(page, 'chu@demo.gmep.test');
    await page.goto('/sys/audit');
    const from = page.getByLabel('Từ ngày');
    await expect(from).toHaveAttribute('placeholder', 'dd/MM/yyyy');
    await from.fill('01112026');
    await expect(from).toHaveValue('01/11/2026');
    await expect(page.locator('input[type="date"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Áp dụng' }).click();
    await expect(page.getByLabel('Từ ngày')).toHaveValue('01/11/2026');
    const actions = await page.getByTestId('audit-action').allInnerTexts();
    expect(actions.length).toBeGreaterThan(0);
    for (const a of actions) expect(a).not.toMatch(/^[a-z]+[._][a-z_]+$/i);
    await expect(page.getByLabel('Loại bản ghi')).not.toHaveAttribute('placeholder', /./);
    // before/after detail opens without raw JSON
    await page.getByText('Chi tiết', { exact: true }).first().click();
    await expect(page.locator('details[open]')).toBeVisible();
    await expect(page.locator('details[open]')).not.toContainText('{');
  });

  test('tax rate page: readable values and status, percent input stored as basis points', async ({
    page,
  }) => {
    await loginOk(page, 'kt@demo.gmep.test');
    await page.goto('/sys/config/tax-rate');
    await expect(page.getByText('Giá trị dưới đây là số minh họa')).toBeVisible();
    await page.getByLabel('Khóa phạm vi').fill('VAT-UI');
    await page.getByLabel('Hiệu lực từ').fill('01/01/2030');
    await page.getByLabel(/^Tên\*?$/).fill('Mẫu giao diện');
    await page.getByLabel(/Thuế suất \(%\)/).fill('8,5');
    await page.getByLabel('Lý do').fill('kiểm thử giao diện');
    await page.getByRole('button', { name: 'Gửi đề xuất' }).click();
    const row = page.getByRole('row').filter({ hasText: 'VAT-UI' });
    await expect(row).toContainText('Mẫu giao diện · 8,5%');
    await expect(row).toContainText('01/01/2030');
    await expect(row).toContainText('Chờ duyệt');
    await expect(row).not.toContainText('rateBp');
    // an invalid date is rejected next to the field, typed data kept
    await page.getByLabel('Khóa phạm vi').fill('VAT-UI2');
    await page.getByLabel('Hiệu lực từ').fill('31/02/2030');
    await page.getByRole('button', { name: 'Gửi đề xuất' }).click();
    await expect(page.locator('.field__error').first()).toBeVisible();
    await expect(page.getByLabel('Khóa phạm vi')).toHaveValue('VAT-UI2');
  });

  test('sidebar collapses, remembers the choice and marks read-only entries', async ({ page }) => {
    await loginOk(page, 'kt@demo.gmep.test'); // accountant: views users? no; views audit/config
    await page.getByRole('button', { name: 'Thu gọn' }).click();
    await expect(page.locator('#app')).toHaveClass(/is-collapsed/);
    await page.reload();
    await expect(page.locator('#app')).toHaveClass(/is-collapsed/);
    await page.getByRole('button', { name: 'Mở rộng thanh bên' }).click();
    await expect(page.locator('#app')).not.toHaveClass(/is-collapsed/);
    await loginAs(page);
  });
});

async function loginAs(page: Page) {
  // the storekeeper can view warehouses but not change them: the entry carries the "Chỉ xem" lock
  await page.context().clearCookies();
  await loginOk(page, 'tk.q7@demo.gmep.test');
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole('link', { name: 'Kho Chỉ xem' })).toBeVisible();
}
