import type { Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import { isOpenRequest } from '../domain/state';
import type { InvoiceQueue, InvoiceRequest, QueueItem } from '../domain/invoice';
import type { EinDeps } from '../ports/deps';

/**
 * The error / retry queue of a branch (FR-EIN-010) is ONE bounded document read by key (R68 rule 3: no query, no index).
 * An open request (anything not succeeded or cancelled) is listed; a request is never dropped from it except by reaching a
 * final state. When the document is full, new issues are refused instead of losing a request.
 */
export const toQueueItem = (r: InvoiceRequest): QueueItem => ({
  requestId: r.id,
  number: r.number,
  purpose: r.purpose,
  orderId: r.orderId,
  orderNumber: r.orderNumber,
  invoiceId: r.invoiceId,
  status: r.status,
  ...(r.lastError
    ? {
        errorKind: r.lastError.kind,
        errorCode: r.lastError.code,
        errorMessage: r.lastError.message,
      }
    : {}),
  attemptCount: r.attemptCount,
  maxAttempts: r.maxAttempts,
  ...(r.nextAttemptAt ? { nextAttemptAt: r.nextAttemptAt } : {}),
  valueVnd: r.valueVnd,
  createdAt: r.createdAt,
});

export async function readQueue(
  deps: EinDeps,
  tx: Tx,
  scope: Scope,
  companyId: string,
  branchId: string,
  now: Date,
): Promise<InvoiceQueue> {
  return (
    (await deps.queue.getInTx(tx, scope, branchId)) ?? {
      id: branchId,
      companyId,
      branchId,
      items: {},
      updatedAt: now,
      version: 0,
    }
  );
}

/** Pure: the queue after `r` changed. */
export function queueWith(q: InvoiceQueue, r: InvoiceRequest, now: Date): InvoiceQueue {
  const items = { ...q.items };
  if (isOpenRequest(r.status)) items[r.id] = toQueueItem(r);
  else delete items[r.id];
  return { ...q, items, updatedAt: now, version: q.version + 1 };
}
