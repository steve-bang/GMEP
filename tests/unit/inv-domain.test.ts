import { describe, expect, it } from 'vitest';
import {
  applyEffect,
  approvalReasons,
  assertTransition,
  availableOf,
  checkLines,
  checkSource,
  compatKey,
  costMethodOf,
  holdStatus,
  InvRuleError,
  issueStock,
  normalizePartCode,
  partCodeKey,
  PART_CODE_PATTERN,
  planHold,
  proportion,
  receiveStock,
  receiveValue,
  remainingDemand,
  RESERVATION_EVENTS,
  surplusValue,
  varianceBp,
  weightedAverage,
  type StockDocLine,
} from '@/modules/inv';

/**
 * INV domain rules. The cost examples are the ones the accountant must sign off (NFR-MNT-01);
 * until then they are SAMPLES: FR-INV-027 gives 10 x 100.000 + 20 x 120.000 -> about 113.333.
 */
const zero = { onHand: 0, reserved: 0, inTransit: 0, valueVnd: 0 };

describe('FR-INV-027 weighted average cost (sample cases, not yet signed off)', () => {
  it('10 x 100.000 then 20 x 120.000 gives 113.333 per unit (UAT-25)', () => {
    const a = receiveStock(zero, weightedAverage, 10, 100_000);
    expect(a.valueVnd).toBe(1_000_000);
    const b = receiveStock(a.next, weightedAverage, 20, 120_000);
    expect(b.next).toEqual({ onHand: 30, reserved: 0, inTransit: 0, valueVnd: 3_400_000 });
    expect(weightedAverage.unitCost(b.next)).toBe(113_333);
  });

  it('issues at the average, rounds half up, and issuing everything leaves no residue', () => {
    const s = { onHand: 30, reserved: 0, inTransit: 0, valueVnd: 3_400_000 };
    const one = issueStock(s, weightedAverage, 1);
    expect(one.unitCostVnd).toBe(113_333);
    expect(one.valueVnd).toBe(113_333);
    expect(one.next.valueVnd).toBe(3_400_000 - 113_333);
    const all = issueStock(s, weightedAverage, 30);
    expect(all.valueVnd).toBe(3_400_000);
    expect(all.next).toEqual(zero);
    // 2 of 3 units worth 100 -> 66,67 -> 67
    expect(weightedAverage.issue({ onHand: 3, valueVnd: 100 }, 2).valueVnd).toBe(67);
  });

  it('computes large values exactly (BigInt, no float drift)', () => {
    const big = { onHand: 999_999, valueVnd: 999_999_000_000 };
    expect(weightedAverage.issue(big, 333_333).valueVnd).toBe(333_333_000_000);
  });

  it('the method is looked up by code; an unknown code is refused', () => {
    expect(costMethodOf(undefined).code).toBe('weighted-average');
    expect(() => costMethodOf('fifo')).toThrow();
  });
});

describe('RULE-008 four numbers and negative-stock block (FR-INV-019, FR-INV-020)', () => {
  it('on-hand 20, reserved 5 -> available 15 (UAT-13)', () => {
    expect(availableOf({ onHand: 20, reserved: 5 })).toBe(15);
  });

  it('an issue beyond available is refused unless it consumes the source own hold', () => {
    const b = { onHand: 20, reserved: 5, inTransit: 0, valueVnd: 2_000_000 };
    expect(() => issueStock(b, weightedAverage, 16)).toThrow(InvRuleError);
    expect(issueStock(b, weightedAverage, 15).next.reserved).toBe(5);
    // the order holding 5 may take 20 (5 own hold + 15 available) but never more than on-hand
    expect(issueStock(b, weightedAverage, 20, 5).next.onHand).toBe(0);
    expect(() => issueStock(b, weightedAverage, 21, 5)).toThrow(InvRuleError);
  });

  it('applyEffect keeps onHand >= 0, 0 <= reserved <= onHand, no value residue', () => {
    const b = { onHand: 5, reserved: 3, inTransit: 0, valueVnd: 500 };
    expect(() => applyEffect(b, { onHand: -6 })).toThrow('stock_negative');
    expect(() => applyEffect(b, { onHand: -3, valueVnd: -300 })).toThrow('stock_insufficient');
    expect(() => applyEffect(b, { reserved: -4 })).toThrow('reservation_underflow');
    expect(() => applyEffect(b, { onHand: -5, reserved: -3 })).toThrow('stock_cost_residue');
    expect(() => applyEffect(b, { valueVnd: -501 })).toThrow('stock_cost_negative');
    expect(() => applyEffect(b, { onHand: 0.5 })).toThrow('stock_quantity_invalid');
  });
});

