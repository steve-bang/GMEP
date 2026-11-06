import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import {
  hasPermission,
  resolveScope,
  resolveWorkingScope,
  requireWorkingBranch,
  type Actor,
} from '@/platform/rbac/rbac';
import { issueForOrderInTx } from '@/modules/inv';
import { notifyUsers, usersWithRole } from '@/modules/sys';
import {
  checkUndo,
  workedMsOf,
  type PartRequest,
  type RepairItem,
  type TimeEvent,
  type TimeEventType,
} from '../domain/order';
import {
  PAUSE_REASONS,
  allowedItemEvents,
  isOrderOpen,
  transitionItem,
  transitionOrder,
  type ItemCtx,
  type ItemEvent,
  type OrderStatus,
} from '../domain/orderState';
import type { RecDeps } from '../ports/deps';
import { orderPatch } from './orderHelpers';
import { toItemDto, toPartRequestDto, type ItemDto, type PartRequestDto } from './orders';
import {
  AppError,
  assertWritable,
  auditEntry,
  idemOf,
  notFound,
  parseInput,
  versionConflict,
  z,
  type RequestCtx,
} from './support';

/**
 * Execution on the workshop floor (FR-REC-012, 013): assigning technicians, the technician's tablet actions
 * (start, pause, finish, undo; one tap each, G2-TEC-01/02), and part requests that end in a stock issue
 * against the order (G2-TEC-03, RULE-005/007). Item state lives in its own machine; the order moves only
 * through the explicit events below.
 */

const onlyMine = (actor: Actor): boolean => !hasPermission(actor, 'repair-item:manage');

// ---- assigning (FR-REC-012) -------------------------------------------------------------------------------

export interface TechnicianOption {
  id: string;
  name: string;
  /** items still to do assigned to this person at the branch */
  active: number;
}

