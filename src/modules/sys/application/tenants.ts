import { z } from 'zod';
import { AppError, conflict, forbidden, notFound } from '@/platform/errors/errors';
import type { Tx } from '@/platform/tx/unitOfWork';
import { identityOf, normalizeEmployeeCode, roleAssignmentId } from '../domain/entities';
import { defaultRoleSeeds } from '../domain/permissions';
import {
  platformHas,
  type PlatformActor,
  type PlatformAuditEntry,
  type PlatformPermission,
  type SystemActor,
} from '../domain/platform';
import {
  PROVISIONING_STEPS,
  TENANT_ID_PATTERN,
  TENANT_STATUSES,
  decideTransition,
  hasTermsAcceptance,
  newTenantDefaults,
  type Tenant,
  type TenantStatus,
  type TransitionActor,
} from '../domain/tenant';
import type { SysDeps } from '../ports/deps';
import { sendInvitation } from './users';
import { parseInput, type RequestCtx } from './support';

/**
 * Tenant record, lifecycle and provisioning (FR-TEN-001, 002, 003, 013; ADR 0002). Platform-level use cases: they take a
 * PlatformActor or the SystemActor, never a tenant `Actor`, so a tenant session cannot reach them (FR-TEN-011), and every
 * change stages a platform audit entry in the same transaction (FR-TEN-013).
 */
export type PlatformCaller = PlatformActor | SystemActor;

const SYSTEM_ID = (a: SystemActor) => `system:${a.id}`;
const actorId = (a: PlatformCaller) => (a.kind === 'platform' ? a.platformUserId : SYSTEM_ID(a));
const actorRole = (a: PlatformCaller): PlatformAuditEntry['actorRole'] =>
  a.kind === 'platform' ? a.role : 'system';

function require(a: PlatformCaller, p: PlatformPermission): void {
  if (a.kind === 'platform' && !platformHas(a, p)) throw forbidden();
}

function audit(
  deps: SysDeps,
  tx: Tx,
  a: PlatformCaller,
  ctx: RequestCtx,
  e: Pick<PlatformAuditEntry, 'action' | 'tenantId'> &
    Partial<
      Pick<
        PlatformAuditEntry,
        'reason' | 'approverId' | 'before' | 'after' | 'actorId' | 'actorRole'
      >
    >,
): void {
  deps.platformAudit.record(tx, {
    id: deps.newId(),
    at: deps.clock.now(),
    actorId: actorId(a),
    actorRole: actorRole(a),
    before: null,
    after: null,
    requestId: ctx.requestId,
    ...e,
  });
}

// ---- reads --------------------------------------------------------------------

export interface TenantDto {
  id: string;
  name: string;
  status: TenantStatus;
  plan: Tenant['plan'];
  subscriptionStatus: Tenant['subscriptionStatus'];
  environment: Tenant['environment'];
  placement: Tenant['placement'];
  legalHold: boolean;
  contractRef: string | null;
  /** RULE-029: latest recorded acceptance of Terms and DPA, null = none yet (real data is blocked) */
  termsAcceptance: {
    termsVersion: string;
    dpaVersion: string;
    acceptedByName: string;
    acceptedOn: string;
    documentRef: string;
    recordedBy: string;
    recordedAt: string;
  } | null;
  pendingTransition: { to: TenantStatus; reason: string; requestedBy: string } | null;
  provisioning: string[];
  createdAt: string;
  version: number;
}

const latestTerms = (t: Tenant): TenantDto['termsAcceptance'] => {
  const a = (t.termsAcceptances ?? []).at(-1);
  return a
    ? {
        termsVersion: a.termsVersion,
        dpaVersion: a.dpaVersion,
        acceptedByName: a.acceptedByName,
        acceptedOn: a.acceptedOn,
        documentRef: a.documentRef,
        recordedBy: a.recordedBy,
        recordedAt: a.recordedAt.toISOString(),
      }
    : null;
};

