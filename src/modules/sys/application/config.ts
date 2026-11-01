import { z } from 'zod';
import { AppError, forbidden, notFound } from '@/platform/errors/errors';
import {
  decodeCursor,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  type Page,
} from '@/platform/pagination/pagination';
import {
  fingerprintOf,
  runIdempotent,
  type StoredResponse,
} from '@/platform/idempotency/idempotency';
import {
  assertEffectiveFrom,
  businessDateOf,
  pickEffective,
  type ConfigSnapshot,
} from '@/platform/effective/effective';
import { hasPermission, resolveScope, type Actor, type Permission } from '@/platform/rbac/rbac';
import { scopeAllows } from '@/platform/scope/scope';
import {
  COST_VISIBLE_ROLES,
  SELF_APPROVE_ROLES,
  configTypeOrThrow,
  configVersionId,
  type ConfigVersion,
} from '../domain/config';
import type { SysDeps } from '../ports/deps';
import { InvalidCredentialsError } from '../ports/ports';
import { notifyUsers } from './notifications';
import { auditEntry, parseInput, roleCodesOf, type RequestCtx } from './support';

/**
 * Effective-dated configuration framework (FR-SYS-004, NFR-MNT-01): propose -> approve|reject,
 * `resolveAt`, snapshots for documents. Nothing here knows about tax, price or discounts; the
 * type definitions in domain/config.ts carry the payload schemas and the RBAC resource.
 */
const idem = (deps: SysDeps) => ({
  uow: deps.uow,
  store: deps.idempotency,
  now: () => deps.clock.now(),
  ttlMs: deps.config.idempotencyTtlMs,
});

const cacheKeyOf = (companyId: string, type: string, scopeKey: string) =>
  `${companyId}|${type}|${scopeKey}`;

async function versionsOf(
  deps: SysDeps,
  companyId: string,
  type: string,
  scopeKey: string,
): Promise<ConfigVersion[]> {
  const key = cacheKeyOf(companyId, type, scopeKey);
  const hit = deps.caches.config.get(key);
  if (hit) return hit;
  const rows = await deps.configs.listVersions(companyId, type, scopeKey);
  deps.caches.config.set(key, rows, [`cfg:${companyId}:${type}`]);
  return rows;
}

function invalidateConfig(deps: SysDeps, companyId: string, type: string): void {
  deps.caches.config.invalidateTag(`cfg:${companyId}:${type}`);
}

/**
 * Internal resolver used by other modules (tax, price, labor, limits): the approved version in
 * force on `date` (business date yyyy-MM-dd). Branch-specific keys override the company key for
 * types that allow it. Cached `configCacheTtlMs` (invalidated on approval in this process; other
 * instances pick the change up within the TTL, and new versions are always effective in the future).
 */
export async function resolveConfigAt(
  deps: SysDeps,
  q: { companyId: string; type: string; scopeKey: string; date: string; branchId?: string | null },
): Promise<ConfigSnapshot | null> {
  const def = configTypeOrThrow(q.type);
  const keys =
    def.branchOverride && q.branchId ? [`branch:${q.branchId}`, q.scopeKey] : [q.scopeKey];
  for (const scopeKey of keys) {
    const v = pickEffective(await versionsOf(deps, q.companyId, q.type, scopeKey), q.date);
    if (v) return snapshotOf(v);
  }
  return null;
}

export function snapshotOf(v: ConfigVersion): ConfigSnapshot {
  return {
    type: v.type,
    scopeKey: v.scopeKey,
    versionId: v.id,
    effectiveFrom: v.effectiveFrom,
    payload: v.payload,
  };
}

export interface ConfigVersionDto {
  id: string;
  type: string;
  scopeKey: string;
  effectiveFrom: string;
  status: string;
  payload: Record<string, unknown>;
  proposedBy: string;
  proposedAt: string;
  reason: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  version: number;
}

/** price cost (giá vốn) is redacted for roles that may not see it (ba-answers-04). */
function toDto(actor: Actor, v: ConfigVersion): ConfigVersionDto {
  let payload = v.payload;
  if (v.type === 'price-item' && !roleCodesOf(actor).some((r) => COST_VISIBLE_ROLES.includes(r))) {
    const { costVnd: _cost, ...rest } = payload;
    void _cost;
    payload = rest;
  }
  return {
    id: v.id,
    type: v.type,
    scopeKey: v.scopeKey,
    effectiveFrom: v.effectiveFrom,
    status: v.status,
    payload,
    proposedBy: v.proposedBy,
    proposedAt: v.proposedAt.toISOString(),
    reason: v.reason,
    decidedBy: v.decidedBy,
    decidedAt: v.decidedAt?.toISOString() ?? null,
    decisionNote: v.decisionNote,
    version: v.version,
  };
}

