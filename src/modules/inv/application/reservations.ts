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
import type { Part } from '../domain/entities';
import type { Warehouse } from '@/modules/sys';
import type { InvDeps } from '../ports/deps';
import { BalanceSet, quantitiesOf } from './engine';
import { reservationPatch } from './holds';
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
  /** I1: demand that could not be held; stored, shown in the shortage list, no backorder is created */
  unmetQty: number;
  /** quantity the last call could not hold (same as unmetQty for a hold, 0 otherwise) */
  shortBy: number;
  createdAt: string;
  updatedAt: string;
}

export function toReservationDto(r: Reservation, shortBy = r.unmetQty): ReservationDto {
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
    unmetQty: r.unmetQty,
    shortBy,
    createdAt: r.createdAt.toISOString(),
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
 * Pure core of a hold: the caller has read the warehouse, part, existing hold and balances. Stages
 * the reservation, the ledger row (through `set`) and the audit entry; `set.flush` is the caller's.
 * Target semantics make the call idempotent and cover every change of demand (approval, partial
 * approval, supplementary work): the same qty changes nothing, a higher qty holds the difference
 * (or, with allowPartial, what is available, storing the rest as unmet), a lower qty releases the
 * difference. The comparison is against AVAILABLE (RULE-008).
 */
function applyHold(
  deps: InvDeps,
  tx: Tx,
  actor: Actor,
  ctx: RequestCtx,
  w: Pick<Warehouse, 'id' | 'branchId'>,
  part: Part,
  r: Reservation | null,
  set: BalanceSet,
  data: HoldInput,
): { dto: ReservationDto; next: Reservation | null } {
  const lineKey = data.lineKey ?? data.partId;
  const rid = reservationId(data.sourceType, data.sourceId, lineKey, w.id);
  if (part.status !== 'active' && !(r && r.heldQty > 0)) throw new AppError('part_inactive', 409);
  const b = set.get(part.id);
  const plan = guard(() => planHold(r, b, data.qty, data.allowPartial));
  if (r && plan.heldDelta === 0 && r.qty === plan.qty && r.unmetQty === plan.unmetQty && !r.closed)
    return { dto: toReservationDto(r, plan.shortBy), next: null };
  const now = deps.sys.clock.now();
  const opCount = (r?.opCount ?? 0) + 1;
  const heldQty = (r?.heldQty ?? 0) + plan.heldDelta;
  const next: Reservation = {
    id: rid,
    tenantId: actor.tenantId,
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
    unmetQty: plan.unmetQty,
    closed: false,
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
  if (r) deps.reservations.update(tx, rid, reservationPatch(next));
  else deps.reservations.create(tx, next);
  deps.sys.audit.record(
    tx,
    auditEntry(deps.sys, actor, ctx, {
      branchId: w.branchId,
      entityType: 'stockReservation',
      entityId: rid,
      action: plan.heldDelta >= 0 ? 'stockReservation.hold' : 'stockReservation.release',
      before: r ? { qty: r.qty, heldQty: r.heldQty, unmetQty: r.unmetQty } : null,
      after: { qty: next.qty, heldQty: next.heldQty, unmetQty: next.unmetQty, partId: part.id },
    }),
  );
  return { dto: toReservationDto(next, plan.shortBy), next };
}

/**
 * FR-INV-020: reserve stock for ONE line of a quote or repair order. Must run inside the caller's
 * transaction after the caller's own reads (Firestore reads-before-writes). Several lines of one
 * approval must go through `holdForApproval`, which shares the balance reads.
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
  const rid = reservationId(data.sourceType, data.sourceId, data.lineKey ?? data.partId, w.id);
  const [r, set] = await Promise.all([
    deps.reservations.getInTx(tx, scope, rid),
    BalanceSet.load(deps, tx, scope, w, [part], actor.userId, today(deps)),
  ]);
  const out = applyHold(deps, tx, actor, ctx, w, part, r, set, data);
  set.flush(tx);
  return out.dto;
}

export const holdForApprovalSchema = z.object({
  orderId: idToken,
  warehouseId: z.string().trim().min(1).max(128),
  /** one entry per order line that needs a part (lineKey = the repair-order line) */
  lines: z
    .array(
      z.object({
        lineKey: idToken,
        partId: z.string().trim().min(1).max(128),
        /** TOTAL approved demand of the line */
        qty: z.number().int().min(1).max(1_000_000),
      }),
    )
    .min(1)
    .max(200),
});
export type HoldForApprovalInput = z.infer<typeof holdForApprovalSchema>;

