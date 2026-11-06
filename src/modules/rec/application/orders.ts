import { businessDate } from '@/platform/format/date';
import { toPhotoDtos, type PhotoDto } from './photos';
import { rootLogger } from '@/platform/logging/logger';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import {
  decodeCursor,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  type Page,
} from '@/platform/pagination/pagination';
import {
  hasPermission,
  resolveScope,
  resolveWorkingScope,
  requireWorkingBranch,
  type Actor,
} from '@/platform/rbac/rbac';
import { branchesScope, type Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import { normalizePlate } from '@/modules/crm';
import {
  listReservationsBySource,
  orderIssueBalance,
  prepareHoldForApproval,
  prepareRelease,
  type ReservationDto,
} from '@/modules/inv';
import { notifyUsers, resolveConfigAt, usersWithRole, type Branch } from '@/modules/sys';
import { versionId, type Quote, type QuoteVersion } from '../domain/entities';
import {
  itemId,
  itemSeedsOf,
  orderIdOfQuote,
  seqKeyOf,
  type HandoverPayment,
  type RepairItem,
  type RepairOrder,
  type WorkflowStepSnapshot,
} from '../domain/order';
import {
  allowedOrderEvents,
  isOrderOpen,
  transitionOrder,
  type OrderStatus,
} from '../domain/orderState';
import type { RecDeps } from '../ports/deps';
import { orderPatch, systemActor } from './orderHelpers';
import { appendSupplement, prepareCloseSupplements } from './supplement';
import { allocateRepairOrderNumber } from './orderSupport';
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
 * Repair order (lệnh sửa chữa, G2-REC-02..06; FR-REC-010, 015, 021, 022, 028; RULE-005/006/007). The order is
 * the source document of the visit: it is opened BY THE APPROVAL of a quote (R37), holds stock for the approved
 * part lines, and carries its own state machine. The quote is untouched; items have their own machine.
 */

// ---- who acts ----------------------------------------------------------------------------------------

/** The warehouse the holds are taken from: the branch's default one, else the first active by code [Cần xác nhận: Khách]. */
async function holdWarehouse(
  deps: RecDeps,
  scope: Scope,
  branchId: string,
): Promise<string | null> {
  const page = await deps.sys.warehouses.list(scope, { sort: 'code', direction: 'asc', limit: 50 });
  const active = page.items.filter((w) => w.branchId === branchId && w.status === 'active');
  return (active.find((w) => w.isDefault) ?? active[0])?.id ?? null;
}

// ---- opening the order from an approved quote (R35, R37) ------------------------------------------------

export interface OpenedOrder {
  orderId: string;
  number: string;
  created: boolean;
  unmetLines: number;
}

function approvedVersionOf(versions: QuoteVersion[]): QuoteVersion | null {
  return versions.find((v) => v.approval) ?? null;
}

/**
 * R37: ONE business event. In a single transaction: the RO number (R35, idempotent by the approval evidence
 * hash), the order holding only the approved lines, the stock hold of the approved part lines (INV
 * `holdForApproval`, partial: a shortage never blocks, it is stored as unmet), the items, the link from the
 * quote and the notice to the advisor and the branch manager. Calling it again returns the same order.
 * `actor` is the staff member when there is one (counter approval, "Tạo lệnh" button), else the system.
 */
export async function openOrderForQuote(
  deps: RecDeps,
  quote: Pick<Quote, 'id' | 'tenantId' | 'branchId'>,
  actor: Actor | null,
  ctx: RequestCtx,
): Promise<OpenedOrder> {
  const scope = branchesScope(quote.tenantId, [quote.branchId]);
  const by = actor ?? systemActor(quote.tenantId, quote.branchId);
  const q = await deps.quotes.get(scope, quote.id);
  if (!q) throw notFound();
  if (q.supplementOfOrderId) return appendSupplement(deps, q, actor, ctx);
  const versions = await deps.versions.listByQuote(scope, q.id, q.currentN);
  const v = approvedVersionOf(versions);
  if (!v?.approval) throw new AppError('quote_not_approved', 409);
  const approval = v.approval;
  const orderId = orderIdOfQuote(q.id);
  const existing = await deps.orders.get(scope, orderId);
  if (existing)
    return { orderId, number: existing.number, created: false, unmetLines: existing.unmetLines };

  const intake = await deps.intakes.get(scope, q.intakeId);
  const workflow = intake?.serviceType
    ? await resolveConfigAt(deps.sys, {
        tenantId: q.tenantId,
        type: 'service-workflow',
        scopeKey: intake.serviceType,
        date: businessDate(approval.decidedAt),
      })
    : null;
  const steps = ((workflow?.payload as { steps?: WorkflowStepSnapshot[] } | undefined)?.steps ??
    []) as WorkflowStepSnapshot[];
  const seeds = itemSeedsOf(
    approval.lines,
    (no) => v.items.find((i) => i.no === no)?.necessity ?? 'optional',
  );
  if (seeds.length === 0) throw new AppError('quote_not_approved', 409);
  if (seeds.length > deps.rec.maxItemsPerOrder) throw new AppError('order_too_large', 422);
  const partLines = approval.lines.filter((l) => l.kind === 'part' && l.partId && l.qty);
  const warehouseId = partLines.length ? await holdWarehouse(deps, scope, q.branchId) : null;
  if (partLines.length && !warehouseId) throw new AppError('warehouse_missing', 409);
  const managers = await usersWithRole(deps.sys, q.tenantId, ['QL'], q.branchId);
  const recipients = [...new Set([q.advisorId, ...managers])].filter((id) => id !== by.userId);

  return deps.sys.uow.run(async (tx) => {
    // ---- reads (Firestore: every read before the first write) ----
    const dup = await deps.orders.getInTx(tx, scope, orderId);
    if (dup) return { orderId, number: dup.number, created: false, unmetLines: dup.unmetLines };
    const branch = await deps.sys.branches.getInTx(tx, scope, q.branchId);
    if (!branch) throw notFound();
    const hold = partLines.length
      ? await prepareHoldForApproval(
          deps.inv,
          tx,
          by,
          scope,
          {
            orderId,
            warehouseId: warehouseId!,
            lines: partLines.map((l) => ({ lineKey: l.lineKey, partId: l.partId!, qty: l.qty! })),
          },
          ctx,
        )
      : null;
    const now = deps.sys.clock.now();
    const number = await allocateRepairOrderNumber(deps, tx, {
      branch,
      orderId,
      businessDate: businessDate(now),
      requestKey: approval.hash,
    });
    // ---- writes ----
    const holds = hold ? hold.commit() : [];
    const unmet = new Set(holds.filter((h) => h.unmetQty > 0).map((h) => h.lineKey));
    const items: RepairItem[] = seeds.map((s, i) => {
      const no = i + 1;
      const waiting = s.lines.some((l) => unmet.has(l.lineKey));
      return {
        id: itemId(orderId, no),
        tenantId: q.tenantId,
        branchId: q.branchId,
        orderId,
        no,
        seqKey: seqKeyOf(no),
        origin: 'base',
        sourceQuoteId: q.id,
        sourceItemNo: s.sourceItemNo,
        name: s.name,
        necessity: s.necessity,
        lines: s.lines,
        subtotalVnd: s.subtotalVnd,
        // Journey step 5: an item whose parts are short starts "paused, waiting for parts"
        status: waiting ? 'paused' : 'not_started',
        active: true,
        ...(waiting ? { pauseReason: 'waiting_parts' } : {}),
        waitingParts: waiting,
        technicianId: null,
        technicianName: null,
        assignments: [],
        events: [],
        workedMs: 0,
        approvedMinutes: s.approvedMinutes,
        orderNumber: number,
        plate: q.plate,
        vehicleLabel: q.vehicleLabel,
        createdAt: now,
        createdBy: by.userId,
        updatedAt: now,
        updatedBy: by.userId,
        version: 1,
      };
    });
    const order: RepairOrder = {
      id: orderId,
      tenantId: q.tenantId,
      branchId: q.branchId,
      number,
      status: 'approved',
      open: true,
      quoteId: q.id,
      quoteNumber: q.number,
      quoteVersionN: v.n,
      evidenceHash: approval.hash,
      intakeId: q.intakeId,
      vehicleId: q.vehicleId,
      customerId: q.customerId,
      plate: q.plate,
      plateNorm: q.plateNorm,
      vehicleLabel: q.vehicleLabel,
      customerName: q.customerName,
      // R37 (d): the advisor of the order is whoever made the quote
      advisorId: q.advisorId,
      ...(intake?.serviceType ? { serviceType: intake.serviceType } : {}),
      ...(workflow ? { workflowVersionId: workflow.versionId } : {}),
      steps,
      ...(intake?.km !== undefined ? { km: intake.km } : {}),
      ...(intake?.promisedDate ? { promisedDate: intake.promisedDate } : {}),
      baseTotalVnd: approval.approvedTotalVnd,
      totalVnd: approval.approvedTotalVnd,
      supplements: [],
      warehouseId,
      unmetLines: unmet.size,
      itemCount: items.length,
      doneCount: 0,
      proposals: [],
      qcRuns: [],
      history: [{ from: null, to: 'approved', event: 'create', at: now, by: by.userId }],
      createdAt: now,
      createdBy: by.userId,
      updatedAt: now,
      updatedBy: by.userId,
      version: 1,
    };
    deps.orders.create(tx, order);
    for (const it of items) deps.items.create(tx, it);
    deps.quotes.update(tx, q.id, { orderId, updatedAt: now, updatedBy: by.userId });
    deps.sys.audit.record(
      tx,
      auditEntry(deps.sys, by, ctx, {
        branchId: q.branchId,
        entityType: 'repairOrder',
        entityId: orderId,
        action: 'repairOrder.create',
        after: {
          number,
          quoteId: q.id,
          quoteVersion: v.n,
          evidence: approval.hash,
          items: items.length,
          totalVnd: approval.approvedTotalVnd,
          unmetLines: unmet.size,
        },
      }),
    );
    if (recipients.length)
      notifyUsers(deps.sys, tx, {
        tenantId: q.tenantId,
        userIds: recipients,
        kind: 'rec.order',
        titleKey: unmet.size ? 'notifications.orderCreatedShort' : 'notifications.orderCreated',
        params: { number, quote: q.number },
        link: `/rec/orders/${orderId}`,
        branchId: q.branchId,
      });
    return { orderId, number, created: true, unmetLines: unmet.size };
  });
}

/**
 * Called right after an approval is committed (R37 rule 2). The approval stands whatever happens here; a
 * technical failure leaves the quote "approved, no order yet" and tells the branch manager, who (or the
 * advisor) can press "Tạo lệnh", which calls the same idempotent path again.
 */
export async function afterQuoteApproved(
  deps: RecDeps,
  quote: Pick<Quote, 'id' | 'tenantId' | 'branchId' | 'number' | 'supplementOfOrderId'>,
  actor: Actor | null,
  ctx: RequestCtx,
): Promise<OpenedOrder | null> {
  try {
    return await openOrderForQuote(deps, quote, actor, ctx);
  } catch (e) {
    try {
      const managers = await usersWithRole(deps.sys, quote.tenantId, ['QL'], quote.branchId);
      if (managers.length)
        await deps.sys.uow.run(async (tx) => {
          notifyUsers(deps.sys, tx, {
            tenantId: quote.tenantId,
            userIds: managers,
            kind: 'rec.order',
            titleKey:
              (e as { code?: string })?.code === 'warehouse_missing'
                ? 'notifications.orderWarehouseMissing'
                : 'notifications.orderMissing',
            params: { number: quote.number },
            link: `/rec/quotes/${quote.id}`,
            branchId: quote.branchId,
          });
        });
    } catch {
      /* the notice is best effort; the quote still shows "approved, no order yet" */
    }
    rootLogger.error(
      {
        op: 'openOrderForQuote',
        quoteId: quote.id,
        requestId: ctx.requestId,
        code: (e as { code?: string })?.code ?? 'unknown',
      },
      'order not opened after approval',
    );
    return null;
  }
}

/** The "Tạo lệnh" button (R37 rule 2): same idempotent path, by a staff member. */
export async function createOrderForQuote(
  deps: RecDeps,
  actor: Actor,
  quoteId: string,
  ctx: RequestCtx,
): Promise<OpenedOrder> {
  const scope = resolveScope(actor, 'repair-order:create');
  const q = await deps.quotes.get(scope, quoteId);
  if (!q) throw notFound();
  if (q.branchId !== requireWorkingBranch(actor)) throw notFound();
  return openOrderForQuote(deps, q, actor, ctx);
}

// ---- reading ------------------------------------------------------------------------------------------

export interface OrderDto {
  id: string;
  number: string;
  status: OrderStatus;
  open: boolean;
  quoteId: string;
  quoteNumber: string;
  plate: string;
  vehicleLabel: string;
  customerName: string;
  advisorId: string;
  serviceType: string | null;
  promisedDate: string | null;
  totalVnd: number;
  itemCount: number;
  doneCount: number;
  unmetLines: number;
  pausedReason: string | null;
  /** promised date passed and the order is still open (FR-REC-022 "xe trễ hẹn") */
  late: boolean;
  startedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export function toOrderDto(o: RepairOrder, today: string): OrderDto {
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    open: o.open,
    quoteId: o.quoteId,
    quoteNumber: o.quoteNumber,
    plate: o.plate,
    vehicleLabel: o.vehicleLabel,
    customerName: o.customerName,
    advisorId: o.advisorId,
    serviceType: o.serviceType ?? null,
    promisedDate: o.promisedDate ?? null,
    totalVnd: o.totalVnd,
    itemCount: o.itemCount,
    doneCount: o.doneCount,
    unmetLines: o.unmetLines,
    pausedReason: o.pausedReason ?? null,
    late: o.open && !!o.promisedDate && o.promisedDate < today,
    startedAt: o.startedAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    version: o.version,
  };
}

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  cursor: z.string().max(512).optional(),
  status: z
    .enum([
      'approved',
      'in_progress',
      'paused',
      'awaiting_qc',
      'ready_for_delivery',
      'completed',
      'cancelled',
    ])
    .optional(),
  q: z.string().trim().max(40).optional(),
});