const perm = (resource: string, action: string) => `${resource}:${action}` as Permission;

export const configListSchema = z.object({
  scopeKey: z.string().max(120).optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  cursor: z.string().max(512).optional(),
});

/** Versions of one config type visible to the actor; branch overrides outside the actor's scope are invisible (NFR-ISO-01). */
export async function listConfigVersions(
  deps: SysDeps,
  actor: Actor,
  type: string,
  raw: unknown,
): Promise<Page<ConfigVersionDto>> {
  const def = configTypeOrThrow(type);
  const scope = resolveScope(actor, perm(def.resource, 'view'));
  const q = parseInput(configListSchema, raw);
  const visible = (v: ConfigVersion) => {
    const m = /^branch:(.+)$/.exec(v.scopeKey);
    return !m || scopeAllows(scope, v.companyId, m[1]!);
  };
  if (q.scopeKey) {
    const rows = (await deps.configs.listVersions(actor.companyId, type, q.scopeKey))
      .filter(visible)
      .filter((v) => !q.status || v.status === q.status);
    return { items: rows.map((v) => toDto(actor, v)), nextCursor: null };
  }
  const page = await deps.configs.listByType(
    actor.companyId,
    type,
    q.status,
    q.limit,
    decodeCursor(q.cursor),
  );
  return {
    items: page.items.filter(visible).map((v) => toDto(actor, v)),
    nextCursor: page.nextCursor,
  };
}

export const proposeConfigSchema = z.object({
  scopeKey: z.string().trim().min(1).max(120),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payload: z.record(z.string(), z.unknown()),
  reason: z.string().trim().min(3).max(300),
});

