import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { as, getJson } from './acc-helpers';
import { noHorizontalOverflow } from './helpers';

const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
const serious = (r: Awaited<ReturnType<typeof axe>>) =>
  r.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));

const HEAD = 'Mã khách cũ,Tên khách hàng,Số điện thoại,Biển số xe,Hãng xe,Dòng xe,Năm sản xuất';
const csv = (...lines: string[]) => Buffer.from(lines.join('\r\n') + '\r\n');
const pick = (page: Page, name: string, buffer: Buffer, mimeType = 'text/csv') =>
  page.getByLabel('Tệp Excel hoặc CSV').setInputFiles({ name, mimeType, buffer });

/**
 * UAT-12 / FR-SYS-007 through the SCREEN /sys/imports: templates, a file with row errors writes nothing, column mapping fixes a
 * file whose headers differ, the dry run, the commit with confirmation, the undo of exactly the batch, permission and a phone
 * viewport. Fake data only. Selectors are labels and roles, so cosmetic changes of the screen do not break the journey.
 */
test.describe('UAT-12 Excel import screen', () => {
  test('templates, row errors, mapping, dry run, commit, undo, phone viewport, accessibility', async ({
    browser,
  }) => {
    const ql = await as(browser, 'ql.q7');
    const page = ql.page;
    // no CSS transitions while axe measures colours (a button fading in from its disabled state reads as low contrast)
    await page.emulateMedia({ reducedMotion: 'reduce' });
    try {
      await page.goto('/sys/imports');
      await expect(
        page.getByRole('heading', { name: 'Nhập dữ liệu từ Excel', level: 1 }),
      ).toBeVisible();
      await page.getByRole('radio', { name: /Khách hàng và xe/ }).check();

      // 1. both templates download
      const [csvDl] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('link', { name: 'Tải mẫu (CSV)' }).click(),
      ]);
      expect(csvDl.suggestedFilename()).toMatch(/\.csv$/i);
      const csvText = readFileSync((await csvDl.path())!, 'utf8');
      expect(csvText).toContain('Mã khách cũ');
      const [xlsxDl] = await Promise.all([
        page.waitForEvent('download'),
        page.getByTestId('template-xlsx').click(),
      ]);
      expect(xlsxDl.suggestedFilename()).toMatch(/\.xlsx$/i);

      // 2. a file with a bad row is rejected whole, errors are listed by row, nothing is written
      await pick(
        page,
        'loi.csv',
        csv(
          HEAD,
          'UI1,Nguyen Van UI,0911111111,51G-111.11,Kia,Morning,2019',
          'UI2,,0911111112,@@,Kia,Morning,2019',
        ),
      );
      await page.getByRole('button', { name: 'Chạy thử', exact: true }).click();
      await expect(page.getByText(/không ghi gì/).first()).toBeVisible();
      const errors = page.getByRole('table').filter({ hasText: 'Nội dung' });
      await expect(errors.first()).toBeVisible();
      await expect(errors.first()).toContainText('3'); // file line 3 is the bad one
      await expect(page.getByRole('button', { name: 'Ghi vào hệ thống' })).toHaveCount(0);
      expect(
        (await getJson(page.request, '/api/v1/crm/customers?q=Nguyen%20Van%20UI')).items,
      ).toHaveLength(0);
      expect(serious(await axe(page))).toEqual([]);

      // 3. a file whose headers differ: map the column by hand and run again
      await pick(
        page,
        'khac-tieu-de.csv',
        csv(
          'Mã khách cũ,Họ và tên khách,Số điện thoại,Biển số xe,Hãng xe,Dòng xe,Năm sản xuất',
          'UI3,Le Van Anh Xa,0911111113,51G-222.22,Kia,Morning,2019',
        ),
      );
      await page.getByRole('button', { name: 'Chạy thử', exact: true }).click();
      await expect(page.getByRole('table', { name: 'Ánh xạ cột' })).toBeVisible();
      await page.locator('#map-name').selectOption({ label: 'Họ và tên khách' });
      await page.getByRole('button', { name: 'Chạy thử lại với ánh xạ này' }).click();
      await expect(page.getByText(/Tệp hợp lệ/)).toBeVisible();

      // 4. the real workbook (.xlsx): dry run, then commit behind the confirmation checkbox
      await pick(
        page,
        'khach.xlsx',
        readFileSync('tests/fixtures/import/customers.xlsx'),
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      await page.getByRole('button', { name: 'Chạy thử', exact: true }).click();
      await expect(page.getByText(/Tệp hợp lệ/)).toBeVisible();
      const commit = page.getByRole('button', { name: 'Ghi vào hệ thống' });
      await expect(commit).toBeDisabled();
      await page.getByLabel('Tôi đã kiểm tra số dòng, chi nhánh nhận và loại dữ liệu.').check();
      await expect(commit).toBeEnabled();
      expect(serious(await axe(page))).toEqual([]);
      await commit.click();
      await expect(page.getByText(/Đã ghi lô nhập/)).toBeVisible();
      expect(
        (
          (
            await getJson(
              page.request,
              '/api/v1/crm/customers?q=Tr%E1%BA%A7n%20Th%E1%BB%8B%20M%E1%BA%ABu',
            )
          ).items as unknown[]
        ).length,
      ).toBeGreaterThanOrEqual(1);

      // 5. phone viewport: no horizontal overflow on the finished screen
      await page.setViewportSize({ width: 375, height: 800 });
      await noHorizontalOverflow(page);
      await page.setViewportSize({ width: 1280, height: 800 });

      // 6. undo exactly this batch (a reason is required)
      const undo = page.getByRole('button', { name: 'Hoàn tác lô' });
      await expect(undo).toBeDisabled();
      await page.getByLabel('Lý do hoàn tác').fill('Nhập thử để kiểm tra màn hình');
      await undo.click();
      await expect(page.getByText(/Lô đã được hoàn tác/)).toBeVisible();
      expect(
        (
          await getJson(
            page.request,
            '/api/v1/crm/customers?q=Tr%E1%BA%A7n%20Th%E1%BB%8B%20M%E1%BA%ABu',
          )
        ).items,
      ).toHaveLength(0);
      await expect(page.getByRole('table').filter({ hasText: 'Trạng thái' }).first()).toContainText(
        'Đã hoàn tác',
      );
    } finally {
      await ql.ctx.close();
    }
  });

  test('permission: an advisor has no import menu and cannot use the screen or the API', async ({
    browser,
  }) => {
    const cv = await as(browser, 'cv.q7');
    try {
      await cv.page.goto('/');
      await expect(cv.page.getByRole('link', { name: 'Nhập dữ liệu từ Excel' })).toHaveCount(0);
      await cv.page.goto('/sys/imports');
      await expect(cv.page.getByLabel('Tệp Excel hoặc CSV')).toHaveCount(0);
      const r = await cv.page.request.get('/api/v1/sys/imports/kinds');
      expect([200, 403]).toContain(r.status());
      if (r.status() === 200)
        expect(((await r.json()) as { items?: unknown[] }).items ?? []).toHaveLength(0);
    } finally {
      await cv.ctx.close();
    }
  });
});