/**
 * I1 / BA-07 rows 2, 3, 6: the REC approval path (customer approves the quote, partially, or a
 * supplementary job). Holds are anchored to the REPAIR-ORDER line, always with `allowPartial`:
 * the approval is never refused for lack of stock; the shortfall is stored as `unmetQty`. Runs in
 * REC's own approval transaction (after its reads); balances are read once per part so lines for
 * the same part see each other's holds.
 */
export async function holdForApproval(
  deps: InvDeps,
  tx: Tx,
  actor: Actor,
  scope: Scope,
  input: HoldForApprovalInput,
  ctx: RequestCtx,
): Promise<ReservationDto[]> {
  return (await prepareHoldForApproval(deps, tx, actor, scope, input, ctx)).commit();
}

/**
 * Two-phase form of `holdForApproval` for callers that must do other reads in the same transaction
 * (Firestore allows no read after a write): `prepare` performs EVERY read and checks; `commit()` is
 * synchronous and only stages the writes (reservations, ledger rows, balances, audit).
 */
export async function prepareHoldForApproval(
  deps: InvDeps,
  tx: Tx,
  actor: Actor,
  scope: Scope,
  input: HoldForApprovalInput,
  ctx: RequestCtx,
): Promise<{ commit: () => ReservationDto[] }> {
  const data = parseInput(holdForApprovalSchema, input);
  const branchId = requireWorkingBranch(actor);
  const branch = await assertWritable(deps, tx, actor, scope, branchId, 'edit_open_order');
  const w = await activeWarehouse(deps, tx, scope, data.warehouseId, branch.id);
  const partIds = [...new Set(data.lines.map((l) => l.partId))];
  const parts = await Promise.all(partIds.map((id) => deps.parts.getInTx(tx, scope, id)));
  const byId = new Map<string, Part>();
  parts.forEach((p, i) => {
    if (!p) throw notFound();
    byId.set(partIds[i]!, p);
  });
  const rids = data.lines.map((l) => reservationId('repair-order', data.orderId, l.lineKey, w.id));
  const [existing, set] = await Promise.all([
    Promise.all(rids.map((rid) => deps.reservations.getInTx(tx, scope, rid))),
    BalanceSet.load(deps, tx, scope, w, [...byId.values()], actor.userId, today(deps)),
  ]);
  return {
    commit: () => {
      const out: ReservationDto[] = [];
      data.lines.forEach((l, i) => {
        const out1 = applyHold(
          deps,
          tx,
          actor,
          ctx,
          w,
          byId.get(l.partId)!,
          existing[i] ?? null,
          set,
          {
            sourceType: 'repair-order',
            sourceId: data.orderId,
            lineKey: l.lineKey,
            warehouseId: w.id,
            partId: l.partId,
            qty: l.qty,
            allowPartial: true,
          },
        );
        out.push(out1.dto);
      });
      set.flush(tx);
      return out;
    },
  };
}

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

/** Standalone approval-path hold with its own transaction (HTTP route; REC calls `holdForApproval` inside its own). */
export async function holdForApprovalStandalone(
  deps: InvDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'stock-reservation:create');
  const data = parseInput(holdForApprovalSchema, input);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: 'POST /api/v1/inv/reservations/approval',
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf(data),
    },
    async (tx) => ({
      status: 200,
      body: { items: await holdForApproval(deps, tx, actor, scope, data, ctx) },
    }),
  );
}