export async function listOrders(
  deps: RecDeps,
  actor: Actor,
  raw: unknown,
): Promise<Page<OrderDto>> {
  const scope = resolveWorkingScope(actor, 'repair-order:view');
  const q = parseInput(listSchema, raw);
  const text = q.q ?? '';
  const byNumber = /^ro/i.test(text);
  const page = await deps.orders.list(scope, {
    limit: q.limit,
    ...(q.status ? { status: q.status } : {}),
    ...(text && byNumber ? { numberPrefix: text.toUpperCase() } : {}),
    ...(text && !byNumber ? { platePrefix: normalizePlate(text) } : {}),
    ...(q.cursor ? { cursor: decodeCursor(q.cursor)! } : {}),
  });
  const today = businessDate(deps.sys.clock.now());
  return { items: page.items.map((o) => toOrderDto(o, today)), nextCursor: page.nextCursor };
}

// ---- dispatch board (FR-REC-022) ---------------------------------------------------------------------

export interface BoardCard extends OrderDto {
  /** items not done, by technician name (staff display names only) */
  technicians: string[];
  unassignedItems: number;
  /** items waiting for parts */
  waitingItems: number;
  pendingPartRequests: number;
}
export interface BoardDto {
  columns: Record<
    'approved' | 'in_progress' | 'paused' | 'awaiting_qc' | 'ready_for_delivery',
    BoardCard[]
  >;
  /** cards counted for the filters shown */
  total: number;
  /** technicians with the number of active items, for the load view (G2-REC-05) */
  load: { technicianId: string; name: string; active: number; inProgress: number }[];
}

