/**
 * FAKE INV demo data (slice 1.4): invented parts and quantities. Two branches hold stock so branch
 * isolation is visible: Q7 (main warehouse, a low-stock part, an out-of-stock part, a hold for a
 * demo repair order) and Thu Duc (small stock). Balances, ledger rows and the opening adjustment
 * document are generated TOGETHER so the ledger always reproduces the balances (RULE-009).
 * Warehouse WH-SON of Q7 deliberately stays empty (other tests deactivate it).
 */
import {
  balanceId,
  SEED_PART_GROUPS,
  SEED_PART_UNITS,
  compatKey,
  DOC_SERIES,
  normalizePartCode,
  partCodeKey,
  reservationId,
  type StockBalance,
} from '@/modules/inv';
import { configVersionId, warehouseId } from '@/modules/sys';
import { counterId, formatNumber } from '@/platform/numbering/numbering';
import { DEFAULT_NUMBERING } from '@/platform/numbering/numbering';
import { normalizeSearch } from '@/platform/text/normalize';
import { COL } from '../repos/queries';
import type { SeedDoc } from './types';

const AT = new Date('2026-10-01T00:00:00.000Z');
const CMP = 'tnt_demo';
const DAY = '2026-10-01';

interface P {
  n: string;
  code: string;
  name: string;
  brand: string;
  unit: string;
  group: string;
  barcode?: string;
  compat?: [string, string][];
  status?: 'active' | 'inactive';
}
export const demoParts: P[] = [
  {
    n: '01',
    code: 'LOC-DAU-TY01',
    name: 'Lọc dầu Toyota',
    brand: 'Toyota',
    unit: 'piece',
    group: 'filter',
    barcode: '8930000000011',
    compat: [
      ['Toyota', 'Vios'],
      ['Toyota', 'Innova'],
    ],
  },
  {
    n: '02',
    code: 'DAU-5W30-4L',
    name: 'Dầu động cơ 5W-30 can 4 lít',
    brand: 'Castrol',
    unit: 'box',
    group: 'oil',
    barcode: '8930000000028',
    compat: [
      ['Toyota', 'Vios'],
      ['Mazda', 'CX-5'],
    ],
  },
  {
    n: '03',
    code: 'MA-PHANH-TY01',
    name: 'Má phanh trước Toyota Vios',
    brand: 'Toyota',
    unit: 'set',
    group: 'brake',
    compat: [['Toyota', 'Vios']],
  },
  {
    n: '04',
    code: 'BUGI-NGK-IR01',
    name: 'Bugi NGK Iridium',
    brand: 'NGK',
    unit: 'piece',
    group: 'electrical',
    barcode: '8930000000042',
    compat: [
      ['Mazda', 'CX-5'],
      ['Toyota', 'Vios'],
    ],
  },
  {
    n: '05',
    code: 'LOC-GIO-HY01',
    name: 'Lọc gió Hyundai Porter',
    brand: 'Hyundai',
    unit: 'piece',
    group: 'filter',
    compat: [['Hyundai', 'Porter H150']],
  },
  {
    n: '06',
    code: 'LOP-MICH-18565',
    name: 'Lốp Michelin 185/65R15',
    brand: 'Michelin',
    unit: 'piece',
    group: 'tire',
    compat: [['Toyota', 'Vios']],
  },
  {
    n: '07',
    code: 'ACQUY-GS-45',
    name: 'Ắc quy GS 45Ah',
    brand: 'GS',
    unit: 'piece',
    group: 'electrical',
  },
  {
    n: '08',
    code: 'NUOC-MAT-1L',
    name: 'Nước làm mát 1 lít',
    brand: 'Prestone',
    unit: 'litre',
    group: 'consumable',
  },
  {
    n: '09',
    code: 'DAY-CUROA-01',
    name: 'Dây curoa tổng',
    brand: 'Gates',
    unit: 'piece',
    group: 'engine',
  },
  {
    n: '10',
    code: 'GIOANG-NAP-01',
    name: 'Gioăng nắp máy (ngừng dùng)',
    brand: 'Victor',
    unit: 'piece',
    group: 'engine',
    status: 'inactive',
  },
];
export const partId = (n: string) => `part_seed_${n}`;

