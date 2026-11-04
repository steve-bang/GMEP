import type { Scope } from '@/platform/scope/scope';
import { issueReturnId } from '../domain/entities';
import type { InvDeps } from '../ports/deps';

export interface OrderIssueBalance {
  /** total quantity issued to the order according to the holds (every path, REC or INV screens) */
  reservationIssuedQty: number;
  /** quantity on the posted issue documents the caller knows about */
  documentIssuedQty: number;
  /** quantity returned to stock against those documents (posted RTN) */
  returnedQty: number;
  /** issued but not returned: what blocks the cancellation of the order (FR-REC-021) */
  netIssuedQty: number;
  /** issues exist that the caller's documents do not explain: the net cannot be proven, so it is not zero */
  unaccountedQty: number;
}

/**
 * FR-REC-021 / RULE-009: how much stock is still out on a repair order. REC passes the goods-issue documents it
 * created for the order; INV adds the posted returns against each line and compares with the order's own
 * holds, so an issue made outside REC cannot hide. Read-only, inside the given scope.
 */
export async function orderIssueBalance(
  deps: InvDeps,
  scope: Scope,
  orderId: string,
  documentIds: readonly string[],
): Promise<OrderIssueBalance> {
  const holds = await deps.reservations.listBySource(scope, 'repair-order', orderId, 200);
  const reservationIssuedQty = holds.reduce((s, r) => s + r.issuedQty, 0);
  let documentIssuedQty = 0;
  let returnedQty = 0;
  await deps.sys.uow.run(async (tx) => {
    for (const id of new Set(documentIds)) {
      const d = await deps.documents.getInTx(tx, scope, id);
      if (!d || d.type !== 'GIN' || d.status !== 'posted') continue;
      for (const l of d.lines) {
        documentIssuedQty += l.qty;
        const r = await deps.returns.getInTx(tx, scope, issueReturnId(d.id, l.lineNo));
        returnedQty += r?.returnedQty ?? 0;
      }
    }
  });
  const unaccountedQty = Math.max(0, reservationIssuedQty - documentIssuedQty);
  return {
    reservationIssuedQty,
    documentIssuedQty,
    returnedQty,
    // a reversed issue lowers the hold's issued quantity, so the smaller of the two is what is really out
    netIssuedQty:
      Math.max(0, Math.min(documentIssuedQty - returnedQty, reservationIssuedQty)) + unaccountedQty,
    unaccountedQty,
  };
}
