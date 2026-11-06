/**
 * Data-subject requests (FR-CRM-011, BR-CRM-05, UAT-10). Own state machine; a request is never
 * deleted. `delete` completion anonymises the customer but keeps data that law requires.
 */
export const REQUEST_TYPES = ['view', 'correct', 'delete'] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const REQUEST_STATUSES = ['received', 'in_progress', 'completed', 'rejected'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  received: ['in_progress', 'rejected'],
  in_progress: ['completed', 'rejected'],
  completed: [],
  rejected: [],
};

export const canTransition = (from: RequestStatus, to: RequestStatus): boolean =>
  REQUEST_TRANSITIONS[from].includes(to);

export const isClosed = (s: RequestStatus): boolean => REQUEST_TRANSITIONS[s].length === 0;

export interface DataRequest {
  id: string;
  tenantId: string;
  /** branch that received the request */
  branchId: string;
  code: string;
  customerId: string;
  type: RequestType;
  status: RequestStatus;
  /** how the request arrived: counter, phone, email, web */
  receivedVia: 'in_person' | 'phone' | 'email' | 'web';
  receivedAt: Date;
  /** internal target (C3): drives reminders and the red "overdue" mark; NOT a legal conclusion */
  internalDueAt: Date;
  /** legal deadline: null until the client's lawyer enters it per request type [Cần xác nhận: Luật sư khách] */
  legalDueAt: Date | null;
  assigneeId: string | null;
  /** what the customer asked; staff must not paste personal data here */
  note?: string;
  resultNote?: string;
  closedAt?: Date;
  closedBy?: string;
  /** set when a `delete` request was completed by anonymising the customer */
  anonymizedAt?: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

/**
 * C3 (ba-answers-for-dev §15): two separate parameters per request type. The internal target is
 * 72 hours as a starting value; the legal deadline stays blank until the lawyer sets it, and a blank
 * legal deadline never yields a "late by law" conclusion. Both are configuration (NFR-MNT-01).
 */
export type RequestTypeHours = Record<RequestType, number>;
export const DEFAULT_INTERNAL_TARGET_HOURS: RequestTypeHours = {
  view: 72,
  correct: 72,
  delete: 72,
};

export function dueAtFor(receivedAt: Date, deadlineHours: number): Date {
  return new Date(receivedAt.getTime() + deadlineHours * 3_600_000);
}

/** null when the lawyer has not set a legal deadline for the type. */
export function legalDueAtFor(
  receivedAt: Date,
  legalHours: Partial<Record<RequestType, number | null>>,
  type: RequestType,
): Date | null {
  const h = legalHours[type];
  return typeof h === 'number' ? dueAtFor(receivedAt, h) : null;
}

export const isOverdue = (r: Pick<DataRequest, 'status' | 'internalDueAt'>, now: Date): boolean =>
  !isClosed(r.status) && r.internalDueAt.getTime() < now.getTime();

/** Only when a legal deadline exists can a request be reported as late by law. */
export const isLegallyOverdue = (
  r: Pick<DataRequest, 'status' | 'legalDueAt'>,
  now: Date,
): boolean => !isClosed(r.status) && !!r.legalDueAt && r.legalDueAt.getTime() < now.getTime();

/** What a customer-delete request must keep or may not touch (FR-CRM-011 [Cần xác nhận: Luật sư khách]). */
export interface RetentionCheck {
  /**
   * C4 fail closed: false while the owning modules (REC/ACC/EIN) cannot report open orders, debt,
   * warranty and invoice retention. An unverifiable check never lets a deletion complete.
   */
  verified: boolean;
  /** open repair orders, outstanding debt, valid warranty: the deletion must wait */
  blockers: string[];
  /** records kept for legal reasons (issued invoices, accounting vouchers); listed in the result */
  retained: string[];
}

/** Nothing blocks and everything was verified (real ports, tests of the happy path). */
export const NO_RETENTION: RetentionCheck = { verified: true, blockers: [], retained: [] };
/** What the temporary port returns until REC/ACC exist: nothing is known, so nothing may be deleted. */
export const RETENTION_UNVERIFIED: RetentionCheck = {
  verified: false,
  blockers: [],
  retained: [],
};
