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
  cfg('discount-limit', 'company', { maxDiscountBpByRole: { CV: 500, QL: 1500, CH: 3000 } });
  return docs;
}
