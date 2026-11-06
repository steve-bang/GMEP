import { AppError } from '@/platform/errors/errors';
import { hasPermission, resolveScope } from '@/platform/rbac/rbac';
import { allBranchesScope } from '@/platform/scope/scope';
import {
  auditEntry,
  ImportStepError,
  type ImportColumn,
  type ImportEntityRef,
  type ImportKindHandler,
  type ImportUnit,
  type RowIssue,
} from '@/modules/sys';
import {
  isValidBarcode,
  normalizeBarcode,
  normalizePartCode,
  partCodeKey,
  PART_CODE_PATTERN,
} from '../domain/normalize';
import type { Part } from '../domain/entities';
import type { InvDeps } from '../ports/deps';
import { resolveCatalog, type CatalogEntry } from './catalog';
import { today } from './config';
import { cancelDocument, createDocument, getDocument, reverseDocument } from './documents';
import { createPart } from './parts';

/**
 * FR-SYS-007 import for INV: the part catalogue and the opening stock. Writes go through createPart and
 * createDocument as the actor, so branch scope, numbering, audit, the stock ledger and the document state machine
 * are the module's own. Opening stock is a normal opening-balance adjustment (ADJ) created as a DRAFT: it posts
 * through the usual approval (a manager other than the importer), never by writing balances directly (RULE-007/009).
 * Undo cancels a draft or reverses a posted document with a reversal document (RULE-010); parts are removed only
 * while no stock history exists.
 */
const col = (
  field: string,
  label: string,
  required: boolean,
  example: string,
  aliases: string[] = [],
): ImportColumn => ({ field, label, required, example, aliases });

export const PART_IMPORT_COLUMNS: readonly ImportColumn[] = [
  col('code', 'Mã phụ tùng', true, 'LOC-DAU-01', ['Mã', 'Mã PT', 'Mã hàng']),
  col('name', 'Tên phụ tùng', true, 'Lọc dầu động cơ', ['Tên', 'Tên hàng']),
  col('brand', 'Thương hiệu', false, 'Denso', ['Hãng', 'Nhãn hiệu']),
  col('unit', 'Đơn vị tính', true, 'piece', ['ĐVT', 'Đơn vị']),
  col('group', 'Nhóm hàng', true, 'oil', ['Nhóm']),
  col('barcode', 'Mã vạch', false, '', ['Barcode']),
];

export const OPENING_STOCK_COLUMNS: readonly ImportColumn[] = [
  col('code', 'Mã phụ tùng', true, 'LOC-DAU-01', ['Mã', 'Mã PT', 'Mã hàng']),
  col('qty', 'Số lượng tồn', true, '12', ['Số lượng', 'Tồn', 'SL']),
  col('unitCost', 'Đơn giá vốn (VND)', true, '85000', ['Đơn giá', 'Giá vốn', 'Giá nhập']),
  col('note', 'Ghi chú', false, ''),
];

const refsOf = (refs: readonly ImportEntityRef[], type: string) =>
  refs.filter((r) => r.type === type);

/** "150.000" or "150,000" or "150000" -> integer VND (never a float) */
function parseVnd(raw: string): number | null {
  const s = raw.trim();
  if (!/^\d{1,3}([.,]\d{3})+$|^\d+$/.test(s)) return null;
  const n = Number(s.replace(/[.,]/g, ''));
  return Number.isSafeInteger(n) && n <= 1_000_000_000 ? n : null;
}

function matchCatalog(entries: readonly CatalogEntry[], raw: string): CatalogEntry | undefined {
  const k = raw.trim().toLowerCase();
  return entries.find((e) => e.active && (e.code === k || e.name.toLowerCase() === k));
}