const boardQuery = z.object({
  technicianId: z.string().trim().max(128).optional(),
  status: z
    .enum(['approved', 'in_progress', 'paused', 'awaiting_qc', 'ready_for_delivery'])
    .optional(),
  late: z.coerce.boolean().optional(),
  waitingParts: z.coerce.boolean().optional(),
});

export async function getBoard(deps: RecDeps, actor: Actor, raw: unknown): Promise<BoardDto> {
  const scope = resolveWorkingScope(actor, 'repair-order:view');
  const f = parseInput(boardQuery, raw);
  const today = businessDate(deps.sys.clock.now());
  const open = await deps.orders.listOpen(scope, deps.rec.boardMax);
  const cards: BoardCard[] = [];
  const load = new Map<
    string,
    { technicianId: string; name: string; active: number; inProgress: number }
  >();
  for (const o of open) {
    const items = await deps.items.listByOrder(scope, o.id, deps.rec.maxItemsPerOrder);
    for (const it of items.filter((i) => i.active && i.technicianId)) {
      const row = load.get(it.technicianId!) ?? {
        technicianId: it.technicianId!,
        name: it.technicianName ?? '',
        active: 0,
        inProgress: 0,
      };
      row.active += 1;
      if (it.status === 'in_progress') row.inProgress += 1;
      load.set(it.technicianId!, row);
    }
    const dto = toOrderDto(o, today);
    if (f.status && o.status !== f.status) continue;
    if (f.late && !dto.late) continue;
    if (f.waitingParts && !items.some((i) => i.waitingParts)) continue;
    if (f.technicianId && !items.some((i) => i.technicianId === f.technicianId)) continue;
    const pending = (await deps.partRequests.listByOrder(scope, o.id, 50)).filter(
      (r) => r.status === 'requested',
    ).length;
    cards.push({
      ...dto,
      technicians: [
        ...new Set(items.filter((i) => i.active && i.technicianName).map((i) => i.technicianName!)),
      ],
      unassignedItems: items.filter((i) => i.active && !i.technicianId).length,
      waitingItems: items.filter((i) => i.waitingParts).length,
      pendingPartRequests: pending,
    });
  }
  const columns: BoardDto['columns'] = {
    approved: [],
    in_progress: [],
    paused: [],
    awaiting_qc: [],
    ready_for_delivery: [],
  };
  for (const c of cards) columns[c.status as keyof BoardDto['columns']].push(c);
  return {
    columns,
    total: cards.length,
    load: [...load.values()].sort((a, b) => b.active - a.active),
  };
}

