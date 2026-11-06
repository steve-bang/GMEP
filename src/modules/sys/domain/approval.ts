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
  'deposit_refund',
  // FR-ACC-016: money received for an order goes back to the customer; always decided by a manager (RULE-011)
  'customer_refund',
  // FR-ACC-005: reopening a closed day is decided by the owner only (R62)
  'day_reopen',
  'debt_handover',
  'cash_variance',
  // slice 1.8 (FR-EIN-007): correcting an issued invoice is always decided by someone other than the requester
  'invoice_adjust',
  'invoice_replace',
  'invoice_cancel',
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
  /**
   * R58: the requester's own approvals (values <= selfMaxVnd) of one cash shift may not add up to more than this;
   * the voucher that would pass it needs an approval. Absent = no running cap. Only meaningful for `expense`.
   */
  shiftCapVnd?: number;
  /**
   * R106: hours an APPROVED request stays usable; later it must be asked for again. Absent = no expiry. Only used by
   * `day_reopen` today (2 hours), configurable.
   */
  validHours?: number;
  /**
   * R106: a branch that reopens its day more than this many times in a calendar month raises an exception notice to
   * the owner and the accountant (default 3 [Đề xuất dev - chờ xác nhận]). Only `day_reopen`.
   */
  maxReopensPerMonth?: number;
  /**
   * FR-SYS-034 "T2": hours (of branch working time) AFTER the reminder (`dueHours` = T1) before a pending level-1
   * request moves to level 2. Absent = never escalates; the request is only reminded.
   */
  escalateAfterHours?: number;
  /** FR-SYS-034: this kind may be approved in bulk (same kind only). Absent = not allowed. */
  bulkAllowed?: boolean;
  /** R106 as configuration: the decider types the password again to approve. Absent = the legacy list `REAUTH_ON_APPROVE`. */
  reauthOnApprove?: boolean;
  /**
   * RULE-036 / FR-SYS-033: no limit has been issued for the kind, so every request goes to the highest level and
   * nothing passes alone. Set by `unconfiguredLimits`, never by configuration.
   */
  topOnly?: boolean;
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
  // R57: a deposit refund is always decided by a manager (no self-decision tier), above 50.000.000 by the owner
  deposit_refund: {
    alwaysNeeded: true,
    defaults: { selfMaxVnd: 0, level1MaxVnd: 50_000_000, dueHours: 24 },
  },
  customer_refund: {
    alwaysNeeded: true,
    defaults: { selfMaxVnd: 0, level1MaxVnd: 10_000_000, dueHours: 24, validHours: 24 },
  },
  // no value: the request is raised at level 2 (owner) whatever the numbers
  day_reopen: {
    alwaysNeeded: true,
    defaults: { selfMaxVnd: 0, level1MaxVnd: 0, dueHours: 24, validHours: 2 },
  },
  debt_handover: {
    alwaysNeeded: true,
    defaults: { selfMaxVnd: 0, level1MaxVnd: 10_000_000, dueHours: 8 },
  },
  // FR-EIN-007: an issued invoice is never edited; the accountant proposes, the chief accountant (invoice:approve) decides.
  // Level 1 = KT with the chief-accountant right or the owner; there is no value tier, so the level-1 ceiling is unbounded.
  invoice_adjust: {
    alwaysNeeded: true,
    defaults: { selfMaxVnd: 0, level1MaxVnd: 1_000_000_000_000, dueHours: 24 },
  },
  invoice_replace: {
    alwaysNeeded: true,
    defaults: { selfMaxVnd: 0, level1MaxVnd: 1_000_000_000_000, dueHours: 24 },
  },
  invoice_cancel: {
    alwaysNeeded: true,
    defaults: { selfMaxVnd: 0, level1MaxVnd: 1_000_000_000_000, dueHours: 24 },
  },
  cash_variance: {
    alwaysNeeded: true,
    defaults: { selfMaxVnd: 0, level1MaxVnd: 500_000, dueHours: 24 },
  },
};

/**
 * RULE-036 / FR-SYS-033: a kind with no limit version in force asks for the highest level and never passes alone.
 * Only the hours-based technical fallbacks of the kind (reminder time, validity) are kept; NO money number.
 */
export const unconfiguredLimits = (kind: ApprovalKind): ApprovalLimits => {
  const d = APPROVAL_KIND_DEFS[kind].defaults;
  return {
    selfMaxVnd: 0,
    level1MaxVnd: 0,
    dueHours: d.dueHours,
    ...(d.validHours !== undefined ? { validHours: d.validHours } : {}),
    topOnly: true,
  };
};