/** FR-SYS-004: a change becomes a PENDING version with a future effective date; it affects nothing until approved. */
export async function proposeConfig(
  deps: SysDeps,
  actor: Actor,
  type: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
): Promise<{ response: StoredResponse; replayed: boolean }> {
  const def = configTypeOrThrow(type);
  const scope = resolveScope(actor, perm(def.resource, 'update'));
  const data = parseInput(proposeConfigSchema, input);
  const keyOk = def.scopeKey.safeParse(data.scopeKey);
  const payload = def.payload.safeParse(data.payload);
  if (!keyOk.success || !payload.success)
    throw new AppError('validation_failed', 422, [
      ...(keyOk.success ? [] : [{ field: 'scopeKey', message: 'invalid' }]),
      ...(payload.success
        ? []
        : payload.error.issues.map((i) => ({
            field: `payload.${i.path.join('.')}`,
            message: i.message,
          }))),
    ]);
  // branch overrides need the update right in that branch; company-wide keys need a company-wide scope
  const branch = /^branch:(.+)$/.exec(data.scopeKey);
  if (branch ? !scopeAllows(scope, actor.companyId, branch[1]!) : scope.kind !== 'all')
    throw forbidden();
  assertEffectiveFrom(data.effectiveFrom, businessDateOf(deps.clock.now()));

  const approvers = await approverIds(deps, actor, perm(def.resource, 'approve'));

  return runIdempotent(
    idem(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/sys/config/${type}`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf(data),
    },
    async (tx) => {
      const id = configVersionId(type, data.scopeKey, data.effectiveFrom);
      const existing = await deps.configs.getInTx(tx, id);
      // one slot per effective date; a rejected proposal frees it
      if (existing && existing.status !== 'rejected') throw new AppError('config_slot_taken', 409);
      const now = deps.clock.now();
      const v: ConfigVersion = {
        id,
        companyId: actor.companyId,
        type,
        scopeKey: data.scopeKey,
        effectiveFrom: data.effectiveFrom,
        status: 'pending',
        payload: payload.data,
        proposedBy: actor.userId,
        proposedAt: now,
        reason: data.reason,
        decidedBy: null,
        decidedAt: null,
        decisionNote: null,
        version: 1,
      };
      deps.configs.create(tx, v);
      deps.audit.record(
        tx,
        auditEntry(deps, actor, ctx, {
          branchId: branch ? branch[1]! : null,
          entityType: `config.${type}`,
          entityId: id,
          action: 'config.propose',
          after: { scopeKey: v.scopeKey, effectiveFrom: v.effectiveFrom, payload: v.payload },
          reason: data.reason,
        }),
      );
      notifyUsers(deps, tx, {
        companyId: actor.companyId,
        userIds: approvers.filter((u) => u !== actor.userId),
        kind: 'config.pending',
        titleKey: 'notifications.configPending',
        params: { type },
        link: `/sys/config/${type}`,
      });
      return { status: 201, body: toDto(actor, v) };
    },
  );
}

async function approverIds(deps: SysDeps, actor: Actor, permission: Permission): Promise<string[]> {
  const roles = await deps.roles.list();
  const codes = roles.filter((r) => r.permissions.includes(permission)).map((r) => r.code);
  const ids = new Set<string>();
  for (const code of codes)
    for (const a of await deps.assignments.listByRole(actor.companyId, code, 50)) ids.add(a.userId);
  return [...ids];
}

export const decideConfigSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().trim().max(300).optional(),
  /** only for the owner approving their OWN proposal (BA §2.2 rule 5): password is re-entered */
  reauthPassword: z.string().max(256).optional(),
});

/**
 * Approval (FR-SYS-004). The proposer never approves their own change (separation of duties by
 * PERSON, plan §2.4) except the owner role, which must re-enter the password; the approval is
 * audited either way. An approval after the effective date has passed is refused.
 */
export async function decideConfig(
  deps: SysDeps,
  actor: Actor,
  type: string,
  id: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
): Promise<{ response: StoredResponse; replayed: boolean }> {
  const def = configTypeOrThrow(type);
  const data = parseInput(decideConfigSchema, input);
  resolveScope(actor, perm(def.resource, data.decision === 'approve' ? 'approve' : 'reject'));

  // password re-entry is an external call: done BEFORE the transaction, never inside it
  const pre = await deps.configs.get(id);
  const ownApproval = !!pre && pre.proposedBy === actor.userId && data.decision === 'approve';
  if (ownApproval && roleCodesOf(actor).some((r) => SELF_APPROVE_ROLES.includes(r)))
    await reauthenticate(deps, actor, data.reauthPassword);

  return runIdempotent(
    idem(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/sys/config/${type}/${id}:decide`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({
        ...data,
        reauthPassword: data.reauthPassword ? 'x' : undefined,
      }),
    },
    async (tx) => {
      const v = await deps.configs.getInTx(tx, id);
      if (!v || v.type !== type || v.companyId !== actor.companyId) throw notFound();
      if (v.status !== 'pending') throw new AppError('state_invalid', 409);

      const own = v.proposedBy === actor.userId;
      if (own) {
        if (!roleCodesOf(actor).some((r) => SELF_APPROVE_ROLES.includes(r)))
          throw new AppError('self_approval', 403);
      }
      const now = deps.clock.now();
      if (data.decision === 'approve') assertEffectiveFrom(v.effectiveFrom, businessDateOf(now));

      const status = data.decision === 'approve' ? 'approved' : 'rejected';
      deps.configs.decide(tx, v, {
        status,
        decidedBy: actor.userId,
        decidedAt: now,
        decisionNote: data.note ?? null,
      });
      const branch = /^branch:(.+)$/.exec(v.scopeKey);
      deps.audit.record(
        tx,
        auditEntry(deps, actor, ctx, {
          branchId: branch ? branch[1]! : null,
          entityType: `config.${type}`,
          entityId: id,
          action: `config.${data.decision}`,
          before: { status: v.status },
          after: { status, selfApproved: own },
          ...(data.note ? { reason: data.note } : {}),
        }),
      );
      if (!own)
        notifyUsers(deps, tx, {
          companyId: actor.companyId,
          userIds: [v.proposedBy],
          kind: data.decision === 'approve' ? 'config.approved' : 'config.rejected',
          titleKey:
            data.decision === 'approve'
              ? 'notifications.configApproved'
              : 'notifications.configRejected',
          params: { type },
          link: `/sys/config/${type}`,
        });
      invalidateConfig(deps, v.companyId, type);
      return {
        status: 200,
        body: toDto(actor, {
          ...v,
          status,
          decidedBy: actor.userId,
          decidedAt: now,
          decisionNote: data.note ?? null,
        }),
      };
    },
  );
}

/** Password re-entry for the self-approval exception; failures look like any other 403. */
async function reauthenticate(
  deps: SysDeps,
  actor: Actor,
  password: string | undefined,
): Promise<void> {
  if (!password) throw new AppError('reauth_required', 403);
  const user = await deps.users.getById(actor.userId);
  if (!user) throw forbidden();
  try {
    const r = await deps.identity.signInWithPassword(user.email, password);
    if (r.uid !== user.id) throw forbidden();
  } catch (e) {
    if (e instanceof InvalidCredentialsError) throw new AppError('reauth_required', 403);
    throw e;
  }
}

export function canViewConfig(actor: Actor, type: string): boolean {
  return hasPermission(actor, perm(configTypeOrThrow(type).resource, 'view'));
}