/** People who can take an item at the working branch: holders of the technician role (TH) or the foreman (QD). */
export async function listTechnicians(deps: RecDeps, actor: Actor): Promise<TechnicianOption[]> {
  const scope = resolveWorkingScope(actor, 'repair-item:manage');
  const ids = await usersWithRole(deps.sys, actor.tenantId, ['TH', 'QD'], actor.workingBranchId);
  const users = await Promise.all(ids.map((id) => deps.sys.users.getById(id)));
  const open = await deps.orders.listOpen(scope, deps.rec.boardMax);
  const count = new Map<string, number>();
  for (const o of open)
    for (const it of await deps.items.listByOrder(scope, o.id, deps.rec.maxItemsPerOrder))
      if (it.active && it.technicianId)
        count.set(it.technicianId, (count.get(it.technicianId) ?? 0) + 1);
  return users
    .flatMap((u) => (u ? [{ id: u.id, name: u.displayName, active: count.get(u.id) ?? 0 }] : []))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

export const assignSchema = z.object({
  /** item version (optimistic) */
  version: z.number().int().min(1),
  technicianId: z.string().trim().min(1).max(128).nullable(),
  reason: z.string().trim().max(300).optional(),
});

/**
 * FR-REC-012: exactly one main technician per item; changing the technician is recorded with who and when,
 * and with a reason once somebody was already assigned. An item being worked on is paused before it moves.
 */
export async function assignTechnician(
  deps: RecDeps,
  actor: Actor,
  itemIdValue: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'repair-item:manage');
  const data = parseInput(assignSchema, input);
  const it0 = await deps.items.get(scope, itemIdValue);
  if (!it0) throw notFound();
  let tech: { id: string; name: string } | null = null;
  if (data.technicianId) {
    const ok = (await usersWithRole(deps.sys, actor.tenantId, ['TH', 'QD'], it0.branchId)).includes(
      data.technicianId,
    );
    const u = ok ? await deps.sys.users.getById(data.technicianId) : null;
    if (!u) throw new AppError('technician_invalid', 422);
    tech = { id: u.id, name: u.displayName };
  }
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/rec/items/${itemIdValue}/assign`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ itemIdValue, ...data }),
    },
    async (tx) => {
      const it = await deps.items.getInTx(tx, scope, itemIdValue);
      if (!it) throw notFound();
      if (it.version !== data.version) throw versionConflict();
      const o = await deps.orders.getInTx(tx, scope, it.orderId);
      if (!o || !isOrderOpen(o.status)) throw new AppError('order_state_invalid', 409);
      if (!it.active) throw new AppError('item_state_invalid', 409);
      if (it.status === 'in_progress' && it.technicianId !== (tech?.id ?? null))
        throw new AppError('item_in_progress', 409);
      await assertWritable(deps, tx, actor, scope, o.branchId, 'edit_open_order');
      if (o.branchId !== requireWorkingBranch(actor)) throw notFound();
      if (it.technicianId && it.technicianId !== tech?.id && !data.reason)
        throw new AppError('reason_required', 422, [
          { field: 'reason', message: 'Ghi lý do khi đổi thợ.' },
        ]);
      const now = deps.sys.clock.now();
      deps.items.update(tx, it.id, {
        technicianId: tech?.id ?? null,
        technicianName: tech?.name ?? null,
        assignments: [
          ...it.assignments,
          {
            technicianId: tech?.id ?? null,
            at: now,
            by: actor.userId,
            ...(data.reason ? { reason: data.reason } : {}),
          },
        ].slice(-50),
        updatedAt: now,
        updatedBy: actor.userId,
        version: it.version + 1,
      });
      deps.orders.update(tx, o.id, { touchedAt: now });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: o.branchId,
          entityType: 'repairItem',
          entityId: it.id,
          action: 'repairItem.assign',
          before: { technicianId: it.technicianId },
          after: { technicianId: tech?.id ?? null },
          ...(data.reason ? { reason: data.reason } : {}),
        }),
      );
      if (tech && tech.id !== actor.userId)
        notifyUsers(deps.sys, tx, {
          tenantId: o.tenantId,
          userIds: [tech.id],
          kind: 'rec.order',
          titleKey: 'notifications.itemAssigned',
          params: { number: o.number, item: it.name },
          link: '/rec/work',
          branchId: o.branchId,
        });
      return {
        status: 200,
        body: { id: it.id, technicianId: tech?.id ?? null, version: it.version + 1 },
      };
    },
  );
}

// ---- technician's tablet (FR-REC-013) ------------------------------------------------------------------------

export interface WorkItemDto extends ItemDto {
  orderId: string;
  orderNumber: string;
  plate: string;
  vehicleLabel: string;
  orderStatus: OrderStatus;
  orderVersion: number;
  /** events the caller may press now: the screen shows exactly these */
  allowedEvents: ItemEvent[];
  /** the last action can still be undone by the caller */
  canUndo: boolean;
  /** approved part lines of the item with what was asked and issued so far (G2-TEC-03) */
  partLines: {
    lineKey: string;
    partId: string;
    name: string;
    code: string;
    qty: number;
    qtyScale: number;
    requested: number;
    issued: number;
  }[];
}

function ctxOf(it: RepairItem, orderStatus: OrderStatus): ItemCtx {
  return {
    orderStatus,
    assigned: it.technicianId !== null,
    waitingParts: it.waitingParts,
    neverStarted: it.events.length === 0,
  };
}

/** "Việc được giao": the active items assigned to the caller, or to `technicianId` for roles that manage the floor. */
export async function listMyWork(
  deps: RecDeps,
  actor: Actor,
  raw: unknown,
): Promise<{ items: WorkItemDto[] }> {
  const scope = resolveWorkingScope(actor, 'repair-item:view');
  const q = parseInput(z.object({ technicianId: z.string().trim().max(128).optional() }), raw);
  const who = !onlyMine(actor) && q.technicianId ? q.technicianId : actor.userId;
  const rows = await deps.items.listActiveByTechnician(scope, who, 100);
  const now = deps.sys.clock.now();
  const orders = new Map<string, { status: OrderStatus; version: number }>();
  const allRequests = new Map<string, PartRequest[]>();
  const out: WorkItemDto[] = [];
  for (const it of rows) {
    if (!orders.has(it.orderId)) {
      const o = await deps.orders.get(scope, it.orderId);
      orders.set(it.orderId, { status: o?.status ?? 'cancelled', version: o?.version ?? 0 });
    }
    const { status: st, version: orderVersion } = orders.get(it.orderId)!;
    if (!allRequests.has(it.orderId))
      allRequests.set(
        it.orderId,
        await deps.partRequests.listByOrder(scope, it.orderId, deps.rec.maxPartRequestsPerOrder),
      );
    const requests = allRequests.get(it.orderId)!.filter((r) => r.itemId === it.id);
    out.push({
      ...toItemDto(it, now),
      orderId: it.orderId,
      orderNumber: it.orderNumber,
      plate: it.plate,
      vehicleLabel: it.vehicleLabel,
      orderStatus: st,
      orderVersion,
      allowedEvents: allowedItemEvents(it.status, ctxOf(it, st)).filter(
        (e) => e === 'start' || e === 'pause' || e === 'finish',
      ),
      canUndo: checkUndo(it.events, now, actor.userId, deps.rec.undoWindowMs).ok,
      partLines: it.lines
        .filter((l) => l.kind === 'part' && l.partId)
        .map((l) => ({
          lineKey: l.lineKey,
          partId: l.partId!,
          name: l.name,
          code: l.code,
          qty: l.qty ?? 0,
          qtyScale: l.qtyScale ?? 1,
          requested: requests
            .filter(
              (r) => r.lineKey === l.lineKey && (r.status === 'requested' || r.status === 'issued'),
            )
            .reduce((s, r) => s + r.qty, 0),
          issued: requests
            .filter((r) => r.lineKey === l.lineKey && r.status === 'issued')
            .reduce((s, r) => s + r.qty, 0),
        })),
    });
  }
  return { items: out };
}

export const itemActionSchema = z.object({
  version: z.number().int().min(1),
  /** pause only */
  reason: z.enum(PAUSE_REASONS).optional(),
  note: z.string().trim().max(300).optional(),
});

const EVENT_TYPE: Record<'start' | 'pause' | 'finish', TimeEventType> = {
  start: 'start',
  pause: 'pause',
  finish: 'finish',
};

/**
 * Start, pause or finish ONE item with a single tap (FR-REC-013, job start/finish in at most 2 taps). Every press
 * writes a time event with the server clock; hours are computed from the events, never typed. The first start
 * moves an approved order to "in progress"; nothing else moves the order. A technician only touches their own items.
 */
export async function itemAction(
  deps: RecDeps,
  actor: Actor,
  itemIdValue: string,
  event: 'start' | 'pause' | 'finish',
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'repair-item:update');
  const data = parseInput(itemActionSchema, input);
  if (event === 'pause' && !data.reason)
    throw new AppError('validation_failed', 422, [
      { field: 'reason', message: 'Chọn lý do tạm dừng.' },
    ]);
  // R41: "khác" needs a note so the waiting-time report can be read
  if (event === 'pause' && data.reason === 'other' && (data.note ?? '').length < 3)
    throw new AppError('validation_failed', 422, [
      { field: 'note', message: 'Ghi chú lý do tạm dừng.' },
    ]);
  const it0 = await deps.items.get(scope, itemIdValue);
  if (!it0 || (onlyMine(actor) && it0.technicianId !== actor.userId)) throw notFound();
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/rec/items/${itemIdValue}/${event}`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ itemIdValue, event, ...data }),
    },
    async (tx) => {
      const it = await deps.items.getInTx(tx, scope, itemIdValue);
      if (!it || (onlyMine(actor) && it.technicianId !== actor.userId)) throw notFound();
      if (it.version !== data.version) throw versionConflict();
      const o = await deps.orders.getInTx(tx, scope, it.orderId);
      if (!o) throw notFound();
      await assertWritable(deps, tx, actor, scope, o.branchId, 'edit_open_order');
      const t = transitionItem(it.status, event, ctxOf(it, o.status));
      if (!t.ok) throw new AppError(t.reason, 409);
      if (it.events.length >= deps.rec.maxEventsPerItem) throw new AppError('order_too_large', 422);
      const now = deps.sys.clock.now();
      const e: TimeEvent = {
        n: it.events.length + 1,
        type: EVENT_TYPE[event],
        from: it.status,
        to: t.state,
        at: now,
        by: actor.userId,
        ...(data.reason ? { reason: data.reason } : {}),
        ...(event === 'pause' && data.note ? { note: data.note } : {}),
      };
      const events = [...it.events, e];
      const finished = t.state === 'done';
      deps.items.update(tx, it.id, {
        status: t.state,
        active: !finished,
        pauseReason: event === 'pause' ? (data.reason ?? null) : null,
        events,
        workedMs: workedMsOf(events),
        updatedAt: now,
        updatedBy: actor.userId,
        version: it.version + 1,
      });
      // the first start of an approved order opens the work; finishing counts toward "all items done"
      const orderT =
        o.status === 'approved' && event === 'start' ? transitionOrder(o.status, 'start') : null;
      deps.orders.update(tx, o.id, {
        touchedAt: now,
        ...(finished ? { doneCount: o.doneCount + 1 } : {}),
        ...(orderT?.ok ? orderPatch(o, 'start', orderT.state, actor.userId, now) : {}),
        ...(finished && !orderT?.ok ? { version: o.version + 1 } : {}),
      });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: o.branchId,
          entityType: 'repairItem',
          entityId: it.id,
          action: `repairItem.${event}`,
          before: { status: it.status },
          after: { status: t.state, order: o.number },
          ...(data.reason ? { reason: data.reason } : {}),
        }),
      );
      return {
        status: 200,
        body: {
          id: it.id,
          status: t.state,
          version: it.version + 1,
          orderStatus: orderT?.ok ? orderT.state : o.status,
        },
      };
    },
  );
}

