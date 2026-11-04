import { describe, expect, it } from 'vitest';
import {
  buildAdjustmentContent,
  buildInvoiceContent,
  checkEligibility,
  DEFAULT_ELIGIBILITY_POLICY,
  INVOICE_STATUSES,
  INVOICE_TRANSITIONS,
  isValidTaxCode,
  mergeBuyer,
  mustQueryFirst,
  nextAttemptDelayMinutes,
  REQUEST_STATUSES,
  REQUEST_TRANSITIONS,
  transitionInvoice,
  transitionRequest,
  type EligibilityInput,
  type RequestEvent,
  type SourceLine,
} from '@/modules/ein';

/**
 * Slice 1.8 domain rules: FR-EIN-001/002 (buyer), 007 (corrections), 010/013 (request states, no resend before asking),
 * 011 (eligibility list), RULE-005 (invoice total = order total). Pure, no I/O.
 */

const line = (over: Partial<SourceLine> = {}): SourceLine => ({
  sourceKey: 'base',
  lineKey: 'k',
  kind: 'labor',
  code: 'SV',
  name: 'Công',
  amountVnd: 100_000,
  taxKey: 'vat',
  taxVersionId: 'tax-rate__vat__2026-01-01',
  taxRateBp: 800,
  ...over,
});

describe('invoice state machine (FR-EIN-005, 007)', () => {
  it('lists every allowed move and rejects every other pair of state x event', () => {
    const events = ['provider_issued', 'provider_cancelled', 'request_cancelled'] as const;
    for (const from of INVOICE_STATUSES)
      for (const event of events) {
        const allowed = INVOICE_TRANSITIONS.find((t) => t.from === from && t.event === event);
        const r = transitionInvoice(from, event);
        expect(r.ok, `${from} --${event}-->`).toBe(!!allowed);
        if (r.ok) expect(r.to).toBe(allowed!.to);
      }
  });
  it('a cancelled or abandoned invoice never moves again (RULE-010: no editing a posted document)', () => {
    for (const from of ['cancelled', 'abandoned'] as const)
      for (const e of ['provider_issued', 'provider_cancelled', 'request_cancelled'] as const)
        expect(transitionInvoice(from, e).ok).toBe(false);
  });
});

describe('request state machine (FR-EIN-010, 013)', () => {
  const events: RequestEvent[] = [
    'claim',
    'provider_ok',
    'provider_processing',
    'provider_timeout',
    'provider_unavailable',
    'provider_rejected',
    'provider_data_error',
    'query_not_found',
    'fix_data',
    'release',
    'lease_expired',
    'cancel',
  ];
  it('every state x event pair is either in the table or rejected', () => {
    for (const from of REQUEST_STATUSES)
      for (const event of events) {
        const row = REQUEST_TRANSITIONS.find((t) => t.from === from && t.event === event);
        expect(transitionRequest(from, event).ok, `${from} --${event}-->`).toBe(!!row);
      }
  });
  it('a data error cannot be claimed again until the data is fixed (the retry button is locked with a reason)', () => {
    expect(transitionRequest('failed_data', 'claim').ok).toBe(false);
    expect(transitionRequest('failed_data', 'fix_data')).toEqual({ ok: true, to: 'pending' });
  });
  it('final states never move', () => {
    for (const from of ['succeeded', 'cancelled'] as const)
      for (const e of events) expect(transitionRequest(from, e).ok, `${from} ${e}`).toBe(false);
  });
  it('FR-EIN-013: after a timeout, an earlier attempt or an async answer the provider is asked before any resend', () => {
    expect(mustQueryFirst({ status: 'pending', attemptCount: 0 })).toBe(false);
    expect(mustQueryFirst({ status: 'pending', attemptCount: 1 })).toBe(true);
    expect(mustQueryFirst({ status: 'unknown', attemptCount: 1 })).toBe(true);
    expect(mustQueryFirst({ status: 'awaiting_provider', attemptCount: 1 })).toBe(true);
  });
  it('backoff follows the configured list and stays on its last value', () => {
    const list = [5, 15, 60];
    expect([1, 2, 3, 4, 9].map((n) => nextAttemptDelayMinutes(n, list))).toEqual([
      5, 15, 60, 60, 60,
    ]);
  });
});

/**
 * TAX EXAMPLE TABLE - PENDING ACCOUNTANT SIGN-OFF (NFR-MNT-01). The numbers below are sample rows chosen by the developer
 * to pin the CURRENT rule (tax once per rate and per approval, half up, summed per rate). They are NOT signed by the
 * client's accountant, so they prove consistency with the quote maths, not legal correctness.
 * [Cần xác nhận: Kế toán khách] (rounding per rate vs per line; 8% vs 10%; the 1/1/2027 rule).
 */
