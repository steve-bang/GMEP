/**
 * Tenant record and lifecycle (FR-TEN-001, 003; analysis §5; ADR 0002). Pure data and rules, no I/O.
 *
 * The tenant is the sixth object with its own state machine, separate from quote, repair order, repair item,
 * payment and invoice. The transition table below is DATA: changing who may move a tenant where is a table edit,
 * not scattered conditions. No state has a way back from `purged`, `rejected` or `cancelled`.
 */

export const TENANT_STATUSES = [
  'signup_pending',
  'rejected',
  'proposed',
  'provisioning',
  'provision_failed',
  'onboarding',
  'active',
  'restricted',
  'suspended',
  'terminating',
  'terminated',
  'purged',
  'cancelled',
] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

/** Immutable tenant code (FR-TEN-001); also the document id and the `tenantId` of every record of the tenant. */
export const TENANT_ID_PATTERN = /^[a-z][a-z0-9_]{2,39}$/;

/** `pooled` = shared database (ADR 0002 §2.1). Other values are reserved for a tenant moved to its own database. */
export type TenantPlacement = 'pooled';
/** FR-TEN-021 / C-15: demo data and real data are told apart; `fake` e-invoice provider is refused for `live`. */
export type TenantEnvironment = 'demo' | 'live';
/** B0 of FR-TEN-028: the plan slot. The default is the free plan, no clock, no trial (RULE-035). */
export type TenantPlan = 'free';
export type SubscriptionStatus = 'none';

export interface ProvisioningStepState {
  doneAt: Date;
}

export interface PendingTransition {
  to: TenantStatus;
  reason: string;
  requestedBy: string;
  /** role of the requester, kept so the audit line of the final decision names the requester (not the approver) */
  requestedByRole: string;
  requestedAt: Date;
}

/**
 * RULE-029 / FR-TEN-037 (minimum): manual record that the tenant accepted the Terms and the DPA. Append-only: a new
 * version is a new entry, an entry is never edited. Real data (Excel import, live e-invoice, `onboarding -> active`)
 * waits for the first one. The signed document itself is kept outside the system; `documentRef` only points at it.
 */
export interface TermsAcceptance {
  id: string;
  termsVersion: string;
  dpaVersion: string;
  /** who accepted for the tenant (the tenant representative; name only, no contact data) */
  acceptedByName: string;
  acceptedByCapacity: string;
  /** date the tenant accepted (yyyy-MM-dd) */
  acceptedOn: string;
  documentRef: string;
  /** platform user who typed it in, and when */
  recordedBy: string;
  recordedAt: Date;
}

export const hasTermsAcceptance = (t: Pick<Tenant, 'termsAcceptances'>): boolean =>
  (t.termsAcceptances ?? []).length > 0;

