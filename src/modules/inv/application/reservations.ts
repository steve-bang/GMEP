import { AppError } from '@/platform/errors/errors';
import {
  decodeCursor,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  type Page,
} from '@/platform/pagination/pagination';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import {
  resolveScope,
  resolveWorkingScope,
  requireWorkingBranch,
  type Actor,
} from '@/platform/rbac/rbac';
import type { Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import {
  RESERVATION_SOURCES,
  reservationId,
  type Reservation,
  type ReservationStatus,
} from '../domain/entities';
import { holdStatus, planHold } from '../domain/ledger';
import type { InvDeps } from '../ports/deps';
import { BalanceSet, quantitiesOf } from './engine';
import {
  activeWarehouse,
  assertWritable,
  auditEntry,
  guard,
  idemOf,
  idToken,
  notFound,
  parseInput,
  z,
  type RequestCtx,
} from './support';
import { today } from './config';

export interface ReservationDto {
  id: string;
  sourceType: string;
  sourceId: string;
  lineKey: string;
  warehouseId: string;
  partId: string;
  partCode: string;
  /** total the source needs (issued + held) */
  qty: number;
  heldQty: number;
  issuedQty: number;
  status: ReservationStatus;
  /** quantity that could not be held when the caller allowed a partial hold (no backorder is created) */
  shortBy: number;
  updatedAt: string;
}

export function toReservationDto(r: Reservation, shortBy = 0): ReservationDto {
  return {
    id: r.id,
    sourceType: r.sourceType,
    sourceId: r.sourceId,
    lineKey: r.lineKey,
    warehouseId: r.warehouseId,
    partId: r.partId,
    partCode: r.partCode,
    qty: r.qty,
    heldQty: r.heldQty,
    issuedQty: r.issuedQty,
    status: r.status,
    shortBy,
    updatedAt: r.updatedAt.toISOString(),
  };
}

export const holdSchema = z.object({
  sourceType: z.enum(RESERVATION_SOURCES),
  sourceId: idToken,
  /** the quote/order line this hold belongs to; defaults to the part id */
  lineKey: idToken.optional(),
  warehouseId: z.string().trim().min(1).max(128),
  partId: z.string().trim().min(1).max(128),
  /** TOTAL the source needs of this part; the hold is qty - already issued (target semantics) */
  qty: z.number().int().min(1).max(1_000_000),
  /** hold what is available instead of refusing; the shortage is reported, never queued (BA-07 default) */
  allowPartial: z.boolean().default(false),
});
export type HoldInput = z.infer<typeof holdSchema>;

/**
 * FR-INV-020: reserve stock for a quote line or repair-order line. Target semantics make the call
 * idempotent and cover every change of demand (approval, partial approval, supplementary work):
 * asking again for the same qty changes nothing; a higher qty holds the difference or fails whole;
 * a lower qty releases the difference. The comparison is against AVAILABLE (RULE-008).
 *
 * MUST run inside the caller's transaction after the caller's own reads (Firestore reads-before-
 * writes); REC calls it through the standalone `holdStock` or inside its own approval transaction.
 */
export async function holdStockInTx(
  deps: InvDeps,
  tx: Tx,
  actor: Actor,
  scope: Scope,
  data: HoldInput,
  ctx: RequestCtx,
): Promise<ReservationDto> {
  const branchId = requireWorkingBranch(actor);
  const branch = await assertWritable(deps, tx, actor, scope, branchId, 'edit_open_order');
  const w = await activeWarehouse(deps, tx, scope, data.warehouseId, branch.id);
  const part = await deps.parts.getInTx(tx, scope, data.partId);
  if (!part) throw notFound();
  const lineKey = data.lineKey ?? data.partId;
  const rid = reservationId(data.sourceType, data.sourceId, lineKey, w.id);
  const [r, set] = await Promise.all([
    deps.reservations.getInTx(tx, scope, rid),
    BalanceSet.load(deps, tx, scope, w, [part], actor.userId, today(deps)),
  ]);
  if (part.status !== 'active' && !(r && r.heldQty > 0)) throw new AppError('part_inactive', 409);
  const b = set.get(part.id);
  const plan = guard(() => planHold(r, b, data.qty, data.allowPartial));
  if (plan.heldDelta === 0 && r && r.qty === plan.qty) return toReservationDto(r, plan.shortBy);
  if (plan.heldDelta === 0 && !r) {
    // nothing could be held and no record exists: report the shortage without creating a hold
    return {
      id: rid,
      sourceType: data.sourceType,
      sourceId: data.sourceId,
      lineKey,
      warehouseId: w.id,
      partId: part.id,
      partCode: part.code,
      qty: 0,
      heldQty: 0,
      issuedQty: 0,
      status: 'released',
      shortBy: plan.shortBy,
      updatedAt: deps.sys.clock.now().toISOString(),
    };
  }
  const now = deps.sys.clock.now();
  const opCount = (r?.opCount ?? 0) + 1;
  const heldQty = (r?.heldQty ?? 0) + plan.heldDelta;
  const next: Reservation = {
    id: rid,
    companyId: actor.companyId,
    branchId: w.branchId,
    warehouseId: w.id,
    partId: part.id,
    partCode: part.code,
    sourceType: data.sourceType,
    sourceId: data.sourceId,
    lineKey,
    qty: plan.qty,
    heldQty,
    issuedQty: r?.issuedQty ?? 0,
    status: 'holding',
    opCount,
    createdAt: r?.createdAt ?? now,
    createdBy: r?.createdBy ?? actor.userId,
    updatedAt: now,
    updatedBy: actor.userId,
    version: (r?.version ?? 0) + 1,
  };
  next.status = holdStatus(next);
  if (plan.heldDelta !== 0) {
    const q = quantitiesOf(b);
    set.move(
      part.id,
      guard(() => ({ ...q, reserved: q.reserved + plan.heldDelta })),
      {
        id: `${rid}#${opCount}`,
        kind: plan.heldDelta > 0 ? 'reserve' : 'release',
        documentId: null,
        documentNo: null,
        reservationId: rid,
        lineNo: null,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        unitCostVnd: 0,
      },
    );
  }
  if (r) deps.reservations.update(tx, rid, patchOf(next));
  else deps.reservations.create(tx, next);
  set.flush(tx);
  deps.sys.audit.record(
    tx,
    auditEntry(deps.sys, actor, ctx, {
      branchId: w.branchId,
      entityType: 'stockReservation',
      entityId: rid,
      action: plan.heldDelta >= 0 ? 'stockReservation.hold' : 'stockReservation.release',
      before: r ? { qty: r.qty, heldQty: r.heldQty } : null,
      after: { qty: next.qty, heldQty: next.heldQty, partId: part.id },
    }),
  );
  return toReservationDto(next, plan.shortBy);
}

const patchOf = (r: Reservation) => ({
  qty: r.qty,
  heldQty: r.heldQty,
  issuedQty: r.issuedQty,
  status: r.status,
  opCount: r.opCount,
  updatedAt: r.updatedAt,
  updatedBy: r.updatedBy,
  version: r.version,
});

/** Standalone reserve with its own transaction (HTTP route, REC). Retries with the same key replay the stored result. */
export async function holdStock(
  deps: InvDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'stock-reservation:create');
  const data = parseInput(holdSchema, input);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: 'POST /api/v1/inv/reservations',
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf(data),
    },
    async (tx) => ({ status: 200, body: await holdStockInTx(deps, tx, actor, scope, data, ctx) }),
  );
}