describe('FR-INV-020 reservation planning (target quantity semantics)', () => {
  const b = { onHand: 20, reserved: 5, inTransit: 0, valueVnd: 0 };
  it('holds the difference to the new target; fails whole when it does not fit', () => {
    expect(planHold(null, b, 10, false)).toEqual({
      heldDelta: 10,
      qty: 10,
      shortBy: 0,
      unmetQty: 0,
    });
    expect(planHold(null, b, 15, false).heldDelta).toBe(15);
    expect(() => planHold(null, b, 16, false)).toThrow('stock_insufficient');
  });
  it('asking again for the same total changes nothing (idempotent); a lower total releases', () => {
    const r = { qty: 4, issuedQty: 0, heldQty: 4 };
    expect(planHold(r, b, 4, false).heldDelta).toBe(0);
    expect(planHold(r, b, 1, false).heldDelta).toBe(-3);
  });
  it('already issued units count towards the total and cannot be taken back', () => {
    const r = { qty: 5, issuedQty: 3, heldQty: 2 };
    expect(planHold(r, b, 7, false).heldDelta).toBe(2); // 7 - 3 issued - 2 held
    expect(() => planHold(r, b, 2, false)).toThrow('reservation_below_issued');
  });
  it('I1: a partial hold takes what is available and STORES the shortage as unmet (no backorder)', () => {
    // the demand (qty) stays the approved total; held + unmet = remaining demand
    expect(planHold(null, b, 40, true)).toEqual({
      heldDelta: 15,
      qty: 40,
      shortBy: 25,
      unmetQty: 25,
    });
    expect(planHold(null, { ...b, reserved: 20 }, 3, true)).toEqual({
      heldDelta: 0,
      qty: 3,
      shortBy: 3,
      unmetQty: 3,
    });
  });
  it('I1: asking again after goods arrived holds the shortage; lowering the total shrinks unmet first', () => {
    const r = { qty: 40, issuedQty: 0, heldQty: 15 };
    const plenty = { onHand: 60, reserved: 15, inTransit: 0, valueVnd: 0 };
    expect(planHold(r, plenty, 40, true)).toMatchObject({ heldDelta: 25, unmetQty: 0 });
    expect(planHold(r, b, 20, true)).toMatchObject({ heldDelta: 5, unmetQty: 0 });
    expect(planHold(r, b, 10, true)).toMatchObject({ heldDelta: -5, unmetQty: 0 });
  });
  it('I3/I8: remaining demand = approved total minus issued', () => {
    expect(remainingDemand({ qty: 10, issuedQty: 4 })).toBe(6);
  });
  it('status follows the held and issued quantities', () => {
    expect(holdStatus({ heldQty: 2, issuedQty: 0 })).toBe('holding');
    expect(holdStatus({ heldQty: 0, issuedQty: 2 })).toBe('fulfilled');
    expect(holdStatus({ heldQty: 0, issuedQty: 0 })).toBe('released');
    // a line that only has unmet demand is still open
    expect(holdStatus({ heldQty: 0, issuedQty: 0, unmetQty: 3 })).toBe('holding');
  });
});