export function buildPartImport(getDeps: () => InvDeps): ImportKindHandler {
  return {
    kind: 'parts',
    label: 'Danh mục phụ tùng',
    columns: PART_IMPORT_COLUMNS,
    needsWarehouse: false,
    chunkSize: 25,
    requires: ['part:create'],

    async validate(actor, rows) {
      const deps = getDeps();
      const scope = resolveScope(actor, 'part:create');
      const date = today(deps);
      const [units, groups] = await Promise.all([
        resolveCatalog(deps, actor.tenantId, 'unit', date),
        resolveCatalog(deps, actor.tenantId, 'group', date),
      ]);
      const issues: RowIssue[] = [];
      const out: ImportUnit[] = [];
      const codes = new Map<string, number>();
      const barcodes = new Map<string, number>();
      for (const r of rows) {
        const c = r.cells;
        const bad = (field: string, message: string) => issues.push({ row: r.row, field, message });
        const mark = issues.length;
        const code = normalizePartCode(c.code!);
        if (!PART_CODE_PATTERN.test(code))
          bad(
            'code',
            'Mã gồm 2-40 ký tự: chữ không dấu, số, dấu chấm, gạch ngang, gạch dưới hoặc gạch chéo, không khoảng trắng.',
          );
        if (c.name!.length < 1 || c.name!.length > 120) bad('name', 'Tên tối đa 120 ký tự.');
        if (c.brand!.length > 60) bad('brand', 'Thương hiệu tối đa 60 ký tự.');
        const unit = matchCatalog(units, c.unit!);
        if (!unit) bad('unit', 'Đơn vị tính chưa có trong danh mục.');
        const group = matchCatalog(groups, c.group!);
        if (!group) bad('group', 'Nhóm hàng chưa có trong danh mục.');
        let barcode: string | undefined;
        if (c.barcode) {
          barcode = normalizeBarcode(c.barcode);
          if (!isValidBarcode(barcode))
            bad('barcode', 'Mã vạch gồm 4-32 ký tự chữ và số, không có khoảng trắng.');
        }
        if (issues.length > mark) continue;
        const key = partCodeKey(code);
        const dup = codes.get(key);
        if (dup !== undefined) {
          bad('code', `Mã trùng với dòng ${dup} trong tệp.`);
          continue;
        }
        codes.set(key, r.row);
        if (barcode) {
          const db = barcodes.get(barcode);
          if (db !== undefined) {
            bad('barcode', `Mã vạch trùng với dòng ${db} trong tệp.`);
            continue;
          }
          barcodes.set(barcode, r.row);
        }
        if (await deps.parts.idByCodeKey(scope, key)) {
          bad('code', 'Mã phụ tùng đã có trong danh mục.');
          continue;
        }
        if (barcode && (await deps.parts.idByBarcode(scope, barcode))) {
          bad('barcode', 'Mã vạch đã gắn với một phụ tùng khác.');
          continue;
        }
        out.push({
          row: r.row,
          rows: [r.row],
          data: {
            code,
            name: c.name,
            brand: c.brand,
            unit: unit!.code,
            group: group!.code,
            ...(barcode ? { barcode } : {}),
          },
        });
      }
      return { units: out, issues, warnings: [] };
    },

    async commit(actor, units, ctx) {
      const deps = getDeps();
      const refs: ImportEntityRef[] = [];
      try {
        for (const u of units) {
          const r = await createPart(deps, actor, u.data, {
            idempotencyKey: `imp-${ctx.batchId}-${u.row}`,
            requestId: ctx.requestId,
          });
          refs.push({ type: 'part', id: (r.response.body as { id: string }).id, row: u.row });
        }
      } catch (e) {
        throw new ImportStepError(refs, e);
      }
      return refs;
    },

    async undo(actor, refs, ctx) {
      const deps = getDeps();
      const scope = resolveScope(actor, 'part:create');
      const all = allBranchesScope(actor.tenantId);
      const blocked: string[] = [];
      const parts: Part[] = [];
      for (const r of refsOf(refs, 'part')) {
        const p = await deps.parts.get(scope, r.id);
        if (!p) continue;
        const hasStock = (await deps.balances.listByPart(all, p.id, 1)).length > 0;
        if (p.version !== 1 || hasStock)
          blocked.push(`Dòng ${r.row}: phụ tùng đã sửa hoặc đã có lịch sử kho.`);
        parts.push(p);
      }
      if (blocked.length)
        throw new AppError(
          'import_undo_blocked',
          409,
          blocked.slice(0, 50).map((message) => ({ field: 'refs', message })),
        );
      for (let i = 0; i < parts.length; i += 20)
        await deps.sys.uow.run(async (tx) => {
          for (const p0 of parts.slice(i, i + 20)) {
            const p = await deps.parts.getInTx(tx, scope, p0.id);
            if (!p) continue;
            deps.parts.remove(tx, p);
            deps.sys.audit.record(
              tx,
              auditEntry(deps.sys, actor, ctx, {
                branchId: null,
                entityType: 'part',
                entityId: p.id,
                action: 'part.import-undo',
                before: { code: p.code },
                reason: ctx.reason,
              }),
            );
          }
        });
    },
  };
}