/** "Hoàn tác": takes back the caller's own latest press inside the configured window (default 2 minutes). */
export async function undoItemAction(
  deps: RecDeps,
  actor: Actor,
  itemIdValue: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'repair-item:update');
  const data = parseInput(z.object({ version: z.number().int().min(1) }), input);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/rec/items/${itemIdValue}/undo`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ itemIdValue, ...data }),
    },
    async (tx) => {
      const it = await deps.items.getInTx(tx, scope, itemIdValue);
      if (!it || (onlyMine(actor) && it.technicianId !== actor.userId)) throw notFound();
      if (it.version !== data.version) throw versionConflict();
      const o = await deps.orders.getInTx(tx, scope, it.orderId);
      if (!o) throw notFound();
      await assertWritable(deps, tx, actor, scope, o.branchId, 'edit_open_order');
      if (o.status !== 'approved' && o.status !== 'in_progress')
        throw new AppError('order_not_active', 409);
      const now = deps.sys.clock.now();
      const u = checkUndo(it.events, now, actor.userId, deps.rec.undoWindowMs);
      if (!u.ok) throw new AppError(u.reason, 409);
      const events: TimeEvent[] = [
        ...it.events.map((x) => (x.n === u.event.n ? { ...x, undone: true } : x)),
        {
          n: it.events.length + 1,
          type: 'undo',
          from: it.status,
          to: u.event.from,
          at: now,
          by: actor.userId,
        },
      ];
      const wasDone = it.status === 'done';
      deps.items.update(tx, it.id, {
        status: u.event.from,
        active: true,
        pauseReason: u.event.from === 'paused' ? (it.pauseReason ?? null) : null,
        events,
        workedMs: workedMsOf(events),
        updatedAt: now,
        updatedBy: actor.userId,
        version: it.version + 1,
      });
      deps.orders.update(tx, o.id, {
        touchedAt: now,
        ...(wasDone ? { doneCount: Math.max(0, o.doneCount - 1), version: o.version + 1 } : {}),
      });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: o.branchId,
          entityType: 'repairItem',
          entityId: it.id,
          action: 'repairItem.undo',
          before: { status: it.status },
          after: { status: u.event.from, undone: u.event.type },
        }),
      );
      return { status: 200, body: { id: it.id, status: u.event.from, version: it.version + 1 } };
    },
  );
}

// ---- part requests (FR-REC-013, RULE-005/007) -----------------------------------------------------------------

export const partRequestSchema = z.object({
  itemId: z.string().trim().min(1).max(120),
  lineKey: z.string().trim().min(1).max(80),
  /** stored quantity (same scale as the quote line) */
  qty: z.number().int().min(1).max(1_000_000),
  note: z.string().trim().max(300).optional(),
});

/**
 * "Yêu cầu phụ tùng": only an APPROVED part line of the order can be requested (RULE-005), at most the approved
 * quantity minus what is already requested or issued. The storekeeper sees the request and issues it against the order.
 */
export async function createPartRequest(
  deps: RecDeps,
  actor: Actor,
  orderId: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'part-request:create');
  const data = parseInput(partRequestSchema, input);
  const storekeepers = await usersWithRole(deps.sys, actor.tenantId, ['TK'], actor.workingBranchId);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/rec/orders/${orderId}/part-requests`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ orderId, ...data }),
    },
    async (tx) => {
      const o = await deps.orders.getInTx(tx, scope, orderId);
      if (!o || o.branchId !== requireWorkingBranch(actor)) throw notFound();
      const it = await deps.items.getInTx(tx, scope, data.itemId);
      if (!it || it.orderId !== o.id) throw notFound();
      if (onlyMine(actor) && it.technicianId !== actor.userId) throw notFound();
      if (o.status !== 'approved' && o.status !== 'in_progress' && o.status !== 'paused')
        throw new AppError('order_state_invalid', 409);
      await assertWritable(deps, tx, actor, scope, o.branchId, 'edit_open_order');
      const line = it.lines.find(
        (l) => l.lineKey === data.lineKey && l.kind === 'part' && l.partId,
      );
      if (!line) throw new AppError('line_not_approved', 422);
      const existing = await deps.partRequests.listByOrderInTx(
        tx,
        scope,
        o.id,
        deps.rec.maxPartRequestsPerOrder,
      );
      if (existing.length >= deps.rec.maxPartRequestsPerOrder)
        throw new AppError('order_too_large', 422);
      const taken = existing
        .filter(
          (r) => r.lineKey === line.lineKey && (r.status === 'requested' || r.status === 'issued'),
        )
        .reduce((s, r) => s + r.qty, 0);
      if (taken + data.qty > (line.qty ?? 0)) throw new AppError('request_exceeds_approved', 422);
      const now = deps.sys.clock.now();
      const r: PartRequest = {
        id: `prq_${deps.sys.newId()}`,
        tenantId: o.tenantId,
        branchId: o.branchId,
        orderId: o.id,
        orderNumber: o.number,
        itemId: it.id,
        lineKey: line.lineKey,
        partId: line.partId!,
        partCode: line.code,
        partName: line.name,
        qty: data.qty,
        qtyScale: line.qtyScale ?? 1,
        status: 'requested',
        requestedBy: actor.userId,
        requestedAt: now,
        receiverUserId: it.technicianId ?? actor.userId,
        ...(data.note ? { note: data.note } : {}),
        createdAt: now,
        createdBy: actor.userId,
        updatedAt: now,
        updatedBy: actor.userId,
        version: 1,
      };
      deps.partRequests.create(tx, r);
      deps.orders.update(tx, o.id, { touchedAt: now });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: o.branchId,
          entityType: 'partRequest',
          entityId: r.id,
          action: 'partRequest.create',
          after: { order: o.number, lineKey: r.lineKey, qty: r.qty },
        }),
      );
      const to = storekeepers.filter((u) => u !== actor.userId);
      if (to.length)
        notifyUsers(deps.sys, tx, {
          tenantId: o.tenantId,
          userIds: to,
          kind: 'rec.order',
          titleKey: 'notifications.partRequested',
          params: { number: o.number, part: r.partCode },
          link: '/rec/part-requests',
          branchId: o.branchId,
        });
      return { status: 201, body: toPartRequestDto(r, o.plate) };
    },
  );
}