interface S {
  branch: string;
  code: string;
  user: string;
  poster: string;
  rows: { n: string; qty: number; unit: number; min?: number; max?: number }[];
  reserve?: { n: string; qty: number; order: string };
}
const stocks: S[] = [
  {
    branch: 'br_q7',
    code: 'Q7',
    user: 'u_tk_q7',
    poster: 'u_ql_q7',
    rows: [
      { n: '01', qty: 20, unit: 85000, min: 6, max: 30 },
      { n: '02', qty: 10, unit: 420000, min: 4, max: 20 },
      { n: '03', qty: 3, unit: 650000, min: 5, max: 12 },
      { n: '04', qty: 12, unit: 180000 },
      { n: '05', qty: 0, unit: 0, min: 4, max: 10 },
      { n: '06', qty: 8, unit: 1150000 },
      { n: '07', qty: 4, unit: 1350000 },
      { n: '08', qty: 30, unit: 95000 },
    ],
    reserve: { n: '01', qty: 2, order: 'ro_demo_1' },
  },
  {
    branch: 'br_td',
    code: 'TD',
    user: 'u_ql_td',
    poster: 'u_ql_td',
    rows: [
      { n: '01', qty: 6, unit: 88000, min: 3 },
      { n: '02', qty: 2, unit: 430000, min: 4 },
    ],
  },
];

