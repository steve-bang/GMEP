import type { OtpState } from './otp';

/**
 * Records behind "send the quote link" and the approval code (A4). All are read by key (no query shape, no index).
 * Personal data: only a MASKED recipient is kept; the real contact is read from CRM when the message is sent.
 */

export type MessageChannelCode = 'sms' | 'zalo' | 'email';

/** one record per link: the code asked for the approval attempt in progress (a new code replaces the old one) */
export interface QuoteOtpRecord extends OtpState {
  /** the link hash (token SHA-256) */
  id: string;
  companyId: string;
  branchId: string;
  quoteId: string;
  channel: MessageChannelCode;
  sentAt: Date;
  /** the next code can be asked for after this */
  resendAfter: Date;
  createdAt: Date;
  /** Firestore TTL: the record is purged a day after the code expired (30 days while wrong tries are remembered) */
  expiresAt: Date;
}

export type DeliveryStatus = 'pending' | 'sent' | 'dead';
export type DeliveryDeadReason =
  'attempts_exhausted' | 'no_consent' | 'no_contact' | 'quote_not_open' | 'channel_unavailable';

/** A request to deliver the quote link over one channel; `pending` ones are retried by the `messageRetry` job. */
export interface QuoteDelivery {
  /** deterministic from the Idempotency-Key of the request: the key that makes a resend impossible */
  id: string;
  companyId: string;
  branchId: string;
  quoteId: string;
  n: number;
  customerId: string;
  channel: MessageChannelCode;
  /** masked phone or e-mail, never the real value */
  recipientMasked: string;
  status: DeliveryStatus;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date;
  /** short technical reason of the last failure, no personal data */
  lastError?: string;
  deadReason?: DeliveryDeadReason;
  sentAt?: Date;
  createdAt: Date;
  createdBy: string;
  /** Firestore TTL */
  expiresAt: Date;
}

export interface MessageQueueItem {
  nextAttemptAt: Date;
  attempts: number;
}

/** Pending deliveries of ONE branch (`messageQueues/<branchId>`), the cron job reads it by key; bounded. */
export interface MessageQueue {
  /** the branch id */
  id: string;
  companyId: string;
  branchId: string;
  items: Record<string, MessageQueueItem>;
}