describe('FR-INV-021 / RULE-007 / RULE-010 document rules', () => {
  const line = (o: Partial<StockDocLine> = {}): StockDocLine => ({
    lineNo: 1,
    partId: 'p1',
    partCode: 'P1',
    partName: 'P',
    qty: 1,
    ...o,
  });

  it('a document is draft -> posted | cancelled and posted is final (no edit, no cancel)', () => {
    expect(() => assertTransition('draft', 'posted')).not.toThrow();
    expect(() => assertTransition('draft', 'cancelled')).not.toThrow();
    expect(() => assertTransition('posted', 'cancelled')).toThrow('state_invalid');
    expect(() => assertTransition('posted', 'draft')).toThrow('state_invalid');
    expect(() => assertTransition('cancelled', 'posted')).toThrow('state_invalid');
  });

  it('every type needs a recognised source; only no-po and opening need no reference (UAT-02)', () => {
    expect(() => checkSource('GIN', { type: 'manual', id: 'x' })).toThrow('source_invalid');
    expect(() => checkSource('GIN', { type: 'repair-order', id: null })).toThrow('source_required');
    expect(checkSource('GIN', { type: 'repair-order', id: 'ro1' })).toEqual({
      type: 'repair-order',
      id: 'ro1',
    });
    expect(checkSource('GRN', { type: 'no-po', id: 'ignored' }).id).toBeNull();
    expect(() => checkSource('RTN', { type: 'retail-sale', id: 'x' })).toThrow('source_invalid');
  });

  it('lines: quantity, cost and original line per type; opening balance cannot be negative', () => {
    expect(() => checkLines('GRN', [line({ qty: 2 })], { opening: false })).toThrow('line_invalid');
    expect(() =>
      checkLines('GRN', [line({ qty: 2, unitCostVnd: 5 })], { opening: false }),
    ).not.toThrow();
    expect(() => checkLines('GIN', [line({ qty: -1 })], { opening: false })).toThrow(
      'line_invalid',
    );
    expect(() => checkLines('RTN', [line()], { opening: false })).toThrow('line_invalid');
    expect(() => checkLines('ADJ', [line({ qty: -3 })], { opening: false })).not.toThrow();
    expect(() => checkLines('ADJ', [line({ qty: -3 })], { opening: true })).toThrow('line_invalid');
    // I5: a stocktake surplus may omit the price (average cost at posting); an opening balance may not
    expect(() => checkLines('ADJ', [line({ qty: 3 })], { opening: false })).not.toThrow();
    expect(() => checkLines('ADJ', [line({ qty: 3 })], { opening: true })).toThrow('line_invalid');
    expect(() =>
      checkLines('ADJ', [line({ qty: 3, unitCostVnd: 10 })], { opening: true }),
    ).not.toThrow();
    expect(() => checkLines('GRN', [], { opening: false })).toThrow('lines_required');
  });

  it('variance in basis points and the approval triggers (FR-INV-005)', () => {
    expect(varianceBp(105, 100)).toBe(500);
    expect(varianceBp(100, 100)).toBe(0);
    expect(varianceBp(1, 0)).toBeGreaterThan(10_000);
    const base = {
      priceVarianceBp: 500,
      qtyVarianceBp: 0,
      source: { type: 'purchase-order', id: 'po1' },
    };
    const grn = (l: Partial<StockDocLine>) => ({
      ...base,
      type: 'GRN' as const,
      lines: [line({ qty: 10, unitCostVnd: 100, expectedQty: 10, expectedUnitCostVnd: 100, ...l })],
    });
    expect(approvalReasons(grn({}))).toEqual([]);
    expect(approvalReasons(grn({ unitCostVnd: 105 }))).toEqual([]); // exactly at the threshold
    expect(approvalReasons(grn({ unitCostVnd: 106 }))).toEqual(['price_variance']);
    // I7: a SHORT receipt is a partial receipt (no approval); only receiving MORE than ordered needs one
    expect(approvalReasons(grn({ qty: 9 }))).toEqual([]);
    expect(approvalReasons(grn({ qty: 11 }))).toEqual(['quantity_variance']);
    expect(approvalReasons({ ...grn({ qty: 11 }), qtyVarianceBp: 1000 })).toEqual([]); // exactly 10% over, inside a 10% threshold
    expect(
      approvalReasons({
        ...base,
        type: 'GRN',
        source: { type: 'no-po', id: null },
        lines: [line()],
      }),
    ).toEqual(['no_purchase_order']);
    expect(approvalReasons({ ...base, type: 'ADJ', lines: [line()] })).toEqual(['adjustment']);
    expect(approvalReasons({ ...base, type: 'GIN', lines: [line()] })).toEqual([]);
  });
});