/** R106: the decider types the password again for a kind: the configured flag wins over the legacy list. */
export const reauthRequired = (kind: ApprovalKind, limits: ApprovalLimits): boolean =>
  limits.reauthOnApprove ?? REAUTH_ON_APPROVE.includes(kind);

/** R106: the owner types the password again when approving these (not MFA: MFA is out of scope) */
export const REAUTH_ON_APPROVE: readonly ApprovalKind[] = ['day_reopen'];

/** R106: an approved request older than `validHours` can no longer be used */
export const isApprovalExpired = (
  decidedAt: Date,
  now: Date,
  validHours: number | undefined,
): boolean =>
  validHours !== undefined && now.getTime() > decidedAt.getTime() + validHours * 3_600_000;

/**
 * 0 = no approval needed; 1 or 2 = the level that must decide. `accumulatedVnd` (RULE-036, FR-ACC-028) is what the
 * kind's accumulator already counted in its window (same category, supplier and branch): the LIMIT is compared with
 * value + accumulated so a split spend cannot slip under it. The accumulator itself is the owning module's (slice 2.7).
 */
export function requiredLevel(
  kind: ApprovalKind,
  valueVnd: number,
  limits: ApprovalLimits = APPROVAL_KIND_DEFS[kind].defaults,
  accumulatedVnd = 0,
): 0 | ApprovalLevel {
  if (!Number.isInteger(valueVnd) || valueVnd < 0)
    throw new RangeError('value must be integer VND');
  if (!Number.isInteger(accumulatedVnd) || accumulatedVnd < 0)
    throw new RangeError('accumulated value must be integer VND');
  if (limits.topOnly) return 2;
  const total = valueVnd + accumulatedVnd;
  if (!APPROVAL_KIND_DEFS[kind].alwaysNeeded && total <= limits.selfMaxVnd) return 0;
  return total <= limits.level1MaxVnd ? 1 : 2;
}

/** The permission that lets someone decide a request of this level (level 2 holders are also level 1). */
export const approverPermission = (level: ApprovalLevel): `${string}:approve` =>
  level === 1 ? 'approval-l1:approve' : 'approval-l2:approve';

/** Invoice corrections are decided by the "chief accountant" right (`invoice:approve`, FR-EIN-007), a role setting of KT. */
export const INVOICE_APPROVAL_KINDS: readonly ApprovalKind[] = [
  'invoice_adjust',
  'invoice_replace',
  'invoice_cancel',
];
export const INVOICE_APPROVER_PERMISSION = 'invoice:approve' as const;

/** The permission that decides a request of this kind and level (level 2 is always the owner). */
export const approverPermissionFor = (
  kind: ApprovalKind,
  level: ApprovalLevel,
): `${string}:approve` =>
  level === 1 && INVOICE_APPROVAL_KINDS.includes(kind)
    ? INVOICE_APPROVER_PERMISSION
    : approverPermission(level);