/** documents read per warehouse and status before the check refuses to answer (never a silent partial check) */
const OPENING_DOC_SCAN = 20_000;

/** RULE-007/R95: part ids with a live opening-balance document (draft or posted, not reversed, not a reversal). */
async function openedParts(
  deps: InvDeps,
  tenantId: string,
  warehouseId: string,
  exceptBatchId?: string,
) {
  const set = new Set<string>();
  for (const status of ['draft', 'posted'] as const) {
    const { docs, truncated } = await deps.documents.listAllByWarehouseStatus(
      tenantId,
      warehouseId,
      status,
      OPENING_DOC_SCAN,
    );
    // a large warehouse is read page by page; past the ceiling the check says so instead of missing documents (R95)
    if (truncated) throw new AppError('import_opening_scan_limit', 409);
    for (const d of docs) {
      if (d.source.type !== 'opening-balance' || d.reversedBy || d.reversalOf) continue;
      if (exceptBatchId && d.reason?.includes(exceptBatchId)) continue;
      for (const l of d.lines) set.add(l.partId);
    }
  }
  return set;
}

export function buildOpeningStockImport(getDeps: () => InvDeps): ImportKindHandler {
  return {
    kind: 'opening-stock',
    label: 'Tồn kho đầu kỳ',
    columns: OPENING_STOCK_COLUMNS,
    needsWarehouse: true,
    get chunkSize() {
      return Math.min(100, getDeps().inv.maxDocLines);
    },
    requires: ['stock-doc:create'],

    async validate(actor, rows, ctx) {
      const deps = getDeps();
      const scope = resolveScope(actor, 'part:view');
      const issues: RowIssue[] = [];
      const warehouseId = ctx.warehouseId!;
      const w = actor.workingBranchId
        ? await deps.sys.warehouses.get(resolveScope(actor, 'stock-doc:create'), warehouseId)
        : null;
      if (!w || w.branchId !== actor.workingBranchId || w.status !== 'active') {
        issues.push({
          row: 0,
          field: 'warehouseId',
          message: 'Kho không thuộc chi nhánh đang làm việc hoặc đã ngừng hoạt động.',
        });
        return { units: [], issues, warnings: [] };
      }
      const out: ImportUnit[] = [];
      const seen = new Map<string, number>();
      // R95: parts already covered by a draft or posted, not reversed, opening document of this warehouse
      const opened = await openedParts(deps, actor.tenantId, warehouseId);
      for (const r of rows) {
        const c = r.cells;
        const bad = (field: string, message: string) => issues.push({ row: r.row, field, message });
        const mark = issues.length;
        const code = normalizePartCode(c.code!);
        const id = PART_CODE_PATTERN.test(code)
          ? await deps.parts.idByCodeKey(scope, partCodeKey(code))
          : null;
        const part = id ? (await deps.parts.getMany(scope, [id]))[0] : undefined;
        if (!part) bad('code', 'Mã phụ tùng chưa có trong danh mục. Nhập danh mục trước.');
        else if (part.status !== 'active') bad('code', 'Phụ tùng đã ngừng sử dụng.');
        else if (part.quantityScale !== 1)
          bad('code', 'Phụ tùng tính số lẻ chưa nhập được bằng tệp; hãy nhập tồn đầu kỳ thủ công.');
        else if (opened.has(part.id))
          bad(
            'code',
            'Phụ tùng đã có phiếu tồn đầu kỳ chưa đảo ở kho này; hoàn tác phiếu cũ trước khi nhập lại.',
          );
        const qty = Number(c.qty);
        if (!/^\d+$/.test(c.qty!) || !Number.isSafeInteger(qty) || qty < 1 || qty > 1_000_000)
          bad('qty', 'Số lượng là số nguyên từ 1 đến 1.000.000.');
        const cost = parseVnd(c.unitCost!);
        if (cost === null) bad('unitCost', 'Đơn giá vốn là số nguyên VND, không âm (tối đa 1 tỷ).');
        if (c.note!.length > 200) bad('note', 'Ghi chú tối đa 200 ký tự.');
        if (issues.length > mark) continue;
        const dup = seen.get(part!.id);
        if (dup !== undefined) {
          bad('code', `Phụ tùng trùng với dòng ${dup} trong tệp.`);
          continue;
        }
        seen.set(part!.id, r.row);
        out.push({
          row: r.row,
          rows: [r.row],
          data: { partId: part!.id, qty, unitCostVnd: cost, ...(c.note ? { note: c.note } : {}) },
        });
      }
      return { units: out, issues, warnings: [] };
    },

    async commit(actor, units, ctx) {
      const deps = getDeps();
      try {
        // R95 again at write time: another batch may have been validated and written since this preview
        const opened = await openedParts(deps, actor.tenantId, ctx.warehouseId!, ctx.batchId);
        if (units.some((u) => opened.has(u.data.partId as string)))
          throw new AppError('import_opening_duplicate', 409);
        const r = await createDocument(
          deps,
          actor,
          {
            type: 'ADJ',
            warehouseId: ctx.warehouseId,
            source: { type: 'opening-balance' },
            reason: `Nhập tồn đầu kỳ từ tệp (lô ${ctx.batchId})`,
            lines: units.map((u) => u.data),
          },
          { idempotencyKey: `imp-${ctx.batchId}-${units[0]!.row}`, requestId: ctx.requestId },
        );
        return [
          { type: 'stockDocument', id: (r.response.body as { id: string }).id, row: units[0]!.row },
        ];
      } catch (e) {
        throw new ImportStepError([], e);
      }
    },

    async undo(actor, refs, ctx) {
      const deps = getDeps();
      const docs = [];
      for (const r of refsOf(refs, 'stockDocument')) {
        const d = await getDocument(deps, actor, r.id).catch(() => null);
        if (!d) continue;
        docs.push(d);
      }
      // reversing a posted document is a manager act (stock-doc:approve): refuse before changing anything
      if (
        docs.some((d) => d.status === 'posted' && !d.reversedBy) &&
        !hasPermission(actor, 'stock-doc:approve')
      )
        throw new AppError('forbidden', 403);
      for (const d of docs) {
        if (d.status === 'draft')
          await cancelDocument(deps, actor, d.id, { reason: ctx.reason, version: d.version }, ctx);
        else if (d.status === 'posted' && !d.reversedBy && !d.reversalOf)
          await reverseDocument(
            deps,
            actor,
            d.id,
            { reason: ctx.reason, version: d.version },
            { idempotencyKey: `imp-undo-${ctx.batchId}-${d.id}`, requestId: ctx.requestId },
          );
      }
    },
  };
}