const toDto = (t: Tenant): TenantDto => ({
  id: t.id,
  name: t.name,
  status: t.status,
  plan: t.plan,
  subscriptionStatus: t.subscriptionStatus,
  environment: t.environment,
  placement: t.placement,
  legalHold: t.legalHold,
  contractRef: t.contractRef ?? null,
  termsAcceptance: latestTerms(t),
  pendingTransition: t.pendingTransition
    ? {
        to: t.pendingTransition.to,
        reason: t.pendingTransition.reason,
        requestedBy: t.pendingTransition.requestedBy,
      }
    : null,
  provisioning: Object.keys(t.provisioning),
  createdAt: t.createdAt.toISOString(),
  version: t.version,
});

export async function listTenants(deps: SysDeps, actor: PlatformActor): Promise<TenantDto[]> {
  require(actor, 'tenant:view');
  return (await deps.tenants.list(200)).map(toDto);
}

export async function getTenant(
  deps: SysDeps,
  actor: PlatformActor,
  id: string,
): Promise<TenantDto> {
  require(actor, 'tenant:view');
  const t = await deps.tenants.get(id);
  if (!t) throw notFound();
  return toDto(t);
}

// ---- terms and DPA (RULE-029, FR-TEN-037 minimum) ---------------------------------

export const termsSchema = z.object({
  termsVersion: z.string().trim().min(1).max(40),
  dpaVersion: z.string().trim().min(1).max(40),
  acceptedByName: z.string().trim().min(2).max(120),
  acceptedByCapacity: z.string().trim().min(2).max(120),
  acceptedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  documentRef: z.string().trim().min(3).max(300),
});

/** Records (appends) the tenant's acceptance of Terms and DPA. Never edits an earlier entry; audited on the platform log. */
export async function recordTermsAcceptance(
  deps: SysDeps,
  actor: PlatformActor,
  id: string,
  input: unknown,
  ctx: RequestCtx,
): Promise<TenantDto> {
  require(actor, 'tenant:terms-record');
  const data = parseInput(termsSchema, input);
  return deps.uow.run(async (tx) => {
    const t = await deps.tenants.getInTx(tx, id);
    if (!t) throw notFound();
    const now = deps.clock.now();
    const entry = { id: deps.newId(), ...data, recordedBy: actor.platformUserId, recordedAt: now };
    const list = [...(t.termsAcceptances ?? []), entry];
    deps.tenants.update(tx, t.id, {
      termsAcceptances: list,
      updatedAt: now,
      updatedBy: actor.platformUserId,
      version: t.version + 1,
    });
    audit(deps, tx, actor, ctx, {
      action: 'tenant.terms_accepted',
      tenantId: t.id,
      before: { accepted: (t.termsAcceptances ?? []).length > 0 },
      after: {
        termsVersion: data.termsVersion,
        dpaVersion: data.dpaVersion,
        acceptedOn: data.acceptedOn,
        documentRef: data.documentRef,
      },
    });
    return toDto({ ...t, termsAcceptances: list, version: t.version + 1 });
  });
}

/**
 * RULE-029: real data waits for the recorded acceptance. A `demo` tenant is exempt (no real data by definition); a
 * `live` one needs at least one record. Throws `terms_acceptance_required` (409).
 */
export async function assertTermsAccepted(deps: SysDeps, tenantId: string): Promise<void> {
  const t = await deps.tenants.get(tenantId);
  if (t && t.environment === 'live' && !hasTermsAcceptance(t))
    throw new AppError('terms_acceptance_required', 409);
}

/** Same rule as a boolean, for checklists (the e-invoice eligibility list). */
export async function tenantTermsBlock(deps: SysDeps, tenantId: string): Promise<boolean> {
  const t = await deps.tenants.get(tenantId);
  return !!t && t.environment === 'live' && !hasTermsAcceptance(t);
}

// ---- lifecycle ----------------------------------------------------------------

export const transitionSchema = z.object({
  to: z.enum(TENANT_STATUSES),
  reason: z.string().trim().max(500).optional(),
  version: z.number().int().positive(),
});

const asTransitionActor = (a: PlatformCaller): TransitionActor =>
  a.kind === 'platform' ? 'platform' : 'system';