describe('FR-INV-001/002 part identity', () => {
  it('codes that differ only by case, spaces or separators are the same part', () => {
    expect(normalizePartCode(' 04152 yzza1 ')).toBe('04152YZZA1');
    expect(partCodeKey('04152-YZZA1')).toBe(partCodeKey('04152 yzza1'));
    expect(partCodeKey('LOC-DAU-01')).not.toBe(partCodeKey('LOC-DAU-02'));
  });
  it('vehicle line keys ignore diacritics and case', () => {
    expect(compatKey('Toyota', 'Vios')).toBe('toyota vios');
    expect(compatKey('', 'Đời Mới')).toBe('doi moi');
  });
});

describe('I5 cost values in whole dong (examples for the accountant, not yet signed off)', () => {
  const s = { onHand: 30, reserved: 0, inTransit: 0, valueVnd: 3_400_000 };
  it('issue 5 of 30 takes round(3.400.000 x 5 / 30) = 566.667; issuing the rest leaves exactly 0', () => {
    const a = issueStock(s, weightedAverage, 5);
    expect(a.valueVnd).toBe(566_667);
    expect(a.next.valueVnd).toBe(2_833_333);
    const b = issueStock(a.next, weightedAverage, 25);
    expect(b.valueVnd).toBe(2_833_333);
    expect(b.next).toEqual(zero);
  });
  it('a stocktake surplus defaults to the average cost computed from the stored value', () => {
    expect(surplusValue(weightedAverage, s, 3)).toBe(340_000);
    const r = receiveValue(s, 3, surplusValue(weightedAverage, s, 3));
    expect(r.next.valueVnd).toBe(3_740_000);
    expect(() => surplusValue(weightedAverage, zero, 3)).toThrow();
  });
  it('a return takes the issue value pro rata; cumulative parts add up to exactly the line value', () => {
    const line = 566_667; // issued 5
    const first = proportion(line, 2, 5) - proportion(line, 0, 5);
    const second = proportion(line, 5, 5) - proportion(line, 2, 5);
    expect(first).toBe(226_667);
    expect(first + second).toBe(line);
  });
});

describe('I12 part codes and BA-07 event table', () => {
  it('a manufacturer code may contain "/" but not spaces; 2-40 characters', () => {
    expect(PART_CODE_PATTERN.test(normalizePartCode('90915/YZZE1'))).toBe(true);
    expect(PART_CODE_PATTERN.test(normalizePartCode('A'))).toBe(false);
    expect(PART_CODE_PATTERN.test('AB CD')).toBe(false);
    expect(PART_CODE_PATTERN.test('/AB')).toBe(false);
  });
  it('the 23 rows are numbered and every INV-side row names the entry point that implements it', () => {
    expect(RESERVATION_EVENTS.map((e) => e.no)).toEqual(
      Array.from({ length: 23 }, (_, i) => i + 1),
    );
    for (const e of RESERVATION_EVENTS) if (e.side === 'inv') expect(e.by).toBeTruthy();
    expect(RESERVATION_EVENTS.find((e) => e.no === 22)?.side).toBe('later');
  });
});