export interface ApprovalRequest {
  id: string;
  tenantId: string;
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
  /** FR-SYS-034: when the approvers were reminded (once) */
  remindedAt?: Date;
  /** FR-SYS-034: moved from `escalatedFrom` to the current level (still `pending`); reason is `overdue` or `no_eligible_approver` */
  escalatedAt?: Date;
  escalatedFrom?: ApprovalLevel;
  escalationReason?: string;
  /** FR-SYS-033: decided by the delegate named in `decidedBy` on behalf of this person, under this delegation */
  decidedOnBehalfOf?: string;
  delegationId?: string;
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

// ---- working time, reminders and escalation (FR-SYS-015, FR-SYS-034) -----------------------------------

/**
 * Working time of a branch (config `work-hours`, effective-dated): local days of the week (0 = Sunday) and the
 * minute of the day the work starts and ends. Local time is Vietnam's fixed UTC+7. No schedule in force = wall-clock
 * time (every hour counts), which escalates earlier, never later.
 */
export interface WorkSchedule {
  days: number[];
  startMinute: number;
  endMinute: number;
}
const VN_OFFSET_MS = 7 * 3_600_000;
const DAY_MS = 86_400_000;

/** Whole minutes of working time between two instants (0 when `to` is not after `from`). */
export function workingMinutesBetween(from: Date, to: Date, s: WorkSchedule | null): number {
  const a = from.getTime();
  const b = to.getTime();
  if (b <= a) return 0;
  if (!s) return Math.floor((b - a) / 60_000);
  let total = 0;
  // local midnight (as a UTC instant) of the first local day
  let day = Math.floor((a + VN_OFFSET_MS) / DAY_MS) * DAY_MS - VN_OFFSET_MS;
  for (let i = 0; day < b && i < 400; i++, day += DAY_MS) {
    const dow = new Date(day + VN_OFFSET_MS).getUTCDay();
    if (!s.days.includes(dow)) continue;
    const start = Math.max(day + s.startMinute * 60_000, a);
    const end = Math.min(day + s.endMinute * 60_000, b);
    if (end > start) total += Math.floor((end - start) / 60_000);
  }
  return total;
}

export type EscalationAction = 'none' | 'remind' | 'escalate';

/**
 * What the background job does with a request after `workedMinutes` of working time (FR-SYS-034). T1 = `dueHours`
 * reminds the current approvers once; T2 = `escalateAfterHours` more moves a level-1 request to level 2. An escalated
 * request stays `pending`. Each step happens once (`remindedAt`, `escalatedAt`), so a repeated run changes nothing.
 */
export function escalationAction(
  r: Pick<ApprovalRequest, 'status' | 'level' | 'remindedAt' | 'escalatedAt'>,
  limits: Pick<ApprovalLimits, 'dueHours' | 'escalateAfterHours'>,
  workedMinutes: number,
): EscalationAction {
  if (r.status !== 'pending') return 'none';
  const t1 = limits.dueHours * 60;
  if (
    r.level === 1 &&
    !r.escalatedAt &&
    limits.escalateAfterHours !== undefined &&
    workedMinutes >= t1 + limits.escalateAfterHours * 60
  )
    return 'escalate';
  if (!r.remindedAt && workedMinutes >= t1) return 'remind';
  return 'none';
}

// ---- delegation (FR-SYS-033, RULE-036) ------------------------------------------------------------------

export interface ApprovalDelegation {
  id: string;
  tenantId: string;
  /** whose approval right is lent; must still hold the right (at the request's branch) when the delegate decides */
  delegatorId: string;
  delegateId: string;
  /** the kinds the delegate may decide (never empty: a delegation is off by default and explicit) */
  kinds: ApprovalKind[];
  /** the branches covered; never empty (a group of branches = a list, [Cần xác nhận: Q84]) */
  branchIds: string[];
  validFrom: Date;
  validUntil: Date;
  status: 'active' | 'revoked';
  reason: string;
  revokedAt?: Date;
  revokedBy?: string;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

/** Expiry takes the right away at once: `validUntil` is exclusive. */
export const delegationInForce = (
  d: Pick<ApprovalDelegation, 'status' | 'validFrom' | 'validUntil'>,
  now: Date,
): boolean =>
  d.status === 'active' &&
  now.getTime() >= d.validFrom.getTime() &&
  now.getTime() < d.validUntil.getTime();

/**
 * Whether a delegation in force lets its delegate decide the request. The delegate is never the requester (checked
 * by `checkDecision`), and a request the DELEGATOR raised cannot be approved through the delegator's right (RULE-036:
 * no self-approval by proxy).
 */
export const delegationCovers = (
  d: ApprovalDelegation,
  r: Pick<ApprovalRequest, 'kind' | 'branchId' | 'requestedBy'>,
  now: Date,
): boolean =>
  delegationInForce(d, now) &&
  d.kinds.includes(r.kind) &&
  d.branchIds.includes(r.branchId) &&
  d.delegatorId !== r.requestedBy;

export type DelegationCheck = { ok: true } | { ok: false; code: string; field?: string };

/** Shape rules of a new delegation (the permission and view-scope rules are checked by the use case). */
export function checkNewDelegation(
  d: Pick<
    ApprovalDelegation,
    'delegatorId' | 'delegateId' | 'kinds' | 'branchIds' | 'validFrom' | 'validUntil'
  >,
  now: Date,
): DelegationCheck {
  if (d.delegatorId === d.delegateId)
    return { ok: false, code: 'delegation_self', field: 'delegateId' };
  if (d.kinds.length === 0) return { ok: false, code: 'delegation_kinds_required', field: 'kinds' };
  if (d.branchIds.length === 0)
    return { ok: false, code: 'delegation_branches_required', field: 'branchIds' };
  if (d.validUntil.getTime() <= d.validFrom.getTime() || d.validUntil.getTime() <= now.getTime())
    return { ok: false, code: 'delegation_period_invalid', field: 'validUntil' };
  return { ok: true };
}