export const releaseSchema = z.object({
  sourceType: z.enum(RESERVATION_SOURCES),
  sourceId: idToken,
  /** release one line; omit to release every hold of the source (quote rejected/expired, order cancelled) */
  lineKey: idToken.optional(),
  warehouseId: z.string().trim().max(128).optional(),
  partId: z.string().trim().max(128).optional(),
});

/**
 * FR-INV-020: release holds when the quote is rejected or the order is cancelled. What was already
 * issued stays issued (returning it is a separate RTN document). Releasing nothing is not an error.
 */
export async function releaseStock(
  deps: InvDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'stock-reservation:update');
  const data = parseInput(releaseSchema, input);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: 'POST /api/v1/inv/reservations/release',
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf(data),
    },
    async (tx) => {
      const found = (
        await deps.reservations.listBySource(scope, data.sourceType, data.sourceId, 200)
      ).filter(
        (r) =>
          (!data.lineKey || r.lineKey === data.lineKey) &&
          (!data.warehouseId || r.warehouseId === data.warehouseId) &&
          (!data.partId || r.partId === data.partId),
      );
      // reads first: current state of each hold inside the transaction
      const fresh = (
        await Promise.all(found.map((r) => deps.reservations.getInTx(tx, scope, r.id)))
      ).flatMap((r) => (r && r.heldQty > 0 ? [r] : []));
      const byWarehouse = new Map<string, Reservation[]>();
      for (const r of fresh)
        byWarehouse.set(r.warehouseId, [...(byWarehouse.get(r.warehouseId) ?? []), r]);
      // phase 1: every read (branch state, balances) before any write is staged
      const groups: { set: BalanceSet; rs: Reservation[] }[] = [];
      for (const [warehouseId, rs] of byWarehouse) {
        const first = rs[0]!;
        await assertWritable(deps, tx, actor, scope, first.branchId, 'edit_open_order');
        const set = await BalanceSet.load(
          deps,
          tx,
          scope,
          { id: warehouseId, branchId: first.branchId, companyId: first.companyId },
          rs.map((r) => ({ id: r.partId, code: r.partCode, name: r.partCode })),
          actor.userId,
          today(deps),
        );
        groups.push({ set, rs });
      }
      // phase 2: compute and stage
      const released: ReservationDto[] = [];
      for (const { set, rs } of groups) {
        for (const r of rs) {
          const q = quantitiesOf(set.get(r.partId));
          const opCount = r.opCount + 1;
          set.move(
            r.partId,
            guard(() => ({ ...q, reserved: q.reserved - r.heldQty })),
            {
              id: `${r.id}#${opCount}`,
              kind: 'release',
              documentId: null,
              documentNo: null,
              reservationId: r.id,
              lineNo: null,
              sourceType: r.sourceType,
              sourceId: r.sourceId,
              unitCostVnd: 0,
            },
          );
          const next: Reservation = {
            ...r,
            qty: r.issuedQty,
            heldQty: 0,
            opCount,
            updatedAt: deps.sys.clock.now(),
            updatedBy: actor.userId,
            version: r.version + 1,
          };
          next.status = holdStatus(next);
          deps.reservations.update(tx, r.id, patchOf(next));
          deps.sys.audit.record(
            tx,
            auditEntry(deps.sys, actor, ctx, {
              branchId: r.branchId,
              entityType: 'stockReservation',
              entityId: r.id,
              action: 'stockReservation.release',
              before: { qty: r.qty, heldQty: r.heldQty },
              after: { qty: next.qty, heldQty: 0 },
            }),
          );
          released.push(toReservationDto(next));
        }
      }
      for (const { set } of groups) set.flush(tx);
      return { status: 200, body: { released } };
    },
  );
}

