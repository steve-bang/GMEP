/**
 * Pure stock arithmetic (RULE-008, RULE-009, FR-INV-019, FR-INV-020). No I/O: the application
 * layer loads balances inside a transaction, calls these functions, and stages the results.
 *
 * Invariants kept by applyEffect (a violation throws InvRuleError and nothing is written):
 *   onHand >= 0, 0 <= reserved <= onHand, inTransit >= 0, valueVnd >= 0
 * so available = onHand - reserved is never negative either.
 */
import type { CostMethod, CostState } from './cost';
import type { Reservation, ReservationStatus, StockBalance } from './entities';

export class InvRuleError extends Error {
  constructor(
    public readonly code: string,
    public readonly detail?: Record<string, number | string>,
  ) {
    super(code);
    this.name = 'InvRuleError';
  }
}

export type Quantities = Pick<StockBalance, 'onHand' | 'reserved' | 'inTransit' | 'valueVnd'>;

/** RULE-008: what may be sold, reserved or issued to a new demand. In-transit stock is excluded. */
export const availableOf = (b: Pick<Quantities, 'onHand' | 'reserved'>): number =>
  b.onHand - b.reserved;

export interface Effect {
  onHand?: number;
  reserved?: number;
  inTransit?: number;
  valueVnd?: number;
}

export function applyEffect(b: Quantities, e: Effect): Quantities {
  const next: Quantities = {
    onHand: b.onHand + (e.onHand ?? 0),
    reserved: b.reserved + (e.reserved ?? 0),
    inTransit: b.inTransit + (e.inTransit ?? 0),
    valueVnd: b.valueVnd + (e.valueVnd ?? 0),
  };
  for (const [k, v] of Object.entries(next))
    if (!Number.isSafeInteger(v)) throw new InvRuleError('stock_quantity_invalid', { field: k });
  if (next.onHand < 0) throw new InvRuleError('stock_negative');
  if (next.reserved < 0) throw new InvRuleError('reservation_underflow');
  if (next.reserved > next.onHand) throw new InvRuleError('stock_insufficient');
  if (next.inTransit < 0) throw new InvRuleError('stock_in_transit_negative');
  if (next.valueVnd < 0) throw new InvRuleError('stock_cost_negative');
  // a zero balance must not keep a value residue
  if (next.onHand === 0 && next.valueVnd !== 0) throw new InvRuleError('stock_cost_residue');
  return next;
}

export const costState = (b: Quantities): CostState => ({
  onHand: b.onHand,
  valueVnd: b.valueVnd,
});

/** Receipt of `qty` units at a unit cost: weighted-average style value increase. */
export function receive(
  b: Quantities,
  method: CostMethod,
  qty: number,
  unitCostVnd: number,
): { next: Quantities; valueVnd: number; unitCostVnd: number } {
  const valueVnd = method.receipt(costState(b), qty, unitCostVnd);
  return { next: applyEffect(b, { onHand: qty, valueVnd }), valueVnd, unitCostVnd };
}

/**
 * Issue of `qty` units (GIN, negative ADJ, reversal of a receipt without a recorded value).
 * `fromHeld` of them consume this source's own reservation (BA-04 Câu 9): the rest must fit in
 * available stock. onHand is the hard ceiling in every case (FR-INV-019).
 */
export function issue(
  b: Quantities,
  method: CostMethod,
  qty: number,
  fromHeld = 0,
): { next: Quantities; valueVnd: number; unitCostVnd: number } {
  if (fromHeld < 0 || fromHeld > qty) throw new InvRuleError('stock_quantity_invalid');
  if (qty > b.onHand) throw new InvRuleError('stock_insufficient');
  if (qty - fromHeld > availableOf(b)) throw new InvRuleError('stock_insufficient');
  const cost = method.issue(costState(b), qty);
  return {
    next: applyEffect(b, { onHand: -qty, reserved: -fromHeld, valueVnd: -cost.valueVnd }),
    valueVnd: cost.valueVnd,
    unitCostVnd: cost.unitCostVnd,
  };
}

/** Derived flags kept on the balance document. */
export function derive(
  b: Quantities & { minQty: number | null },
): Pick<StockBalance, 'lowStock' | 'nonZero'> {
  return {
    lowStock: b.minQty !== null && availableOf(b) <= b.minQty,
    nonZero: b.onHand !== 0 || b.reserved !== 0 || b.inTransit !== 0,
  };
}

// ---- reservations -----------------------------------------------------------------------

/**
 * Reservation target semantics (FR-INV-020): `qty` is the total the source needs (approved demand);
 * the demand still open is qty - issuedQty, split into what is held and what is unmet.
 * Returns the change to the reserved number plus the new unmet quantity. Without `allowPartial` the
 * call throws when the extra does not fit in available stock; with it (the REC approval path, I1)
 * the hold grows as far as available stock allows and the rest is stored as unmet (never refused:
 * the customer's approval is a business event the warehouse cannot veto).
 */
export function planHold(
  r: Pick<Reservation, 'qty' | 'issuedQty' | 'heldQty'> | null,
  b: Quantities,
  wantQty: number,
  allowPartial: boolean,
): { heldDelta: number; qty: number; shortBy: number; unmetQty: number } {
  const issued = r?.issuedQty ?? 0;
  if (wantQty < issued) throw new InvRuleError('reservation_below_issued');
  const wantHeld = wantQty - issued;
  const held = r?.heldQty ?? 0;
  const need = wantHeld - held;
  if (need <= 0) return { heldDelta: need, qty: wantQty, shortBy: 0, unmetQty: 0 };
  const free = availableOf(b);
  if (need <= free) return { heldDelta: need, qty: wantQty, shortBy: 0, unmetQty: 0 };
  if (!allowPartial) throw new InvRuleError('stock_insufficient', { short: need - free });
  return { heldDelta: free, qty: wantQty, shortBy: need - free, unmetQty: need - free };
}

/** Remaining demand of a line: what the order still needs from stock (I3/I8 cap on issuing). */
export const remainingDemand = (r: Pick<Reservation, 'qty' | 'issuedQty'>): number =>
  r.qty - r.issuedQty;

/** holding while something is held or still unmet; fulfilled once all demand was issued; released when nothing was ever issued. */
export function holdStatus(
  r: Pick<Reservation, 'heldQty' | 'issuedQty'> & { unmetQty?: number },
): ReservationStatus {
  return r.heldQty > 0 || (r.unmetQty ?? 0) > 0
    ? 'holding'
    : r.issuedQty > 0
      ? 'fulfilled'
      : 'released';
}

/** I5: value of `qty` units at the current average, from the stored value (no per-unit rounding drift). */
export function surplusValue(method: CostMethod, b: Quantities, qty: number): number {
  return method.valueAtAverage(costState(b), qty);
}

/** Receipt with an explicit total value (surplus at average cost, return at the issue value). */
export function receiveValue(
  b: Quantities,
  qty: number,
  valueVnd: number,
): { next: Quantities; valueVnd: number; unitCostVnd: number } {
  return {
    next: applyEffect(b, { onHand: qty, valueVnd }),
    valueVnd,
    unitCostVnd: qty > 0 ? Math.round(valueVnd / qty) : 0,
  };
}