export function invDemoDocs(): SeedDoc[] {
  const docs: SeedDoc[] = [];
  const put = (collection: string, id: string, data: SeedDoc['data']) =>
    docs.push({ collection, id, data });

  for (const p of demoParts) {
    const id = partId(p.n);
    const code = normalizePartCode(p.code);
    const keys = [
      ...new Set((p.compat ?? []).flatMap(([mk, md]) => [compatKey(mk, md), compatKey('', md)])),
    ];
    put(COL.parts, id, {
      tenantId: CMP,
      code,
      codeKey: partCodeKey(code),
      name: p.name,
      nameNorm: normalizeSearch(p.name),
      brand: p.brand,
      unit: p.unit,
      group: p.group,
      quantityScale: 1,
      ...(p.barcode ? { barcode: p.barcode } : {}),
      compat: (p.compat ?? []).map(([mk, md]) => `${mk} ${md}`),
      compatKeys: keys,
      status: p.status ?? 'active',
      createdAt: AT,
      createdBy: 'seed',
      updatedAt: AT,
      updatedBy: 'seed',
      version: 1,
    });
    put(COL.partCodes, `${CMP}__${partCodeKey(code)}`, { tenantId: CMP, partId: id });
    if (p.barcode) put(COL.partBarcodes, `${CMP}__${p.barcode}`, { tenantId: CMP, partId: id });
    for (const k of keys)
      put(COL.partCompat, `${CMP}__${k}__${id}`, {
        tenantId: CMP,
        compatKey: k,
        partId: id,
        code,
      });
  }

  // the standard price list (SYS header) and effective-dated prices for a few parts (INV-025 link)
  put(COL.priceLists, 'pl_std', {
    tenantId: CMP,
    code: 'STD',
    name: 'Bảng giá chuẩn',
    nameNorm: normalizeSearch('Bảng giá chuẩn'),
    status: 'active',
    createdAt: AT,
    createdBy: 'seed',
    updatedAt: AT,
    updatedBy: 'seed',
    version: 1,
  });
  const cfg = (type: string, scopeKey: string, payload: Record<string, unknown>) =>
    put(COL.configVersions, configVersionId(CMP, type, scopeKey, '2026-10-01'), {
      tenantId: CMP,
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
  for (const [n, cost, list] of [
    ['01', 85000, 130000],
    ['02', 420000, 560000],
    ['03', 650000, 890000],
    ['04', 180000, 260000],
  ] as const) {
    const p = demoParts.find((x) => x.n === n)!;
    cfg('price-item', `STD:${p.code}`, { name: p.name, costVnd: cost, listPriceVnd: list });
  }
  // I14: part groups and units are company catalogues (effective-dated config), seeded with the initial lists
  for (const g of SEED_PART_GROUPS) cfg('part-group', g.code, { name: g.name, status: 'active' });
  for (const u of SEED_PART_UNITS) cfg('part-unit', u.code, { name: u.name, status: 'active' });
  // FR-INV-009: the default method, as data (sample; the accountant decides)
  cfg('cost-method', 'tenant', { method: 'weighted-average' });

  for (const s of stocks) {
    const wh = warehouseId(s.branch, 'WH-CHINH');
    const docId = `stk_seed_${s.code.toLowerCase()}_open`;
    const series = DEFAULT_NUMBERING[DOC_SERIES.ADJ]!;
    const ctx = {
      tenantId: CMP,
      branchId: s.branch,
      branchCode: s.code,
      docType: DOC_SERIES.ADJ,
      businessDate: DAY,
      series,
    };
    const number = formatNumber(ctx, 1);
    put(COL.counters, counterId(ctx), {
      tenantId: CMP,
      branchId: s.branch,
      docType: DOC_SERIES.ADJ,
      period: '2610',
      last: 1,
      updatedAt: AT,
    });
    const lines = s.rows
      .filter((r) => r.qty > 0)
      .map((r, i) => {
        const p = demoParts.find((x) => x.n === r.n)!;
        return {
          lineNo: i + 1,
          partId: partId(r.n),
          partCode: normalizePartCode(p.code),
          partName: p.name,
          qty: r.qty,
          unitCostVnd: r.unit,
          valueVnd: r.qty * r.unit,
        };
      });
    put(COL.stockDocuments, docId, {
      tenantId: CMP,
      branchId: s.branch,
      warehouseId: wh,
      type: 'ADJ',
      status: 'posted',
      number,
      draftRef: `NHAP-${docId.slice(-8).toUpperCase()}`,
      businessDate: DAY,
      source: { type: 'opening-balance', id: null },
      reason: 'Tồn đầu kỳ (dữ liệu mẫu)',
      lines,
      totalValueVnd: lines.reduce((a, l) => a + l.valueVnd, 0),
      approvalReasons: ['adjustment'],
      postedAt: AT,
      postedBy: s.poster,
      createdAt: AT,
      createdBy: s.user,
      updatedAt: AT,
      updatedBy: s.poster,
      version: 2,
    });
    for (const r of s.rows) {
      const p = demoParts.find((x) => x.n === r.n)!;
      const reserved = s.reserve && s.reserve.n === r.n ? s.reserve.qty : 0;
      const line = lines.find((l) => l.partId === partId(r.n));
      const bal: StockBalance = {
        id: balanceId(wh, partId(r.n)),
        tenantId: CMP,
        branchId: s.branch,
        warehouseId: wh,
        partId: partId(r.n),
        partCode: normalizePartCode(p.code),
        partCodeNorm: normalizePartCode(p.code),
        partName: p.name,
        onHand: r.qty,
        reserved,
        inTransit: 0,
        valueVnd: r.qty * r.unit,
        minQty: r.min ?? null,
        maxQty: r.max ?? null,
        lowStock: r.min !== undefined && r.qty - reserved <= r.min,
        nonZero: r.qty !== 0 || reserved !== 0,
        seq: line ? 1 + (reserved ? 1 : 0) : 0,
        createdAt: AT,
        updatedAt: AT,
      };
      const { id, ...rest } = bal;
      put(COL.stockBalances, id, rest);
      if (line)
        put(COL.stockMovements, `${docId}#${line.lineNo}`, {
          tenantId: CMP,
          branchId: s.branch,
          warehouseId: wh,
          partId: bal.partId,
          partCode: bal.partCode,
          kind: 'adjust',
          documentId: docId,
          documentNo: number,
          reservationId: null,
          lineNo: line.lineNo,
          sourceType: 'opening-balance',
          sourceId: null,
          onHandDelta: r.qty,
          reservedDelta: 0,
          inTransitDelta: 0,
          valueDeltaVnd: r.qty * r.unit,
          unitCostVnd: r.unit,
          onHandAfter: r.qty,
          reservedAfter: 0,
          inTransitAfter: 0,
          valueAfterVnd: r.qty * r.unit,
          seq: 1,
          seqKey: '0000000001',
          at: AT,
          businessDate: DAY,
          actorId: s.poster,
        });
      if (reserved) {
        const rid = reservationId('repair-order', s.reserve!.order, bal.partId, wh);
        put(COL.stockReservations, rid, {
          tenantId: CMP,
          branchId: s.branch,
          warehouseId: wh,
          partId: bal.partId,
          partCode: bal.partCode,
          sourceType: 'repair-order',
          sourceId: s.reserve!.order,
          lineKey: bal.partId,
          qty: reserved,
          heldQty: reserved,
          issuedQty: 0,
          unmetQty: 0,
          closed: false,
          status: 'holding',
          opCount: 1,
          createdAt: AT,
          createdBy: 'seed',
          updatedAt: AT,
          updatedBy: 'seed',
          version: 1,
        });
        put(COL.stockMovements, `${rid}#1`, {
          tenantId: CMP,
          branchId: s.branch,
          warehouseId: wh,
          partId: bal.partId,
          partCode: bal.partCode,
          kind: 'reserve',
          documentId: null,
          documentNo: null,
          reservationId: rid,
          lineNo: null,
          sourceType: 'repair-order',
          sourceId: s.reserve!.order,
          onHandDelta: 0,
          reservedDelta: reserved,
          inTransitDelta: 0,
          valueDeltaVnd: 0,
          unitCostVnd: 0,
          onHandAfter: r.qty,
          reservedAfter: reserved,
          inTransitAfter: 0,
          valueAfterVnd: r.qty * r.unit,
          seq: 2,
          seqKey: '0000000002',
          at: new Date(AT.getTime() + 1000),
          businessDate: DAY,
          actorId: 'seed',
        });
      }
    }
  }
  return docs;
}