/** Stages the status change and its platform audit line. Reads of the caller happen before (Firestore rule). */
function applyTransition(
  deps: SysDeps,
  tx: Tx,
  t: Tenant,
  to: TenantStatus,
  by: PlatformCaller,
  ctx: RequestCtx,
  extra: {
    reason?: string;
    approverId?: string;
    action?: string;
    /** the requester of a two-person move: the audit line names him as the actor and the approver separately */
    onBehalfOf?: { id: string; role: PlatformAuditEntry['actorRole'] };
  } = {},
): void {
  const now = deps.clock.now();
  deps.tenants.update(tx, t.id, {
    status: to,
    pendingTransition: null,
    updatedAt: now,
    updatedBy: actorId(by),
    version: t.version + 1,
  });
  audit(deps, tx, by, ctx, {
    ...(extra.onBehalfOf ? { actorId: extra.onBehalfOf.id, actorRole: extra.onBehalfOf.role } : {}),
    action: extra.action ?? 'tenant.status_changed',
    tenantId: t.id,
    before: { status: t.status },
    after: { status: to },
    ...(extra.reason ? { reason: extra.reason } : {}),
    ...(extra.approverId ? { approverId: extra.approverId } : {}),
  });
}

export type TransitionOutcome =
  { state: 'applied'; tenant: TenantDto } | { state: 'awaiting_approval'; tenant: TenantDto };

/**
 * FR-TEN-003 / RULE-027: requests a move along the lifecycle. Moves that need a second person (suspend, terminate,
 * purge) are parked as `pendingTransition` and applied by `decideTenantTransition` by ANOTHER holder of the approve
 * permission; the owner (CNT) acting alone counts as the approval of `owner` moves. Illegal edges are refused.
 */
export async function transitionTenant(
  deps: SysDeps,
  actor: PlatformCaller,
  id: string,
  input: unknown,
  ctx: RequestCtx,
): Promise<TransitionOutcome> {
  require(actor, 'tenant:transition');
  const data = parseInput(transitionSchema, input);
  return deps.uow.run(async (tx) => {
    const t = await deps.tenants.getInTx(tx, id);
    if (!t) throw notFound();
    if (t.version !== data.version) throw conflict('version_conflict');
    const d = decideTransition(t, data.to, {
      actor: asTransitionActor(actor),
      ...(data.reason ? { reason: data.reason } : {}),
    });
    if (!d.ok) throw new AppError(d.code, d.code === 'actor_not_allowed' ? 403 : 422);
    const holdsApprove =
      actor.kind === 'platform' && platformHas(actor, 'tenant:transition-approve');
    const selfApproved =
      d.rule.approval === 'none' || (d.rule.approval === 'owner' && holdsApprove);
    if (selfApproved) {
      applyTransition(deps, tx, t, data.to, actor, ctx, {
        ...(data.reason ? { reason: data.reason } : {}),
        // MT0-3: the owner proposing and approving in one step is written out (proposer = approver), never left blank
        ...(d.rule.approval === 'owner' && actor.kind === 'platform'
          ? { approverId: actor.platformUserId }
          : {}),
      });
      return { state: 'applied', tenant: toDto({ ...t, status: data.to, version: t.version + 1 }) };
    }
    deps.tenants.update(tx, t.id, {
      pendingTransition: {
        to: data.to,
        reason: data.reason ?? '',
        requestedBy: actorId(actor),
        requestedByRole: actorRole(actor),
        requestedAt: deps.clock.now(),
      },
      updatedAt: deps.clock.now(),
      updatedBy: actorId(actor),
      version: t.version + 1,
    });
    audit(deps, tx, actor, ctx, {
      action: 'tenant.transition_requested',
      tenantId: t.id,
      before: { status: t.status },
      after: { status: t.status, requestedTo: data.to },
      ...(data.reason ? { reason: data.reason } : {}),
    });
    return {
      state: 'awaiting_approval',
      tenant: toDto({ ...t, pendingTransition: undefined, version: t.version + 1 }),
    };
  });
}

export const decisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  reason: z.string().trim().max(500).optional(),
});

