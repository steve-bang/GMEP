import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { loginOk, noHorizontalOverflow } from './helpers';

const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
const serious = (r: Awaited<ReturnType<typeof axe>>) =>
  r.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));

const ORIGIN = 'http://localhost:3100';
let n = 0;
const headers = () => ({
  origin: ORIGIN,
  'idempotency-key': `e2e-apr-${Date.now()}-${++n}-xxxxxxxx`,
});
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function post(req: APIRequestContext, path: string, data: unknown): Promise<Row> {
  const r = await req.post(path, { data, headers: headers() });
  const body = (await r.json()) as Row;
  expect(r.ok(), `${path}: ${JSON.stringify(body)}`).toBe(true);
  return body;
}
async function patch(req: APIRequestContext, path: string, data: unknown): Promise<Row> {
  const r = await req.patch(path, { data, headers: headers() });
  const body = (await r.json()) as Row;
  expect(r.ok(), `${path}: ${JSON.stringify(body)}`).toBe(true);
  return body;
}

let km = 900_000;
/** A sent quote with four items (2 required, 2 optional) through the API, like the advisor would. */
async function sentQuote(req: APIRequestContext): Promise<Row> {
  const intake = await post(req, '/api/v1/rec/intakes', { vehicleId: 'veh_biz' });
  const filled = await patch(req, `/api/v1/rec/intakes/${intake.id}`, {
    version: intake.version,
    step: 5,
    km: (km += 100),
    customerRequest: 'Bảo dưỡng và kiểm tra phanh',
    serviceType: 'maintenance',
    promisedDate: '2099-01-01',
  });
  const done = await post(req, `/api/v1/rec/intakes/${intake.id}/complete`, {
    version: filled.version,
  });
  const q = await post(req, '/api/v1/rec/quotes', { intakeId: done.id });
  const e = await patch(req, `/api/v1/rec/quotes/${q.id}`, {
    version: q.version,
    items: [
      {
        name: 'Thay dầu và lọc',
        necessity: 'required',
        lines: [
          { kind: 'labor', serviceId: 'svc_cmp_demo_SV-DAU' },
          { kind: 'part', partId: 'part_seed_01', qty: 1 },
        ],
      },
      {
        name: 'Thay má phanh',
        necessity: 'required',
        lines: [{ kind: 'labor', serviceId: 'svc_cmp_demo_SV-PHANH' }],
      },
      {
        name: 'Cân chỉnh góc đặt bánh',
        necessity: 'optional',
        customerRequested: true,
        lines: [{ kind: 'labor', serviceId: 'svc_cmp_demo_SV-CANCHINH' }],
      },
      {
        name: 'Lọc dự phòng',
        necessity: 'optional',
        lines: [{ kind: 'part', partId: 'part_seed_01', qty: 1 }],
      },
    ],
  });
  return post(req, `/api/v1/rec/quotes/${q.id}/send`, { version: e.version });
}

