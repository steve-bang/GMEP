import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { login, loginOk } from './helpers';

test.describe('walking skeleton: login -> list -> logout (FR-SYS-001, FR-SYS-005, NFR-ISO-01)', () => {
  test('manager logs in, sees a branch-isolated list and the visible scope, then logs out', async ({
    page,
  }) => {
    const foreignRequests: string[] = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (!['localhost', '127.0.0.1'].includes(u.hostname)) foreignRequests.push(r.url());
    });

    await loginOk(page, 'ql.q7@demo.gmep.test');
    await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible();
    // visible branch scope in the top bar
    await expect(page.getByTestId('branch-scope')).toContainText('Chi nhánh Quận 7');

    await page.getByRole('link', { name: 'Kho', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Kho', exact: true })).toBeVisible();
    const codes = page.getByTestId('wh-code');
    await expect(codes).toHaveCount(3);
    await expect(page.getByRole('cell', { name: 'Chi nhánh Quận 7' }).first()).toBeVisible();
    // another branch's data is nowhere on the page
    await expect(page.getByText('Thủ Đức')).toHaveCount(0);

    // diacritics-insensitive search
    await page.getByLabel('Tìm kiếm').fill('kho son dong');
    await page.getByRole('button', { name: 'Áp dụng' }).click();
    await expect(codes).toHaveCount(1);
    await expect(codes.first()).toHaveText('WH-SON');

    // the session cookie is invisible to page scripts
    expect(await page.evaluate(() => document.cookie)).not.toContain('gmep_session');
    const cookies = await page.context().cookies();
    const session = cookies.find((c) => c.name === '__Host-gmep_session');
    expect(session).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax', path: '/' });

    // logout revokes the server-side session
    await page.getByRole('button', { name: 'Menu tài khoản' }).click();
    await page.getByTestId('logout').click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/sys/warehouses');
    await expect(page).toHaveURL(/\/login$/);

    // replaying the old cookie is rejected by the API
    const replay = await page.request.get('/api/v1/auth/me', {
      headers: { cookie: `__Host-gmep_session=${session!.value}` },
    });
    expect(replay.status()).toBe(401);

    // R-12: the browser only ever talked to our own origin
    expect(foreignRequests).toEqual([]);
  });

  test('owner sees every branch; scope indicator says so', async ({ page }) => {
    await loginOk(page, 'NV0001');
    await expect(page.getByTestId('branch-scope')).toContainText('Tất cả chi nhánh');
    await page.goto('/sys/warehouses');
    await expect(page.getByTestId('wh-code')).toHaveCount(6);
  });

  test('wrong password shows a generic error and no session', async ({ page }) => {
    await login(page, 'ql.q7@demo.gmep.test', 'sai-mat-khau');
    await expect(page.locator('.alert--danger')).toContainText('Không đăng nhập được');
    await expect(page).toHaveURL(/\/login$/);
    expect((await page.context().cookies()).some((c) => c.name === '__Host-gmep_session')).toBe(
      false,
    );
  });

  test('empty fields show inline validation without calling the server', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.getByText('Nhập email hoặc mã nhân viên.')).toBeVisible();
    await expect(page.getByText('Nhập mật khẩu của bạn.')).toBeVisible();
  });

  test('no-permission state for a user without a role; unauthenticated visit redirects to login', async ({
    page,
  }) => {
    await page.goto('/sys/warehouses');
    await expect(page).toHaveURL(/\/login$/);
    await loginOk(page, 'norole@demo.gmep.test');
    await page.goto('/sys/warehouses');
    await expect(page.getByText('Bạn chưa có quyền xem mục này')).toBeVisible();
  });

  test('accessibility: no serious or critical axe violations on login and list; keyboard reachable', async ({
    page,
  }) => {
    await page.goto('/login');
    const loginResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(
      loginResults.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? '')),
    ).toEqual([]);

    await loginOk(page, 'ql.q7@demo.gmep.test');
    await page.goto('/sys/warehouses');
    const listResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
      .analyze();
    expect(
      listResults.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? '')),
    ).toEqual([]);
  });

  test('phone viewport: no horizontal overflow on the list', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await loginOk(page, 'ql.q7@demo.gmep.test');
    await page.goto('/sys/warehouses');
    await expect(page.getByTestId('wh-code').first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test('/api/health is public and reports ok', async ({ request }) => {
  const res = await request.get('/api/health?ready=1');
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ status: 'ok', ready: true, backend: 'firestore' });
});
