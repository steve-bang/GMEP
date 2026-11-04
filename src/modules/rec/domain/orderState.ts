/**
 * State machines of the repair order (lệnh sửa chữa, FR-REC-015) and the repair item (hạng mục sửa chữa,
 * FR-REC-028). They are SEPARATE objects with SEPARATE state sets, and separate from the quote, the payment
 * and the invoice (RULE-005/006): changing an item never moves the order except through an explicit order
 * event with its own guard. Pure functions, no I/O; the tables are the source of `actions.allowed`.
 */

export type OrderStatus =
  | 'approved'
  | 'in_progress'
  | 'paused'
  | 'awaiting_qc'
  | 'ready_for_delivery'
  | 'completed'
  | 'cancelled';
export const ORDER_STATUSES: readonly OrderStatus[] = [
  'approved',
  'in_progress',
  'paused',
  'awaiting_qc',
  'ready_for_delivery',
  'completed',
  'cancelled',
];
export const OPEN_ORDER_STATUSES: readonly OrderStatus[] = [
  'approved',
  'in_progress',
  'paused',
  'awaiting_qc',
  'ready_for_delivery',
];
export const isOrderOpen = (s: OrderStatus): boolean => OPEN_ORDER_STATUSES.includes(s);

export type OrderEvent =
  | 'start'
  | 'pause'
  | 'resume'
  | 'submit_qc'
  | 'qc_pass'
  | 'qc_fail'
  | 'deliver'
  | 'cancel'
  | 'reopen';
export const ORDER_EVENTS: readonly OrderEvent[] = [
  'start',
  'pause',
  'resume',
  'submit_qc',
  'qc_pass',
  'qc_fail',
  'deliver',
  'cancel',
  'reopen',
];

export interface OrderCtx {
  /** every item is done (or the order has none left to do) */
  allItemsDone?: boolean;
  /** at least one item exists */
  hasItems?: boolean;
}

export type OrderTransition = { ok: true; state: OrderStatus } | { ok: false; reason: string };

/** {from -> event -> to}; guards below. `reopen` = extra approved work was added after the work was finished. */
export const ORDER_TRANSITIONS: Readonly<
  Record<OrderStatus, Partial<Record<OrderEvent, OrderStatus>>>
> = {
  approved: { start: 'in_progress', cancel: 'cancelled' },
  in_progress: { pause: 'paused', submit_qc: 'awaiting_qc', cancel: 'cancelled' },
  paused: { resume: 'in_progress', cancel: 'cancelled' },
  awaiting_qc: { qc_pass: 'ready_for_delivery', qc_fail: 'in_progress', reopen: 'in_progress' },
  ready_for_delivery: { deliver: 'completed', reopen: 'in_progress' },
  completed: {},
  cancelled: {},
};

export function transitionOrder(
  from: OrderStatus,
  event: OrderEvent,
  ctx: OrderCtx = {},
): OrderTransition {
  const to = ORDER_TRANSITIONS[from][event];
  if (!to) return { ok: false, reason: 'order_state_invalid' };
  if (event === 'submit_qc' && (ctx.hasItems === false || ctx.allItemsDone !== true))
    return { ok: false, reason: 'items_not_done' };
  return { ok: true, state: to };
}

export const allowedOrderEvents = (from: OrderStatus): OrderEvent[] =>
  ORDER_EVENTS.filter((e) => ORDER_TRANSITIONS[from][e] !== undefined);

// ---- repair item ---------------------------------------------------------------------------------

export type ItemStatus = 'not_started' | 'in_progress' | 'paused' | 'done' | 'returned';
export const ITEM_STATUSES: readonly ItemStatus[] = [
  'not_started',
  'in_progress',
  'paused',
  'done',
  'returned',
];
/** items still to be worked on (the technician's list) */
export const ACTIVE_ITEM_STATUSES: readonly ItemStatus[] = [
  'not_started',
  'in_progress',
  'paused',
  'returned',
];

export type ItemEvent = 'start' | 'pause' | 'finish' | 'return' | 'parts_ready';
export const ITEM_EVENTS: readonly ItemEvent[] = [
  'start',
  'pause',
  'finish',
  'return',
  'parts_ready',
];

/**
 * R41: stable codes. `awaiting_supplement_approval` ("chờ khách duyệt thêm") is the fifth, tied to the supplementary
 * quote (RULE-006) and to the waiting-time report; `awaiting_parts` is the only code that puts the vehicle in the
 * "waiting for parts" column (FR-REC-022). `other` needs a note. Labels come from the UI strings.
 */
export const PAUSE_REASONS = [
  'waiting_parts',
  'waiting_customer',
  'awaiting_supplement_approval',
  'break',
  'other',
] as const;
export type PauseReason = (typeof PAUSE_REASONS)[number];

export interface ItemCtx {
  /** the order the item belongs to */
  orderStatus: OrderStatus;
  /** a technician is assigned (FR-REC-012: exactly one main technician per item) */
  assigned: boolean;
  /** a part line of the item still has unmet demand (stock hold short) */
  waitingParts: boolean;
  /** the item was never started (initial wait for parts) */
  neverStarted: boolean;
}

export type ItemTransition = { ok: true; state: ItemStatus } | { ok: false; reason: string };

export const ITEM_TRANSITIONS: Readonly<
  Record<ItemStatus, Partial<Record<ItemEvent, ItemStatus>>>
> = {
  not_started: { start: 'in_progress' },
  in_progress: { pause: 'paused', finish: 'done' },
  paused: { start: 'in_progress', parts_ready: 'not_started' },
  done: { return: 'returned' },
  returned: { start: 'in_progress' },
};

/** Order states in which technicians may work on items. A paused order must be resumed first. */
const WORKABLE_ORDER: readonly OrderStatus[] = ['approved', 'in_progress'];

export function transitionItem(from: ItemStatus, event: ItemEvent, ctx: ItemCtx): ItemTransition {
  const to = ITEM_TRANSITIONS[from][event];
  if (!to) return { ok: false, reason: 'item_state_invalid' };
  if (event === 'return') {
    // QC sends work back while the order awaits the check
    if (ctx.orderStatus !== 'awaiting_qc') return { ok: false, reason: 'order_not_active' };
    return { ok: true, state: to };
  }
  if (!WORKABLE_ORDER.includes(ctx.orderStatus))
    return {
      ok: false,
      reason: ctx.orderStatus === 'paused' ? 'order_paused' : 'order_not_active',
    };
  if (event === 'parts_ready') {
    if (!ctx.neverStarted || ctx.waitingParts) return { ok: false, reason: 'waiting_parts' };
    return { ok: true, state: to };
  }
  if (event === 'start') {
    if (!ctx.assigned) return { ok: false, reason: 'technician_missing' };
    if (ctx.waitingParts) return { ok: false, reason: 'waiting_parts' };
  }
  return { ok: true, state: to };
}

export const allowedItemEvents = (from: ItemStatus, ctx: ItemCtx): ItemEvent[] =>
  ITEM_EVENTS.filter((e) => transitionItem(from, e, ctx).ok);
