import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { loginOk, noHorizontalOverflow } from './helpers';

const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
const serious = (r: Awaited<ReturnType<typeof axe>>) =>
  r.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));
const rand = () => String(Math.floor(10000 + Math.random() * 89999));

test.describe('slice 1.4 INV: catalogue, four numbers, documents, reorder alert', () => {
  test('storekeeper: catalogue search, create part (duplicate blocked), receipt draft -> post -> stock card', async ({
    page,
  }) => {
    await loginOk(page, 'tk.q7@demo.gmep.test');
    await page.goto('/inv/parts');
    await expect(page.getByRole('heading', { name: 'Danh mục phụ tùng', level: 1 })).toBeVisible();
    await expect(page.getByTestId('part-code').filter({ hasText: 'LOC-DAU-TY01' })).toBeVisible();
    expect(serious(await axe(page))).toEqual([]);
    await noHorizontalOverflow(page);

    // vehicle line search finds the right parts; accent-free name search works
    await page.getByLabel('Tìm theo', { exact: true }).selectOption('model');
    await page.getByLabel('Tìm theo mã, tên, mã vạch, dòng xe').fill('mazda cx-5');
    await page.getByRole('button', { name: 'Áp dụng' }).click();
    await expect(page.getByTestId('part-code')).toHaveCount(2);
    await page.goto('/inv/parts?q=loc%20dau');
    await expect(page.getByTestId('part-code').first()).toHaveText('LOC-DAU-TY01');

    // create a part; a second one with the same code (other spelling) is refused and names the first
    const code = `E2E-${rand()}`;
    await page.goto('/inv/parts/new');
    expect(serious(await axe(page))).toEqual([]);
    await page.getByRole('textbox', { name: 'Mã', exact: true }).fill(code);
    await page.getByLabel('Tên phụ tùng').fill(`Phụ tùng thử ${code}`);
    await page.getByLabel('Dòng xe tương thích').fill('Kia Morning');
    await page.getByRole('button', { name: 'Lưu phụ tùng' }).click();
    await expect(page).toHaveURL(/\/inv\/parts$/);
    await page.goto('/inv/parts/new');
    await page
      .getByRole('textbox', { name: 'Mã', exact: true })
      .fill(code.toLowerCase().replace('-', ' '));
    await page.getByLabel('Tên phụ tùng').fill('Trùng mã');
    await page.getByRole('button', { name: 'Lưu phụ tùng' }).click();
    await expect(page.locator('.field__error').first()).toContainText(code);

    // receipt against a purchase order: draft first, no stock change, then post
    await page.goto('/inv/documents/new?type=GRN');
    expect(serious(await axe(page))).toEqual([]);
    await page
      .getByRole('combobox', { name: 'Kho', exact: true })
      .selectOption({ label: 'Kho chính Quận 7' });
    await page.getByLabel('Mã chứng từ gốc').fill('DM-E2E-1');
    await page.getByTestId('line-code').first().fill('LOC-DAU-TY01');
    await expect(page.locator('.cell-sub').filter({ hasText: 'Lọc dầu Toyota' })).toBeVisible();
    await page.getByTestId('line-qty').first().fill('5');
    await page.getByTestId('line-cost').first().fill('85000');
    await page.getByRole('button', { name: 'Lưu nháp' }).click();
    await expect(page).toHaveURL(/\/inv\/documents\/stk_/);
    await expect(page.getByText('Bản nháp chưa làm đổi tồn')).toBeVisible();
    expect(serious(await axe(page))).toEqual([]);
    page.once('dialog', (d) => void d.accept());
    await page.getByTestId('doc-post').click();
    await expect(page.getByText('Đã ghi sổ: không sửa, không xóa')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2 }).first()).toContainText(
      /PN-Q7-\d{4}-\d{5}/,
    );

    // the four numbers and the stock card show the receipt (20 + 5 on hand, 2 reserved)
    await page.goto('/inv/parts/part_seed_01');
    const row = page.locator('table tbody tr').filter({ hasText: 'Kho chính Quận 7' }).first();
    await expect(row).toContainText('25');
    await expect(page.getByRole('heading', { name: 'Giá niêm yết chuẩn' })).toBeVisible();
    await expect(page.getByRole('link', { name: /PN-Q7-/ }).first()).toBeVisible();
    expect(serious(await axe(page))).toEqual([]);
    await noHorizontalOverflow(page);
  });

  test('manager: stock with four numbers, reorder list on available, documents list, no cost for storekeeper', async ({
    page,
  }) => {
    await loginOk(page, 'ql.q7@demo.gmep.test');
    await page.goto('/inv/stock');
    await expect(page.getByRole('heading', { name: 'Tồn kho', level: 1 })).toBeVisible();
    for (const h of ['Thực tế', 'Giữ chỗ', 'Đang vận chuyển', 'Khả dụng', 'Giá trị tồn'])
      await expect(page.getByRole('columnheader', { name: h })).toBeVisible();
    expect(serious(await axe(page))).toEqual([]);
    await noHorizontalOverflow(page);

    await page.goto('/inv/reorder');
    await expect(page.getByRole('heading', { name: 'Hàng dưới định mức', level: 1 })).toBeVisible();
    await expect(page.getByTestId('stock-code').filter({ hasText: 'MA-PHANH-TY01' })).toBeVisible();
    await expect(page.getByText('Hết hàng').first()).toBeVisible();
    expect(serious(await axe(page))).toEqual([]);

    await page.goto('/inv/documents');
    await expect(page.getByRole('heading', { name: 'Chứng từ kho', level: 1 })).toBeVisible();
    await expect(page.getByTestId('doc-no').first()).toBeVisible();
    expect(serious(await axe(page))).toEqual([]);
    await noHorizontalOverflow(page);
  });

  test('advisor reads the catalogue with available quantity only; stock and documents are closed to the role', async ({
    page,
  }) => {
    await loginOk(page, 'cv.q7@demo.gmep.test');
    await page.goto('/inv/parts');
    await expect(page.getByRole('columnheader', { name: 'Khả dụng' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Thêm phụ tùng' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Tồn kho' })).toHaveCount(0);
    await page.goto('/inv/stock');
    await expect(page.getByText('Bạn chưa có quyền xem mục này')).toBeVisible();
    await page.goto('/inv/documents');
    await expect(page.getByText('Bạn chưa có quyền xem mục này')).toBeVisible();
  });

  test('phone width: documents and detail screens do not overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginOk(page, 'tk.q7@demo.gmep.test');
    for (const path of [
      '/inv/parts',
      '/inv/stock',
      '/inv/documents',
      '/inv/documents/new?type=GRN',
      '/inv/parts/part_seed_01',
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await noHorizontalOverflow(page);
    }
  });
});
