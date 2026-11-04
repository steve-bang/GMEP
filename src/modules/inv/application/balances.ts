import { validationFailed } from '@/platform/errors/errors';
import {
  decodeCursor,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  type Page,
} from '@/platform/pagination/pagination';
import { hasPermission, resolveScope, resolveWorkingScope, type Actor } from '@/platform/rbac/rbac';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import { balanceId, type StockBalance, type StockMovement } from '../domain/entities';
import { availableOf, derive } from '../domain/ledger';
import { normalizePartCode } from '../domain/normalize';
import type { InvDeps } from '../ports/deps';
import {
  activeWarehouse,
  assertWritable,
  auditEntry,
  idemOf,
  notFound,
  parseInput,
  requireWorkingBranch,
  z,
  type RequestCtx,
} from './support';

export type StockStatus = 'ok' | 'low' | 'out';

export interface StockDto {
  id: string;
  branchId: string;
  warehouseId: string;
  partId: string;
  partCode: string;
  partName: string;
  /** RULE-008: the four numbers, always together and in this order */
  onHand: number;
  reserved: number;
  inTransit: number;
  available: number;
  /** value and unit cost only for roles with stock-cost:view */
  valueVnd: number | null;
  unitCostVnd: number | null;
  minQty: number | null;
  maxQty: number | null;
  status: StockStatus;
  /** BA-04 Câu 7: max - (available + in transit); null without a max */
  suggestQty: number | null;
}

export function stockStatus(b: Pick<StockBalance, 'onHand' | 'reserved' | 'minQty'>): StockStatus {
  const a = availableOf(b);
  if (a <= 0) return 'out';
  return b.minQty !== null && a <= b.minQty ? 'low' : 'ok';
}

export function toStockDto(b: StockBalance, showCost: boolean): StockDto {
  const available = availableOf(b);
  return {
    id: b.id,
    branchId: b.branchId,
    warehouseId: b.warehouseId,
    partId: b.partId,
    partCode: b.partCode,
    partName: b.partName,
    onHand: b.onHand,
    reserved: b.reserved,
    inTransit: b.inTransit,
    available,
    valueVnd: showCost ? b.valueVnd : null,
    unitCostVnd:
      showCost && b.onHand > 0
        ? Number((BigInt(b.valueVnd) * 2n + BigInt(b.onHand)) / (BigInt(b.onHand) * 2n))
        : null,
    minQty: b.minQty,
    maxQty: b.maxQty,
    status: stockStatus(b),
    suggestQty: b.maxQty !== null ? Math.max(0, b.maxQty - (available + b.inTransit)) : null,
  };
}

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  cursor: z.string().max(512).optional(),
  q: z.string().trim().max(40).optional(),
  warehouseId: z.string().trim().max(128).optional(),
  lowStock: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

/** FR-INV-003 / FR-INV-013: stock per warehouse (and the reorder list with `lowStock`) inside the working scope. */
export async function listStock(
  deps: InvDeps,
  actor: Actor,
  raw: unknown,
): Promise<Page<StockDto>> {
  const scope = resolveWorkingScope(actor, 'stock:view');
  const q = parseInput(listSchema, raw);
  const showCost = hasPermission(actor, 'stock-cost:view');
  const page = await deps.balances.list(scope, {
    limit: q.limit,
    ...(q.q ? { prefix: normalizePartCode(q.q) } : {}),
    ...(q.warehouseId ? { warehouseId: q.warehouseId } : {}),
    ...(q.lowStock ? { lowStock: true } : {}),
    ...(q.cursor ? { cursor: decodeCursor(q.cursor)! } : {}),
  });
  return { items: page.items.map((b) => toStockDto(b, showCost)), nextCursor: page.nextCursor };
}

/** Stock of one part in every warehouse of the working scope (G3-INV-03). */
export async function getPartStock(
  deps: InvDeps,
  actor: Actor,
  partId: string,
): Promise<StockDto[]> {
  const scope = resolveWorkingScope(actor, 'stock:view');
  const showCost = hasPermission(actor, 'stock-cost:view');
  const rows = await deps.balances.listByPart(scope, partId, 50);
  return rows.map((b) => toStockDto(b, showCost));
}

// ---- stock card -------------------------------------------------------------------------

export interface MovementDto {
  id: string;
  kind: StockMovement['kind'];
  at: string;
  businessDate: string;
  documentId: string | null;
  documentNo: string | null;
  reservationId: string | null;
  sourceType: string | null;
  sourceId: string | null;
  onHandDelta: number;
  reservedDelta: number;
  inTransitDelta: number;
  onHandAfter: number;
  reservedAfter: number;
  availableAfter: number;
  unitCostVnd: number | null;
  valueDeltaVnd: number | null;
  actorId: string;
}

const cardSchema = z.object({
  warehouseId: z.string().trim().min(1).max(128),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  cursor: z.string().max(512).optional(),
});

