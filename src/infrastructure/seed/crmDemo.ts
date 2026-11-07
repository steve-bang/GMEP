/**
 * FAKE CRM demo data (slice 1.3): invented names, phones 09000002xx, plates and VINs. Customers and
 * vehicles are company-level records linked to the branches that know them (BA §10.1.5):
 * Q7 knows An and the business customer, Thu Duc knows Binh; the sedan 51H-123.45 also has a repair
 * history at Thu Duc (cross-branch projection).
 */
import { configVersionId } from '@/modules/sys';
import { customerLinkId, plateKey, vehicleLinkId } from '@/modules/crm';
import { normalizeSearch } from '@/platform/text/normalize';
import type { SeedDoc } from './types';
import { COL } from '../repos/queries';

const AT = new Date('2026-10-01T00:00:00.000Z');
const CMP = 'tnt_demo';

interface C {
  id: string;
  code: string;
  type: 'individual' | 'business';
  name: string;
  branch: string;
  phone: string;
  email?: string;
  address?: string;
  taxCode?: string;
  marketing?: string[];
  vehicles: number;
}
const customers: C[] = [
  {
    id: 'cus_an',
    code: 'KH-Q7-00001',
    type: 'individual',
    name: 'Nguyễn Văn An',
    branch: 'br_q7',
    phone: '0900000211',
    email: 'an.demo@example.test',
    address: '12 Nguyễn Văn Linh, Quận 7, TP.HCM',
    marketing: ['zalo'],
    vehicles: 1,
  },
  {
    id: 'cus_binh',
    code: 'KH-TD-00001',
    type: 'individual',
    name: 'Trần Thị Bình',
    branch: 'br_td',
    phone: '0900000222',
    address: '5 Võ Văn Ngân, Thủ Đức, TP.HCM',
    vehicles: 1,
  },
  {
    id: 'cus_biz',
    code: 'KH-Q7-00002',
    type: 'business',
    name: 'Công ty TNHH Vận tải Demo',
    branch: 'br_q7',
    phone: '0900000233',
    taxCode: '0312345678',
    vehicles: 1,
  },
];
const vehicles = [
  {
    id: 'veh_an',
    plate: '51H-123.45',
    make: 'Toyota',
    model: 'Vios 1.5G',
    year: 2019,
    owner: 'cus_an',
    branches: ['br_q7', 'br_td'],
    commercial: false,
    km: 64200,
  },
  {
    id: 'veh_binh',
    plate: '29A-678.90',
    make: 'Mazda',
    model: 'CX-5',
    year: 2021,
    owner: 'cus_binh',
    branches: ['br_td'],
    commercial: false,
    km: 31000,
  },
  {
    id: 'veh_biz',
    plate: '51D-999.88',
    make: 'Hyundai',
    model: 'Porter H150',
    year: 2020,
    owner: 'cus_biz',
    branches: ['br_q7'],
    commercial: true,
    km: 120500,
  },
];

export const norm = (p: string) => p.toUpperCase().replace(/[^A-Z0-9]/g, '');

