/**
 * Minimal approval workflow (FR-SYS-004, BR-SYS-03; G4-APR-01..03). A request names WHAT is to be approved
 * (a kind, a subject, a value in integer VND), asks for a level of approver and is decided by someone other
 * than the requester (the rule is by PERSON, not by role: a user holding two roles still cannot approve their own
 * request). Limits are effective-dated configuration (`approval-limit`, one version per kind); the numbers below
 * are only the conservative fallback used when no version is in force [Đề xuất dev - chờ xác nhận: Khách /
 * Chủ garage, D-11]. Pure functions, no I/O.
 */

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';
export const APPROVAL_STATUSES: readonly ApprovalStatus[] = [
  'pending',
  'approved',
  'rejected',
  'withdrawn',
];

/** 1 = branch manager, 2 = owner (G4-APR-03 "Cấp 1 / Cấp 2"). */
export type ApprovalLevel = 1 | 2;

export const APPROVAL_KINDS = [
  'payment_reversal',
  'expense',
  'debt_handover',
  'cash_variance',
] as const;
export type ApprovalKind = (typeof APPROVAL_KINDS)[number];
export const isApprovalKind = (k: string): k is ApprovalKind =>
  (APPROVAL_KINDS as readonly string[]).includes(k);

export interface ApprovalLimits {
  /** the requester decides alone up to this value (0 = never alone). Ignored for `alwaysNeeded` kinds. */
  selfMaxVnd: number;
  /** a level-1 approver decides up to this value; above it the owner (level 2) decides */
  level1MaxVnd: number;
  /** hours before an undecided request is shown as overdue / escalated (FR-SYS-004 "hết hạn thì nhắc") */
  dueHours: number;
}

export interface ApprovalKindDef {
  /** true = the request is needed whatever the value (reversal, debt, cash variance) */
  alwaysNeeded: boolean;
  defaults: ApprovalLimits;
}

/** RULE-011: spend over the limit needs approval. Fallbacks are conservative: an expense is never alone. */
export const APPROVAL_KIND_DEFS: Readonly<Record<ApprovalKind, ApprovalKindDef>> = {
  payment_reversal: {
    alwaysNeeded: true,
    defaults: { selfMaxVnd: 0, level1MaxVnd: 50_000_000, dueHours: 24 },
  },
  expense: {
    alwaysNeeded: false,
    defaults: { selfMaxVnd: 0, level1MaxVnd: 5_000_000, dueHours: 24 },
  },
  debt_handover: {
    alwaysNeeded: true,
    defaults: { selfMaxVnd: 0, level1MaxVnd: 10_000_000, dueHours: 8 },
  },
  cash_variance: {
    alwaysNeeded: true,
    defaults: { selfMaxVnd: 0, level1MaxVnd: 500_000, dueHours: 24 },
  },
};

/** 0 = no approval needed; 1 or 2 = the level that must decide. */
export function requiredLevel(
  kind: ApprovalKind,
  valueVnd: number,
  limits: ApprovalLimits = APPROVAL_KIND_DEFS[kind].defaults,
): 0 | ApprovalLevel {
  if (!Number.isInteger(valueVnd) || valueVnd < 0)
    throw new RangeError('value must be integer VND');
  if (!APPROVAL_KIND_DEFS[kind].alwaysNeeded && valueVnd <= limits.selfMaxVnd) return 0;
  return valueVnd <= limits.level1MaxVnd ? 1 : 2;
}

/** The permission that lets someone decide a request of this level (level 2 holders are also level 1). */
export const approverPermission = (level: ApprovalLevel): `${string}:approve` =>
  level === 1 ? 'approval-l1:approve' : 'approval-l2:approve';

export interface ApprovalRequest {
  id: string;
  companyId: string;
  branchId: string;
  /** YC-<BRANCH>-<YYMM>-<seq> (numbering series `approval-request`) */
  number: string;
  kind: ApprovalKind;
  level: ApprovalLevel;
  /** what the request is about: `payment`, `order`, `shift`, `expense` ... and its id */
  subjectType: string;
  subjectId: string;
  /** human label of the subject (a document number): never personal data */
  subjectLabel: string;
  valueVnd: number;
  reason: string;
  /** what the executing use case needs (validated by its own schema); no personal data */
  payload: Record<string, unknown>;
  status: ApprovalStatus;
  requestedBy: string;
  requestedByName: string;
  requestedByRole: string;
  requestedAt: Date;
  dueAt: Date;
  decidedBy?: string;
  decidedByName?: string;
  decidedAt?: Date;
  decisionNote?: string;
  /** a request whose effect needs a later step (reversal, expense payment) is consumed once */
  consumedAt?: Date;
  consumedBy?: string;
  resultId?: string;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

export type ApprovalDecision = 'approve' | 'reject';

export type DecideCheck = { ok: true } | { ok: false; reason: string };

/** The state-and-person rule of a decision (the permission and branch scope are checked by the caller). */
export function checkDecision(
  r: Pick<ApprovalRequest, 'status' | 'requestedBy'>,
  deciderId: string,
): DecideCheck {
  if (r.status !== 'pending') return { ok: false, reason: 'approval_not_pending' };
  if (r.requestedBy === deciderId) return { ok: false, reason: 'approval_self_decision' };
  return { ok: true };
}

export const isOverdue = (r: Pick<ApprovalRequest, 'status' | 'dueAt'>, now: Date): boolean =>
  r.status === 'pending' && r.dueAt.getTime() < now.getTime();

/** One deterministic slot per (kind, subject) so a second pending request cannot be opened for the same thing. */
export const approvalSlotId = (kind: string, subjectId: string): string =>
  `${kind}__${subjectId.replace(/[/]/g, '~')}`;