// ---- detail ------------------------------------------------------------------------------------------

export interface ItemDto {
  id: string;
  no: number;
  name: string;
  necessity: 'required' | 'optional';
  origin: 'base' | 'supplement';
  status: RepairItem['status'];
  pauseReason: string | null;
  waitingParts: boolean;
  technicianId: string | null;
  technicianName: string | null;
  subtotalVnd: number;
  approvedMinutes: number;
  workedMs: number;
  /** open segment included */
  workedNowMs: number;
  lines: {
    lineKey: string;
    kind: 'labor' | 'part';
    code: string;
    name: string;
    minutes: number | null;
    qty: number | null;
    qtyScale: number | null;
    amountVnd: number;
  }[];
  assignments: { technicianId: string | null; at: string; by: string; reason: string | null }[];
  events: {
    n: number;
    type: string;
    at: string;
    by: string;
    reason: string | null;
    undone: boolean;
  }[];
  version: number;
}

export interface PartRequestDto {
  id: string;
  itemId: string;
  lineKey: string;
  partId: string;
  partCode: string;
  partName: string;
  qty: number;
  qtyScale: number;
  status: string;
  requestedBy: string;
  requestedAt: string;
  note: string | null;
  rejectReason: string | null;
  issueDocumentId: string | null;
  issueDocumentNo: string | null;
  orderId: string;
  orderNumber: string;
  plate: string | null;
  version: number;
}

export interface OrderDetailDto extends OrderDto {
  intakeId: string;
  vehicleId: string;
  baseTotalVnd: number;
  warehouseId: string | null;
  steps: WorkflowStepSnapshot[];
  items: ItemDto[];
  supplements: { quoteId: string; number: string; totalVnd: number; approvedAt: string }[];
  photos: PhotoDto[];
  proposals: {
    id: string;
    title: string;
    note: string | null;
    status: string;
    proposedBy: string;
    proposedAt: string;
    quoteId: string | null;
  }[];
  qcRuns: {
    n: number;
    at: string;
    by: string;
    result: string;
    checks: { code: string; name: string; ok: boolean; note: string | null }[];
    returnedItemIds: string[];
    note: string | null;
    /** R47: later approved work voided this result */
    invalidatedAt: string | null;
  }[];
  handover: null | {
    at: string;
    by: string;
    receiverName: string;
    km: number | null;
    confirmation: string;
    paperRef: string | null;
    belongingsReturned: boolean;
    oldPartsReturned: boolean;
    printCount: number;
    /** R44: the money of the order as ACC reported it when the vehicle left */
    payment: HandoverPayment | null;
  };
  history: {
    from: string | null;
    to: string;
    event: string;
    at: string;
    by: string;
    reason: string | null;
  }[];
  partRequests: PartRequestDto[];
  /** which actions the caller may take now (server decides; the screen only shows it) */
  allowed: Record<string, boolean>;
  /** parts waiting for stock, from the INV holds (only for roles allowed to see reservations) */
  shortages: { lineKey: string; partCode: string; unmetQty: number }[] | null;
}

