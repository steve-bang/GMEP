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
  companyId: string;
  /** branch that received the request */
  branchId: string;
  code: string;
  customerId: string;
  type: RequestType;
  status: RequestStatus;
  /** how the request arrived: counter, phone, email, web */
  receivedVia: 'in_person' | 'phone' | 'email' | 'web';
  receivedAt: Date;
  dueAt: Date;
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
 * Response deadline. [Cần xác nhận: Luật sư khách] the PDPL 2025 / NĐ 356/2025 period; the default
 * is the strictest known value (72 hours, as in NĐ 13/2023 for access and correction) and is configuration.
 */
export const DEFAULT_REQUEST_DEADLINE_HOURS = 72;

export function dueAtFor(receivedAt: Date, deadlineHours: number): Date {
  return new Date(receivedAt.getTime() + deadlineHours * 3_600_000);
}

export const isOverdue = (r: Pick<DataRequest, 'status' | 'dueAt'>, now: Date): boolean =>
  !isClosed(r.status) && r.dueAt.getTime() < now.getTime();

/** What a customer-delete request must keep or may not touch (FR-CRM-011 [Cần xác nhận: Luật sư khách]). */
export interface RetentionCheck {
  /** open repair orders, outstanding debt, valid warranty: the deletion must wait */
  blockers: string[];
  /** records kept for legal reasons (issued invoices, accounting vouchers); listed in the result */
  retained: string[];
}

export const NO_RETENTION: RetentionCheck = { blockers: [], retained: [] };
