/**
 * Stock document rules: state machine, line validation, approval triggers (FR-INV-005, 006, 021,
 * RULE-007, RULE-010). Pure; the application layer supplies the facts.
 */
import {
  GATED_SOURCES,
  SOURCES_BY_TYPE,
  type StockDocLine,
  type StockDocSource,
  type StockDocStatus,
  type StockDocType,
} from './entities';
import { InvRuleError } from './ledger';

/**
 * A stock document is its own object with its own states (not a shared status field):
 * draft -> posted | cancelled. A posted document is final; it is corrected only by a reversal
 * document (RULE-010), never edited or deleted. A cancelled draft never touched stock.
 */
export const DOC_TRANSITIONS: Record<StockDocStatus, readonly StockDocStatus[]> = {
  draft: ['posted', 'cancelled'],
  posted: [],
  cancelled: [],
};

export function assertTransition(from: StockDocStatus, to: StockDocStatus): void {
  if (!DOC_TRANSITIONS[from].includes(to)) throw new InvRuleError('state_invalid');
}

/** RULE-007: no stock movement without a source document. Returns the normalised source. */
export function checkSource(
  type: StockDocType,
  source: StockDocSource,
  opts: { allowTransferOrder?: boolean } = {},
): StockDocSource {
  if (!SOURCES_BY_TYPE[type].includes(source.type)) throw new InvRuleError('source_invalid');
  // I16: a gated source is refused where the flag is off, exactly like an unknown one
  if (GATED_SOURCES.includes(source.type) && !opts.allowTransferOrder)
    throw new InvRuleError('source_invalid');
  // a receipt "without purchase order", an opening balance and a manual adjustment are documents of
  // their own: approved by a manager with a stated reason instead of pointing at another document
  const refless =
    source.type === 'no-po' ||
    source.type === 'opening-balance' ||
    source.type === 'manual-adjustment';
  if (!refless && !source.id) throw new InvRuleError('source_required');
  return { type: source.type, id: refless ? null : (source.id ?? null) };
}

export interface ApprovalFacts {
  type: StockDocType;
  source: StockDocSource;
  lines: readonly StockDocLine[];
  priceVarianceBp: number;
  qtyVarianceBp: number;
}

/** basis points of |actual - expected| over expected; expected 0 with any actual is an infinite variance */
export function varianceBp(actual: number, expected: number): number {
  if (actual === expected) return 0;
  if (expected <= 0) return Number.MAX_SAFE_INTEGER;
  return Number((BigInt(Math.abs(actual - expected)) * 10_000n) / BigInt(expected));
}

/**
 * Reasons a manager (stock-doc:approve, a person other than the creator) must post this document:
 *  - every adjustment (opening balance and corrections change stock without a physical flow),
 *  - a receipt without purchase order,
 *  - a receipt whose price differs from the purchase order (either direction) or whose quantity
 *    EXCEEDS the order, beyond the configured thresholds (FR-INV-005, I7).
 */
export function approvalReasons(f: ApprovalFacts): string[] {
  const reasons: string[] = [];
  if (f.type === 'ADJ') reasons.push('adjustment');
  if (f.type === 'GRN') {
    if (f.source.type === 'no-po') reasons.push('no_purchase_order');
    for (const l of f.lines) {
      // I7: only an OVER-order receipt needs approval; a short receipt is a partial receipt (the order stays open)
      if (
        l.expectedQty !== undefined &&
        l.qty > l.expectedQty &&
        varianceBp(l.qty, l.expectedQty) > f.qtyVarianceBp
      ) {
        reasons.push('quantity_variance');
        break;
      }
    }
    for (const l of f.lines) {
      if (
        l.expectedUnitCostVnd !== undefined &&
        l.unitCostVnd !== undefined &&
        varianceBp(l.unitCostVnd, l.expectedUnitCostVnd) > f.priceVarianceBp
      ) {
        reasons.push('price_variance');
        break;
      }
    }
  }
  return reasons;
}

/** Line shape per document type. Throws InvRuleError('line_invalid') with the offending line number. */
export function checkLines(
  type: StockDocType,
  lines: readonly StockDocLine[],
  opts: { opening: boolean },
): void {
  if (lines.length === 0) throw new InvRuleError('lines_required');
  const seen = new Set<string>();
  for (const l of lines) {
    const bad = (why: string) => new InvRuleError('line_invalid', { line: l.lineNo, why });
    if (!Number.isSafeInteger(l.qty) || l.qty === 0) throw bad('qty');
    if (type !== 'ADJ' && l.qty < 0) throw bad('qty');
    if (type === 'GRN' && (l.unitCostVnd === undefined || l.unitCostVnd < 0)) throw bad('cost');
    // I5: a stocktake surplus defaults to the average cost at posting; the price is mandatory for an opening balance
    if (type === 'ADJ' && l.qty > 0 && l.unitCostVnd === undefined && opts.opening)
      throw bad('cost');
    if (type === 'RTN' && l.originalLineNo === undefined) throw bad('original');
    if (opts.opening && l.qty < 0) throw bad('opening_negative');
    const dupKey = `${l.partId}|${l.lineKey ?? ''}|${l.originalLineNo ?? ''}`;
    if (type !== 'GIN' && seen.has(dupKey)) throw bad('duplicate');
    seen.add(dupKey);
  }
}
