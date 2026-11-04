/**
 * Stock cost methods (FR-INV-009, FR-INV-027, BR-INV-16). The method is data (effective-dated
 * `cost-method` config); this file holds the strategies. Only weighted average exists today
 * [Cần xác nhận: Kế toán khách] - FIFO would be a second strategy keeping receipt layers.
 *
 * Money is integer VND. Intermediate products are computed with BigInt so that
 * value * qty never loses precision, and rounding is "half up" so results are reproducible.
 * Examples to be signed off by the accountant live in tests/unit/inv-cost.test.ts (NFR-MNT-01).
 */

/** Cost state of one warehouse x part balance: units on hand and their total value. */
export interface CostState {
  onHand: number;
  valueVnd: number;
}

export interface IssueCost {
  /** value leaving stock for the whole quantity */
  valueVnd: number;
  /** rounded per-unit cost shown on documents (valueVnd / qty) */
  unitCostVnd: number;
}

export interface CostMethod {
  code: string;
  /** value entering stock: qty units at unitCostVnd each */
  receipt(state: CostState, qty: number, unitCostVnd: number): number;
  /** cost of qty units leaving stock (issue, supplier return, negative adjustment, count loss) */
  issue(state: CostState, qty: number): IssueCost;
  /** current per-unit cost (0 when nothing is on hand) */
  unitCost(state: CostState): number;
}

/** round-half-up of a / b for non-negative BigInts */
function divRound(a: bigint, b: bigint): bigint {
  return (a * 2n + b) / (b * 2n);
}

function safe(n: bigint, what: string): number {
  if (n > BigInt(Number.MAX_SAFE_INTEGER) || n < 0n) throw new RangeError(`${what} out of range`);
  return Number(n);
}

export const weightedAverage: CostMethod = {
  code: 'weighted-average',
  receipt(_state, qty, unitCostVnd) {
    return safe(BigInt(qty) * BigInt(unitCostVnd), 'receipt value');
  },
  issue(state, qty) {
    if (qty <= 0 || qty > state.onHand) throw new RangeError('issue quantity out of range');
    // issuing everything takes everything: no rounding residue is left in a zero-quantity balance
    const value =
      qty === state.onHand
        ? BigInt(state.valueVnd)
        : divRound(BigInt(state.valueVnd) * BigInt(qty), BigInt(state.onHand));
    return {
      valueVnd: safe(value, 'issue value'),
      unitCostVnd: safe(divRound(value, BigInt(qty)), 'unit cost'),
    };
  },
  unitCost(state) {
    return state.onHand > 0
      ? safe(divRound(BigInt(state.valueVnd), BigInt(state.onHand)), 'unit cost')
      : 0;
  },
};

export const COST_METHODS: Readonly<Record<string, CostMethod>> = {
  [weightedAverage.code]: weightedAverage,
};

/** Used when no `cost-method` version is in force yet (default per the plan, pending the accountant). */
export const DEFAULT_COST_METHOD = weightedAverage.code;

export function costMethodOf(code: string | undefined): CostMethod {
  const m = COST_METHODS[code ?? DEFAULT_COST_METHOD];
  if (!m) throw new Error(`unknown cost method ${code}`);
  return m;
}
