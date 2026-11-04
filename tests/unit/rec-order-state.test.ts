import { describe, expect, it } from 'vitest';
import {
  ITEM_EVENTS,
  ITEM_STATUSES,
  ITEM_TRANSITIONS,
  ORDER_EVENTS,
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  allowedItemEvents,
  allowedOrderEvents,
  transitionItem,
  transitionOrder,
  type ItemCtx,
  type OrderStatus,
} from '@/modules/rec';
import { checkUndo, itemSeedsOf, workedMsOf, type TimeEvent } from '@/modules/rec';

const T = (min: number) => new Date(Date.UTC(2026, 10, 4, 8, min));
const ev = (
  n: number,
  type: TimeEvent['type'],
  min: number,
  extra: Partial<TimeEvent> = {},
): TimeEvent => ({
  n,
  type,
  from: 'not_started',
  to: 'in_progress',
  at: T(min),
  by: 'u1',
  ...extra,
});

describe('FR-REC-015/028 repair order state machine', () => {
  it('every state x event pair is either in the table or rejected with order_state_invalid', () => {
    for (const from of ORDER_STATUSES)
      for (const e of ORDER_EVENTS) {
        const r = transitionOrder(from, e, { allItemsDone: true, hasItems: true });
        const to = ORDER_TRANSITIONS[from][e];
        if (to) expect(r).toEqual({ ok: true, state: to });
        else expect(r).toEqual({ ok: false, reason: 'order_state_invalid' });
      }
  });
  it('completed and cancelled are terminal', () => {
    for (const s of ['completed', 'cancelled'] as OrderStatus[])
      expect(allowedOrderEvents(s)).toEqual([]);
  });
  it('QC can only be requested when every item is done (FR-REC-016)', () => {
    expect(
      transitionOrder('in_progress', 'submit_qc', { allItemsDone: false, hasItems: true }),
    ).toEqual({
      ok: false,
      reason: 'items_not_done',
    });
    expect(
      transitionOrder('in_progress', 'submit_qc', { allItemsDone: true, hasItems: true }).ok,
    ).toBe(true);
  });
  it('FR-REC-021: cancellation only before the work is checked', () => {
    for (const s of ['approved', 'in_progress', 'paused'] as OrderStatus[])
      expect(transitionOrder(s, 'cancel').ok).toBe(true);
    for (const s of ['awaiting_qc', 'ready_for_delivery', 'completed'] as OrderStatus[])
      expect(transitionOrder(s, 'cancel').ok).toBe(false);
  });
  it('a failed QC returns the order to work; delivery needs a passed QC', () => {
    expect(transitionOrder('awaiting_qc', 'qc_fail')).toEqual({ ok: true, state: 'in_progress' });
    expect(transitionOrder('in_progress', 'deliver').ok).toBe(false);
    expect(transitionOrder('ready_for_delivery', 'deliver')).toEqual({
      ok: true,
      state: 'completed',
    });
  });
});

describe('FR-REC-028 repair item state machine, separate from the order', () => {
  const ctx = (o: Partial<ItemCtx> = {}): ItemCtx => ({
    orderStatus: 'in_progress',
    assigned: true,
    waitingParts: false,
    neverStarted: false,
    ...o,
  });
  it('every state x event pair follows the table (order in progress, technician set)', () => {
    for (const from of ITEM_STATUSES)
      for (const e of ITEM_EVENTS) {
        const r = transitionItem(
          from,
          e,
          ctx(e === 'return' ? { orderStatus: 'awaiting_qc' } : { neverStarted: true }),
        );
        const to = ITEM_TRANSITIONS[from][e];
        expect(r.ok).toBe(to !== undefined);
        if (r.ok) expect(r.state).toBe(to);
      }
  });
  it('FR-REC-012: an item without a technician cannot start', () => {
    expect(transitionItem('not_started', 'start', ctx({ assigned: false }))).toEqual({
      ok: false,
      reason: 'technician_missing',
    });
  });
  it('an item waiting for parts cannot start (Journey step 5)', () => {
    expect(transitionItem('paused', 'start', ctx({ waitingParts: true }))).toEqual({
      ok: false,
      reason: 'waiting_parts',
    });
    expect(transitionItem('paused', 'parts_ready', ctx({ neverStarted: true })).ok).toBe(true);
  });
  it('the item machine does not move the order, and a paused or finished order refuses item work', () => {
    expect(transitionItem('not_started', 'start', ctx({ orderStatus: 'paused' }))).toEqual({
      ok: false,
      reason: 'order_paused',
    });
    expect(
      transitionItem('not_started', 'start', ctx({ orderStatus: 'ready_for_delivery' })).ok,
    ).toBe(false);
    expect(transitionItem('not_started', 'start', ctx({ orderStatus: 'cancelled' })).ok).toBe(
      false,
    );
    expect(allowedItemEvents('in_progress', ctx())).toEqual(['pause', 'finish']);
  });
  it('QC can return a done item only while the order awaits the check', () => {
    expect(transitionItem('done', 'return', ctx({ orderStatus: 'awaiting_qc' }))).toEqual({
      ok: true,
      state: 'returned',
    });
    expect(transitionItem('done', 'return', ctx()).ok).toBe(false);
    expect(transitionItem('returned', 'start', ctx()).ok).toBe(true);
  });
});