/** RULE-009 / FR-INV-021: the stock card, every document that moved the balance, newest first. */
export async function listStockCard(
  deps: InvDeps,
  actor: Actor,
  partId: string,
  raw: unknown,
): Promise<Page<MovementDto>> {
  const scope = resolveWorkingScope(actor, 'stock:view');
  const q = parseInput(cardSchema, raw);
  const showCost = hasPermission(actor, 'stock-cost:view');
  const page = await deps.movements.listByBalance(scope, {
    warehouseId: q.warehouseId,
    partId,
    limit: q.limit,
    ...(q.cursor ? { cursor: decodeCursor(q.cursor)! } : {}),
  });
  return {
    items: page.items.map((m) => ({
      id: m.id,
      kind: m.kind,
      at: m.at.toISOString(),
      businessDate: m.businessDate,
      documentId: m.documentId,
      documentNo: m.documentNo,
      reservationId: m.reservationId,
      sourceType: m.sourceType,
      sourceId: m.sourceId,
      onHandDelta: m.onHandDelta,
      reservedDelta: m.reservedDelta,
      inTransitDelta: m.inTransitDelta,
      onHandAfter: m.onHandAfter,
      reservedAfter: m.reservedAfter,
      availableAfter: m.onHandAfter - m.reservedAfter,
      unitCostVnd: showCost ? m.unitCostVnd : null,
      valueDeltaVnd: showCost ? m.valueDeltaVnd : null,
      actorId: m.actorId,
    })),
    nextCursor: page.nextCursor,
  };
}

// ---- reorder levels (G3-INV-02) ----------------------------------------------------------

export const levelsSchema = z
  .object({
    warehouseId: z.string().trim().min(1).max(128),
    partId: z.string().trim().min(1).max(128),
    minQty: z.number().int().min(0).max(1_000_000).nullable(),
    maxQty: z.number().int().min(0).max(1_000_000).nullable(),
  })
  .refine((v) => v.minQty === null || v.maxQty === null || v.minQty <= v.maxQty, {
    path: ['maxQty'],
    message: 'Mức tối đa phải lớn hơn hoặc bằng mức tối thiểu.',
  });

/**
 * Reorder level and target per warehouse x part. Setting them is not a stock movement (the
 * quantities are untouched); the alert compares them with AVAILABLE, never on-hand (RULE-008).
 */
export async function setStockLevels(
  deps: InvDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'stock-level:update');
  const data = parseInput(levelsSchema, input);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: 'PUT /api/v1/inv/stock/levels',
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf(data),
    },
    async (tx) => {
      const branchId = requireWorkingBranch(actor);
      const part = await deps.parts.getInTx(tx, scope, data.partId);
      if (!part) throw notFound();
      const branch = await assertWritable(deps, tx, actor, scope, branchId, 'edit_master');
      const w = await activeWarehouse(deps, tx, scope, data.warehouseId, branch.id);
      const cur = await deps.balances.getInTx(tx, scope, balanceId(w.id, part.id));
      const now = deps.sys.clock.now();
      const base: StockBalance = cur ?? {
        id: balanceId(w.id, part.id),
        companyId: actor.companyId,
        branchId: w.branchId,
        warehouseId: w.id,
        partId: part.id,
        partCode: part.code,
        partCodeNorm: part.code,
        partName: part.name,
        onHand: 0,
        reserved: 0,
        inTransit: 0,
        valueVnd: 0,
        minQty: null,
        maxQty: null,
        lowStock: false,
        nonZero: false,
        seq: 0,
        createdAt: now,
        updatedAt: now,
      };
      const next: StockBalance = {
        ...base,
        minQty: data.minQty,
        maxQty: data.maxQty,
        updatedAt: now,
      };
      Object.assign(next, derive(next));
      deps.balances.save(tx, next);
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: w.branchId,
          entityType: 'stockBalance',
          entityId: next.id,
          action: 'stockLevel.update',
          before: { minQty: base.minQty, maxQty: base.maxQty },
          after: { minQty: next.minQty, maxQty: next.maxQty },
        }),
      );
      return { status: 200, body: toStockDto(next, hasPermission(actor, 'stock-cost:view')) };
    },
  );
}

// ---- availability for REC (BA-04 Câu 6) ----------------------------------------------------

export interface AvailabilityDto {
  partId: string;
  /** sum over the warehouses of the working scope; never on-hand, reserved or cost */
  available: number;
  warehouses: { warehouseId: string; available: number }[];
}

const availabilitySchema = z.object({
  partIds: z.array(z.string().trim().min(1).max(128)).min(1).max(50),
  warehouseId: z.string().trim().max(128).optional(),
});

/**
 * Public API for REC and the quote part picker (FR-REC-006, FR-INV-020): only the available
 * quantity is returned - an advisor sees 15 (not 20 on hand, 5 reserved).
 */
export async function getAvailability(
  deps: InvDeps,
  actor: Actor,
  input: unknown,
): Promise<AvailabilityDto[]> {
  const scope = resolveWorkingScope(actor, 'stock-availability:view');
  const data = parseInput(availabilitySchema, input);
  const out: AvailabilityDto[] = [];
  for (const partId of [...new Set(data.partIds)]) {
    const rows = (await deps.balances.listByPart(scope, partId, 50)).filter(
      (b) => !data.warehouseId || b.warehouseId === data.warehouseId,
    );
    const warehouses = rows.map((b) => ({ warehouseId: b.warehouseId, available: availableOf(b) }));
    out.push({
      partId,
      available: warehouses.reduce((s, w) => s + w.available, 0),
      warehouses,
    });
  }
  return out;
}

/** Parses the comma separated `partIds` query parameter of the availability route. */
export function parseAvailabilityQuery(params: Record<string, string>): {
  partIds: string[];
  warehouseId?: string;
} {
  const partIds = (params.partIds ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (partIds.length === 0)
    throw validationFailed([{ field: 'partIds', message: 'Cần ít nhất một mã phụ tùng.' }]);
  return { partIds, ...(params.warehouseId ? { warehouseId: params.warehouseId } : {}) };
}