const listSchema = z.object({
  partId: z.string().trim().min(1).max(128),
  status: z.enum(['holding', 'fulfilled', 'released']).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  cursor: z.string().max(512).optional(),
});

/** Holds on a part by order (G3-INV-03 "phiếu giữ chỗ theo lệnh"), inside the working scope. */
export async function listReservationsByPart(
  deps: InvDeps,
  actor: Actor,
  raw: unknown,
): Promise<Page<ReservationDto>> {
  const scope = resolveWorkingScope(actor, 'stock-reservation:view');
  const q = parseInput(listSchema, raw);
  const page = await deps.reservations.listByPart(scope, {
    partId: q.partId,
    limit: q.limit,
    ...(q.status ? { status: q.status } : {}),
    ...(q.cursor ? { cursor: decodeCursor(q.cursor)! } : {}),
  });
  return { items: page.items.map((r) => toReservationDto(r)), nextCursor: page.nextCursor };
}

/** Holds of one quote or order (REC detail screens). */
export async function listReservationsBySource(
  deps: InvDeps,
  actor: Actor,
  sourceType: string,
  sourceId: string,
): Promise<ReservationDto[]> {
  const scope = resolveWorkingScope(actor, 'stock-reservation:view');
  const rows = await deps.reservations.listBySource(scope, sourceType, sourceId, 200);
  return rows.map((r) => toReservationDto(r));
}