export function crmDemoDocs(): SeedDoc[] {
  const docs: SeedDoc[] = [];
  const put = (collection: string, id: string, data: SeedDoc['data']) =>
    docs.push({ collection, id, data });
  for (const c of customers) {
    const branchIds = c.id === 'cus_an' ? ['br_q7', 'br_td'] : [c.branch];
    put(COL.customers, c.id, {
      tenantId: CMP,
      branchId: c.branch,
      code: c.code,
      type: c.type,
      name: c.name,
      nameNorm: normalizeSearch(c.name),
      ...(c.taxCode ? { taxCode: c.taxCode } : {}),
      labels: [],
      status: 'active',
      vehicleCount: c.vehicles,
      marketing: c.marketing ?? [],
      branchIds,
      createdAt: AT,
      createdBy: 'seed',
      updatedAt: AT,
      updatedBy: 'seed',
      version: 1,
    });
    put(COL.customerPii, c.id, {
      tenantId: CMP,
      phone: c.phone,
      phoneNorm: c.phone,
      ...(c.email ? { email: c.email } : {}),
      ...(c.address ? { address: c.address } : {}),
      createdAt: AT,
    });
    for (const b of branchIds)
      put(COL.customerLinks, customerLinkId(c.id, b), {
        tenantId: CMP,
        customerId: c.id,
        branchId: b,
        nameNorm: normalizeSearch(c.name),
        type: c.type,
        code: c.code,
        source: b === c.branch ? 'created' : 'lookup_adopt',
        createdBy: 'seed',
        createdAt: AT,
      });
    if (c.marketing?.length)
      put(COL.consents, `con_${c.id}`, {
        tenantId: CMP,
        branchId: c.branch,
        customerId: c.id,
        purpose: 'marketing',
        channel: 'zalo',
        basis: 'consent',
        status: 'granted',
        grantedAt: AT,
        evidence: 'Phiếu giấy mẫu',
        createdBy: 'seed',
        version: 1,
      });
  }
  for (const v of vehicles) {
    put(COL.vehicles, v.id, {
      tenantId: CMP,
      branchId: v.branches[0],
      plate: v.plate,
      plateNorm: norm(v.plate),
      previousPlates: [],
      make: v.make,
      model: v.model,
      year: v.year,
      isCommercial: v.commercial,
      lastKm: v.km,
      lastKmAt: '2026-10-01',
      currentOwnerId: v.owner,
      branchIds: v.branches,
      createdAt: AT,
      createdBy: 'seed',
      updatedAt: AT,
      updatedBy: 'seed',
      version: 1,
    });
    put(COL.vehiclePlates, plateKey(CMP, norm(v.plate)), { tenantId: CMP, vehicleId: v.id });
    for (const b of v.branches)
      put(COL.vehicleLinks, vehicleLinkId(v.id, b), {
        tenantId: CMP,
        vehicleId: v.id,
        branchId: b,
        plateNorm: norm(v.plate),
        createdAt: AT,
      });
    put(COL.vehicleOwnerships, `own_${v.id}`, {
      tenantId: CMP,
      vehicleId: v.id,
      customerId: v.owner,
      from: '2024-01-01',
      to: null,
      branchId: v.branches[0],
      createdAt: AT,
      createdBy: 'seed',
    });
  }
  // cross-branch repair history of the sedan: one visit at Q7, one at Thu Duc (white-listed projection fields only)
  put(COL.vehicleHistory, 'ro:demo-1', {
    tenantId: CMP,
    vehicleId: 'veh_an',
    branchId: 'br_q7',
    branchName: 'Chi nhánh Quận 7',
    orderCode: 'RO-Q7-2607-00093',
    date: '2026-07-12',
    km: 58000,
    items: ['Bảo dưỡng định kỳ 60.000 km'],
    parts: [
      { name: 'Lọc dầu', qty: 1 },
      { name: 'Dầu động cơ 4L', qty: 1 },
    ],
    totalVnd: 2150000,
    projectedAt: AT,
  });
  put(COL.vehicleHistory, 'ro:demo-2', {
    tenantId: CMP,
    vehicleId: 'veh_an',
    branchId: 'br_td',
    branchName: 'Chi nhánh Thủ Đức',
    orderCode: 'RO-TD-2603-00041',
    date: '2026-03-03',
    km: 52100,
    items: ['Cân chỉnh thước lái', 'Thay lốp'],
    parts: [{ name: 'Lốp 185/60R15', qty: 2 }],
    totalVnd: 3400000,
    projectedAt: AT,
  });
  // C23: kinds of consent evidence (the lawyer and the client decide the real list)
  for (const [code, name, extra] of [
    ['paper-slip', 'Phiếu giấy ký tại quầy', { referenceLabel: 'Số phiếu' }],
    ['web-tick', 'Tick xác nhận trên web hoặc liên kết', {}],
    ['reply-message', 'Tin nhắn trả lời của khách', { referenceLabel: 'Mã tin nhắn' }],
    ['email', 'Email', { referenceLabel: 'Mã email' }],
    ['other', 'Khác (ghi chú)', { noteRequired: true }],
  ] as const)
    put(COL.configVersions, configVersionId(CMP, 'evidence-kind', code, '2026-10-01'), {
      tenantId: CMP,
      type: 'evidence-kind',
      scopeKey: code,
      effectiveFrom: '2026-10-01',
      status: 'approved',
      payload: { name, status: 'active', ...extra },
      proposedBy: 'seed',
      proposedAt: AT,
      reason: 'Dữ liệu mẫu (chờ luật sư và khách xác nhận)',
      decidedBy: 'seed',
      decidedAt: AT,
      decisionNote: null,
      version: 1,
    });
  // the seeded customer codes are already issued: the counters continue after them
  for (const [branch, last] of [
    ['br_q7', 2],
    ['br_td', 1],
  ] as const)
    put(COL.counters, `${CMP}__${branch}__customer__ALL`, {
      tenantId: CMP,
      branchId: branch,
      docType: 'customer',
      period: 'ALL',
      last,
      updatedAt: AT,
    });
  return docs;
}