export interface Tenant {
  /** immutable code, never deleted (FR-TEN-001) */
  id: string;
  name: string;
  /** legal entities of the tenant (FR-SYS-018); reserved, Company is built later */
  legalEntityIds: string[];
  contact?: string;
  /** contract / terms reference (FR-TEN-001, FR-TEN-037) */
  contractRef?: string;
  status: TenantStatus;
  plan: TenantPlan;
  subscriptionStatus: SubscriptionStatus;
  environment: TenantEnvironment;
  placement: TenantPlacement;
  /** a legal hold blocks `purged` (analysis §5.4) */
  legalHold: boolean;
  /** the garage owner to invite while provisioning (FR-TEN-002); personal data of platform onboarding, never in a DTO */
  owner?: { email: string; name: string; employeeCode: string };
  /** FR-TEN-002: idempotency key of the provisioning request that created the tenant */
  provisionRequestKey: string;
  /** checklist steps already done: a re-run skips them (no duplicate data) */
  provisioning: Record<string, ProvisioningStepState>;
  pendingTransition?: PendingTransition;
  /** RULE-029: manual acceptances of Terms and DPA, oldest first */
  termsAcceptances?: TermsAcceptance[];
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

// ---- lifecycle (FR-TEN-003) ---------------------------------------------------

export type TransitionActor = 'platform' | 'system' | 'tenant_owner';
/**
 * `none`: no second person. `owner`: the platform owner (CNT) must approve; the owner acting alone counts as approval.
 * `two_person`: another holder of the approve permission decides (RULE-027), never the requester.
 */
export type TenantApprovalKind = 'none' | 'owner' | 'two_person';

export interface TransitionRule {
  from: TenantStatus;
  to: TenantStatus;
  actors: readonly TransitionActor[];
  reasonRequired: boolean;
  approval: TenantApprovalKind;
}

const R = (
  from: TenantStatus,
  to: TenantStatus,
  actors: TransitionActor[],
  reasonRequired: boolean,
  approval: TenantApprovalKind = 'none',
): TransitionRule => ({ from, to, actors, reasonRequired, approval });

export const TENANT_TRANSITIONS: readonly TransitionRule[] = [
  R('signup_pending', 'provisioning', ['system', 'platform'], false),
  R('signup_pending', 'rejected', ['system', 'platform'], true),
  R('proposed', 'provisioning', ['platform'], false, 'owner'),
  R('proposed', 'cancelled', ['platform'], true),
  R('provisioning', 'onboarding', ['system'], false),
  R('provisioning', 'provision_failed', ['system'], true),
  R('provision_failed', 'provisioning', ['system', 'platform'], false),
  R('provision_failed', 'cancelled', ['platform'], true),
  R('onboarding', 'active', ['tenant_owner', 'platform'], false),
  R('onboarding', 'cancelled', ['platform'], true),
  R('active', 'restricted', ['system', 'platform'], true),
  R('restricted', 'active', ['system', 'platform'], true),
  R('active', 'suspended', ['platform'], true, 'two_person'),
  R('restricted', 'suspended', ['platform'], true, 'two_person'),
  R('suspended', 'active', ['platform'], true),
  R('active', 'terminating', ['platform'], true, 'two_person'),
  R('restricted', 'terminating', ['platform'], true, 'two_person'),
  R('suspended', 'terminating', ['platform'], true, 'two_person'),
  R('terminating', 'terminated', ['platform'], true, 'two_person'),
  R('terminating', 'active', ['platform'], true),
  R('terminated', 'purged', ['platform'], true, 'two_person'),
];

export type TransitionRefusal =
  | 'transition_not_allowed'
  | 'actor_not_allowed'
  | 'reason_required'
  | 'legal_hold'
  | 'terms_acceptance_required';

export type TransitionDecision =
  { ok: true; rule: TransitionRule } | { ok: false; code: TransitionRefusal };

export function ruleFor(from: TenantStatus, to: TenantStatus): TransitionRule | null {
  return TENANT_TRANSITIONS.find((r) => r.from === from && r.to === to) ?? null;
}

export function allowedTransitions(from: TenantStatus): TransitionRule[] {
  return TENANT_TRANSITIONS.filter((r) => r.from === from);
}

/** Checks a requested move against the table: edge exists, actor kind allowed, reason given, no legal hold. */
export function decideTransition(
  tenant: Pick<Tenant, 'status' | 'legalHold'> &
    Partial<Pick<Tenant, 'termsAcceptances' | 'environment'>>,
  to: TenantStatus,
  ctx: { actor: TransitionActor; reason?: string },
): TransitionDecision {
  const rule = ruleFor(tenant.status, to);
  if (!rule) return { ok: false, code: 'transition_not_allowed' };
  if (!rule.actors.includes(ctx.actor)) return { ok: false, code: 'actor_not_allowed' };
  if (rule.reasonRequired && (ctx.reason ?? '').trim().length < 3)
    return { ok: false, code: 'reason_required' };
  if (to === 'purged' && tenant.legalHold) return { ok: false, code: 'legal_hold' };
  // RULE-029: no go-live of a real (`live`) tenant without the recorded Terms and DPA acceptance; demo tenants hold no real data
  if (
    rule.from === 'onboarding' &&
    to === 'active' &&
    tenant.environment !== 'demo' &&
    !hasTermsAcceptance(tenant)
  )
    return { ok: false, code: 'terms_acceptance_required' };
  return { ok: true, rule };
}

/**
 * What a tenant's users may do in each state (analysis §5.1). Enforcement at the access layer (suspended read-only,
 * restricted no new documents) is MT-1/MT-3; MT-0 enforces the part that is a hard stop: nobody signs in to a tenant
 * that is not in a state with `signIn`.
 */
export const TENANT_ACCESS: Record<TenantStatus, { signIn: boolean; write: boolean }> = {
  signup_pending: { signIn: false, write: false },
  rejected: { signIn: false, write: false },
  proposed: { signIn: false, write: false },
  provisioning: { signIn: false, write: false },
  provision_failed: { signIn: false, write: false },
  onboarding: { signIn: true, write: true },
  active: { signIn: true, write: true },
  restricted: { signIn: true, write: true },
  suspended: { signIn: true, write: false },
  terminating: { signIn: true, write: false },
  terminated: { signIn: false, write: false },
  purged: { signIn: false, write: false },
  cancelled: { signIn: false, write: false },
};

export const tenantAllowsSignIn = (status: TenantStatus): boolean => TENANT_ACCESS[status].signIn;

/** Checklist of provisioning steps in execution order (FR-TEN-002). Steps are idempotent. */
export const PROVISIONING_STEPS = ['roles', 'owner_membership', 'owner_invitation'] as const;
export type ProvisioningStepName = (typeof PROVISIONING_STEPS)[number];

/** Defaults of a freshly created tenant: free plan, no subscription clock (RULE-035), pooled storage. */
export function newTenantDefaults(): Pick<
  Tenant,
  'plan' | 'subscriptionStatus' | 'placement' | 'legalHold' | 'legalEntityIds' | 'provisioning'
> {
  return {
    plan: 'free',
    subscriptionStatus: 'none',
    placement: 'pooled',
    legalHold: false,
    legalEntityIds: [],
    provisioning: {},
  };
}
