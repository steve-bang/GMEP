import { taxPerRate } from '@/platform/money/splitTax';
import type { InvoiceLine, TaxSummaryRow } from './invoice';

/**
 * Builds the invoice content from the approved order lines (FR-EIN-001, 011; RULE-005). The tax key, version and rate are
 * those STORED on each approved line (R2); nothing is re-priced and no rate is looked up here. The tax is computed once
 * per (source approval, rate) on the net sum with the rule of the quote (`splitTaxByItems`) and then summed per rate, so
 * the invoice total equals the order total to the VND (NFR-MNT-01; [Cần xác nhận: Kế toán khách] rounding strategy).
 */
export interface SourceLine {
  /** the approval the line came from: `base` or the supplementary quote id */
  sourceKey: string;
  lineKey: string;
  kind: 'labor' | 'part';
  code: string;
  name: string;
  /** shown quantity text for per-line mode, e.g. "2" or "1,5 giờ" */
  quantityText?: string;
  amountVnd: number;
  taxKey: string;
  taxVersionId: string;
  taxRateBp: number;
}

export type LineMode = 'per-rate' | 'per-line';

export interface BuiltInvoice {
  lines: InvoiceLine[];
  taxSummary: TaxSummaryRow[];
  netVnd: number;
  taxVnd: number;
  totalVnd: number;
}

export function buildInvoiceContent(
  src: readonly SourceLine[],
  mode: LineMode,
  perRateDescription: string,
): BuiltInvoice {
  // tax per source approval and rate, then summed per rate
  const sources = [...new Set(src.map((l) => l.sourceKey))];
  const perRate = new Map<number, { netVnd: number; taxVnd: number }>();
  for (const s of sources) {
    const items = [
      {
        no: 0,
        lines: src
          .filter((l) => l.sourceKey === s)
          .map((l) => ({
            amountVnd: l.amountVnd,
            taxRateBp: l.taxRateBp,
          })),
      },
    ];
    for (const [bp, v] of taxPerRate(items)) {
      const cur = perRate.get(bp) ?? { netVnd: 0, taxVnd: 0 };
      perRate.set(bp, { netVnd: cur.netVnd + v.netVnd, taxVnd: cur.taxVnd + v.taxVnd });
    }
  }
  const keyOfRate = (bp: number) => src.find((l) => l.taxRateBp === bp)!;
  const taxSummary: TaxSummaryRow[] = [...perRate.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bp, v]) => ({
      rateBp: bp,
      taxKey: keyOfRate(bp).taxKey,
      taxVersionId: keyOfRate(bp).taxVersionId,
      netVnd: v.netVnd,
      taxVnd: v.taxVnd,
    }));
  const lines: InvoiceLine[] =
    mode === 'per-line'
      ? src.map((l, i) => ({
          no: i + 1,
          description: l.name,
          ...(l.quantityText ? { quantityText: l.quantityText } : {}),
          netVnd: l.amountVnd,
          rateBp: l.taxRateBp,
          taxKey: l.taxKey,
          taxVersionId: l.taxVersionId,
        }))
      : taxSummary.map((t, i) => ({
          no: i + 1,
          description: perRateDescription,
          netVnd: t.netVnd,
          rateBp: t.rateBp,
          taxKey: t.taxKey,
          taxVersionId: t.taxVersionId,
        }));
  const netVnd = taxSummary.reduce((s, t) => s + t.netVnd, 0);
  const taxVnd = taxSummary.reduce((s, t) => s + t.taxVnd, 0);
  return { lines, taxSummary, netVnd, taxVnd, totalVnd: netVnd + taxVnd };
}

/** A signed correction (adjustment): the delta lines and their tax, one source, same rule. */
export function buildAdjustmentContent(
  deltas: readonly {
    description: string;
    netVnd: number;
    taxKey: string;
    taxVersionId: string;
    rateBp: number;
  }[],
): BuiltInvoice {
  const sum = new Map<
    number,
    { netVnd: number; taxVnd: number; taxKey: string; taxVersionId: string }
  >();
  for (const d of deltas) {
    const cur = sum.get(d.rateBp) ?? {
      netVnd: 0,
      taxVnd: 0,
      taxKey: d.taxKey,
      taxVersionId: d.taxVersionId,
    };
    cur.netVnd += d.netVnd;
    sum.set(d.rateBp, cur);
  }
  const taxSummary: TaxSummaryRow[] = [...sum.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bp, v]) => {
      // half up on the magnitude, sign kept: -0.5 VND rounds away from zero like +0.5 (symmetry of correction and original)
      const tax = Math.sign(v.netVnd) * Math.floor((2 * Math.abs(v.netVnd) * bp + 10_000) / 20_000);
      return {
        rateBp: bp,
        taxKey: v.taxKey,
        taxVersionId: v.taxVersionId,
        netVnd: v.netVnd,
        taxVnd: tax,
      };
    });
  const lines: InvoiceLine[] = deltas.map((d, i) => ({
    no: i + 1,
    description: d.description,
    netVnd: d.netVnd,
    rateBp: d.rateBp,
    taxKey: d.taxKey,
    taxVersionId: d.taxVersionId,
  }));
  const netVnd = taxSummary.reduce((s, t) => s + t.netVnd, 0);
  const taxVnd = taxSummary.reduce((s, t) => s + t.taxVnd, 0);
  return { lines, taxSummary, netVnd, taxVnd, totalVnd: netVnd + taxVnd };
}
