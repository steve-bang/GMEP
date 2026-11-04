import { describe, expect, it } from 'vitest';
import {
  allowedQuoteActions,
  approvedLinesOf,
  computeTotals,
  decideApproval,
  lineKeyOf,
  splitGross,
  transitionQuote,
  type QuoteItem,
  type QuoteLine,
} from '@/modules/rec';
import { splitTaxByItems } from '@/platform/money/splitTax';

/**
 * FR-REC-007, 009, 026 approval maths and rules (RULE-005). VAT 8% (800 bp) and the amounts are SAMPLE
 * values, not accountant sign-off examples; the rounding rule is [Cần xác nhận: Kế toán khách] (NFR-MNT-01).
 */
const line = (
  no: number,
  amountVnd: number,
  taxRateBp = 800,
  kind: 'labor' | 'part' = 'part',
): QuoteLine =>
  kind === 'part'
    ? {
        kind: 'part',
        lineNo: no,
        code: `P${no}`,
        name: `Part ${no}`,
        partId: `p${no}`,
        qty: 1,
        qtyScale: 1,
        priceListCode: 'STD',
        priceVersionId: `price-v${no}`,
        listUnitVnd: amountVnd,
        unitVnd: amountVnd,
        discountBp: 0,
        amountVnd,
        taxRateBp,
        taxKey: 'vat',
        taxVersionId: 'tax-v1',
      }
    : {
        kind: 'labor',
        lineNo: no,
        code: `S${no}`,
        name: `Labor ${no}`,
        serviceId: `s${no}`,
        minutes: 60,
        standardMinutes: 60,
        minutesDelta: 0,
        minutesDeltaBp: 0,
        differsFromStandard: false,
        rateVersionId: 'rate-v1',
        hoursVersionId: 'hours-v1',
        listUnitVnd: amountVnd,
        unitVnd: amountVnd,
        discountBp: 0,
        amountVnd,
        taxRateBp,
        taxKey: 'vat',
        taxVersionId: 'tax-v1',
      };
const item = (
  no: number,
  necessity: 'required' | 'optional',
  lines: QuoteLine[],
  customerRequested = false,
): QuoteItem => ({
  no,
  name: `Item ${no}`,
  necessity,
  customerRequested,
  selected: necessity === 'required' || customerRequested,
  lines,
  subtotalVnd: lines.reduce((s, l) => s + l.amountVnd, 0),
});

// UAT-17 shape: four items, brakes refused
const items = [
  item(1, 'required', [line(1, 150_000, 800, 'labor'), line(2, 1_250_000), line(3, 185_000)]),
  item(2, 'required', [line(1, 450_000, 800, 'labor'), line(2, 620_000)]),
  item(3, 'optional', [line(1, 300_000, 800, 'labor')], true),
  item(4, 'optional', [line(1, 400_000, 800, 'labor'), line(2, 250_000)]),
];
const policy = { allowDeclineRequired: true, reasonCodes: new Set(['later', 'other']) };