describe('FR-REC-013 hours from the time events', () => {
  it('worked time is the sum of the closed segments; an open segment counts until now', () => {
    const events = [
      ev(1, 'start', 0),
      ev(2, 'pause', 30, { from: 'in_progress', to: 'paused' }),
      ev(3, 'start', 40, { from: 'paused' }),
      ev(4, 'finish', 100, { from: 'in_progress', to: 'done' }),
    ];
    expect(workedMsOf(events)).toBe((30 + 60) * 60_000);
    expect(workedMsOf([ev(1, 'start', 0)], T(15))).toBe(15 * 60_000);
    expect(workedMsOf([ev(1, 'start', 0)])).toBe(0);
  });
  it('an undone event does not count', () => {
    const events = [
      ev(1, 'start', 0),
      ev(2, 'finish', 10, { from: 'in_progress', to: 'done', undone: true }),
      ev(3, 'undo', 11, { from: 'done', to: 'in_progress' }),
      ev(4, 'finish', 50, { from: 'in_progress', to: 'done' }),
    ];
    expect(workedMsOf(events)).toBe(50 * 60_000);
  });
  it('undo: only the latest event, by the same person, within the window', () => {
    const events = [ev(1, 'start', 0), ev(2, 'finish', 10, { from: 'in_progress', to: 'done' })];
    expect(checkUndo(events, T(11), 'u1', 120_000).ok).toBe(true);
    expect(checkUndo(events, T(11), 'u2', 120_000)).toEqual({
      ok: false,
      reason: 'undo_not_yours',
    });
    expect(checkUndo(events, T(15), 'u1', 120_000)).toEqual({
      ok: false,
      reason: 'undo_window_passed',
    });
    expect(checkUndo([], T(1), 'u1', 1000)).toEqual({ ok: false, reason: 'nothing_to_undo' });
  });
});

describe('RULE-005 items of an order come only from approved lines', () => {
  it('groups approved lines by quote item, keeps the order and sums the amounts', () => {
    const l = (
      itemNo: number,
      lineNo: number,
      kind: 'labor' | 'part',
      amountVnd: number,
      minutes?: number,
    ) => ({
      lineKey: `q__v1_${itemNo}_${lineNo}`,
      itemNo,
      itemName: `Item ${itemNo}`,
      lineNo,
      kind,
      code: 'c',
      name: 'n',
      unitVnd: 1,
      amountVnd,
      taxKey: 'vat',
      taxVersionId: 'v',
      taxRateBp: 800,
      priceVersionId: 'p',
      ...(minutes ? { minutes } : {}),
    });
    const seeds = itemSeedsOf(
      [l(3, 1, 'labor', 100, 30), l(1, 1, 'labor', 200, 60), l(1, 2, 'part', 50)],
      (n) => (n === 1 ? 'required' : 'optional'),
    );
    expect(
      seeds.map((s) => [s.sourceItemNo, s.subtotalVnd, s.approvedMinutes, s.necessity]),
    ).toEqual([
      [1, 250, 60, 'required'],
      [3, 100, 30, 'optional'],
    ]);
  });
});
