import type { ErrorKind, InvoiceStatus, RequestStatus, SyncState } from './invoice';

/**
 * Two explicit state machines (plan §2.14): the INVOICE (the document) and the REQUEST (the technical attempt to get it
 * issued, FR-EIN-010/013). Pure: `transition(state, event) -> state | rejection`. The order and the payment have their own.
 */

export type InvoiceEvent = 'provider_issued' | 'provider_cancelled' | 'request_cancelled';
export type InvoiceTransition =
  { ok: true; to: InvoiceStatus } | { ok: false; reason: 'invoice_transition_not_allowed' };

export const INVOICE_TRANSITIONS: readonly {
  from: InvoiceStatus;
  event: InvoiceEvent;
  to: InvoiceStatus;
}[] = [
  { from: 'not_issued', event: 'provider_issued', to: 'issued' },
  { from: 'not_issued', event: 'request_cancelled', to: 'abandoned' },
  { from: 'issued', event: 'provider_cancelled', to: 'cancelled' },
];

export function transitionInvoice(from: InvoiceStatus, event: InvoiceEvent): InvoiceTransition {
  const t = INVOICE_TRANSITIONS.find((x) => x.from === from && x.event === event);
  return t ? { ok: true, to: t.to } : { ok: false, reason: 'invoice_transition_not_allowed' };
}

export type RequestEvent =
  | 'claim'
  | 'provider_ok'
  | 'provider_processing'
  | 'provider_timeout'
  | 'provider_unavailable'
  | 'provider_rejected'
  | 'provider_data_error'
  | 'query_not_found'
  | 'fix_data'
  | 'release'
  | 'lease_expired'
  | 'cancel';
export type RequestTransition =
  { ok: true; to: RequestStatus } | { ok: false; reason: 'request_transition_not_allowed' };

/**
 * `claim` -> sending; the result events leave `sending`. `fix_data` (the buyer was corrected) and `release` (retry now)
 * put the request back to `pending`. `cancel` is allowed from a state where the provider is known NOT to hold an invoice,
 * decided by the caller after a last query (FR-EIN-013): the table only lists where it can ever apply.
 */
export const REQUEST_TRANSITIONS: readonly {
  from: RequestStatus;
  event: RequestEvent;
  to: RequestStatus;
}[] = [
  { from: 'pending', event: 'claim', to: 'sending' },
  { from: 'awaiting_provider', event: 'claim', to: 'sending' },
  { from: 'unknown', event: 'claim', to: 'sending' },
  { from: 'failed_provider', event: 'claim', to: 'sending' },
  { from: 'sending', event: 'lease_expired', to: 'unknown' },
  { from: 'sending', event: 'provider_ok', to: 'succeeded' },
  { from: 'sending', event: 'provider_processing', to: 'awaiting_provider' },
  { from: 'sending', event: 'provider_timeout', to: 'unknown' },
  { from: 'sending', event: 'provider_unavailable', to: 'failed_provider' },
  { from: 'sending', event: 'provider_rejected', to: 'failed_provider' },
  { from: 'sending', event: 'provider_data_error', to: 'failed_data' },
  { from: 'sending', event: 'query_not_found', to: 'sending' },
  { from: 'failed_data', event: 'fix_data', to: 'pending' },
  { from: 'failed_provider', event: 'release', to: 'pending' },
  { from: 'unknown', event: 'release', to: 'pending' },
  { from: 'awaiting_provider', event: 'release', to: 'pending' },
  { from: 'pending', event: 'cancel', to: 'cancelled' },
  { from: 'failed_data', event: 'cancel', to: 'cancelled' },
  { from: 'failed_provider', event: 'cancel', to: 'cancelled' },
  { from: 'unknown', event: 'cancel', to: 'cancelled' },
  { from: 'awaiting_provider', event: 'cancel', to: 'cancelled' },
];

export function transitionRequest(from: RequestStatus, event: RequestEvent): RequestTransition {
  const t = REQUEST_TRANSITIONS.find((x) => x.from === from && x.event === event);
  return t ? { ok: true, to: t.to } : { ok: false, reason: 'request_transition_not_allowed' };
}

/** A request that has not reached a final state: it sits in the queue and keeps the order from being invoiced twice. */
export const isOpenRequest = (s: RequestStatus): boolean => s !== 'succeeded' && s !== 'cancelled';

/** The provider may already hold an invoice for this request: a resend is forbidden before asking (FR-EIN-013). */
export const mustQueryFirst = (r: { status: RequestStatus; attemptCount: number }): boolean =>
  r.attemptCount > 0 || r.status === 'unknown' || r.status === 'awaiting_provider';

/** Sync indicator derived from the request state (shown next to the invoice status). */
export function syncOf(s: RequestStatus): SyncState {
  switch (s) {
    case 'pending':
      return 'queued';
    case 'sending':
      return 'sending';
    case 'awaiting_provider':
    case 'unknown':
      return 'waiting_query';
    case 'failed_data':
    case 'failed_provider':
      return 'failed';
    default:
      return 'synced';
  }
}

export function errorKindOf(e: RequestEvent): ErrorKind | null {
  switch (e) {
    case 'provider_timeout':
      return 'timeout';
    case 'provider_unavailable':
      return 'unavailable';
    case 'provider_rejected':
      return 'rejected';
    case 'provider_data_error':
      return 'data';
    default:
      return null;
  }
}

/** Waiting time before the next automatic attempt; the list is configuration (`einvoice-policy.retryBackoffMinutes`). */
export function nextAttemptDelayMinutes(attemptCount: number, backoff: readonly number[]): number {
  if (backoff.length === 0) return 5;
  return backoff[Math.min(Math.max(attemptCount, 1), backoff.length) - 1]!;
}
