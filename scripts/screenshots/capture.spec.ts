import fs from 'node:fs';
import path from 'node:path';
import { test, type Browser, type Page } from '@playwright/test';
import {
  as,
  asCashier,
  approvedOrder,
  ensureShift,
  getJson,
  hdr,
  patch,
  post,
  readyOrder,
  startKmAt,
  type Row,
} from '../../e2e/acc-helpers';

const OUT = path.resolve('docs/screenshots');

let kmSeq = 0;
async function atQ7(browser: Browser, user: string, viewport = { width: 1440, height: 900 }) {
  const s = await as(browser, user, viewport);
  await s.page.request.put('/api/v1/sys/scope', { data: { branchId: 'br_q7' }, headers: hdr() });
  return s;
}

async function shot(page: Page, url: string, file: string, full = true) {
  const dest = path.join(OUT, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await page.goto(url, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(600);
  await page.screenshot({ path: dest, fullPage: full });
  console.log('shot', file);
}

/** quote -> order, a fully paid and handed-over order, an invoice, etc: realistic spread of states for the screens. */
test('seed rich data and capture every built screen', async ({ browser }) => {
  startKmAt(3_100_000);
  const cv = await as(browser, 'cv.q7');
  const tn = await asCashier(browser);
  await ensureShift(tn.page.request);
  const ql = await atQ7(browser, 'ql.q7');

  // --- data ---
  // A. quote still a draft / sent (not approved)
  const mkQuote = async (vehicleId: string, send: boolean) => {
    const intake = await post(cv.page.request, '/api/v1/rec/intakes', { vehicleId });
    const f = await patch(cv.page.request, `/api/v1/rec/intakes/${intake.id}`, {
      version: intake.version,
      step: 5,
      km: 3_090_000 + (kmSeq += 10),
      customerRequest: 'Xe rung khi phanh, kiểm tra hệ thống phanh và thay dầu',
      serviceType: 'maintenance',
      promisedDate: '2099-01-01',
    });
    const d = await post(cv.page.request, `/api/v1/rec/intakes/${intake.id}/complete`, {
      version: f.version,
    });
    const q = await post(cv.page.request, '/api/v1/rec/quotes', { intakeId: d.id });
    const e = await patch(cv.page.request, `/api/v1/rec/quotes/${q.id}`, {
      version: q.version,
      items: [
        {
          name: 'Thay dầu động cơ',
          necessity: 'required',
          lines: [{ kind: 'labor', serviceId: 'svc_tnt_demo_SV-DAU' }],
        },
        {
          name: 'Thay má phanh',
          necessity: 'optional',
          lines: [{ kind: 'labor', serviceId: 'svc_tnt_demo_SV-PHANH' }],
        },
      ],
    });
    if (!send) return { intake: d, quote: e };
    const sent = await post(cv.page.request, `/api/v1/rec/quotes/${q.id}/send`, {
      version: e.version,
    });
    return { intake: d, quote: sent };
  };
  const draftQ = await mkQuote('veh_biz', false);
  const sentQ = await mkQuote('veh_an', true);
  const link = await post(cv.page.request, `/api/v1/rec/quotes/${sentQ.quote.id}/link`, {
    version: sentQ.quote.version,
  });

  // B. approved order, technician started one item (in progress)
  const head = await approvedOrder(cv.page.request, 'veh_an');
  const qd = await as(browser, 'qd.q7');
  const th = await as(browser, 'th.q7');
  const o1 = await getJson(qd.page.request, `/api/v1/rec/orders/${head.orderId}`);
  for (const it of o1.items)
    await post(qd.page.request, `/api/v1/rec/items/${it.id}/assign`, {
      version: it.version,
      technicianId: 'u_th_q7',
    });
  const first = (await getJson(qd.page.request, `/api/v1/rec/orders/${head.orderId}`)).items[0];
  await post(th.page.request, `/api/v1/rec/items/${first.id}/start`, { version: first.version });
  await qd.ctx.close();
  await th.ctx.close();

  // C. approved order, nobody assigned yet
  const waiting = await approvedOrder(cv.page.request, 'veh_biz');

  // D. ready for delivery, unpaid
  const ready = await readyOrder(browser, cv.page);

  // E. paid + handed over + invoiced (business buyer)
  const handedOver = async (pay: boolean) => {
    const o = await readyOrder(browser, cv.page);
    const bal = (await getJson(tn.page.request, `/api/v1/acc/orders/${o.id}`)).balance;
    if (pay)
      await post(tn.page.request, `/api/v1/acc/orders/${o.id}/payments`, {
        kind: 'receipt',
        lines: [
          { method: 'cash', amountVnd: Math.floor(bal.outstandingVnd / 2) },
          {
            method: 'transfer',
            amountVnd: bal.outstandingVnd - Math.floor(bal.outstandingVnd / 2),
            reference: `FT26${Date.now() % 1_000_000}`,
          },
        ],
      });
    const cur = await getJson(cv.page.request, `/api/v1/rec/orders/${o.id}`);
    await post(cv.page.request, `/api/v1/rec/orders/${o.id}/handover`, {
      version: cur.version,
      receiverName: 'Nguyễn Văn An',
      confirmation: 'screen',
      belongingsReturned: true,
      oldPartsReturned: true,
    });
    return o;
  };
  const invoiced = await handedOver(true);
  const inv = await post(tn.page.request, `/api/v1/ein/orders/${invoiced.id}/invoices`, {
    buyer: {
      kind: 'business',
      name: 'Công ty TNHH Vận tải Minh Phát',
      taxCode: '0312345678',
      address: '45 Lê Lợi, Bến Nghé, Quận 1, TP.HCM',
      email: 'ketoan@minhphat.example',
    },
  });
  const paidNoInv = await handedOver(true);
  const onDebt = await handedOver(false).catch(() => null);

  // F. a partial deposit-style receipt on the waiting order
  await post(tn.page.request, `/api/v1/acc/orders/${waiting.orderId}/payments`, {
    kind: 'deposit',
    lines: [{ method: 'cash', amountVnd: 500_000 }],
  }).catch(() => {});

  // G. rollup for today
  await ql.page.request.post('/api/v1/rpt/jobs/run-due', { data: {}, headers: hdr() });

  // --- capture ---
  const open = await atQ7(browser, 'chu');
  const o = open.page;
  const mgr = ql.page;
  const OID = head.orderId;

  // login (anonymous)
  const anon = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await shot(anon, '/login', '00-auth/login.png', false);
  await shot(anon, '/forgot-password', '00-auth/forgot-password.png', false);
  await shot(anon, `/b/${link.token}`, '03-rec/customer-quote-link.png');

  const owner: [string, string][] = [
    ['/', '01-shell/home.png'],
    ['/notifications', '01-shell/notifications.png'],
    ['/approvals', '01-shell/approvals.png'],
    // SYS
    ['/sys/users', '02-sys/users.png'],
    ['/sys/users/u_cv_q7', '02-sys/user-detail.png'],
    ['/sys/branches', '02-sys/branches.png'],
    ['/sys/warehouses', '02-sys/warehouses.png'],
    ['/sys/services', '02-sys/services.png'],
    ['/sys/price-lists', '02-sys/price-lists.png'],
    ['/sys/config', '02-sys/config.png'],
    ['/sys/audit', '02-sys/audit.png'],
    // CRM
    ['/crm/customers', '04-crm/customers.png'],
    ['/crm/customers/cus_an', '04-crm/customer-detail.png'],
    ['/crm/vehicles', '04-crm/vehicles.png'],
    ['/crm/vehicles/veh_an', '04-crm/vehicle-detail.png'],
    ['/crm/lookup', '04-crm/lookup.png'],
    ['/crm/data-requests', '04-crm/data-requests.png'],
    ['/crm/export', '04-crm/export.png'],
    // INV
    ['/inv/parts', '05-inv/parts.png'],
    ['/inv/stock', '05-inv/stock.png'],
    ['/inv/reorder', '05-inv/reorder.png'],
    ['/inv/documents', '05-inv/documents.png'],
    ['/inv/documents/new?type=GRN', '05-inv/document-new.png'],
    // REC
    ['/rec/board', '03-rec/board.png'],
    ['/rec/intakes', '03-rec/intakes.png'],
    [`/rec/intakes/${draftQ.intake.id}`, '03-rec/intake-detail.png'],
    ['/rec/intakes/new', '03-rec/intake-new.png'],
    ['/rec/quotes', '03-rec/quotes.png'],
    [`/rec/quotes/${draftQ.quote.id}`, '03-rec/quote-draft.png'],
    [`/rec/quotes/${sentQ.quote.id}`, '03-rec/quote-sent.png'],
    [`/rec/quotes/${head.id}`, '03-rec/quote-approved.png'],
    [`/rec/quotes/${head.id}/print`, '03-rec/quote-print.png'],
    ['/rec/orders', '03-rec/orders.png'],
    [`/rec/orders/${OID}`, '03-rec/order-in-progress.png'],
    [`/rec/orders/${ready.id}`, '03-rec/order-ready.png'],
    [`/rec/orders/${ready.id}/qc`, '03-rec/order-qc.png'],
    [`/rec/orders/${ready.id}/handover`, '03-rec/order-handover.png'],
    [`/rec/orders/${invoiced.id}`, '03-rec/order-delivered.png'],
    [`/rec/orders/${invoiced.id}/handover/print`, '03-rec/handover-print.png'],
    ['/rec/part-requests', '03-rec/part-requests.png'],
    // ACC
    ['/acc/payments', '06-acc/payments.png'],
    ['/acc/cashbook', '06-acc/cashbook.png'],
    ['/acc/cashbook/close', '06-acc/shift-close.png'],
    ['/acc/day-close', '06-acc/day-close.png'],
    ['/acc/debts', '06-acc/debts.png'],
    [`/acc/orders/${ready.id}`, '06-acc/order-balance.png'],
    // EIN
    ['/ein', '07-ein/invoices.png'],
    [`/ein/invoices/${inv.invoiceId}`, '07-ein/invoice-detail.png'],
    [`/ein/orders/${paidNoInv.id}/issue`, '07-ein/issue-checklist.png'],
    ['/ein/queue', '07-ein/error-queue.png'],
    ['/ein/warnings', '07-ein/warnings.png'],
    ['/ein/connection', '07-ein/connection.png'],
    // RPT
    ['/rpt', '08-rpt/dashboard.png'],
    ['/rpt/daily', '08-rpt/daily-report.png'],
    ['/rpt/daily/drill?metric=closed', '08-rpt/drill-down.png'],
    ['/rpt/alerts', '08-rpt/alerts.png'],
  ];
  for (const [u, f] of owner) await shot(o, u, f);

  // payments detail via list link
  const pays = await getJson(tn.page.request, `/api/v1/acc/orders/${invoiced.id}`);
  const payId = pays.payments?.[0]?.id ?? pays.receipts?.[0]?.id;
  if (payId) await shot(o, `/acc/payments/${payId}`, '06-acc/payment-detail.png');

  // technician tablet + cashier + phone manager
  const tech = await as(browser, 'th.q7', { width: 1024, height: 768 });
  await shot(tech.page, '/rec/work', '03-rec/technician-tablet.png');
  await shot(tn.page, '/acc/cashbook', '06-acc/cashier-cashbook.png');
  await shot(tn.page, '/rpt', '08-rpt/dashboard-cashier-lens.png');
  const phone = await atQ7(browser, 'ql.q7', { width: 390, height: 844 });
  await shot(phone.page, '/rpt', '09-mobile/dashboard-phone.png');
  await shot(phone.page, '/rpt/daily', '09-mobile/daily-report-phone.png');
  await shot(phone.page, '/rec/board', '09-mobile/board-phone.png');
  await shot(phone.page, '/approvals', '09-mobile/approvals-phone.png');
  void mgr;
  void onDebt;
  void (null as unknown as Row);
});
