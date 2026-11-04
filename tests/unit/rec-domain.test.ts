import { describe, expect, it } from 'vitest';
import {
  QUOTE_EVENTS,
  QUOTE_STATUSES,
  allowedIntakeActions,
  allowedQuoteActions,
  checkKm,
  computeTotals,
  discountBpOf,
  editMode,
  effectiveQuoteStatus,
  isQuoteExpired,
  standardHoursDelta,
  laborAmount,
  maxDiscountBp,
  partAmount,
  roundDiv,
  transitionIntake,
  transitionQuote,
  type QuoteItem,
  type QuoteLine,
  type QuoteEvent,
  type QuoteStatus,
} from '@/modules/rec';

/**
 * FR-REC-004 / 005 / 007 formulas and the quote + intake state machines. The VAT rate (800 bp) and
 * the amounts are SAMPLE values from the design pack (g2-quo, shared sample data), not accountant
 * sign-off examples; the rounding rules are [Cần xác nhận: Kế toán khách] (NFR-MNT-01).
 */
const line = (amountVnd: number, taxRateBp = 800): QuoteLine => ({
  kind: 'part',
  lineNo: 1,
  code: 'X',
  name: 'x',
  partId: 'p',
  qty: 1,
  qtyScale: 1,
  priceListCode: 'STD',
  priceVersionId: 'v',
  listUnitVnd: amountVnd,
  unitVnd: amountVnd,
  discountBp: 0,
  amountVnd,
  taxRateBp,
  taxKey: 'vat',
  taxVersionId: 'tax__vat__2026-10-01',
});
const item = (no: number, amounts: number[], selected: boolean, taxRateBp = 800): QuoteItem => ({
  no,
  name: `item ${no}`,
  necessity: 'optional',
  customerRequested: false,
  selected,
  lines: amounts.map((a) => line(a, taxRateBp)),
  subtotalVnd: amounts.reduce((s, a) => s + a, 0),
});

describe('rounding and line amounts (FR-REC-004, FR-REC-005)', () => {
  it('rounds half up on whole VND', () => {
    expect(roundDiv(1, 2)).toBe(1);
    expect(roundDiv(5, 10)).toBe(1);
    expect(roundDiv(4, 10)).toBe(0);
    expect(roundDiv(149_999, 100)).toBe(1500);
  });
  it('labor = standard minutes x hourly price / 60 (half an hour at 300.000 = 150.000)', () => {
    expect(laborAmount(30, 300_000)).toBe(150_000);
    expect(laborAmount(90, 300_000)).toBe(450_000);
    expect(laborAmount(45, 333_333)).toBe(250_000); // 249.999,75 rounds up
    expect(laborAmount(1, 100)).toBe(2); // 1,67 -> 2
  });
  it('part = qty x unit price / scale (I4)', () => {
    expect(partAmount(2, 130_000, 1)).toBe(260_000);
    expect(partAmount(500, 90_000, 1000)).toBe(45_000); // half a litre of a 90.000/l oil
  });
  it('rejects floats and negatives instead of rounding silently', () => {
    expect(() => laborAmount(30.5, 300_000)).toThrow();
    expect(() => partAmount(-1, 100, 1)).toThrow();
    expect(() => roundDiv(10, 0)).toThrow();
  });
});

describe('R5 labor minutes against the standard hours', () => {
  it('stores the signed gap in minutes and basis points and the flag', () => {
    expect(standardHoursDelta(30, 30)).toEqual({
      minutesDelta: 0,
      minutesDeltaBp: 0,
      differs: false,
    });
    expect(standardHoursDelta(45, 30)).toEqual({
      minutesDelta: 15,
      minutesDeltaBp: 5000,
      differs: true,
    });
    expect(standardHoursDelta(20, 30)).toEqual({
      minutesDelta: -10,
      minutesDeltaBp: -3333,
      differs: true,
    });
  });
});