export const releaseSchema = z.object({
  sourceType: z.enum(RESERVATION_SOURCES),
  sourceId: idToken,
  /** release one line; omit to release every hold of the source (quote rejected/expired, order cancelled) */
  lineKey: idToken.optional(),
  warehouseId: z.string().trim().max(128).optional(),
  partId: z.string().trim().max(128).optional(),
  /** BA-07 rows 8, 14, 18, 19: why the surplus is released (audit only) */
  reason: z
    .enum(['item-cancelled', 'item-completed', 'order-cancelled', 'order-closed', 'quote-closed'])
    .optional(),
});

/**
 * FR-INV-020, BA-07 rows 8, 14, 18, 19: release what is still held AND the unmet remainder when an
 * item is cancelled or completed, the order is cancelled or closed. What was already issued stays
 * issued (returning it is a separate RTN document). The line is marked closed so a later reversal
 * does not reopen it. Releasing nothing is not an error.
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
      const prepared = await prepareRelease(deps, tx, actor, scope, data, ctx);
      return { status: 200, body: { released: prepared.commit() } };
    },
  );
}

/**
 * Two-phase release for callers that must read more in the same transaction (REC cancelling an order):
 * `prepareRelease` does every read; `commit()` only stages the writes. See `releaseStock` for the rules.
 */
export async function prepareRelease(
  deps: InvDeps,
  tx: Tx,
  actor: Actor,
  scope: Scope,
  data: z.infer<typeof releaseSchema>,
  ctx: RequestCtx,
): Promise<{ commit: () => ReservationDto[] }> {
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
  ).flatMap((r) => (r && !r.closed ? [r] : []));
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
      { id: warehouseId, branchId: first.branchId, tenantId: first.tenantId },
      rs.map((r) => ({ id: r.partId, code: r.partCode, name: r.partCode })),
      actor.userId,
      today(deps),
    );
    groups.push({ set, rs });
  }
  return {
    commit: () => {
      // phase 2: compute and stage
      const released: ReservationDto[] = [];
      for (const { set, rs } of groups) {
        for (const r of rs) {
          const q = quantitiesOf(set.get(r.partId));
          const opCount = r.opCount + 1;
          if (r.heldQty > 0)
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
            unmetQty: 0,
            closed: true,
            opCount,
            updatedAt: deps.sys.clock.now(),
            updatedBy: actor.userId,
            version: r.version + 1,
          };
          next.status = holdStatus(next);
          deps.reservations.update(tx, r.id, reservationPatch(next));
          deps.sys.audit.record(
            tx,
            auditEntry(deps.sys, actor, ctx, {
              branchId: r.branchId,
              entityType: 'stockReservation',
              entityId: r.id,
              action: 'stockReservation.release',
              before: { qty: r.qty, heldQty: r.heldQty, unmetQty: r.unmetQty },
              after: { qty: next.qty, heldQty: 0, unmetQty: 0 },
              ...(data.reason ? { reason: data.reason } : {}),
            }),
          );
          released.push(toReservationDto(next));
        }
      }
      for (const { set } of groups) set.flush(tx);
      return released;
    },
  };
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

export interface OpenReservationDto extends ReservationDto {
  /** whole days since the hold was first created */
  ageDays: number;
}

/**
 * BA-07 / I2: the shortage list (demand that could not be held; source for transfer and purchase
 * requests later) and the "long-held" report (holds older than `days`, default `inv.longHeldDays`;
 * reported to the manager, never released automatically).
 */
export async function listOpenReservations(
  deps: InvDeps,
  actor: Actor,
  raw: unknown,
): Promise<OpenReservationDto[]> {
  const scope = resolveWorkingScope(actor, 'stock-reservation:view');
  const q = parseInput(
    z.object({
      kind: z.enum(['short', 'long-held']),
      days: z.coerce.number().int().min(0).max(365).optional(),
    }),
    raw,
  );
  const days = q.days ?? deps.inv.longHeldDays;
  const now = deps.sys.clock.now().getTime();
  const rows = await deps.reservations.listOpen(scope, deps.inv.openReservationsMax);
  return rows
    .map((r) => ({
      ...toReservationDto(r),
      ageDays: Math.floor((now - r.createdAt.getTime()) / 86_400_000),
    }))
    .filter((r) => (q.kind === 'short' ? r.unmetQty > 0 : r.heldQty > 0 && r.ageDays >= days));
}
