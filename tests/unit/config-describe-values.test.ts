import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONFIG_DESCRIPTORS, type DescribeT } from '@/modules/sys/domain/configDescriptors';
import { formatVnd } from '@/platform/format/vnd';

const vi = JSON.parse(readFileSync('src/platform/i18n/vi.json', 'utf8')) as Record<string, unknown>;
const lookup = (key: string): string | undefined => {
  let cur: unknown = vi;
  for (const part of key.split('.')) {
    if (typeof cur !== 'object' || cur === null || !(part in cur)) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === 'string' ? cur : undefined;
};
/** the real Vietnamese messages with {name} interpolation (no ICU plural/select is used in these messages) */
const t = Object.assign(
  (key: string, values: Record<string, string | number> = {}) => {
    const m = lookup(key);
    if (m === undefined) throw new Error(`missing i18n key ${key}`);
    return m.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? `{${k}}`));
  },
  { has: (key: string) => lookup(key) !== undefined },
) as DescribeT;
const d = (type: string, payload: Record<string, unknown>) =>
  CONFIG_DESCRIPTORS[type]!.describe!(t, payload);
const v = (n: number) => formatVnd(n);

/**
 * Readable value of each config type in the version table (FR-SYS-004). The payloads are SAMPLE shapes to prove the
 * wording and the units; none is a signed-off business number (NFR-MNT-01 examples come from the accountant).
 */
