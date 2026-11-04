import type { Necessity, QuoteItem, QuoteTotals } from './entities';

/**
 * Money and quantity maths for quotes (FR-REC-004, FR-REC-005; NFR-MNT-01). Every function is pure
 * and works on integers: VND amounts, minutes, basis points. The ROUNDING choices below are
 * [Cần xác nhận: Kế toán khách] and are tested with examples the accountant must sign off:
 *   - line amount: round half up to a whole VND;
 *   - tax: computed once per tax rate on the sum of net amounts (not per line), round half up.
 */
export class PricingError extends Error {
  constructor(
    public readonly code: string,
    public readonly detail?: Record<string, unknown>,
  ) {
    super(code);
  }
}

const assertInt = (n: number, what: string) => {
  if (!Number.isSafeInteger(n) || n < 0) throw new PricingError('amount_invalid', { what });
};

/** round(n / d) with halves going up; n >= 0, d > 0, both integers */
export function roundDiv(n: number, d: number): number {
  assertInt(n, 'numerator');
  if (!Number.isSafeInteger(d) || d <= 0)
    throw new PricingError('amount_invalid', { what: 'divisor' });
  return Math.floor((2 * n + d) / (2 * d));
}

/** labor: minutes x hourly price / 60 */
export function laborAmount(minutes: number, hourlyVnd: number): number {
  assertInt(minutes, 'minutes');
  assertInt(hourlyVnd, 'hourly');
  return roundDiv(minutes * hourlyVnd, 60);
}

/** part: stored quantity x price per displayed unit / scale (I4) */
export function partAmount(qty: number, unitVnd: number, scale: number): number {
  assertInt(qty, 'qty');
  assertInt(unitVnd, 'unit');
  return roundDiv(qty * unitVnd, scale);
}

/** FR-INV-025: discount against the list price in basis points, rounded UP so a limit is never exceeded by rounding */
export function discountBpOf(listVnd: number, actualVnd: number): number {
  assertInt(listVnd, 'list');
  assertInt(actualVnd, 'actual');
  if (listVnd === 0 || actualVnd >= listVnd) return 0;
  return Math.ceil(((listVnd - actualVnd) * 10_000) / listVnd);
}

/** Highest limit among the actor's roles; a role without an entry may not discount at all. */
export function maxDiscountBp(
  limits: Readonly<Record<string, number>> | null,
  roleCodes: readonly string[],
): number {
  if (!limits) return 0;
  return roleCodes.reduce((m, r) => Math.max(m, limits[r] ?? 0), 0);
}

export function taxOf(netByRate: ReadonlyMap<number, number>): number {
  let tax = 0;
  for (const [bp, net] of netByRate) tax += roundDiv(net * bp, 10_000);
  return tax;
}

function sums(items: readonly QuoteItem[], only: (i: QuoteItem) => boolean) {
  const byRate = new Map<number, number>();
  let subtotal = 0;
  for (const item of items) {
    if (!only(item)) continue;
    for (const l of item.lines) {
      subtotal += l.amountVnd;
      byRate.set(l.taxRateBp, (byRate.get(l.taxRateBp) ?? 0) + l.amountVnd);
    }
  }
  const tax = taxOf(byRate);
  return { subtotal, tax, total: subtotal + tax };
}

/**
 * Totals of a quote version. `subtotalVnd` is the BA C6 "price": the items' total BEFORE any order
 * level discount and BEFORE tax - the number other branches may see in the vehicle history.
 */
export function computeTotals(items: readonly QuoteItem[]): QuoteTotals {
  const all = sums(items, () => true);
  const sel = sums(items, (i) => i.selected);
  return {
    subtotalVnd: all.subtotal,
    taxVnd: all.tax,
    totalVnd: all.total,
    selectedSubtotalVnd: sel.subtotal,
    selectedTaxVnd: sel.tax,
    selectedTotalVnd: sel.total,
  };
}

/** ba-answers-03 Câu 2: required items start ticked; optional ones only when the customer asked for them. */
export function defaultSelected(necessity: Necessity, customerRequested: boolean): boolean {
  return necessity === 'required' || customerRequested;
}

export const sumLines = (item: Pick<QuoteItem, 'lines'>): number =>
  item.lines.reduce((s, l) => s + l.amountVnd, 0);