describe('discount limit (FR-INV-025)', () => {
  it('computes the discount against the list price, rounded UP', () => {
    expect(discountBpOf(100_000, 100_000)).toBe(0);
    expect(discountBpOf(100_000, 95_000)).toBe(500);
    expect(discountBpOf(100_000, 94_999)).toBe(501); // 5,001% must not slip under a 5% limit
    expect(discountBpOf(100_000, 120_000)).toBe(0); // above list is not a discount
    expect(discountBpOf(0, 0)).toBe(0);
  });
  it('takes the highest limit among the actor roles; a role without an entry may not discount', () => {
    const limits = { CV: 500, QL: 1500 };
    expect(maxDiscountBp(limits, ['CV'])).toBe(500);
    expect(maxDiscountBp(limits, ['CV', 'QL'])).toBe(1500);
    expect(maxDiscountBp(limits, ['TN'])).toBe(0);
    expect(maxDiscountBp(null, ['CV'])).toBe(0);
  });
});

describe('quote totals (FR-REC-004, FR-REC-007, BA C6)', () => {
  const items = [
    item(1, [1_585_000], true),
    item(2, [1_070_000], true),
    item(3, [300_000], true),
    item(4, [650_000], false),
  ];
  it('matches the design sample: 3.605.000 + 8% = 3.893.400; ticked items 2.955.000 -> 3.191.400', () => {
    const t = computeTotals(items);
    expect(t.subtotalVnd).toBe(3_605_000);
    expect(t.taxVnd).toBe(288_400);
    expect(t.totalVnd).toBe(3_893_400);
    expect(t.selectedSubtotalVnd).toBe(2_955_000);
    expect(t.selectedTaxVnd).toBe(236_400);
    expect(t.selectedTotalVnd).toBe(3_191_400);
  });
  it('subtotal is before tax and before any order-level discount (the BA C6 "price")', () => {
    const t = computeTotals([item(1, [100_000, 50_000], true)]);
    expect(t.subtotalVnd).toBe(150_000);
    expect(t.totalVnd - t.taxVnd).toBe(t.subtotalVnd);
  });
  it('taxes once per rate on the sum, so many small lines do not drift', () => {
    // 3 lines of 1.250 at 8%: per line 100 each = 300, on the sum 3.750 x 8% = 300; with 1.255: 100,4 x3 vs 301,2
    const t = computeTotals([item(1, [1255, 1255, 1255], true)]);
    expect(t.taxVnd).toBe(301); // 3.765 x 0,08 = 301,2 -> 301 (per-line rounding would give 300)
  });
  it('supports mixed rates by grouping on the line rate', () => {
    const mixed = [item(1, [1_000_000], true, 800), item(2, [500_000], true, 0)];
    const t = computeTotals(mixed);
    expect(t.taxVnd).toBe(80_000);
    expect(t.totalVnd).toBe(1_580_000);
  });
  it('an empty quote totals zero', () => {
    expect(computeTotals([]).totalVnd).toBe(0);
  });
});