export function toItemDto(it: RepairItem, now: Date): ItemDto {
  const open = [...it.events].reverse().find((e) => !e.undone && e.type !== 'undo');
  const running = open?.type === 'start' ? Math.max(0, now.getTime() - open.at.getTime()) : 0;
  return {
    id: it.id,
    no: it.no,
    name: it.name,
    necessity: it.necessity,
    origin: it.origin,
    status: it.status,
    pauseReason: it.pauseReason ?? null,
    waitingParts: it.waitingParts,
    technicianId: it.technicianId,
    technicianName: it.technicianName,
    subtotalVnd: it.subtotalVnd,
    approvedMinutes: it.approvedMinutes,
    workedMs: it.workedMs,
    workedNowMs: it.workedMs + running,
    lines: it.lines.map((l) => ({
      lineKey: l.lineKey,
      kind: l.kind,
      code: l.code,
      name: l.name,
      minutes: l.minutes ?? null,
      qty: l.qty ?? null,
      qtyScale: l.qtyScale ?? null,
      amountVnd: l.amountVnd,
    })),
    assignments: it.assignments.map((a) => ({
      technicianId: a.technicianId,
      at: a.at.toISOString(),
      by: a.by,
      reason: a.reason ?? null,
    })),
    events: it.events.map((e) => ({
      n: e.n,
      type: e.type,
      at: e.at.toISOString(),
      by: e.by,
      reason: e.reason ?? null,
      undone: e.undone === true,
    })),
    version: it.version,
  };
}

export function toPartRequestDto(
  r: import('../domain/order').PartRequest,
  plate: string | null = null,
): PartRequestDto {
  return {
    id: r.id,
    itemId: r.itemId,
    lineKey: r.lineKey,
    partId: r.partId,
    partCode: r.partCode,
    partName: r.partName,
    qty: r.qty,
    qtyScale: r.qtyScale,
    status: r.status,
    requestedBy: r.requestedBy,
    requestedAt: r.requestedAt.toISOString(),
    note: r.note ?? null,
    rejectReason: r.rejectReason ?? null,
    issueDocumentId: r.issueDocumentId ?? null,
    issueDocumentNo: r.issueDocumentNo ?? null,
    orderId: r.orderId,
    orderNumber: r.orderNumber,
    plate,
    version: r.version,
  };
}