describe('invoice amounts from approved lines (FR-EIN-001, RULE-005) [unsigned sample table]', () => {
  const table: {
    name: string;
    lines: Partial<SourceLine>[];
    net: number;
    tax: number;
    total: number;
    rows: number;
  }[] = [
    {
      name: 'one rate 8%',
      lines: [{ amountVnd: 1_000_000 }, { amountVnd: 250_000 }],
      net: 1_250_000,
      tax: 100_000,
      total: 1_350_000,
      rows: 1,
    },
    {
      name: 'half VND rounds up per rate (8% of 6.250 = 500)',
      lines: [{ amountVnd: 6_250 }],
      net: 6_250,
      tax: 500,
      total: 6_750,
      rows: 1,
    },
    {
      name: 'rounding up (8% of 1.234 = 98,72 -> 99)',
      lines: [{ amountVnd: 1_234 }],
      net: 1_234,
      tax: 99,
      total: 1_333,
      rows: 1,
    },
    {
      name: 'two rates (8% and 10%) stay on their own rows',
      lines: [{ amountVnd: 500_000 }, { amountVnd: 300_000, taxRateBp: 1000, taxKey: 'vat10' }],
      net: 800_000,
      tax: 70_000,
      total: 870_000,
      rows: 2,
    },
    {
      name: 'a supplementary approval is taxed on its own (two roundings, summed)',
      lines: [{ amountVnd: 1_234 }, { amountVnd: 1_234, sourceKey: 'supp1' }],
      net: 2_468,
      tax: 198, // 99 + 99, not round(2468 * 8%) = 197
      total: 2_666,
      rows: 1,
    },
    {
      name: 'zero-rated line',
      lines: [{ amountVnd: 90_000, taxRateBp: 0 }],
      net: 90_000,
      tax: 0,
      total: 90_000,
      rows: 1,
    },
  ];
  it.each(table)('$name', (t) => {
    const b = buildInvoiceContent(
      t.lines.map((l) => line(l)),
      'per-rate',
      'Dịch vụ',
    );
    expect([b.netVnd, b.taxVnd, b.totalVnd, b.taxSummary.length]).toEqual([
      t.net,
      t.tax,
      t.total,
      t.rows,
    ]);
    expect(b.lines).toHaveLength(t.rows);
    // the invariants that hold for ANY rule
    expect(b.totalVnd).toBe(b.netVnd + b.taxVnd);
    expect(b.taxSummary.reduce((s, r) => s + r.netVnd, 0)).toBe(b.netVnd);
  });
  it('per-line mode keeps one invoice line per approved line and the same totals', () => {
    const lines = [
      line({ amountVnd: 10_000 }),
      line({ amountVnd: 20_000, name: 'Phụ tùng', kind: 'part' }),
    ];
    const per = buildInvoiceContent(lines, 'per-line', 'x');
    const agg = buildInvoiceContent(lines, 'per-rate', 'x');
    expect(per.lines).toHaveLength(2);
    expect(per.totalVnd).toBe(agg.totalVnd);
  });
  it('the tax key and version stored on the line travel to the invoice (R2), nothing is looked up again', () => {
    const b = buildInvoiceContent([line({ taxKey: 'vat', taxVersionId: 'v-1' })], 'per-rate', 'x');
    expect(b.lines[0]).toMatchObject({ taxKey: 'vat', taxVersionId: 'v-1', rateBp: 800 });
  });
  it('an adjustment keeps the sign: a reduction has negative net and tax', () => {
    const b = buildAdjustmentContent([
      { description: 'Giảm công', netVnd: -100_000, taxKey: 'vat', taxVersionId: 'v', rateBp: 800 },
    ]);
    expect([b.netVnd, b.taxVnd, b.totalVnd]).toEqual([-100_000, -8_000, -108_000]);
  });
});

