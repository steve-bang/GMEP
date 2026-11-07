/**
 * FAKE REC phase-2 demo data (slice 2.8b). EVERY value is a SAMPLE ("minh họa"): whether the client takes appointments
 * at all is open (BRD Discovery 13) and the workshop capacity is the client's number. They are ordinary approved config
 * versions; nothing in code reads these values. The second demo tenant has NO version, so appointments are off there.
 */
import { configVersionId } from '@/modules/sys';
import { COL } from '../repos/queries';
import type { SeedDoc } from './types';

const AT = new Date('2026-10-01T00:00:00.000Z');
const TENANT = 'tnt_demo';
const DAY = '2026-10-01';

export function recP2DemoDocs(): SeedDoc[] {
  const docs: SeedDoc[] = [];
  const cfg = (type: string, scopeKey: string, payload: Record<string, unknown>) =>
    docs.push({
      collection: COL.configVersions,
      id: configVersionId(TENANT, type, scopeKey, DAY),
      data: {
        tenantId: TENANT,
        type,
        scopeKey,
        effectiveFrom: DAY,
        status: 'approved',
        payload,
        proposedBy: 'seed',
        proposedAt: AT,
        reason: 'Dữ liệu minh họa (Discovery câu 13 chưa xác nhận)',
        decidedBy: 'seed',
        decidedAt: AT,
        decisionNote: null,
        version: 1,
      },
    });
  // FR-REC-019, 027: appointments on for the demo company (20 cars a day), Quận 7 overrides with a small capacity
  cfg('appointment-policy', 'tenant', { enabled: true, dailyCapacity: 20 });
  cfg('appointment-policy', 'branch:br_q7', { enabled: true, dailyCapacity: 2 });
  // FR-REC-045 / Q94: SAMPLE cancel reasons (BA appointments-improvements-ba.md 2.2); the client confirms the list
  for (const [i, [code, name, party, noteRequired]] of (
    [
      ['customer_request', 'Khách yêu cầu hủy', 'customer', false],
      ['customer_busy', 'Khách bận hoặc đổi kế hoạch', 'customer', false],
      ['fixed_elsewhere', 'Xe đã sửa ở nơi khác', 'customer', false],
      ['not_needed', 'Xe không còn cần dịch vụ', 'customer', false],
      ['unreachable', 'Không liên lạc được với khách', 'customer', false],
      ['duplicate_or_mistake', 'Trùng lịch hoặc đặt nhầm', 'garage', false],
      ['garage_unable', 'Xưởng không nhận được (hết công suất, thiếu thợ)', 'garage', false],
      ['other', 'Khác', 'other', true],
    ] as const
  ).entries())
    cfg('appointment-cancel-reason', code, {
      name,
      status: 'active',
      party,
      order: (i + 1) * 10,
      ...(noteRequired ? { noteRequired } : {}),
    });
  // FR-REC-046 / Q95: SAMPLE reschedule reasons (BA 3.3)
  for (const [i, [code, name, party, noteRequired]] of (
    [
      ['customer_busy', 'Khách bận', 'customer', false],
      ['customer_late', 'Khách báo đến trễ', 'customer', false],
      ['vehicle_not_ready', 'Xe chưa sẵn sàng', 'customer', false],
      ['garage_reschedule', 'Xưởng đổi lịch', 'garage', false],
      ['weather_incident', 'Thời tiết hoặc sự cố', 'garage', false],
      ['other', 'Khác', 'other', true],
    ] as const
  ).entries())
    cfg('appointment-reschedule-reason', code, {
      name,
      status: 'active',
      party,
      order: (i + 1) * 10,
      ...(noteRequired ? { noteRequired } : {}),
    });
  // FR-REC-018: sample warranty terms (Q77 open): maintenance 90 days or 5,000 km, anything else 30 days or 1,000 km
  cfg('warranty-term', 'svc:maintenance', {
    days: 90,
    km: 5000,
    conditions: 'Minh họa: không áp dụng khi xe sửa ở nơi khác',
  });
  cfg('warranty-term', 'default', { days: 30, km: 1000 });
  // FR-REC-036: Thủ Đức may open warranty work on another branch's order (sample only; the company default stays
  // strict because no tenant-level version exists), recording the origin branch as the cost bearer
  cfg('warranty-policy', 'branch:br_td', { crossBranchOpen: true, costBearer: 'origin_branch' });
  // FR-REC-020: one sample maintenance package (lines priced by the normal quote pricing)
  cfg('service-package', 'bd-10000', {
    name: 'Gói bảo dưỡng 10.000 km (minh họa)',
    status: 'active',
    serviceType: 'maintenance',
    items: [
      {
        name: 'Thay dầu và lọc dầu',
        necessity: 'required',
        lines: [
          { kind: 'labor', serviceId: 'svc_tnt_demo_SV-DAU' },
          { kind: 'part', partId: 'part_seed_01', qty: 1 },
        ],
      },
      {
        name: 'Kiểm tra phanh',
        necessity: 'optional',
        lines: [{ kind: 'labor', serviceId: 'svc_tnt_demo_SV-PHANH' }],
      },
    ],
  });
  return docs;
}