export async function getOrder(deps: RecDeps, actor: Actor, id: string): Promise<OrderDetailDto> {
  const scope = resolveScope(actor, 'repair-order:view');
  const o = await deps.orders.get(scope, id);
  if (!o) throw notFound();
  const now = deps.sys.clock.now();
  const today = businessDate(now);
  const [items, requests] = await Promise.all([
    deps.items.listByOrder(scope, id, deps.rec.maxItemsPerOrder),
    deps.partRequests.listByOrder(scope, id, deps.rec.maxPartRequestsPerOrder),
  ]);
  let shortages: OrderDetailDto['shortages'] = null;
  if (hasPermission(actor, 'stock-reservation:view') && actor.workingBranchId === o.branchId) {
    try {
      const rs = await listReservationsBySource(deps.inv, actor, 'repair-order', id);
      shortages = rs
        .filter((r: ReservationDto) => r.unmetQty > 0)
        .map((r: ReservationDto) => ({
          lineKey: r.lineKey,
          partCode: r.partCode,
          unmetQty: r.unmetQty,
        }));
    } catch {
      shortages = null;
    }
  }
  const events = allowedOrderEvents(o.status);
  const manage = hasPermission(actor, 'repair-item:manage');
  return {
    ...toOrderDto(o, today),
    intakeId: o.intakeId,
    vehicleId: o.vehicleId,
    baseTotalVnd: o.baseTotalVnd,
    warehouseId: o.warehouseId,
    steps: o.steps,
    items: items.map((i) => toItemDto(i, now)),
    photos: toPhotoDtos(o.photos, hasPermission(actor, 'rec-photo:update')),
    supplements: o.supplements.map((s) => ({
      quoteId: s.quoteId,
      number: s.number,
      totalVnd: s.totalVnd,
      approvedAt: s.approvedAt.toISOString(),
    })),
    proposals: o.proposals.map((p) => ({
      id: p.id,
      title: p.title,
      note: p.note ?? null,
      status: p.status,
      proposedBy: p.proposedBy,
      proposedAt: p.proposedAt.toISOString(),
      quoteId: p.quoteId ?? null,
    })),
    qcRuns: o.qcRuns.map((r) => ({
      n: r.n,
      at: r.at.toISOString(),
      by: r.by,
      result: r.result,
      checks: r.checks.map((c) => ({ code: c.code, name: c.name, ok: c.ok, note: c.note ?? null })),
      returnedItemIds: r.returnedItemIds,
      note: r.note ?? null,
      invalidatedAt: r.invalidatedAt?.toISOString() ?? null,
    })),
    handover: o.handover
      ? {
          at: o.handover.at.toISOString(),
          by: o.handover.by,
          receiverName: o.handover.receiverName,
          km: o.handover.km ?? null,
          confirmation: o.handover.confirmation,
          paperRef: o.handover.paperRef ?? null,
          belongingsReturned: o.handover.belongingsReturned,
          oldPartsReturned: o.handover.oldPartsReturned,
          printCount: o.handover.printCount,
          payment: o.handover.payment ?? null,
        }
      : null,
    history: o.history.map((h) => ({
      from: h.from,
      to: h.to,
      event: h.event,
      at: h.at.toISOString(),
      by: h.by,
      reason: h.reason ?? null,
    })),
    partRequests: requests.map((r) => toPartRequestDto(r, o.plate)),
    allowed: {
      assign: manage && isOrderOpen(o.status),
      pause: events.includes('pause') && hasPermission(actor, 'repair-order:update'),
      resume: events.includes('resume') && hasPermission(actor, 'repair-order:update'),
      submitQc:
        events.includes('submit_qc') &&
        o.doneCount === o.itemCount &&
        hasPermission(actor, 'repair-order:update'),
      runQc: o.status === 'awaiting_qc' && hasPermission(actor, 'qc-record:create'),
      handover:
        o.status === 'ready_for_delivery' && hasPermission(actor, 'vehicle-handover:create'),
      // R42: the manager cancels any open order; the advisor only one still approved with no work started
      cancel:
        events.includes('cancel') &&
        (hasPermission(actor, 'repair-order:approve') ||
          (hasPermission(actor, 'repair-order:archive') &&
            o.status === 'approved' &&
            !o.startedAt &&
            items.every((i) => i.events.length === 0))),
      recheckParts:
        isOrderOpen(o.status) && o.unmetLines > 0 && hasPermission(actor, 'repair-order:update'),
      supplement: isOrderOpen(o.status) && hasPermission(actor, 'quote:create'),
      requestParts: isOrderOpen(o.status) && hasPermission(actor, 'part-request:create'),
      propose: isOrderOpen(o.status) && hasPermission(actor, 'work-proposal:create'),
    },
    shortages,
  };
}

// ---- order-level actions -------------------------------------------------------------------------------

const reasonSchema = z.object({
  version: z.number().int().min(1),
  reason: z.string().trim().min(3).max(300),
});
const versionOnly = z.object({ version: z.number().int().min(1) });

async function orderEventUseCase(
  deps: RecDeps,
  actor: Actor,
  id: string,
  event: 'pause' | 'resume',
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'repair-order:update');
  const data = parseInput(event === 'pause' ? reasonSchema : versionOnly, input) as {
    version: number;
    reason?: string;
  };
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/rec/orders/${id}/${event}`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ id, ...data }),
    },
    async (tx) => {
      const o = await deps.orders.getInTx(tx, scope, id);
      if (!o) throw notFound();
      if (o.version !== data.version) throw versionConflict();
      await assertWritable(deps, tx, actor, scope, o.branchId, 'edit_open_order');
      const t = transitionOrder(o.status, event);
      if (!t.ok) throw new AppError(t.reason, 409);
      const now = deps.sys.clock.now();
      deps.orders.update(tx, o.id, orderPatch(o, event, t.state, actor.userId, now, data.reason));
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: o.branchId,
          entityType: 'repairOrder',
          entityId: o.id,
          action: `repairOrder.${event}`,
          before: { status: o.status },
          after: { status: t.state },
          ...(data.reason ? { reason: data.reason } : {}),
        }),
      );
      return { status: 200, body: { id: o.id, status: t.state, version: o.version + 1 } };
    },
  );
}

export const pauseOrder = (
  deps: RecDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) => orderEventUseCase(deps, actor, id, 'pause', input, ctx);
export const resumeOrder = (
  deps: RecDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) => orderEventUseCase(deps, actor, id, 'resume', input, ctx);

/** FR-REC-016: all items done -> the order waits for the quality check. */
export async function submitForQc(
  deps: RecDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'repair-order:update');
  const data = parseInput(versionOnly, input);
  const qcStaff = await usersWithRole(
    deps.sys,
    actor.tenantId,
    ['QD', 'QL'],
    actor.workingBranchId,
  );
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/rec/orders/${id}/submit-qc`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ id, ...data }),
    },
    async (tx) => {
      const o = await deps.orders.getInTx(tx, scope, id);
      if (!o) throw notFound();
      if (o.version !== data.version) throw versionConflict();
      await assertWritable(deps, tx, actor, scope, o.branchId, 'edit_open_order');
      const t = transitionOrder(o.status, 'submit_qc', {
        hasItems: o.itemCount > 0,
        allItemsDone: o.doneCount === o.itemCount,
      });
      if (!t.ok) throw new AppError(t.reason, 409);
      const now = deps.sys.clock.now();
      deps.orders.update(tx, o.id, orderPatch(o, 'submit_qc', t.state, actor.userId, now));
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: o.branchId,
          entityType: 'repairOrder',
          entityId: o.id,
          action: 'repairOrder.submit_qc',
          before: { status: o.status },
          after: { status: t.state },
        }),
      );
      const to = qcStaff.filter((u) => u !== actor.userId);
      if (to.length)
        notifyUsers(deps.sys, tx, {
          tenantId: o.tenantId,
          userIds: to,
          kind: 'rec.order',
          titleKey: 'notifications.orderAwaitingQc',
          params: { number: o.number },
          link: `/rec/orders/${o.id}`,
          branchId: o.branchId,
        });
      return { status: 200, body: { id: o.id, status: t.state, version: o.version + 1 } };
    },
  );
}