/** Second step of a two-person move: another approver applies or rejects it; the requester can never approve. */
export async function decideTenantTransition(
  deps: SysDeps,
  actor: PlatformActor,
  id: string,
  input: unknown,
  ctx: RequestCtx,
): Promise<TransitionOutcome> {
  require(actor, 'tenant:transition-approve');
  const data = parseInput(decisionSchema, input);
  return deps.uow.run(async (tx) => {
    const t = await deps.tenants.getInTx(tx, id);
    if (!t) throw notFound();
    const p = t.pendingTransition;
    if (!p) throw conflict('no_pending_transition');
    if (p.requestedBy === actor.platformUserId)
      throw new AppError('approver_same_as_requester', 403);
    if (data.decision === 'reject') {
      if ((data.reason ?? '').trim().length < 3) throw new AppError('reason_required', 422);
      deps.tenants.update(tx, t.id, {
        pendingTransition: null,
        updatedAt: deps.clock.now(),
        updatedBy: actor.platformUserId,
        version: t.version + 1,
      });
      audit(deps, tx, actor, ctx, {
        action: 'tenant.transition_rejected',
        tenantId: t.id,
        before: { status: t.status, requestedTo: p.to },
        after: { status: t.status },
        reason: data.reason!,
      });
      return { state: 'applied', tenant: toDto({ ...t, pendingTransition: undefined }) };
    }
    // re-validate against the CURRENT state: the tenant may have moved since the request
    const d = decideTransition(t, p.to, { actor: 'platform', reason: p.reason });
    if (!d.ok) throw new AppError(d.code, 422);
    applyTransition(deps, tx, t, p.to, actor, ctx, {
      reason: p.reason,
      approverId: actor.platformUserId,
      action: 'tenant.status_changed',
      onBehalfOf: { id: p.requestedBy, role: p.requestedByRole as PlatformAuditEntry['actorRole'] },
    });
    return { state: 'applied', tenant: toDto({ ...t, status: p.to, version: t.version + 1 }) };
  });
}

// ---- provisioning (FR-TEN-002) ---------------------------------------------------

export const provisionSchema = z.object({
  /** immutable tenant code = tenant id */
  code: z.string().regex(TENANT_ID_PATTERN),
  name: z.string().trim().min(2).max(120),
  contact: z.string().trim().max(200).optional(),
  contractRef: z.string().trim().max(120).optional(),
  environment: z.enum(['demo', 'live']).default('live'),
  /** the garage owner (role CH, every branch): invited by email once the tenant exists (FR-TEN-002, 017) */
  owner: z
    .object({
      email: z.string().trim().toLowerCase().email().max(254),
      name: z.string().trim().min(2).max(120),
      employeeCode: z
        .string()
        .trim()
        .transform(normalizeEmployeeCode)
        .pipe(z.string().regex(/^[A-Z0-9._-]{2,20}$/))
        .default('CH01'),
    })
    .optional(),
});

export interface ProvisionResult {
  state: 'provisioned' | 'awaiting_approval' | 'failed';
  tenant: TenantDto;
  /** step that failed, when state is `failed` */
  failedStep?: string;
}

interface StepRunner {
  /** writes staged in the transaction that also records the step as done */
  tx?: (deps: SysDeps, tx: Tx, t: Tenant) => Promise<void>;
  /** external effects (identity provider, email): run BEFORE the step is recorded, so a failure retries the step */
  after?: (deps: SysDeps, t: Tenant) => Promise<void>;
}

/**
 * Checklist of idempotent steps. A step is only done once: its completion is recorded on the tenant in the SAME
 * transaction as its writes, so a re-run (retry, double click, timeout) skips it and creates no duplicate.
 * Further steps (owner invitation, first branch and warehouse for self-service) plug in here (FR-TEN-042, MT-1).
 */