describe('splitGross: item prices add up to the exact total (R1, FR-REC-009)', () => {
  it('UAT-17: tax is computed on the approved set, not prorated from the original total', () => {
    const all = splitGross(items);
    expect(all).toMatchObject({ netVnd: 3_605_000, taxVnd: 288_400, totalVnd: 3_893_400 });
    // same numbers as computeTotals: the screen total and the stored total never disagree
    expect(computeTotals(items)).toMatchObject({
      subtotalVnd: 3_605_000,
      taxVnd: 288_400,
      totalVnd: 3_893_400,
    });
    const part = splitGross([items[0]!, items[2]!]);
    expect(part).toMatchObject({ netVnd: 1_885_000, taxVnd: 150_800, totalVnd: 2_035_800 });
    expect(part.items.reduce((s, i) => s + i.grossVnd, 0)).toBe(part.totalVnd);
  });

  it('a remainder goes to the largest fractional share (ties: the lower item); the sum is exact', () => {
    // net 100 + 100 + 100 at 8%: tax 24 -> 8 each; at 3 x 101: 8% of 303 = 24.24 -> 24, shares 8.0 each
    const three = splitTaxByItems([
      { no: 1, lines: [{ amountVnd: 1, taxRateBp: 1000 }] },
      { no: 2, lines: [{ amountVnd: 1, taxRateBp: 1000 }] },
      { no: 3, lines: [{ amountVnd: 1, taxRateBp: 1000 }] },
    ]);
    // tax = round(0.3) = 0: nobody gets a unit
    expect(three.taxVnd).toBe(0);
    const odd = splitTaxByItems([
      { no: 1, lines: [{ amountVnd: 5, taxRateBp: 5000 }] },
      { no: 2, lines: [{ amountVnd: 5, taxRateBp: 5000 }] },
      { no: 3, lines: [{ amountVnd: 5, taxRateBp: 5000 }] },
    ]);
    // tax = round(7.5) = 8 over three equal items: 2 each plus the 2 leftover units to items 1 and 2
    expect(odd.items.map((i) => i.taxVnd)).toEqual([3, 3, 2]);
    expect(odd.taxVnd).toBe(8);
  });

  it('two tax rates: tax once per rate, split per rate', () => {
    const r = splitTaxByItems([
      { no: 1, lines: [{ amountVnd: 1_000_000, taxRateBp: 800 }] },
      { no: 2, lines: [{ amountVnd: 1_000_000, taxRateBp: 1000 }] },
    ]);
    expect(r.items.map((i) => i.taxVnd)).toEqual([80_000, 100_000]);
    expect(r.totalVnd).toBe(2_180_000);
  });

  it('property: for any amounts the shares sum to the exact tax and gross sums to the total', () => {
    let seed = 12345;
    const rnd = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    for (let t = 0; t < 300; t++) {
      const its = Array.from({ length: 1 + rnd(6) }, (_, i) => ({
        no: i + 1,
        lines: Array.from({ length: 1 + rnd(4) }, () => ({
          amountVnd: rnd(5_000_000),
          taxRateBp: [0, 500, 800, 1000][rnd(4)]!,
        })),
      }));
      const r = splitTaxByItems(its);
      const byRate = new Map<number, number>();
      for (const i of its)
        for (const l of i.lines)
          byRate.set(l.taxRateBp, (byRate.get(l.taxRateBp) ?? 0) + l.amountVnd);
      let expectTax = 0;
      for (const [bp, net] of byRate) expectTax += Math.floor((2 * net * bp + 10_000) / 20_000);
      expect(r.taxVnd).toBe(expectTax);
      expect(r.items.reduce((s, i) => s + i.grossVnd, 0)).toBe(r.totalVnd);
      for (const i of r.items) expect(i.taxVnd).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('decideApproval (FR-REC-009, ba-answers-03 Câu 2)', () => {
  it('everything ticked is a full approval', () => {
    const d = decideApproval(items, [1, 2, 3, 4], [], policy);
    expect(d).toMatchObject({ ok: true, mode: 'full' });
    if (d.ok) expect(d.declined).toEqual([]);
  });

  it('a refused required item needs a catalogue reason and carries the safety flag; an optional one does not', () => {
    const d = decideApproval(items, [1, 3], [{ itemNo: 2, reasonCode: 'later' }], policy);
    expect(d).toMatchObject({ ok: true, mode: 'partial' });
    if (!d.ok) return;
    expect(d.declined.map((x) => [x.itemNo, x.safety])).toEqual([
      [2, true],
      [4, false],
    ]);
    expect(d.split.totalVnd).toBe(2_035_800);
  });

  it('refusals are rejected with a precise reason', () => {
    expect(decideApproval(items, [], [], policy)).toMatchObject({
      ok: false,
      reason: 'nothing_selected',
    });
    expect(decideApproval(items, [9], [], policy)).toMatchObject({
      ok: false,
      reason: 'unknown_item',
    });
    expect(decideApproval(items, [1], [{ itemNo: 9 }], policy)).toMatchObject({
      ok: false,
      reason: 'unknown_item',
    });
    expect(decideApproval(items, [1, 3], [], policy)).toMatchObject({
      ok: false,
      reason: 'decline_reason_missing',
      itemNo: 2,
    });
    expect(
      decideApproval(items, [1, 3], [{ itemNo: 2, reasonCode: 'unknown' }], policy),
    ).toMatchObject({ ok: false, reason: 'decline_reason_missing' });
  });

  it('the branch can lock required items (Câu 2 config off)', () => {
    expect(
      decideApproval(items, [2, 3], [{ itemNo: 1, reasonCode: 'later' }], {
        ...policy,
        allowDeclineRequired: false,
      }),
    ).toMatchObject({ ok: false, reason: 'required_item_locked', itemNo: 1 });
    // only optional items left out: fine even when locked
    expect(
      decideApproval(items, [1, 2], [], { ...policy, allowDeclineRequired: false }),
    ).toMatchObject({
      ok: true,
      mode: 'partial',
    });
  });
});

describe('approved lines for the repair order (RULE-005/007, I20)', () => {
  it('only approved items flow on, each line with an immutable key, price version and tax key', () => {
    const lines = approvedLinesOf('qt_1', 2, [items[0]!, items[2]!]);
    expect(lines.map((l) => l.lineKey)).toEqual([
      'qt_1__v2#1.1',
      'qt_1__v2#1.2',
      'qt_1__v2#1.3',
      'qt_1__v2#3.1',
    ]);
    expect(lineKeyOf('qt_1', 2, 1, 1)).toBe(lines[0]!.lineKey);
    expect(lines[0]).toMatchObject({
      kind: 'labor',
      priceVersionId: 'rate-v1',
      hoursVersionId: 'hours-v1',
      taxKey: 'vat',
      taxVersionId: 'tax-v1',
    });
    expect(lines[1]).toMatchObject({
      kind: 'part',
      priceVersionId: 'price-v2',
      qty: 1,
      qtyScale: 1,
    });
  });
});

describe('quote approval state machine (FR-REC-009, RULE-005)', () => {
  it('approve_full and approve_partial only from sent; an expired quote cannot be approved', () => {
    for (const e of ['approve_full', 'approve_partial'] as const) {
      expect(transitionQuote('sent', e)).toMatchObject({ ok: true });
      for (const s of [
        'draft',
        'approved_full',
        'approved_partial',
        'rejected',
        'expired',
      ] as const)
        expect(transitionQuote(s, e)).toEqual({ ok: false, reason: 'state_invalid' });
      expect(transitionQuote('sent', e, { expired: true })).toEqual({
        ok: false,
        reason: 'quote_expired',
      });
    }
  });

  it('actions: approve and link only while sent and not expired; nothing once approved (content locked)', () => {
    expect(allowedQuoteActions('sent')).toEqual(['approve', 'link', 'reject', 'revise']);
    expect(allowedQuoteActions('sent', true)).toEqual(['revise']);
    expect(allowedQuoteActions('approved_partial')).toEqual([]);
  });
});
