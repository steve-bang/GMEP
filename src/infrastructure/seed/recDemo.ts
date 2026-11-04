/**
 * FAKE REC demo data (slice 1.5): a few services with standard hours, a company hourly rate, a VAT rate and discount limits per role. EVERY number is a sample for tests and
 * the demo, NOT signed off by the accountant (NFR-MNT-01); real values arrive through the approved
 * configuration screens. They are config versions like any other: nothing in code reads these numbers.
 */
import { normalizeSearch } from '@/platform/text/normalize';
import { COL } from '../repos/queries';
import type { SeedDoc } from './types';

const AT = new Date('2026-10-01T00:00:00.000Z');
const CMP = 'cmp_demo';
const DAY = '2026-10-01';

export const demoServices = [
  { code: 'SV-DAU', name: 'Bảo dưỡng dầu động cơ và lọc dầu', group: 'Bảo dưỡng', minutes: 30 },
  { code: 'SV-PHANH', name: 'Phanh trước: má phanh', group: 'Phanh', minutes: 90 },
  { code: 'SV-CANCHINH', name: 'Cân chỉnh góc đặt bánh xe', group: 'Lốp và mâm', minutes: 60 },
  { code: 'SV-NOHOURS', name: 'Dịch vụ chưa khai giờ chuẩn', group: 'Khác', minutes: 0 },
] as const;