describe('FR-SYS-004: describe of the types that used to show an empty value', () => {
  it('service-package', () => {
    expect(
      d('service-package', {
        name: 'Bảo dưỡng nhỏ',
        status: 'active',
        serviceType: 'maintenance',
        items: [
          { name: 'Thay dầu', necessity: 'required', lines: [{ kind: 'labor' }, { kind: 'part' }] },
          { name: 'Kiểm tra phanh', necessity: 'optional', lines: [{ kind: 'labor' }] },
        ],
      }),
    ).toBe(
      'Bảo dưỡng nhỏ · Đang dùng · loại dịch vụ maintenance · 2 hạng mục (1 bắt buộc), 3 dòng',
    );
  });

  it('public-rate-limit', () => {
    expect(
      d('public-rate-limit', {
        viewLimit: 60,
        viewWindowSeconds: 60,
        decideLimit: 5,
        decideWindowMinutes: 10,
      }),
    ).toBe('Xem trang: 60 lần mỗi 60 giây · Duyệt hoặc từ chối: 5 lần mỗi 10 phút');
    expect(
      d('public-rate-limit', {
        viewLimit: 60,
        viewWindowSeconds: 60,
        decideLimit: 5,
        decideWindowMinutes: 10,
        photoViewLimit: 120,
        photoViewWindowSeconds: 60,
      }),
    ).toContain('Xem ảnh: 120 lần mỗi 60 giây');
  });

  it('qc-checklist', () => {
    expect(
      d('qc-checklist', {
        checks: [
          { code: 'brake', name: 'Phanh' },
          { code: 'lights', name: 'Đèn' },
        ],
      }),
    ).toBe('2 mục kiểm tra: Phanh, Đèn');
  });

  it('order-policy', () => {
    expect(
      d('order-policy', {
        undoWindowSeconds: 30,
        handoverRequiresPayment: true,
        handoverRequiresReceiver: false,
      }),
    ).toBe('Hoàn tác trong 30 giây · Bàn giao khi đã thu đủ: có · Ghi tên người nhận xe: không');
  });

  it('acc-policy', () => {
    expect(
      d('acc-policy', {
        methods: ['cash', 'transfer'],
        nonCashReferenceRequired: true,
        receiptRequiresQc: false,
        varianceToleranceVnd: 20000,
        debtMaxDays: 45,
        sourceFlagNoticeDays: 2,
      }),
    ).toBe(
      `Hình thức thu: Tiền mặt, Chuyển khoản · Bắt buộc mã giao dịch khi không thu tiền mặt: có · Thu cuối cần qua kiểm tra chất lượng: không · Lệch két trong ±${v(20000)} chỉ cần giải trình · Công nợ tối đa 45 ngày · Nhắc thiếu chứng từ sau 2 ngày`,
    );
  });

  it('approval-limit (required fields, then every optional one)', () => {
    expect(d('approval-limit', { selfMaxVnd: 0, level1MaxVnd: 5000000, dueHours: 24 })).toBe(
      `Tự quyết đến ${v(0)} · Quản lý chi nhánh duyệt đến ${v(5000000)} · Hạn xử lý 24 giờ`,
    );
    expect(
      d('approval-limit', {
        selfMaxVnd: 100000,
        level1MaxVnd: 2000000,
        shiftCapVnd: 300000,
        dueHours: 48,
        validHours: 2,
        maxReopensPerMonth: 3,
        escalateAfterHours: 4,
        bulkAllowed: true,
        reauthOnApprove: true,
      }),
    ).toBe(
      `Tự quyết đến ${v(100000)} · Quản lý chi nhánh duyệt đến ${v(2000000)} · Trần mỗi ca ${v(300000)} · Hạn xử lý 48 giờ · Dùng được 2 giờ sau khi duyệt · Báo bất thường khi mở lại quá 3 lần mỗi tháng · Chuyển cấp sau 4 giờ làm việc · Cho duyệt hàng loạt · Nhập lại mật khẩu khi duyệt`,
    );
  });

  it('work-hours: Monday first, Sunday last, HH:MM', () => {
    expect(d('work-hours', { days: [0, 6, 1, 2], startMinute: 480, endMinute: 1020 })).toBe(
      'T2, T3, T7, CN · 08:00 đến 17:00',
    );
    expect(d('work-hours', { days: [1], startMinute: 0, endMinute: 1440 })).toBe(
      'T2 · 00:00 đến 24:00',
    );
  });

  it('expense-category', () => {
    expect(
      d('expense-category', {
        name: 'Hoàn cọc',
        status: 'active',
        depositRefund: true,
        sourceRequirement: 'required',
        accountCode: '131',
      }),
    ).toBe('Hoàn cọc · Đang dùng · Hoàn cọc khách · Chứng từ gốc: bắt buộc · Mã tài khoản 131');
    expect(d('expense-category', { name: 'Văn phòng', status: 'inactive' })).toBe(
      'Văn phòng · Ngừng dùng · Chứng từ gốc: không bắt buộc',
    );
  });

  it('einvoice-issuer shows the issuing unit only: no key, password or secret', () => {
    const payload = {
      enabled: true,
      providerCode: 'fake',
      environment: 'test',
      sellerName: 'Công ty Mẫu',
      sellerTaxCode: '0123456789',
      symbol: 'C26TAA',
      invoiceType: 'vat',
      templateCode: '1',
      // not in the schema, here to prove nothing unknown is echoed
      apiKey: 'SECRET-KEY',
      password: 'SECRET-PASSWORD',
    };
    const out = d('einvoice-issuer', payload);
    expect(out).toBe(
      'Đang bật · Nhà cung cấp fake · Môi trường thử · Công ty Mẫu · MST 0123456789 · Ký hiệu C26TAA · Hóa đơn GTGT · Mẫu số 1',
    );
    expect(out).not.toContain('SECRET');
  });

  it('einvoice-policy', () => {
    expect(
      d('einvoice-policy', {
        lineMode: 'per-rate',
        perRateDescription: 'Dịch vụ sửa chữa',
        issueAfter: 'handover',
        businessAddressRequired: true,
        retailNameRequired: false,
        taxChangePolicy: 'warn',
        maxAttempts: 5,
        retryBackoffMinutes: [1, 5, 15],
        providerTimeoutMs: 30000,
      }),
    ).toBe(
      'Một dòng mỗi thuế suất · Tên dòng gộp «Dịch vụ sửa chữa» · Phát hành sau khi bàn giao xe · Khi đổi thuế suất: cảnh báo và liệt kê · Bắt buộc địa chỉ đơn vị mua: có · Bắt buộc tên khách lẻ: không · Thử lại tối đa 5 lần, cách 1, 5, 15 phút · Chờ nhà cung cấp 30 giây',
    );
    expect(
      d('einvoice-policy', {
        lineMode: 'per-line',
        perRateDescription: 'Bỏ qua',
        issueAfter: 'qc',
        businessAddressRequired: false,
        retailNameRequired: true,
        taxChangePolicy: 'block',
        maxAttempts: 1,
        retryBackoffMinutes: [2],
        providerTimeoutMs: 1500,
      }),
    ).toBe(
      'Một dòng mỗi hạng mục · Phát hành từ khi qua kiểm tra chất lượng · Khi đổi thuế suất: chặn phát hành · Bắt buộc địa chỉ đơn vị mua: không · Bắt buộc tên khách lẻ: có · Thử lại tối đa 1 lần, cách 2 phút · Chờ nhà cung cấp 1.500 ms',
    );
  });

  it('tenant-limits (GB when whole, MB otherwise)', () => {
    const base = {
      activeBranches: 3,
      users: 25,
      apiPerMinute: 300,
      backgroundJobs: 2,
      importRowsPerDay: 20000,
      exportRowsPerRun: 5000,
    };
    expect(d('tenant-limits', { ...base, photoStorageMb: 10240 })).toBe(
      '3 chi nhánh · 25 người dùng · ảnh 10 GB · API 300 lượt mỗi phút · 2 tác vụ nền · nhập 20.000 dòng mỗi ngày · xuất 5.000 dòng mỗi lần',
    );
    expect(d('tenant-limits', { ...base, photoStorageMb: 1500 })).toContain('ảnh 1.500 MB');
  });

  it('report-policy', () => {
    expect(
      d('report-policy', {
        openOrderMaxDays: 7,
        uninvoicedAfterDays: 1,
        unpaidHandoverGraceDays: 3,
        cashVarianceAlertVnd: 50000,
      }),
    ).toBe(
      `Lệnh mở quá 7 ngày bị liệt kê · Lệnh xong chưa có hóa đơn từ 1 ngày · Đã bàn giao còn nợ quá 3 ngày · Lệch két trên ${v(50000)}`,
    );
  });

  it('branch-groups lists names and counts, never branch ids', () => {
    expect(
      d('branch-groups', {
        groups: [
          { code: 'north', name: 'Miền Bắc', branchIds: ['b1', 'b2'] },
          { code: 'south', name: 'Miền Nam', branchIds: ['b3'] },
        ],
      }),
    ).toBe('2 nhóm: Miền Bắc (2 chi nhánh), Miền Nam (1 chi nhánh)');
    expect(d('branch-groups', { groups: [] })).toBe('Chưa có nhóm chi nhánh');
  });

  it('catalog-release', () => {
    expect(d('catalog-release', { audience: 'all' })).toBe('Phát hành cho mọi chi nhánh');
    expect(d('catalog-release', { audience: 'branches', branchIds: ['b1', 'b2', 'b3'] })).toBe(
      'Chỉ phát hành cho 3 chi nhánh',
    );
  });

  it('labor-method: one wording per method', () => {
    expect(d('labor-method', { method: 'standard_hours', hourlyRateVnd: 60000 })).toBe(
      `Giờ chuẩn × ${v(60000)} mỗi giờ`,
    );
    expect(d('labor-method', { method: 'approved_actual', hourlyRateVnd: 60000 })).toBe(
      `Giờ thực tế đã duyệt × ${v(60000)} mỗi giờ`,
    );
    expect(
      d('labor-method', { method: 'approved_actual', hourlyRateVnd: 60000, capBp: 12000 }),
    ).toBe(`Giờ thực tế đã duyệt × ${v(60000)} mỗi giờ · giờ duyệt tối đa 120% giờ chuẩn`);
    expect(d('labor-method', { method: 'flat', amountVnd: 150000 })).toBe(
      `Khoán ${v(150000)} mỗi hạng mục`,
    );
    expect(d('labor-method', { method: 'percent', rateBp: 850 })).toBe(
      '8,5% tiền công của hạng mục',
    );
    expect(
      d('labor-method', {
        method: 'fixed_bonus',
        fixedVnd: 100000,
        bonusVnd: 30000,
        bonusMaxActualBp: 10000,
      }),
    ).toBe(`Cố định ${v(100000)} + thưởng ${v(30000)} nếu giờ thực tế không quá 100% giờ chuẩn`);
  });

  it('labor-position', () => {
    expect(d('labor-position', { name: 'Thợ chính', status: 'active', coefficientBp: 12000 })).toBe(
      'Thợ chính · Đang dùng · Hệ số 120%',
    );
  });

  it('labor-policy', () => {
    expect(
      d('labor-policy', {
        roundingMode: 'half_up',
        moneyStepVnd: 1000,
        minutesStep: 5,
        adjustThresholdMinutes: 30,
        adjustThresholdVnd: 100000,
        reworkMode: 'keep_original',
      }),
    ).toBe(
      `Làm tròn: nửa lên · Tiền làm tròn theo bậc ${v(1000)} · Phút làm tròn theo bậc 5 · Ngưỡng điều chỉnh 30 phút hoặc ${v(100000)} · Làm lại: giữ công gốc`,
    );
  });

  it('appointment-policy (capacity 0 means none configured)', () => {
    expect(d('appointment-policy', { enabled: false, dailyCapacity: 0 })).toBe(
      'Không nhận lịch hẹn · Chưa đặt sức chứa',
    );
    expect(
      d('appointment-policy', {
        enabled: true,
        dailyCapacity: 20,
        overdueGraceMinutes: 15,
        staleDays: 7,
        maxReschedules: 3,
        lateRescheduleMinutes: 120,
        noteMinLength: 10,
      }),
    ).toBe(
      'Nhận lịch hẹn · Sức chứa 20 xe mỗi ngày · Quá hẹn tính sau 15 phút · Lịch tồn đọng sau 7 ngày · Dời tối đa 3 lần · Dời sát giờ khi còn dưới 120 phút · Ghi chú tối thiểu 10 ký tự',
    );
  });

  it('warranty-term (0 = no limit of that kind)', () => {
    expect(d('warranty-term', { days: 180, km: 0, conditions: 'Có hóa đơn' })).toBe(
      '180 ngày · Không giới hạn km · Điều kiện: Có hóa đơn',
    );
    expect(d('warranty-term', { days: 0, km: 10000 })).toBe('Không giới hạn ngày · 10.000 km');
  });

  it('warranty-policy', () => {
    expect(d('warranty-policy', { crossBranchOpen: false, costBearer: 'performing_branch' })).toBe(
      'Mở bảo hành ở chi nhánh khác: không · Ghi nhận chi phí cho: chi nhánh thực hiện',
    );
    expect(d('warranty-policy', { crossBranchOpen: true, costBearer: 'origin_branch' })).toBe(
      'Mở bảo hành ở chi nhánh khác: có · Ghi nhận chi phí cho: chi nhánh gốc',
    );
  });

  it('no description is raw JSON or an empty string for a typical payload', () => {
    for (const out of [
      d('qc-checklist', { checks: [{ code: 'a', name: 'A' }] }),
      d('catalog-release', { audience: 'all' }),
    ]) {
      expect(out).not.toMatch(/[{}[\]"]/);
      expect(out.length).toBeGreaterThan(0);
    }
  });
});
