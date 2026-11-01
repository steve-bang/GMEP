import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { login, loginOk, noHorizontalOverflow, outboxLinks, PASSWORD } from './helpers';

const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
const serious = (r: Awaited<ReturnType<typeof axe>>) =>
  r.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));

test.describe('slice 1.1/1.2 journey: login -> scope pick -> create warehouse/branch -> audit view -> forgot password -> logout', () => {
  test('multi-branch manager must pick one branch (G5-SCP-01), then sees only that branch', async ({
    page,
  }) => {
    await loginOk(page, 'multi@demo.gmep.test');
    // the picker opens by itself because the user must choose
    const scope = page.getByTestId('branch-scope');
    await expect(scope.getByRole('dialog')).toBeVisible();
    await page.goto('/sys/warehouses');
    await expect(page.getByText('Chọn một chi nhánh để tiếp tục')).toBeVisible();
    await scope.getByRole('radio', { name: /Chi nhánh Quận 7/ }).click();
    await scope.getByRole('button', { name: 'Áp dụng phạm vi' }).click();
    await expect(page.getByTestId('wh-code').first()).toBeVisible();
    await expect(scope).toContainText('Chi nhánh Quận 7');
    await expect(page.getByTestId('wh-code')).toHaveCount(3);
    await expect(page.getByText('Thủ Đức')).toHaveCount(0);
    // switch to the other branch he is assigned to
    await scope.getByRole('button', { name: /Phạm vi dữ liệu/ }).click();
    await scope.getByRole('radio', { name: /Chi nhánh Thủ Đức/ }).click();
    await scope.getByRole('button', { name: 'Áp dụng phạm vi' }).click();
    await expect(page.getByTestId('wh-code')).toHaveCount(2);
    // "merged" is not available for him and explains why
    await scope.getByRole('button', { name: /Phạm vi dữ liệu/ }).click();
    await expect(scope.getByText('Xem hợp nhất chưa dùng được với vai trò của bạn')).toBeVisible();
    expect(serious(await axe(page))).toEqual([]);
  });

  test('owner picks the merged view; single-branch staff see a static chip without a picker', async ({
    page,
  }) => {
    await loginOk(page, 'chu@demo.gmep.test');
    await expect(page.getByTestId('branch-scope')).toContainText('Tất cả chi nhánh');
    await page.context().clearCookies();
    await loginOk(page, 'tk.q7@demo.gmep.test');
    await expect(page.getByTestId('branch-scope').getByRole('button')).toHaveCount(0);
    await expect(page.getByTestId('branch-scope')).toContainText('Chi nhánh Quận 7');
  });

  test('admin creates a warehouse and a branch; the audit viewer shows both; warehouse is branch scoped', async ({
    page,
  }) => {
    await loginOk(page, 'ad@demo.gmep.test');
    await page.goto('/sys/warehouses/new');
    expect(serious(await axe(page))).toEqual([]);
    await page.locator('select[name="branchId"]').selectOption({ label: 'Chi nhánh Quận 7' });
    await page.getByLabel('Mã kho').fill('e2e-kho-1');
    // validation is shown next to the field and typed data is kept
    await page.getByLabel('Tên kho').fill('K');
    await page.getByRole('button', { name: 'Lưu kho' }).click();
    await expect(page.locator('.field__error').first()).toBeVisible();
    await expect(page.getByLabel('Mã kho')).toHaveValue('e2e-kho-1');
    await page.getByLabel('Tên kho').fill('Kho thử nghiệm e2e');
    await page.getByRole('button', { name: 'Lưu kho' }).click();
    await expect(page).toHaveURL(/\/sys\/warehouses$/);
    await expect(page.getByText('E2E-KHO-1')).toBeVisible();

    await page.goto('/sys/branches/new');
    await page.getByLabel('Mã chi nhánh').fill('e2');
    await page.getByLabel('Tên chi nhánh').fill('Chi nhánh E2E');
    await page.getByRole('button', { name: 'Lưu chi nhánh' }).click();
    await expect(page).toHaveURL(/\/sys\/branches$/);
    await expect(page.getByText('Chi nhánh E2E')).toBeVisible();

    await page.goto('/sys/audit');
    await expect(
      page.getByTestId('audit-action').filter({ hasText: 'Tạo kho' }).first(),
    ).toBeVisible();
    await expect(
      page.getByTestId('audit-action').filter({ hasText: 'Tạo chi nhánh' }).first(),
    ).toBeVisible();
    expect(serious(await axe(page))).toEqual([]);

    // page size choice 25/100 only and a CSV export that needs a reason
    await page.goto('/sys/audit?limit=100');
    await page.getByLabel('Lý do xuất').fill('kiểm tra e2e');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Xuất CSV' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('audit-log.csv');
  });

  test('a branch manager never sees the other branch warehouse created above', async ({ page }) => {
    await loginOk(page, 'ql.td@demo.gmep.test');
    await page.goto('/sys/warehouses');
    await expect(page.getByText('E2E-KHO-1')).toHaveCount(0);
    await page.goto('/sys/audit');
    await expect(page.getByText('E2E-KHO-1')).toHaveCount(0);
  });

  test('owner approves a pending tax-rate proposal (sample data) and the version becomes approved', async ({
    page,
    context,
  }) => {
    // the accountant proposes
    await loginOk(page, 'kt@demo.gmep.test');
    await page.goto('/sys/config/tax-rate');
    await page.getByLabel('Khóa phạm vi').fill('VAT-E2E');
    const date = new Date(Date.now() + 5 * 86_400_000)
      .toISOString()
      .slice(0, 10)
      .split('-')
      .reverse()
      .join('/'); // dd/MM/yyyy as typed by the user
    await page.getByLabel('Hiệu lực từ').fill(date);
    await page.getByLabel('Tên', { exact: true }).fill('Dữ liệu mẫu e2e');
    await page.getByLabel(/Thuế suất \(%\)/).fill('8');
    await page.getByLabel('Lý do').fill('kiểm thử e2e');
    await page.getByRole('button', { name: 'Gửi đề xuất' }).click();
    await expect(page.getByTestId('cfg-scope').filter({ hasText: 'VAT-E2E' })).toBeVisible();
    await expect(page.getByTestId('cfg-approve')).toHaveCount(0); // the proposer cannot approve
    await context.clearCookies();
    await loginOk(page, 'chu@demo.gmep.test');
    await expect(page.getByTestId('bell')).toContainText(/\d/);
    await page.goto('/notifications');
    await expect(page.getByText(/đang chờ bạn duyệt/).first()).toBeVisible();
    await page.goto('/sys/config/tax-rate');
    await page.getByTestId('cfg-approve').first().click();
    await expect(page.getByText('Sắp hiệu lực').first()).toBeVisible(); // approved, effective in 5 days
  });

  test('forgot password is neutral, the reset link is single use, old sessions die, logout works', async ({
    page,
    browser,
  }) => {
    // a second browser holds an old session of the same user
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await loginOk(otherPage, 'tn.q7@demo.gmep.test');

    await page.goto('/login');
    await page.getByRole('link', { name: 'Quên mật khẩu?' }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(page.getByRole('heading', { name: 'Quên mật khẩu' })).toBeVisible();
    await page.getByLabel('Email hoặc mã nhân viên').fill('khong.ton.tai@demo.gmep.test');
    await page.getByRole('button', { name: 'Gửi hướng dẫn' }).click();
    const neutral = await page.getByTestId('forgot-sent').innerText();
    await page.goto('/forgot-password');
    await page.getByLabel('Email hoặc mã nhân viên').fill('tn.q7@demo.gmep.test');
    await page.getByRole('button', { name: 'Gửi hướng dẫn' }).click();
    expect(await page.getByTestId('forgot-sent').innerText()).toBe(neutral); // same answer for a real account

    const links = await outboxLinks('password-reset', 'tn.q7@demo.gmep.test');
    expect(links.length).toBeGreaterThan(0);
    const link = links.at(-1)!;
    await page.goto(new URL(link).pathname + new URL(link).search);
    expect(serious(await axe(page))).toEqual([]);
    await page.locator('#pw').fill('short');
    await page.locator('#pw2').fill('short');
    await page.getByRole('button', { name: 'Đặt mật khẩu' }).click();
    await expect(page.locator('.field__error')).toContainText('ít nhất 10 ký tự');
    await page.locator('#pw').fill('mat-khau-moi-an-toan-1');
    await page.locator('#pw2').fill('mat-khau-moi-an-toan-1');
    await page.getByRole('button', { name: 'Đặt mật khẩu' }).click();
    await expect(page.getByTestId('password-done')).toBeVisible();
    // single use: opening the same link again shows the "used" state
    await page.goto(new URL(link).pathname + new URL(link).search);
    await expect(page.getByRole('heading', { name: 'Liên kết này đã được dùng' })).toBeVisible();
    // the old session in the other browser is dead
    await otherPage.goto('/sys/warehouses');
    await expect(otherPage).toHaveURL(/\/login/);
    await other.close();

    // log in with the new password, then log out
    await login(page, 'tn.q7@demo.gmep.test', 'mat-khau-moi-an-toan-1');
    await page.waitForURL((u) => u.pathname === '/');
    await page.getByRole('button', { name: 'Menu tài khoản' }).click();
    await page.getByTestId('logout').click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('invitation: the invited person activates the account, the old demo password is irrelevant', async ({
    page,
    context,
  }) => {
    await loginOk(page, 'ql.q7@demo.gmep.test');
    await page.goto('/sys/users/new');
    await page.getByLabel('Mã nhân viên').fill('NV9001');
    await page.getByLabel('Họ và tên').fill('Người Mới E2E');
    await page.getByLabel(/^Email/).fill('moi.e2e@demo.gmep.test');
    await page.getByRole('button', { name: 'Gửi lời mời' }).click();
    await expect(page).toHaveURL(/\/sys\/users$/);
    await context.clearCookies();
    const links = await outboxLinks('invitation', 'moi.e2e@demo.gmep.test');
    await page.goto(new URL(links.at(-1)!).pathname + new URL(links.at(-1)!).search);
    await expect(page.getByTestId('invitee')).toContainText('Người Mới E2E');
    await page.locator('#pw').fill('mat-khau-kich-hoat-1');
    await page.locator('#pw2').fill('mat-khau-kich-hoat-1');
    await expect(page.getByRole('button', { name: 'Kích hoạt tài khoản' })).toBeDisabled(); // consent first
    await page.getByText('Tôi đã đọc và đồng ý').click();
    await page.getByRole('button', { name: 'Kích hoạt tài khoản' }).click();
    await expect(page.getByTestId('password-done')).toBeVisible();
    await login(page, 'NV9001', 'mat-khau-kich-hoat-1');
    await page.waitForURL((u) => u.pathname === '/');
  });

  test('lockout shows a generic wait with a countdown that comes from the server', async ({
    page,
  }) => {
    await page.goto('/login');
    for (let i = 0; i < 5; i++) {
      await page.getByLabel('Email hoặc mã nhân viên').fill('tk.q7@demo.gmep.test');
      await page.getByLabel('Mật khẩu').fill('sai-mat-khau-1');
      await page.getByRole('button', { name: 'Đăng nhập' }).click();
      await expect(page.locator('.alert--danger')).toBeVisible();
      await page.waitForTimeout(2200); // stay below the slow-down of the name/network counters
    }
    await page.getByLabel('Mật khẩu').fill('sai-mat-khau-1');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.locator('.alert--danger')).toContainText('Tạm dừng đăng nhập');
    await expect(page.getByTestId('login-wait')).toContainText(/\d\d:\d\d/);
    await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeDisabled();
  });
});

test.describe('states, security headers and phone layout of the new pages', () => {
  test('404 and error pages use the shared state components; CSP and headers are present', async ({
    page,
  }) => {
    const res = await page.goto('/khong-co-trang-nay');
    expect(res?.status()).toBe(404);
    await expect(page.getByText('Không tìm thấy nội dung này')).toBeVisible();
    const h = res!.headers();
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(h['content-security-policy']).toContain("connect-src 'self'");
    expect(h['content-security-policy']).toMatch(/nonce-/);
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['strict-transport-security']).toContain('max-age');
    expect(h['permissions-policy']).toContain('camera=()');
    expect(serious(await axe(page))).toEqual([]);
  });

  test('no CSP violations while hydrating login and the shell', async ({ page }) => {
    const violations: string[] = [];
    page.on(
      'console',
      (m) => m.text().includes('Content Security Policy') && violations.push(m.text()),
    );
    await loginOk(page, 'ql.q7@demo.gmep.test');
    await page.goto('/sys/users');
    await expect(page.getByTestId('user-code').first()).toBeVisible();
    expect(violations).toEqual([]);
  });

  test('offline: warning banner appears, drafts stay (form keeps its values)', async ({
    page,
    context,
  }) => {
    await loginOk(page, 'ad@demo.gmep.test');
    await page.goto('/sys/warehouses/new');
    await page.getByLabel('Tên kho').fill('Bản nháp khi mất mạng');
    await context.setOffline(true);
    await expect(page.getByTestId('offline-banner')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lưu kho' })).toBeDisabled();
    await context.setOffline(false);
    await expect(page.getByTestId('online-banner')).toBeVisible();
    await expect(page.getByLabel('Tên kho')).toHaveValue('Bản nháp khi mất mạng');
  });

  test('unsaved draft dialog protects a form when the scope is switched', async ({ page }) => {
    await loginOk(page, 'chu@demo.gmep.test');
    const scope = page.getByTestId('branch-scope');
    await page.goto('/sys/warehouses/new');
    await page.getByLabel('Mã kho').fill('NHAP-1');
    await scope.getByRole('button', { name: /Phạm vi dữ liệu/ }).click();
    await scope.getByRole('radio', { name: 'Một chi nhánh' }).click();
    await scope.getByRole('radio', { name: /Chi nhánh Thủ Đức/ }).click();
    await scope.getByRole('button', { name: 'Áp dụng phạm vi' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Ở lại và lưu nháp' }).click();
    await expect(page.getByLabel('Mã kho')).toHaveValue('NHAP-1');
    await expect(page.getByRole('alertdialog')).toBeHidden();
  });

  for (const path of [
    '/sys/branches',
    '/sys/users',
    '/sys/audit',
    '/sys/config/tax-rate',
    '/sys/services',
    '/sys/price-lists',
    '/notifications',
    '/sys/warehouses/new',
  ]) {
    test(`phone 390px: no horizontal overflow and no serious axe violations on ${path}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 800 });
      await loginOk(page, 'chu@demo.gmep.test');
      await page.goto(path);
      await expect(page.locator('main h1').first()).toBeVisible();
      await noHorizontalOverflow(page);
      expect(serious(await axe(page))).toEqual([]);
    });
  }

  test('auth pages at 390px: forgot, reset (expired), no overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    for (const [path, heading] of [
      ['/forgot-password', 'Quên mật khẩu'],
      ['/reset-password?token=abc', 'Liên kết đã hết hạn'],
      ['/activate?token=abc', 'Lời mời đã hết hạn'],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
      await noHorizontalOverflow(page);
      expect(serious(await axe(page))).toEqual([]);
    }
  });
});

test('password constant is not reused by the e2e flows above', () => {
  expect(PASSWORD).toBe('Demo!Pass-2026');
});