export function recDemoDocs(): SeedDoc[] {
  const docs: SeedDoc[] = [];
  const put = (collection: string, id: string, data: Record<string, unknown>) =>
    docs.push({ collection, id, data });
  for (const s of demoServices)
    put(COL.services, `svc_${CMP}_${s.code}`, {
      companyId: CMP,
      code: s.code,
      name: s.name,
      nameNorm: normalizeSearch(s.name),
      group: s.group,
      status: 'active',
      createdAt: AT,
      createdBy: 'seed',
      updatedAt: AT,
      updatedBy: 'seed',
      version: 1,
    });
  const cfg = (type: string, scopeKey: string, payload: Record<string, unknown>) =>
    put(COL.configVersions, `${type}__${scopeKey.replace(/[:/]/g, '~')}__${DAY}`, {
      companyId: CMP,
      type,
      scopeKey,
      effectiveFrom: DAY,
      status: 'approved',
      payload,
      proposedBy: 'seed',
      proposedAt: AT,
      reason: 'Dữ liệu mẫu (chưa được kế toán xác nhận)',
      decidedBy: 'seed',
      decidedAt: AT,
      decisionNote: null,
      version: 1,
    });
  for (const s of demoServices)
    if (s.minutes > 0) cfg('standard-hours', `service:${s.code}`, { standardMinutes: s.minutes });
  cfg('labor-rate', 'company', { hourlyRateVnd: 300_000 });
  // sample rate in basis points; the real rate and the 1/1/2027 rule (BA-03) are the accountant's data
  cfg('tax-rate', 'vat', { name: 'Thuế GTGT (mẫu)', rateBp: 800 });
  // R2: which tax key each kind of line uses; the accountant has not answered, so both use `vat`
  cfg('tax-mapping', 'company', { labor: 'vat', part: 'vat' });
  // R7: the four service types of the BRD as a company catalogue (body and paint workflow not surveyed)
  for (const [code, name] of [
    ['maintenance', 'Bảo dưỡng'],
    ['general_repair', 'Sửa chữa chung'],
    ['tire_wheel', 'Lốp và mâm'],
    ['body_paint', 'Đồng sơn'],
  ] as const)
    cfg('service-type', code, { name, status: 'active' });
  // Câu 2 / FR-REC-026: approval policy (a customer may refuse a required item; no OTP until SMS exists)
  cfg('quote-approval', 'company', {
    allowDeclineRequired: true,
    verbalApproval: true,
    otpMode: 'off',
  });
  for (const [code, name, noteRequired] of [
    ['later', 'Để lần sau', false],
    ['price_high', 'Giá cao hơn dự kiến', false],
    ['fixed_elsewhere', 'Đã sửa ở nơi khác', false],
    ['other', 'Lý do khác', true],
  ] as const)
    cfg('decline-reason', code, {
      name,
      status: 'active',
      ...(noteRequired ? { noteRequired } : {}),
    });
  // FR-REC-032 / R36: step sets per service type (SAMPLE steps from BA §18.2 R36; the client confirms them).
  // Steps are tracking milestones, not order states, and do not count toward the technician's labor
  // (`countsTowardLabor` false) because the pay rules are still open. Body & paint is a MINIMAL SAMPLE that
  // waits for the workshop survey (BR-REC-14): `expectedDays` are placeholders, not a confirmed process.
  cfg('service-workflow', 'maintenance', {
    steps: [
      { code: 'inspect', name: 'Kiểm tra' },
      { code: 'service', name: 'Thực hiện bảo dưỡng', responsibleRole: 'TH' },
      { code: 'qc', name: 'Kiểm tra chất lượng', responsibleRole: 'QD' },
    ],
  });
  cfg('service-workflow', 'general_repair', {
    steps: [
      { code: 'diagnose', name: 'Chẩn đoán', responsibleRole: 'TH' },
      { code: 'repair', name: 'Sửa chữa', responsibleRole: 'TH' },
      { code: 'qc', name: 'Kiểm tra chất lượng', responsibleRole: 'QD' },
    ],
  });
  cfg('service-workflow', 'tire_wheel', {
    steps: [
      { code: 'remove', name: 'Tháo bánh' },
      { code: 'balance', name: 'Cân bằng và lắp', responsibleRole: 'TH' },
      { code: 'qc', name: 'Kiểm tra chất lượng', responsibleRole: 'QD' },
    ],
  });
  cfg('service-workflow', 'body_paint', {
    steps: [
      {
        code: 'assess',
        name: 'Giám định hư hỏng và chụp ảnh',
        responsibleRole: 'CV',
        expectedDays: 1,
      },
      { code: 'bodywork', name: 'Gò, nắn, bả', responsibleRole: 'TH', expectedDays: 2 },
      { code: 'prime', name: 'Sơn lót, chà', responsibleRole: 'TH', expectedDays: 1 },
      { code: 'paint', name: 'Sơn màu và sơn bóng', responsibleRole: 'TH', expectedDays: 2 },
      { code: 'cure', name: 'Sấy, chờ khô', responsibleRole: 'TH', expectedDays: 1 },
      { code: 'polish', name: 'Đánh bóng, lắp ráp', responsibleRole: 'TH', expectedDays: 1 },
      {
        code: 'qc',
        name: 'Kiểm tra chất lượng và duyệt màu',
        responsibleRole: 'QD',
        expectedDays: 1,
      },
    ].map((x) => ({ ...x, countsTowardLabor: false })),
  });
  // FR-REC-016: SAMPLE quality checklist (company default); the client defines the real lists per service type
  cfg('qc-checklist', 'default', {
    checks: [
      { code: 'work_done', name: 'Công việc đã làm đúng nội dung báo giá' },
      { code: 'test_drive', name: 'Chạy thử, không có tiếng ồn hay cảnh báo bất thường' },
      { code: 'leaks', name: 'Không rò rỉ dầu, nước' },
      { code: 'clean', name: 'Xe sạch, đồ đạc của khách còn nguyên' },
    ],
  });
  // FR-REC-013/017 sample execution policy: 2 minutes to undo; R44: the handover checks the payment (ACC, slice 1.7)
  cfg('order-policy', 'company', {
    undoWindowSeconds: 120,
    handoverRequiresPayment: true,
    handoverRequiresReceiver: true,
  });
  // ---- slice 1.8 (EIN) SAMPLE issuing unit: the fake provider in the TEST environment. The real provider, seller data,
  // symbol and invoice type are the client's and the accountant's [Cần xác nhận]; none of this is a legal value.
  cfg('einvoice-issuer', 'company', {
    enabled: true,
    providerCode: 'fake',
    environment: 'test',
    sellerName: 'Công ty TNHH Garage Demo',
    sellerTaxCode: '0312000111',
    sellerAddress: '12 Nguyễn Văn Linh, Quận 7, TP.HCM',
    symbol: 'C26TAA',
    invoiceType: 'vat',
    templateCode: '1',
  });
  cfg('einvoice-policy', 'company', {
    lineMode: 'per-rate',
    perRateDescription: 'Dịch vụ sửa chữa, bảo dưỡng và phụ tùng theo lệnh {order}',
    issueAfter: 'qc',
    businessAddressRequired: true,
    retailNameRequired: true,
    taxChangePolicy: 'warn',
    maxAttempts: 5,
    retryBackoffMinutes: [5, 15, 60, 240, 720],
    providerTimeoutMs: 30000,
  });
  // ---- slice 1.9 (RPT) SAMPLE alert thresholds: the owner decides the real ones [Cần xác nhận]
  cfg('report-policy', 'company', {
    openOrderMaxDays: 5,
    uninvoicedAfterDays: 1,
    unpaidHandoverGraceDays: 0,
    cashVarianceAlertVnd: 0,
  });
  // ---- slice 1.7 (ACC) SAMPLE policy and limits: the client and the accountant give the real numbers [Cần xác nhận]
  cfg('acc-policy', 'company', {
    methods: ['cash', 'transfer', 'card', 'qr'],
    nonCashReferenceRequired: true,
    receiptRequiresQc: true,
    varianceToleranceVnd: 0,
    debtMaxDays: 60,
  });
  // G4-APR-03 illustrative limits (the design says "giá trị minh họa"): an expense up to 500.000 needs no approval
  // R58: sample data, NOT a code fallback (the fallback is "every voucher needs approval"): 500.000 per voucher, 2.000.000 per shift
  cfg('approval-limit', 'expense', {
    selfMaxVnd: 500_000,
    level1MaxVnd: 5_000_000,
    dueHours: 24,
    shiftCapVnd: 2_000_000,
  });
  cfg('approval-limit', 'deposit_refund', {
    selfMaxVnd: 0,
    level1MaxVnd: 50_000_000,
    dueHours: 24,
  });
  for (const kind of ['invoice_adjust', 'invoice_replace', 'invoice_cancel'])
    cfg('approval-limit', kind, { selfMaxVnd: 0, level1MaxVnd: 1_000_000_000_000, dueHours: 24 });
  cfg('approval-limit', 'payment_reversal', {
    selfMaxVnd: 0,
    level1MaxVnd: 50_000_000,
    dueHours: 24,
  });
  cfg('approval-limit', 'debt_handover', { selfMaxVnd: 0, level1MaxVnd: 10_000_000, dueHours: 8 });
  cfg('approval-limit', 'cash_variance', { selfMaxVnd: 0, level1MaxVnd: 500_000, dueHours: 24 });
  for (const [code, name, depositRefund, sourceRequirement] of [
    ['office', 'Vật tư văn phòng', false, 'optional'],
    ['utilities', 'Điện nước', false, 'optional'],
    ['equipment_repair', 'Sửa chữa thiết bị', false, 'optional'],
    ['hospitality', 'Tiếp khách', false, 'optional'],
    ['other', 'Chi phí khác', false, 'optional'],
    // R64: a category tied to a source document cannot be saved without it
    ['order_cost', 'Chi phí theo lệnh sửa chữa', false, 'required'],
    ['deposit_refund', 'Hoàn tiền cọc cho khách', true, 'required'],
  ] as const)
    cfg('expense-category', code, {
      name,
      status: 'active',
      sourceRequirement,
      ...(depositRefund ? { depositRefund } : {}),
    });
  cfg('discount-limit', 'company', { maxDiscountBpByRole: { CV: 500, QL: 1500, CH: 3000 } });
  return docs;
}