/** Slice 1.5 approval: FR-REC-008, 009, 026 (link, counter), print A4; RULE-005; journey quote sent -> approved. */
test.describe('slice 1.5 REC: quote approval', () => {
  test('customer opens the link on a phone, drops a required item with a reason, approves; staff see the evidence and print', async ({
    page,
    browser,
  }) => {
    await loginOk(page, 'cv.q7@demo.gmep.test');
    const sent = await sentQuote(page.request);
    await page.goto(`/rec/quotes/${sent.id}`);
    expect(serious(await axe(page))).toEqual([]);
    // the channels that need a provider are locked with a plain reason and no provider name
    await expect(page.getByTestId('quote-share')).toContainText('Chưa kích hoạt');
    await page.getByTestId('quote-link-make').click();
    const url = await page.getByTestId('quote-link-url').inputValue();
    expect(url).toMatch(/\/b\/[A-Za-z0-9_-]{40,}$/);

    // the customer: no account, phone width
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const cust = await ctx.newPage();
    await cust.goto(url);
    await expect(
      cust.getByRole('heading', { name: 'Báo giá sửa chữa xe', level: 1 }),
    ).toBeVisible();
    await expect(cust.getByTestId('pub-item')).toHaveCount(4);
    // required and the requested optional item start ticked, the other optional item does not
    await expect(cust.getByTestId('pub-check-1')).toBeChecked();
    await expect(cust.getByTestId('pub-check-3')).toBeChecked();
    await expect(cust.getByTestId('pub-check-4')).not.toBeChecked();
    // no phone, address or staff data; the full name is not shown
    const body = await cust.locator('body').innerText();
    expect(body).not.toMatch(/0900000|@demo|Công ty|Cố vấn Quận/);
    expect(serious(await axe(cust))).toEqual([]);
    await noHorizontalOverflow(cust);
    // net 280.000 + 450.000 + 300.000 = 1.030.000; VAT 8% = 82.400; total 1.112.400
    await expect(cust.getByTestId('pub-total')).toContainText('1.112.400');

    // unticking a REQUIRED item asks for a reason first (Câu 2)
    // the pre-ticked box stays ticked until the warning is answered; click the label (the SVG tick inside is the hit target of the bare input)
    await cust.locator('label.check').filter({ hasText: 'Thay má phanh' }).click();
    await expect(cust.getByTestId('pub-warn')).toBeVisible();
    await expect(cust.getByTestId('pub-warn-drop')).toBeDisabled();
    expect(serious(await axe(cust))).toEqual([]);
    await cust.getByLabel('Lý do anh/chị không làm').selectOption({ label: 'Để lần sau' });
    await cust.getByTestId('pub-warn-drop').click();
    // 280.000 + 300.000 = 580.000 + 46.400 = 626.400: tax on the chosen set, not prorated
    await expect(cust.getByTestId('pub-total')).toContainText('626.400');
    await cust.getByTestId('pub-approve').click();
    await expect(cust.getByTestId('pub-state-approved')).toContainText('626.400');
    // the same link now only shows the outcome; a repeated tap cannot approve again
    await cust.reload();
    await expect(cust.getByTestId('pub-state-approved')).toBeVisible();
    await ctx.close();

    // staff: status, locked content, evidence with its hash
    await page.goto(`/rec/quotes/${sent.id}`);
    await expect(page.locator('.badge', { hasText: 'Duyệt một phần' }).first()).toBeVisible();
    await expect(page.getByTestId('approval-method')).toContainText('liên kết');
    await expect(page.getByTestId('approval-hash')).toHaveText(/^[0-9a-f]{64}$/);
    await expect(page.getByTestId('total-approved')).toContainText('626.400');
    await expect(page.getByTestId('quote-send')).toHaveCount(0);
    await expect(page.getByTestId('counter-approve-open')).toHaveCount(0);
    expect(serious(await axe(page))).toEqual([]);

    // print A4: the application frame is hidden, the sheet is A4 wide
    await page.getByTestId('quote-print-open').click();
    await expect(page.getByTestId('quote-sheet')).toBeVisible();
    await expect(page.getByTestId('sheet-item')).toHaveCount(4);
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.page-header')).toBeHidden();
    const w = await page
      .getByTestId('quote-sheet')
      .evaluate((el) => el.getBoundingClientRect().width);
    expect(Math.round(w)).toBeGreaterThan(780); // 210 mm at 96 dpi = 794 px
    await page.emulateMedia({ media: 'screen' });

    // FR-REC-008: "Tải PDF" returns the same quote as a real PDF (same print model as the sheet above)
    const pdf = await page.request.get(`/api/v1/rec/quotes/${sent.id}/pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toBe('application/pdf');
    expect((await pdf.body()).subarray(0, 5).toString('latin1')).toBe('%PDF-');
    await expect(page.getByTestId('quote-pdf')).toHaveAttribute(
      'href',
      new RegExp(`/api/v1/rec/quotes/${sent.id}/pdf`),
    );
  });

  test('counter: the advisor records a signature in three steps with a reason for the refused required item', async ({
    page,
  }) => {
    await loginOk(page, 'cv.q7@demo.gmep.test');
    const sent = await sentQuote(page.request);
    await page.goto(`/rec/quotes/${sent.id}`);
    await page.getByTestId('counter-approve-open').click();
    await expect(page.getByTestId('counter-approval')).toContainText('Bước 1/3');
    expect(serious(await axe(page))).toEqual([]);
    // all required + the requested optional ticked: 280.000 + 450.000 + 300.000 -> 1.112.400
    await expect(page.getByTestId('ca-total')).toContainText('1.112.400');
    await page.getByTestId('ca-item-4').check({ force: true });
    await expect(page.getByTestId('ca-total')).toContainText('1.252.800');
    // a required item left out needs a reason before moving on
    await page.getByTestId('ca-item-2').uncheck({ force: true });
    await expect(page.getByRole('button', { name: 'Tiếp tục' })).toBeDisabled();
    await page.getByLabel('Lý do khách nêu').selectOption({ label: 'Giá cao hơn dự kiến' });
    await page.getByRole('button', { name: 'Tiếp tục' }).click();
    await expect(page.getByTestId('counter-approval')).toContainText('Bước 2/3');
    await expect(page.getByRole('button', { name: 'Tiếp tục' })).toBeDisabled(); // signer required
    await page.getByLabel(/Họ tên người ký/).fill('Trần Văn Bình');
    await page.getByRole('button', { name: 'Tiếp tục' }).click();
    await expect(page.getByTestId('ca-review')).toContainText('Thay má phanh');
    await page.getByTestId('counter-approve-confirm').click();
    await expect(page.locator('.badge', { hasText: 'Duyệt một phần' }).first()).toBeVisible();
    await expect(page.getByTestId('approval-method')).toContainText('Chữ ký tại quầy');
    await expect(page.getByTestId('approval-evidence')).toContainText('Trần Văn Bình');
    await expect(page.getByTestId('approval-evidence')).toContainText('Từ chối hạng mục bắt buộc');
  });
});