const STEP_RUNNERS: Record<(typeof PROVISIONING_STEPS)[number], StepRunner> = {
  // the 10 default roles, per tenant; an existing role (possibly edited by the tenant) is never overwritten
  roles: {
    tx: async (deps, tx, t) => {
      const existing = new Set(
        (
          await deps.roles.getMany(
            t.id,
            defaultRoleSeeds().map((r) => r.code),
          )
        ).map((r) => r.code),
      );
      for (const r of defaultRoleSeeds())
        if (!existing.has(r.code))
          deps.roles.upsert(tx, t.id, r, { at: deps.clock.now(), by: 'provisioning' });
    },
  },
  // the garage owner's membership (status `invited`, role CH on every branch). An email that already has an identity
  // gets a new membership on it, never a new password (FR-TEN-017 d). Deterministic id: a retry cannot duplicate it.
  owner_membership: {
    tx: async (deps, tx, t) => {
      if (!t.owner) return;
      const id = ownerMembershipId(t.id);
      if (await deps.users.getByIdInTx(tx, t.id, id)) return;
      const known = await deps.users.findMembershipsByEmail(t.owner.email);
      if (known.some((m) => m.tenantId === t.id)) return;
      const existing = known[0] ? identityOf(known[0]) : null;
      const now = deps.clock.now();
      deps.users.create(
        tx,
        {
          id,
          ...(existing ? { identityId: existing } : {}),
          tenantId: t.id,
          email: t.owner.email,
          employeeCode: t.owner.employeeCode,
          displayName: t.owner.name,
          status: 'invited',
          createdAt: now,
          createdBy: 'provisioning',
          updatedAt: now,
          updatedBy: 'provisioning',
          version: 1,
        },
        { existingIdentity: existing !== null },
      );
      deps.assignments.add(tx, {
        id: roleAssignmentId(id, 'CH', '*'),
        userId: id,
        tenantId: t.id,
        roleCode: 'CH',
        branchId: '*',
        employeeCode: t.owner.employeeCode,
        createdAt: now,
        createdBy: 'provisioning',
      });
    },
  },
  owner_invitation: {
    after: async (deps, t) => {
      if (!t.owner) return;
      const m = await deps.users.getById(t.id, ownerMembershipId(t.id));
      if (!m || m.status !== 'invited') return; // already active: nothing to send
      await sendInvitation(deps, m);
    },
  },
};

const ownerMembershipId = (tenantId: string) => `own_${tenantId}`;

/**
 * Creates the tenant (status `proposed`) and drives it to `onboarding`. Idempotent on (code, request key): the same call
 * again resumes where it stopped and never creates a second tenant; the same code with another key is a conflict.
 * Platform staff without the approve permission leave the `proposed -> provisioning` edge awaiting the owner (analysis §5.3).
 */
export async function provisionTenant(
  deps: SysDeps,
  actor: PlatformCaller,
  input: unknown,
  ctx: RequestCtx,
): Promise<ProvisionResult> {
  require(actor, 'tenant:provision');
  const data = parseInput(provisionSchema, input);
  if (!ctx.idempotencyKey) throw new AppError('idempotency_key_required', 400);
  const key = ctx.idempotencyKey;
  const caller = asTransitionActor(actor);

  // 1) the record (created once, resumed afterwards)
  let tenant = await deps.uow.run(async (tx) => {
    const found = await deps.tenants.getInTx(tx, data.code);
    if (found) {
      if (found.provisionRequestKey !== key) throw conflict('tenant_code_taken');
      return found;
    }
    const now = deps.clock.now();
    const created: Tenant = {
      id: data.code,
      name: data.name,
      ...(data.contact ? { contact: data.contact } : {}),
      ...(data.contractRef ? { contractRef: data.contractRef } : {}),
      ...(data.owner ? { owner: data.owner } : {}),
      status: 'proposed',
      environment: data.environment,
      provisionRequestKey: key,
      ...newTenantDefaults(),
      createdAt: now,
      createdBy: actorId(actor),
      updatedAt: now,
      updatedBy: actorId(actor),
      version: 1,
    };
    deps.tenants.create(tx, created);
    audit(deps, tx, actor, ctx, {
      action: 'tenant.created',
      tenantId: created.id,
      after: { status: 'proposed', environment: created.environment, plan: created.plan },
    });
    return created;
  });

  // 2) proposed -> provisioning, or retry of a failed run
  if (tenant.status === 'proposed' || tenant.status === 'provision_failed') {
    const holdsApprove = actor.kind === 'system' || platformHas(actor, 'tenant:transition-approve');
    if (tenant.status === 'proposed' && !holdsApprove) {
      if (!tenant.pendingTransition)
        tenant = await deps.uow.run(async (tx) => {
          const t = (await deps.tenants.getInTx(tx, tenant.id))!;
          deps.tenants.update(tx, t.id, {
            pendingTransition: {
              to: 'provisioning',
              reason: 'provisioning',
              requestedBy: actorId(actor),
              requestedByRole: actorRole(actor),
              requestedAt: deps.clock.now(),
            },
            version: t.version + 1,
          });
          audit(deps, tx, actor, ctx, {
            action: 'tenant.transition_requested',
            tenantId: t.id,
            before: { status: t.status },
            after: { status: t.status, requestedTo: 'provisioning' },
          });
          return { ...t, version: t.version + 1 };
        });
      return { state: 'awaiting_approval', tenant: toDto(tenant) };
    }
    tenant = await deps.uow.run(async (tx) => {
      const t = (await deps.tenants.getInTx(tx, tenant.id))!;
      const d = decideTransition(t, 'provisioning', { actor: caller });
      if (!d.ok) throw new AppError(d.code, 422);
      applyTransition(deps, tx, t, 'provisioning', actor, ctx, {
        // MT0-3: CNT proposing and approving provisioning alone is written out, proposer = approver
        ...(t.status === 'proposed' && actor.kind === 'platform'
          ? { approverId: actor.platformUserId }
          : {}),
      });
      return { ...t, status: 'provisioning' as const, version: t.version + 1 };
    });
  }
  if (tenant.status !== 'provisioning') return { state: 'provisioned', tenant: toDto(tenant) };

  return runChecklist(deps, tenant, ctx);
}