export async function listPartRequests(
  deps: RecDeps,
  actor: Actor,
  raw: unknown,
): Promise<{ items: PartRequestDto[] }> {
  const scope = resolveWorkingScope(actor, 'part-request:view');
  const q = parseInput(
    z.object({
      status: z.enum(['requested', 'issued', 'rejected', 'cancelled']).default('requested'),
    }),
    raw,
  );
  const rows = await deps.partRequests.listByStatus(scope, q.status, 100);
  const own = !hasPermission(actor, 'part-request:update') && onlyMine(actor);
  return {
    items: rows
      .filter((r) => !own || r.requestedBy === actor.userId)
      .map((r) => toPartRequestDto(r)),
  };
}

export const decideRequestSchema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('issue'), version: z.number().int().min(1) }),
  z.object({
    decision: z.literal('reject'),
    version: z.number().int().min(1),
    reason: z.string().trim().min(3).max(300),
  }),
]);

/**
 * The storekeeper issues the parts against the order (INV goods issue, same transaction as the request: no
 * issue without the order, RULE-007; the order's own hold is consumed first, the line key rides along) or
 * refuses with a reason. Issuing needs the stock permission; refusing is also open to the manager.
 */
export async function decidePartRequest(
  deps: RecDeps,
  actor: Actor,
  requestId: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'part-request:update');
  const data = parseInput(decideRequestSchema, input);
  const stockScope = data.decision === 'issue' ? resolveScope(actor, 'stock-doc:create') : scope;
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/rec/part-requests/${requestId}/decide`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ requestId, ...data }),
    },
    async (tx) => {
      const r = await deps.partRequests.getInTx(tx, scope, requestId);
      if (!r) throw notFound();
      if (r.version !== data.version) throw versionConflict();
      if (r.status !== 'requested') throw new AppError('request_closed', 409);
      const o = await deps.orders.getInTx(tx, scope, r.orderId);
      if (!o || o.branchId !== requireWorkingBranch(actor)) throw notFound();
      const now = deps.sys.clock.now();
      if (data.decision === 'reject') {
        await assertWritable(deps, tx, actor, scope, o.branchId, 'edit_open_order');
        deps.partRequests.update(tx, r.id, {
          status: 'rejected',
          rejectReason: data.reason,
          decidedBy: actor.userId,
          decidedAt: now,
          updatedAt: now,
          updatedBy: actor.userId,
          version: r.version + 1,
        });
        deps.sys.audit.record(
          tx,
          auditEntry(deps.sys, actor, ctx, {
            branchId: o.branchId,
            entityType: 'partRequest',
            entityId: r.id,
            action: 'partRequest.reject',
            reason: data.reason,
          }),
        );
        notifyUsers(deps.sys, tx, {
          tenantId: o.tenantId,
          userIds: [r.requestedBy],
          kind: 'rec.order',
          titleKey: 'notifications.partRejected',
          params: { number: o.number, part: r.partCode },
          link: '/rec/work',
          branchId: o.branchId,
        });
        return { status: 200, body: toPartRequestDto({ ...r, status: 'rejected' }, o.plate) };
      }
      if (!isOrderOpen(o.status) || !o.warehouseId) throw new AppError('order_state_invalid', 409);
      // RULE-007: the issue is against this order and one of its approved lines
      const doc = await issueForOrderInTx(
        deps.inv,
        tx,
        actor,
        stockScope,
        {
          warehouseId: o.warehouseId,
          orderId: o.id,
          receiverUserId: r.receiverUserId,
          lines: [{ partId: r.partId, qty: r.qty, lineKey: r.lineKey }],
        },
        ctx,
      );
      deps.partRequests.update(tx, r.id, {
        status: 'issued',
        issueDocumentId: doc.id,
        issueDocumentNo: doc.displayNo,
        decidedBy: actor.userId,
        decidedAt: now,
        updatedAt: now,
        updatedBy: actor.userId,
        version: r.version + 1,
      });
      deps.orders.update(tx, o.id, { touchedAt: now });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: o.branchId,
          entityType: 'partRequest',
          entityId: r.id,
          action: 'partRequest.issue',
          after: { order: o.number, lineKey: r.lineKey, qty: r.qty, documentId: doc.id },
        }),
      );
      if (r.requestedBy !== actor.userId)
        notifyUsers(deps.sys, tx, {
          tenantId: o.tenantId,
          userIds: [r.requestedBy],
          kind: 'rec.order',
          titleKey: 'notifications.partIssued',
          params: { number: o.number, part: r.partCode },
          link: '/rec/work',
          branchId: o.branchId,
        });
      return {
        status: 200,
        body: toPartRequestDto(
          { ...r, status: 'issued', issueDocumentId: doc.id, issueDocumentNo: doc.displayNo },
          o.plate,
        ),
      };
    },
  );
}