describe('eligibility (FR-EIN-011, FR-EIN-002): every blocking issue is listed, nothing is sent while one exists', () => {
  const ok = (): EligibilityInput => {
    const lines = [line()];
    const built = buildInvoiceContent(lines, 'per-rate', 'x');
    return {
      providerActive: true,
      issuerComplete: true,
      order: {
        status: 'ready_for_delivery',
        qcPassed: true,
        completed: false,
        cancelled: false,
        totalVnd: built.totalVnd,
        hasLines: true,
      },
      buyer: { kind: 'retail', name: 'Nguyễn Văn An' },
      lines,
      built,
      existing: 'none',
      currentRates: new Map([['vat', 800]]),
      policy: DEFAULT_ELIGIBILITY_POLICY,
    };
  };
  const codes = (i: EligibilityInput) => checkEligibility(i).issues.map((x) => x.code);
  it('a complete order passes', () =>
    expect(checkEligibility(ok())).toMatchObject({ ok: true, issues: [] }));
  it('no provider activated blocks everything', () =>
    expect(codes({ ...ok(), providerActive: false })).toContain('provider_not_activated'));
  it('the order must have passed the quality check; a cancelled order never', () => {
    expect(codes({ ...ok(), order: { ...ok().order, qcPassed: false } })).toContain(
      'order_not_eligible',
    );
    expect(codes({ ...ok(), order: { ...ok().order, cancelled: true } })).toContain(
      'order_cancelled',
    );
  });
  it('the policy can require the handover first', () => {
    const i = {
      ...ok(),
      policy: { ...DEFAULT_ELIGIBILITY_POLICY, issueAfter: 'handover' as const },
    };
    expect(codes(i)).toContain('order_not_eligible');
    expect(codes({ ...i, order: { ...i.order, completed: true } })).not.toContain(
      'order_not_eligible',
    );
  });
  it('FR-EIN-002: a business buyer needs a tax code, a valid one and an address', () => {
    const biz = { ...ok(), buyer: { kind: 'business' as const, name: 'Công ty TNHH A' } };
    expect(codes(biz)).toEqual(
      expect.arrayContaining(['buyer_tax_code_missing', 'buyer_address_missing']),
    );
    expect(
      codes({ ...biz, buyer: { ...biz.buyer, taxCode: '12345', address: '45 Lê Lợi, Quận 1' } }),
    ).toContain('buyer_tax_code_invalid');
    expect(
      codes({
        ...biz,
        buyer: { ...biz.buyer, taxCode: '0312345678', address: '45 Lê Lợi, Quận 1' },
      }),
    ).toEqual([]);
  });
  it('every issue points at the form field to fix', () => {
    const r = checkEligibility({ ...ok(), buyer: { kind: 'business', name: '' } });
    expect(r.issues.map((x) => [x.code, x.field])).toEqual(
      expect.arrayContaining([
        ['buyer_name_missing', 'name'],
        ['buyer_tax_code_missing', 'taxCode'],
        ['buyer_address_missing', 'address'],
      ]),
    );
  });
  it('RULE-005: the invoice total must equal the order total', () =>
    expect(
      codes({ ...ok(), order: { ...ok().order, totalVnd: ok().order.totalVnd + 1 } }),
    ).toContain('invoice_total_mismatch'));
  it('a line without tax key, version or a sane rate blocks (the tax comes from the stored line)', () => {
    expect(codes({ ...ok(), lines: [line({ taxKey: '' })] })).toContain('tax_missing');
    expect(codes({ ...ok(), lines: [line({ taxVersionId: '' })] })).toContain('tax_missing');
    expect(codes({ ...ok(), lines: [line({ taxRateBp: 12_000 })] })).toContain('tax_missing');
  });
  it('a tax rate that changed since the quote is a WARNING by default (the accountant decides), a stop when the policy says so', () => {
    const i = { ...ok(), currentRates: new Map([['vat', 1000]]) };
    const r = checkEligibility(i);
    expect(r.ok).toBe(true);
    expect(r.warnings).toEqual([
      { code: 'tax_rate_changed', taxKey: 'vat', quotedRateBp: 800, currentRateBp: 1000 },
    ]);
    expect(
      codes({ ...i, policy: { ...DEFAULT_ELIGIBILITY_POLICY, taxChangePolicy: 'block' } }),
    ).toContain('tax_rate_changed');
  });
  it('FR-EIN-013: an existing valid invoice or an open request blocks a second one', () => {
    expect(codes({ ...ok(), existing: 'valid_invoice' })).toContain('already_invoiced');
    expect(codes({ ...ok(), existing: 'open_request' })).toContain('request_in_progress');
  });
  it('tax code format: 10 digits or 10-3 digits', () => {
    expect(['0312345678', '0312345678-001'].map(isValidTaxCode)).toEqual([true, true]);
    expect(['031234567', '03123456789', 'abc', '0312345678-1'].map(isValidTaxCode)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });
  it('the buyer form overrides the customer record field by field', () => {
    const b = mergeBuyer(
      { kind: 'retail', name: 'An', address: 'Cũ' },
      { kind: 'business', name: 'Công ty A', taxCode: '0312345678' },
    );
    expect(b).toMatchObject({
      kind: 'business',
      name: 'Công ty A',
      taxCode: '0312345678',
      address: 'Cũ',
    });
  });
});
