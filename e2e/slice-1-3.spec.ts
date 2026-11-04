import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { loginOk, noHorizontalOverflow, PASSWORD } from './helpers';

const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
const serious = (r: Awaited<ReturnType<typeof axe>>) =>
  r.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));

const rand = () => String(Math.floor(10000 + Math.random() * 89999));

test.describe('slice 1.3 CRM: customers, vehicles, ownership, consent, requests, lookup, export', () => {
  test('advisor: branch-scoped list, accent-insensitive search, create customer + vehicle, duplicate plate, owner change', async ({
    page,
  }) => {
    await loginOk(page, 'cv.q7@demo.gmep.test');
    await page.goto('/crm/customers');
    await expect(page.getByRole('heading', { name: 'Khách hàng', level: 1 })).toBeVisible();
    // Q7 advisor sees An and the business customer, never Binh (Thu Duc only)
    await expect(
      page.getByTestId('customer-name').filter({ hasText: 'Nguyễn Văn An' }),
    ).toBeVisible();
    await expect(page.getByText('Trần Thị Bình')).toHaveCount(0);
    expect(serious(await axe(page))).toEqual([]);
    await noHorizontalOverflow(page);

    await page.getByLabel('Tìm kiếm').fill('nguyen van');
    await page.getByRole('button', { name: 'Áp dụng' }).click();
    await expect(page.getByTestId('customer-name')).toHaveCount(1);
    await expect(page.getByTestId('customer-name').first()).toHaveText('Nguyễn Văn An');
    // search by plate and by phone prefix inside the scope
    await page.goto('/crm/customers?q=51h-123');
    await expect(page.getByTestId('customer-name').first()).toHaveText('Nguyễn Văn An');
    await page.goto('/crm/customers?q=0900000222');
    await expect(page.getByText('Không tìm thấy khách phù hợp')).toBeVisible();

    // create a customer: validation next to the field, typed data kept
    const phone = `09001${rand()}`;
    const name = `Phạm Thị E2E ${rand()}`;
    await page.goto('/crm/customers/new');
    expect(serious(await axe(page))).toEqual([]);
    await page.getByLabel('Tên khách / tên pháp nhân').fill(name);
    await page.getByLabel('Điện thoại').fill('12345');
    await page.getByRole('button', { name: 'Lưu khách' }).click();
    await expect(page.locator('.field__error').first()).toBeVisible();
    await expect(page.getByLabel('Tên khách / tên pháp nhân')).toHaveValue(name);
    await page.getByLabel('Điện thoại').fill(phone);
    await page.getByRole('button', { name: 'Lưu khách' }).click();
    await expect(page).toHaveURL(/\/crm\/customers$/);
    await page.goto(`/crm/customers?q=${encodeURIComponent(name)}`);
    await page.getByTestId('customer-name').first().click();
    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
    await expect(page.getByTestId('customer-contact')).toContainText(phone); // advisor sees it in full

    // add a vehicle; the same plate again is refused without leaking who has it
    const plate = `5${Math.floor(Math.random() * 9)}K-${rand()}`;
    await page.getByRole('link', { name: 'Thêm xe' }).click();
    await page.getByLabel('Biển số').fill(plate);
    await page.locator('input[name="make"]').fill('Toyota');
    await page.getByLabel('Dòng xe').fill('Vios');
    await page.getByLabel('Năm sản xuất').fill('2020');
    await page.getByRole('button', { name: 'Lưu xe' }).click();
    await expect(page).toHaveURL(/\/crm\/customers\//);
    await expect(page.getByTestId('customer-vehicles')).toContainText(plate.toUpperCase());

    await page.goto('/crm/vehicles/new?customerId=cus_an');
    await page.getByLabel('Biển số').fill(plate.toLowerCase().replace('-', ' '));
    await page.locator('input[name="make"]').fill('Kia');
    await page.getByLabel('Dòng xe').fill('Morning');
    await page.getByLabel('Năm sản xuất').fill('2019');
    await page.getByRole('button', { name: 'Lưu xe' }).click();
    await expect(page.getByRole('alert').first()).toContainText('Biển số này đã được đăng ký');

    // owner change keeps both ownership rows (UAT-18); the seeded pickup truck was owned since 2024-01-01
    await page.goto('/crm/vehicles/veh_biz');
    await expect(page.getByTestId('vehicle-profile')).toBeVisible();
    await page
      .locator('select[name="newCustomerId"]')
      .selectOption({ label: 'Nguyễn Văn An · KH-Q7-00001' });
    await page.getByLabel('Ngày chuyển chủ').fill('2026-10-01');
    await page.getByRole('button', { name: 'Chuyển chủ' }).click();
    const owners = page.locator('table').filter({ hasText: 'Hiện tại' });
    await expect(owners.locator('tbody tr')).toHaveCount(2);
    await expect(owners.locator('tbody tr').first()).toContainText('Nguyễn Văn An');
    await expect(owners.locator('tbody tr').nth(1)).toContainText('30/09/2026');
    expect(serious(await axe(page))).toEqual([]);
  });

  test('cross-branch repair history of the sedan lists Quận 7 and Thủ Đức visits', async ({
    page,
  }) => {
    await loginOk(page, 'cv.q7@demo.gmep.test');
    await page.goto('/crm/vehicles?q=51H12345');
    await page.getByTestId('vehicle-plate').first().click();
    const table = page.locator('table').filter({ hasText: 'RO-TD-2603-00041' });
    await expect(table).toContainText('Chi nhánh Quận 7');
    await expect(table).toContainText('Chi nhánh Thủ Đức');
    await expect(table).not.toContainText('Thợ');
    expect(serious(await axe(page))).toEqual([]);
  });

  test('owner sees masked contact data; "Hiện" reveals one field and it hides again after reload', async ({
    page,
  }) => {
    await loginOk(page, 'chu@demo.gmep.test');
    await page.goto('/crm/customers?q=nguyen van an');
    await expect(page.getByTestId('customer-phone').first()).not.toContainText('0900000211');
    await page.getByTestId('customer-name').first().click();
    const phone = page.getByTestId('phone-value');
    await expect(phone).toContainText('••');
    await page.getByTestId('reveal-phone').click();
    await expect(phone).toHaveText('0900000211');
    await page.reload();
    await expect(page.getByTestId('phone-value')).toContainText('••');
    expect(serious(await axe(page))).toEqual([]);
  });

  test('consent: record, see in history, withdraw keeps the record', async ({ page }) => {
    await loginOk(page, 'cv.q7@demo.gmep.test');
    await page.goto('/crm/customers/cus_biz?tab=consent');
    await page.locator('select[name="purpose"]').selectOption('marketing');
    await page.locator('select[name="channel"]').selectOption('sms');
    await page.locator('select[name="basis"]').selectOption('consent');
    await page.getByLabel('Bằng chứng').fill('Phiếu giấy e2e');
    await page.getByRole('button', { name: 'Ghi nhận đồng ý' }).click();
    const row = page.getByTestId('consent-table').locator('tbody tr').filter({ hasText: 'SMS' });
    await expect(row).toContainText('Đang đồng ý');
    page.once('dialog', (d) => void d.accept());
    await row.getByTestId('consent-withdraw').click();
    await expect(row.getByTestId('consent-status')).toHaveText('Đã rút');
  });

  test('manager: data-subject request is registered, assigned and closed; Thu Duc cannot open it', async ({
    page,
    browser,
  }) => {
    await loginOk(page, 'ql.q7@demo.gmep.test');
    await page.goto('/crm/data-requests?customerId=cus_biz#new');
    await page.locator('select[name="type"]').selectOption('view');
    await page.getByLabel('Nội dung yêu cầu').fill('Khách muốn xem dữ liệu đã lưu');
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().endsWith('/api/v1/crm/data-requests') && r.status() === 201,
      ),
      page.getByRole('button', { name: 'Ghi nhận yêu cầu' }).click(),
    ]);
    await page.reload();
    await page.getByTestId('request-code').first().click();
    await expect(page.getByTestId('request-detail')).toContainText('Mới tiếp nhận');
    const url = page.url();
    await page.getByTestId('assign-form').getByRole('button', { name: 'Giao người xử lý' }).click();
    await expect(page.getByTestId('request-detail')).toContainText('Đang xử lý');
    await page.getByLabel('Kết quả xử lý').fill('Đã gửi bản sao dữ liệu cho khách');
    await page.getByTestId('close-form').getByRole('button', { name: 'Đóng yêu cầu' }).click();
    await expect(page.getByTestId('request-detail')).toContainText('Hoàn tất');
    expect(serious(await axe(page))).toEqual([]);

    const other = await browser.newContext();
    const p2 = await other.newPage();
    await loginOk(p2, 'ql.td@demo.gmep.test');
    await p2.goto(url);
    await expect(p2.getByText('Không tìm thấy nội dung này')).toBeVisible();
    await other.close();
  });

  test('exact lookup shows a Thu Duc customer to Q7 with minimal fields and no contact data', async ({
    page,
  }) => {
    await loginOk(page, 'cv.q7@demo.gmep.test');
    await page.goto('/crm/lookup');
    expect(serious(await axe(page))).toEqual([]);
    await page.getByLabel('Biển số').fill('29a-678.90');
    await page.getByRole('button', { name: 'Tra cứu' }).click();
    const card = page.getByTestId('lookup-customer');
    await expect(card).toContainText('Trần Thị Bình');
    await expect(card).toContainText('Chi nhánh Thủ Đức');
    await expect(page.locator('body')).not.toContainText('0900000222');
    await page.getByLabel('Biển số').fill('');
    await page.getByLabel('Số điện thoại đầy đủ').fill('0900000999');
    await page.getByRole('button', { name: 'Tra cứu' }).click();
    await expect(page.getByTestId('lookup-none')).toBeVisible();
  });

  test('export: advisor has no entry point and no file; manager downloads the CSV; owner needs reason and password for full columns', async ({
    page,
  }) => {
    await loginOk(page, 'cv.q7@demo.gmep.test');
    await page.goto('/crm/customers');
    await expect(page.getByRole('link', { name: 'Xuất danh sách…' })).toHaveCount(0);
    await page.goto('/crm/export');
    await expect(page.getByText('Bạn chưa có quyền xem mục này')).toBeVisible();

    await page.context().clearCookies();
    await loginOk(page, 'ql.q7@demo.gmep.test');
    await page.goto('/crm/export');
    expect(serious(await axe(page))).toEqual([]);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Xuất CSV' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('customers.csv');
    await expect(page.getByText('Đã tải tệp')).toBeVisible();

    await page.context().clearCookies();
    await loginOk(page, 'chu@demo.gmep.test');
    await page.goto('/crm/export');
    await page.getByTestId('export-pii').check();
    await page.getByLabel('Lý do xuất (ít nhất 5 ký tự)').fill('Gửi báo cáo cho kế toán');
    await page.getByLabel('Nhập lại mật khẩu').fill('sai-mat-khau');
    await page.getByRole('button', { name: 'Xuất CSV' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await page.getByLabel('Nhập lại mật khẩu').fill(PASSWORD);
    const [ok] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Xuất CSV' }).click(),
    ]);
    expect(ok.suggestedFilename()).toBe('customers.csv');
  });

  test('system admin has no CRM menu and cannot open customers', async ({ page }) => {
    await loginOk(page, 'ad@demo.gmep.test');
    await expect(page.getByRole('link', { name: 'Khách hàng' })).toHaveCount(0);
    await page.goto('/crm/customers');
    await expect(page.getByText('Bạn chưa có quyền xem mục này')).toBeVisible();
  });
});