describe('quote state machine (separate from order/item/payment/invoice)', () => {
  const expected: Record<QuoteStatus, Partial<Record<QuoteEvent, QuoteStatus>>> = {
    draft: { send: 'sent' },
    sent: {
      approve_full: 'approved_full',
      approve_partial: 'approved_partial',
      reject: 'rejected',
      expire: 'expired',
    },
    approved_full: {},
    approved_partial: {},
    rejected: {},
    expired: {},
  };
  it.each(QUOTE_STATUSES.flatMap((s) => QUOTE_EVENTS.map((e) => [s, e] as const)))(
    'state %s on event %s follows the table',
    (state, event) => {
      const r = transitionQuote(state, event, { hasLines: true });
      const want = expected[state][event];
      if (want) expect(r).toEqual({ ok: true, state: want });
      else expect(r).toEqual({ ok: false, reason: 'state_invalid' });
    },
  );
  it('cannot send an empty quote', () => {
    expect(transitionQuote('draft', 'send', { hasLines: false })).toEqual({
      ok: false,
      reason: 'quote_empty',
    });
  });
  it('edit mode: draft in place, sent/rejected/expired next version, approved locked (ba-answers-03 Câu 1)', () => {
    expect(editMode('draft')).toBe('in_place');
    for (const s of ['sent', 'rejected', 'expired'] as const)
      expect(editMode(s)).toBe('new_version');
    for (const s of ['approved_full', 'approved_partial'] as const)
      expect(editMode(s)).toBe('locked');
  });
  it('R10: an expired quote cannot be approved, whatever the stored status says (FR-REC-011)', () => {
    for (const e of ['approve_full', 'approve_partial'] as const)
      expect(transitionQuote('sent', e, { expired: true })).toEqual({
        ok: false,
        reason: 'quote_expired',
      });
    expect(transitionQuote('sent', 'approve_full', { expired: false })).toMatchObject({ ok: true });
    expect(transitionQuote('sent', 'reject', { expired: true })).toMatchObject({ ok: true });
  });
  it('R10: expiry is derived from validUntil at read time, no job needed', () => {
    expect(isQuoteExpired('sent', '2026-11-10', '2026-11-10')).toBe(false); // the last day still counts
    expect(isQuoteExpired('sent', '2026-11-10', '2026-11-11')).toBe(true);
    expect(isQuoteExpired('draft', '2026-11-10', '2026-12-01')).toBe(false);
    expect(effectiveQuoteStatus('sent', '2026-11-10', '2026-11-11')).toBe('expired');
    expect(effectiveQuoteStatus('approved_full', '2026-11-10', '2026-11-11')).toBe('approved_full');
    expect(allowedQuoteActions('sent', true)).toEqual(['revise']);
  });
  it('actions allowed follow the state', () => {
    expect(allowedQuoteActions('draft')).toEqual(['edit', 'send']);
    expect(allowedQuoteActions('sent')).toEqual(['approve', 'link', 'reject', 'revise']);
    expect(allowedQuoteActions('approved_full')).toEqual([]);
  });
});

describe('intake state machine and km rule (FR-REC-002, FR-REC-003)', () => {
  it('draft completes or cancels; completed cancels only while no quote exists', () => {
    expect(transitionIntake('draft', 'complete')).toEqual({ ok: true, state: 'completed' });
    expect(transitionIntake('completed', 'cancel', {})).toEqual({ ok: true, state: 'cancelled' });
    expect(transitionIntake('completed', 'cancel', { hasQuote: true }).ok).toBe(false);
    expect(transitionIntake('cancelled', 'complete').ok).toBe(false);
    expect(allowedIntakeActions('completed', {})).toEqual(['cancel', 'quote']);
  });
  it('warns when below the last reading and requires a reason (C5)', () => {
    const base = { km: 43_000, lastKm: 43_900, abnormalDrop: 1000 };
    expect(checkKm({ ...base, km: 48_200 })).toEqual({ ok: true, below: false, abnormal: false });
    expect(checkKm(base)).toMatchObject({ ok: false, field: 'kmReason' });
    expect(checkKm({ ...base, reason: 'other', note: 'ab' })).toMatchObject({
      ok: false,
      field: 'kmNote',
    });
    expect(checkKm({ ...base, reason: 'typo' })).toEqual({
      ok: true,
      below: true,
      abnormal: false,
    });
  });
  it('flags a large drop as abnormal unless the odometer was replaced', () => {
    const base = { km: 30_000, lastKm: 43_900, abnormalDrop: 1000 };
    expect(checkKm({ ...base, reason: 'typo' })).toEqual({ ok: true, below: true, abnormal: true });
    expect(checkKm({ ...base, reason: 'odometer_replaced' })).toEqual({
      ok: true,
      below: true,
      abnormal: false,
    });
  });
  it('a first visit (no last reading) never warns', () => {
    expect(checkKm({ km: 10, lastKm: null, abnormalDrop: 1000 })).toEqual({
      ok: true,
      below: false,
      abnormal: false,
    });
  });
});
