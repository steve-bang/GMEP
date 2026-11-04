/**
 * Ledger engine: loads the balances a business operation touches (all reads first, Firestore
 * transaction rule), applies pure effects in memory, then stages ONE balance document and ONE
 * append-only movement per change in the caller's transaction (RULE-009). Nothing here commits;
 * the caller's unit of work does, so a failure anywhere rolls the whole operation back
 * (stock, ledger, numbering, audit and idempotency record together).
 *
 * Concurrency (S1 spike): a balance document is the unit of contention. Two operations on the
 * same warehouse x part serialise on it - the loser retries on the new state and fails the
 * availability check instead of overselling.
 */
import type { Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import type { Part, StockBalance, StockMovement } from '../domain/entities';
import { balanceId, type MovementKind } from '../domain/entities';
import { derive, type Quantities } from '../domain/ledger';
import type { InvDeps } from '../ports/deps';

export interface MovementMeta {
  kind: MovementKind;
  documentId: string | null;
  documentNo: string | null;
  reservationId: string | null;
  lineNo: number | null;
  sourceType: string | null;
  sourceId: string | null;
  unitCostVnd: number;
  /** ledger row id; deterministic so a repeat can never write a second row */
  id: string;
  note?: string;
}

interface Slot {
  b: StockBalance;
  touched: boolean;
}

export class BalanceSet {
  private readonly slots = new Map<string, Slot>();
  private readonly pending: StockMovement[] = [];

  private constructor(
    private readonly deps: InvDeps,
    private readonly branchId: string,
    private readonly warehouseId: string,
    private readonly actorId: string,
    private readonly at: Date,
    private readonly date: string,
  ) {}

  /** Reads the balance of every part (missing balances start at zero). */
  static async load(
    deps: InvDeps,
    tx: Tx,
    scope: Scope,
    w: { id: string; branchId: string; companyId: string },
    parts: readonly Pick<Part, 'id' | 'code' | 'name'>[],
    actorId: string,
    date: string,
  ): Promise<BalanceSet> {
    const at = deps.sys.clock.now();
    const set = new BalanceSet(deps, w.branchId, w.id, actorId, at, date);
    const unique = [...new Map(parts.map((p) => [p.id, p])).values()];
    const found = await Promise.all(
      unique.map((p) => deps.balances.getInTx(tx, scope, balanceId(w.id, p.id))),
    );
    unique.forEach((p, i) => {
      const b: StockBalance = found[i] ?? {
        id: balanceId(w.id, p.id),
        companyId: w.companyId,
        branchId: w.branchId,
        warehouseId: w.id,
        partId: p.id,
        partCode: p.code,
        partCodeNorm: p.code,
        partName: p.name,
        onHand: 0,
        reserved: 0,
        inTransit: 0,
        valueVnd: 0,
        minQty: null,
        maxQty: null,
        lowStock: false,
        nonZero: false,
        seq: 0,
        createdAt: at,
        updatedAt: at,
      };
      set.slots.set(p.id, { b, touched: false });
    });
    return set;
  }

  get(partId: string): StockBalance {
    const s = this.slots.get(partId);
    if (!s) throw new Error(`balance of part ${partId} was not loaded`);
    return s.b;
  }

  /** Replaces the quantities of a balance by `next` and queues the ledger row that explains the change. */
  move(partId: string, next: Quantities, meta: MovementMeta, actorNote?: string): void {
    const s = this.slots.get(partId);
    if (!s) throw new Error(`balance of part ${partId} was not loaded`);
    const before = s.b;
    const seq = before.seq + 1;
    const after: StockBalance = { ...before, ...next, seq, updatedAt: this.at };
    Object.assign(after, derive(after));
    this.pending.push({
      id: meta.id,
      companyId: before.companyId,
      branchId: this.branchId,
      warehouseId: this.warehouseId,
      partId,
      partCode: before.partCode,
      kind: meta.kind,
      documentId: meta.documentId,
      documentNo: meta.documentNo,
      reservationId: meta.reservationId,
      lineNo: meta.lineNo,
      sourceType: meta.sourceType,
      sourceId: meta.sourceId,
      onHandDelta: next.onHand - before.onHand,
      reservedDelta: next.reserved - before.reserved,
      inTransitDelta: next.inTransit - before.inTransit,
      valueDeltaVnd: next.valueVnd - before.valueVnd,
      unitCostVnd: meta.unitCostVnd,
      onHandAfter: next.onHand,
      reservedAfter: next.reserved,
      inTransitAfter: next.inTransit,
      valueAfterVnd: next.valueVnd,
      seq,
      at: this.at,
      businessDate: this.date,
      actorId: this.actorId,
      ...((actorNote ?? meta.note) ? { note: (actorNote ?? meta.note)! } : {}),
    });
    s.b = after;
    s.touched = true;
  }

  /** Stages every changed balance and every ledger row. Call after all reads of the transaction. */
  flush(tx: Tx): void {
    for (const s of this.slots.values()) if (s.touched) this.deps.balances.save(tx, s.b);
    for (const m of this.pending) this.deps.movements.append(tx, m);
  }

  touchedBalances(): StockBalance[] {
    return [...this.slots.values()].filter((s) => s.touched).map((s) => s.b);
  }
}

export const quantitiesOf = (b: StockBalance): Quantities => ({
  onHand: b.onHand,
  reserved: b.reserved,
  inTransit: b.inTransit,
  valueVnd: b.valueVnd,
});