/** Owner approval of a parked `proposed -> provisioning`: moves the tenant and runs the checklist. */
export async function approveProvisioning(
  deps: SysDeps,
  actor: PlatformActor,
  id: string,
  ctx: RequestCtx,
): Promise<ProvisionResult> {
  const t0 = await deps.tenants.get(id);
  if (!t0) throw notFound();
  if (t0.pendingTransition?.to !== 'provisioning') throw conflict('no_pending_transition');
  await decideTenantTransition(deps, actor, id, { decision: 'approve' }, ctx);
  const t = (await deps.tenants.get(id))!;
  return runChecklist(deps, t, ctx);
}

const SYSTEM: SystemActor = { kind: 'system', id: 'provisioning' };

async function runChecklist(
  deps: SysDeps,
  start: Tenant,
  ctx: RequestCtx,
): Promise<ProvisionResult> {
  let tenant = start;
  for (const step of PROVISIONING_STEPS) {
    if (tenant.provisioning[step]) continue;
    try {
      await STEP_RUNNERS[step].after?.(deps, tenant);
      tenant = await deps.uow.run(async (tx) => {
        const t = (await deps.tenants.getInTx(tx, tenant.id))!;
        if (t.provisioning[step]) return t;
        await STEP_RUNNERS[step].tx?.(deps, tx, t);
        const now = deps.clock.now();
        deps.tenants.update(tx, t.id, {
          provisioning: { ...t.provisioning, [step]: { doneAt: now } },
          updatedAt: now,
          updatedBy: actorId(SYSTEM),
          version: t.version + 1,
        });
        audit(deps, tx, SYSTEM, ctx, {
          action: 'tenant.provision_step',
          tenantId: t.id,
          after: { step },
        });
        return {
          ...t,
          provisioning: { ...t.provisioning, [step]: { doneAt: now } },
          version: t.version + 1,
        };
      });
    } catch (err) {
      // keep the finished steps, park the tenant as `provision_failed`; the same request retries from this step
      const failed = await deps.uow.run(async (tx) => {
        const t = (await deps.tenants.getInTx(tx, tenant.id))!;
        applyTransition(deps, tx, t, 'provision_failed', SYSTEM, ctx, {
          reason: `step ${step} failed: ${err instanceof Error ? err.name : 'error'}`,
        });
        return { ...t, status: 'provision_failed' as const };
      });
      return { state: 'failed', tenant: toDto(failed), failedStep: step };
    }
  }
  tenant = await deps.uow.run(async (tx) => {
    const t = (await deps.tenants.getInTx(tx, tenant.id))!;
    if (t.status !== 'provisioning') return t;
    applyTransition(deps, tx, t, 'onboarding', SYSTEM, ctx);
    return { ...t, status: 'onboarding' as const, version: t.version + 1 };
  });
  return { state: 'provisioned', tenant: toDto(tenant) };
}