// ---- re-check the stock holds ("Kiểm tra lại phụ tùng") ----------------------------------------------

/**
 * The shortage is stored as `unmetQty` on the hold. When stock arrives the advisor (or the manager) re-runs the
 * same idempotent hold (target semantics): what is available now is taken, the rest stays unmet. Items whose
 * parts are now all held and that never started go back to "not started" (event `parts_ready`).
 */
export async function recheckParts(
  deps: RecDeps,
  actor: Actor,
  id: string,
  ctx: RequestCtx,
): Promise<{ unmetLines: number; readyItems: number }> {
  const scope = resolveScope(actor, 'repair-order:update');
  const o0 = await deps.orders.get(scope, id);
  if (!o0) throw notFound();
  if (o0.branchId !== requireWorkingBranch(actor)) throw notFound();
  const items0 = await deps.items.listByOrder(scope, id, deps.rec.maxItemsPerOrder);
  const partLines = items0.flatMap((i) =>
    i.lines.filter((l) => l.kind === 'part' && l.partId && l.qty),
  );
  if (!o0.warehouseId || partLines.length === 0) return { unmetLines: 0, readyItems: 0 };
  return deps.sys.uow.run(async (tx) => {
    const o = await deps.orders.getInTx(tx, scope, id);
    if (!o || !isOrderOpen(o.status)) throw new AppError('order_state_invalid', 409);
    const hold = await prepareHoldForApproval(
      deps.inv,
      tx,
      actor,
      scope,
      {
        orderId: id,
        warehouseId: o.warehouseId!,
        lines: partLines.map((l) => ({ lineKey: l.lineKey, partId: l.partId!, qty: l.qty! })),
      },
      ctx,
    );
    const now = deps.sys.clock.now();
    const holds = hold.commit();
    const unmet = new Set(holds.filter((h) => h.unmetQty > 0).map((h) => h.lineKey));
    let ready = 0;
    for (const it of items0) {
      const waiting = it.lines.some((l) => unmet.has(l.lineKey));
      if (waiting === it.waitingParts) continue;
      const neverStarted = it.events.length === 0;
      const toReady =
        !waiting && it.status === 'paused' && it.pauseReason === 'waiting_parts' && neverStarted;
      if (toReady) ready += 1;
      deps.items.update(tx, it.id, {
        waitingParts: waiting,
        ...(toReady ? { status: 'not_started', pauseReason: null } : {}),
        updatedAt: now,
        updatedBy: actor.userId,
        version: it.version + 1,
      });
    }
    deps.orders.update(tx, id, {
      unmetLines: unmet.size,
      updatedAt: now,
      updatedBy: actor.userId,
      version: o.version + 1,
    });
    deps.sys.audit.record(
      tx,
      auditEntry(deps.sys, actor, ctx, {
        branchId: o.branchId,
        entityType: 'repairOrder',
        entityId: id,
        action: 'repairOrder.recheck_parts',
        before: { unmetLines: o.unmetLines },
        after: { unmetLines: unmet.size, readyItems: ready },
      }),
    );
    return { unmetLines: unmet.size, readyItems: ready };
  });
}

// ---- cancellation (FR-REC-021, RULE-007) ------------------------------------------------------------------

export const cancelOrderSchema = z.object({
  version: z.number().int().min(1),
  reason: z.string().trim().min(5).max(300),
});

/**
 * Cancels an order with a reason. Nothing issued yet: the advisor or the manager cancels and the holds are
 * released. Parts already issued: only a manager (`repair-order:approve`) and only when EVERY issued part has
 * been returned to stock with a posted return document (RTN against the issue), so no stock is left on a dead
 * order (FR-REC-021, RULE-009). The cancelled order keeps its number (R35).
 */
export async function cancelOrder(
  deps: RecDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const data = parseInput(cancelOrderSchema, input);
  const scopeAny = resolveScope(
    actor,
    hasPermission(actor, 'repair-order:archive') ? 'repair-order:archive' : 'repair-order:approve',
  );
  const o0 = await deps.orders.get(scopeAny, id);
  if (!o0) throw notFound();
  // R75 (FR-REC-021): the invoice comes first in the unwinding order (invoice, stock, deposit, order)
  await assertNoValidInvoice(deps, scopeAny, o0.id);
  // what has been issued and what came back, per line (INV is the source of truth)
  const issued = await issuedNet(deps, actor, o0);
  const mayApprove = hasPermission(actor, 'repair-order:approve');
  if (issued.everIssued && !mayApprove) throw new AppError('cancel_needs_manager', 409);
  // R42: an advisor cancels only an order still "approved" with no work started; anything else is the manager's
  if (!mayApprove) {
    const items0 = await deps.items.listByOrder(scopeAny, id, deps.rec.maxItemsPerOrder);
    if (o0.status !== 'approved' || o0.startedAt || items0.some((i) => i.events.length > 0))
      throw new AppError('cancel_needs_manager', 409);
  }
  if (issued.netIssuedQty > 0) throw new AppError('returns_pending', 409);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/rec/orders/${id}/cancel`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ id, ...data }),
    },
    async (tx) => {
      const o = await deps.orders.getInTx(tx, scopeAny, id);
      if (!o) throw notFound();
      if (o.version !== data.version) throw versionConflict();
      const t = transitionOrder(o.status, 'cancel');
      if (!t.ok)
        throw new AppError(
          t.reason === 'order_state_invalid' ? 'order_cancel_not_allowed' : t.reason,
          409,
        );
      await assertWritable(deps, tx, actor, scopeAny, o.branchId, 'edit_open_order');
      if (o.branchId !== requireWorkingBranch(actor)) throw notFound();
      // money taken for the order must be refunded or reversed first, or it would be left on a dead order (RULE-007)
      let paid: Awaited<ReturnType<RecDeps['payments']['balanceInTx']>>;
      try {
        paid = await deps.payments.balanceInTx(tx, scopeAny, o.id);
      } catch {
        throw new AppError('payment_check_unavailable', 409);
      }
      if (paid.receivedVnd > 0 || paid.depositHeldVnd > 0)
        throw new AppError('order_has_payments', 409);
      const release = o.warehouseId
        ? await prepareRelease(
            deps.inv,
            tx,
            actor,
            scopeAny,
            { sourceType: 'repair-order', sourceId: o.id, reason: 'order-cancelled' },
            ctx,
          )
        : null;
      const now = deps.sys.clock.now();
      const supplements = await prepareCloseSupplements(deps, tx, scopeAny, o);
      const items = await deps.items.listByOrderInTx(tx, scopeAny, o.id, deps.rec.maxItemsPerOrder);
      const requests = await deps.partRequests.listByOrderInTx(
        tx,
        scopeAny,
        o.id,
        deps.rec.maxPartRequestsPerOrder,
      );
      release?.commit();
      supplements.commit(actor, ctx, now);
      for (const it of items)
        deps.items.update(tx, it.id, {
          active: false,
          updatedAt: now,
          updatedBy: actor.userId,
          version: it.version + 1,
        });
      for (const r of requests.filter((x) => x.status === 'requested'))
        deps.partRequests.update(tx, r.id, {
          status: 'cancelled',
          decidedBy: actor.userId,
          decidedAt: now,
          updatedAt: now,
          updatedBy: actor.userId,
          version: r.version + 1,
        });
      deps.orders.update(tx, o.id, {
        ...orderPatch(o, 'cancel', t.state, actor.userId, now, data.reason),
        cancelledAt: now,
        cancelReason: data.reason,
      });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: o.branchId,
          entityType: 'repairOrder',
          entityId: o.id,
          action: 'repairOrder.cancel',
          before: { status: o.status },
          after: { status: t.state, everIssued: issued.everIssued },
          reason: data.reason,
        }),
      );
      const recipients = [o.advisorId].filter((u) => u !== actor.userId);
      if (recipients.length)
        notifyUsers(deps.sys, tx, {
          tenantId: o.tenantId,
          userIds: recipients,
          kind: 'rec.order',
          titleKey: 'notifications.orderCancelled',
          params: { number: o.number },
          link: `/rec/orders/${o.id}`,
          branchId: o.branchId,
        });
      return { status: 200, body: { id: o.id, status: t.state } };
    },
  );
}

/** R75: an order with a valid invoice cannot be cancelled until the invoice is cancelled or adjusted. Fail closed. */
async function assertNoValidInvoice(deps: RecDeps, scope: Scope, orderId: string): Promise<void> {
  let has: boolean;
  try {
    has = await deps.invoices.hasValidInvoice(scope, orderId);
  } catch {
    throw new AppError('invoice_check_unavailable', 409);
  }
  if (has) throw new AppError('order_has_valid_invoice', 409);
}

/** Issued minus returned, from INV: the issue documents REC made for the order plus the order's own holds. */
export async function issuedNet(
  deps: RecDeps,
  _actor: Actor,
  o: RepairOrder,
): Promise<{ everIssued: boolean; netIssuedQty: number }> {
  const scope = branchesScope(o.tenantId, [o.branchId]);
  const requests = await deps.partRequests.listByOrder(
    scope,
    o.id,
    deps.rec.maxPartRequestsPerOrder,
  );
  const docs = requests.flatMap((r) => (r.issueDocumentId ? [r.issueDocumentId] : []));
  const b = await orderIssueBalance(deps.inv, scope, o.id, docs);
  return {
    everIssued: b.reservationIssuedQty > 0 || b.documentIssuedQty > 0,
    netIssuedQty: b.netIssuedQty,
  };
}

export type { Tx, Branch };
export { versionId };
