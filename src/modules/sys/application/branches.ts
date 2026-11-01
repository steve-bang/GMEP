import { z } from 'zod';
import { AppError, notFound } from '@/platform/errors/errors';
import {
  fingerprintOf,
  runIdempotent,
  type StoredResponse,
} from '@/platform/idempotency/idempotency';
import { hasPermission, resolveScope, type Actor } from '@/platform/rbac/rbac';
import { allBranchesScope } from '@/platform/scope/scope';
import { assertBranchWritable, BRANCH_TRANSITIONS } from '../domain/branchState';
import { BRANCH_CODE_PATTERN, type Branch } from '../domain/entities';
import type { SysDeps } from '../ports/deps';
import { AlreadyExistsError } from '../ports/ports';
import { auditEntry, parseInput, roleCodesOf, type RequestCtx } from './support';

/** Organisation structure (FR-SYS-005, 011, 018): Company -> Branch -> Warehouse, legal-entity ready via companyId. */
export interface BranchDto {
  id: string;
  code: string;
  name: string;
  status: string;
  hours: string | null;
  contact: string | null;
  version: number;
}
export const toBranchDto = (b: Branch): BranchDto => ({
  id: b.id,
  code: b.code,
  name: b.name,
  status: b.status,
  hours: b.hours ?? null,
  contact: b.contact ?? null,
  version: b.version,
});

const idem = (deps: SysDeps) => ({
  uow: deps.uow,
  store: deps.idempotency,
  now: () => deps.clock.now(),
  ttlMs: deps.config.idempotencyTtlMs,
});

export async function listBranches(deps: SysDeps, actor: Actor): Promise<BranchDto[]> {
  const scope = resolveScope(actor, 'org:view');
  return (await deps.branches.list(scope)).map(toBranchDto);
}

export async function getBranch(deps: SysDeps, actor: Actor, id: string): Promise<BranchDto> {
  const scope = resolveScope(actor, 'org:view');
  const b = await deps.branches.get(scope, id);
  if (!b) throw notFound();
  return toBranchDto(b);
}

export const createBranchSchema = z.object({
  code: z.string().trim().toUpperCase().regex(BRANCH_CODE_PATTERN, 'MÃCN gồm 2-4 ký tự A-Z, 0-9.'),
  name: z.string().trim().min(2).max(120),
  hours: z.string().trim().max(200).optional(),
  contact: z.string().trim().max(200).optional(),
});

/** Adding a branch is configuration only (NFR-SCA-01): one document, no deployment. Needs a company-wide scope. */
export async function createBranch(
  deps: SysDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
): Promise<{ response: StoredResponse; replayed: boolean }> {
  const scope = resolveScope(actor, 'org:create');
  if (scope.kind !== 'all') throw new AppError('forbidden', 403);
  const data = parseInput(createBranchSchema, input);
  try {
    return await runIdempotent(
      idem(deps),
      {
        userId: actor.userId,
        route: 'POST /api/v1/sys/branches',
        key: ctx.idempotencyKey,
        fingerprint: fingerprintOf(data),
      },
      async (tx) => {
        const now = deps.clock.now();
        const branch: Branch = {
          id: `br_${data.code.toLowerCase()}`,
          companyId: actor.companyId,
          code: data.code,
          name: data.name,
          status: 'active',
          ...(data.hours ? { hours: data.hours } : {}),
          ...(data.contact ? { contact: data.contact } : {}),
          createdAt: now,
          createdBy: actor.userId,
          updatedAt: now,
          updatedBy: actor.userId,
          version: 1,
        };
        deps.branches.create(tx, branch);
        deps.audit.record(
          tx,
          auditEntry(deps, actor, ctx, {
            branchId: branch.id,
            entityType: 'branch',
            entityId: branch.id,
            action: 'branch.create',
            after: toBranchDto(branch) as unknown as Record<string, unknown>,
          }),
        );
        return { status: 201, body: toBranchDto(branch) };
      },
    );
  } catch (e) {
    if (e instanceof AlreadyExistsError) throw new AppError('branch_code_exists', 409);
    throw e;
  }
}

export const updateBranchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  hours: z.string().trim().max(200).nullable().optional(),
  contact: z.string().trim().max(200).nullable().optional(),
  version: z.number().int().min(1),
});

/**
 * BA §2.3: opening hours and contact are group-C fields a branch manager (`branch-config:update`) may
 * change; the branch name is master data (`org:update`). The branch code (MÃCN) is never editable here:
 * it becomes immutable with the first numbered document (BA §6.2.4) and there is no flow that needs it.
 */
export async function updateBranch(
  deps: SysDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx,
): Promise<BranchDto> {
  const data = parseInput(updateBranchSchema, input);
  const scope = resolveScope(actor, 'branch-config:update');
  if (data.name !== undefined && !hasPermission(actor, 'org:update'))
    throw new AppError('forbidden', 403);
  return deps.uow.run(async (tx) => {
    const b = await deps.branches.getInTx(tx, scope, id);
    if (!b) throw notFound();
    if (b.version !== data.version) throw new AppError('version_conflict', 409);
    assertBranchWritable(b.status, 'edit_master', roleCodesOf(actor), deps.config.branchStateRules);
    const now = deps.clock.now();
    const next = {
      name: data.name ?? b.name,
      hours: data.hours === undefined ? b.hours : (data.hours ?? undefined),
      contact: data.contact === undefined ? b.contact : (data.contact ?? undefined),
    };
    deps.branches.update(tx, id, {
      name: next.name,
      hours: next.hours ?? '',
      contact: next.contact ?? '',
      updatedAt: now,
      updatedBy: actor.userId,
      version: b.version + 1,
    });
    deps.audit.record(
      tx,
      auditEntry(deps, actor, ctx, {
        branchId: id,
        entityType: 'branch',
        entityId: id,
        action: 'branch.update',
        before: { name: b.name, hours: b.hours ?? null, contact: b.contact ?? null },
        after: { name: next.name, hours: next.hours ?? null, contact: next.contact ?? null },
      }),
    );
    return toBranchDto({ ...b, ...next, version: b.version + 1 });
  });
}

export const branchStatusSchema = z.object({
  status: z.enum(['active', 'closing', 'locked']),
  reason: z.string().trim().min(3).max(300),
  version: z.number().int().min(1),
});

/**
 * FR-SYS-011 + BA §5: active -> closing -> locked, re-opening back to active. Owner action
 * (`org:archive`); `locked` is refused while the branch still has blockers (BranchActivityPort).
 * Takes effect through ONE guard (assertBranchWritable), so no write path needs its own check.
 */
export async function setBranchStatus(
  deps: SysDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
): Promise<{ response: StoredResponse; replayed: boolean }> {
  const scope = resolveScope(actor, 'org:archive');
  const data = parseInput(branchStatusSchema, input);
  return runIdempotent(
    idem(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/sys/branches/${id}:status`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf(data),
    },
    async (tx) => {
      const b = await deps.branches.getInTx(tx, scope, id);
      if (!b) throw notFound();
      if (b.version !== data.version) throw new AppError('version_conflict', 409);
      if (!BRANCH_TRANSITIONS[b.status].includes(data.status))
        throw new AppError('state_invalid', 409);
      if (data.status === 'locked') {
        const blockers = await deps.branchActivity.blockers(b);
        if (blockers.length)
          throw new AppError(
            'branch_has_blockers',
            409,
            blockers.map((m) => ({ field: 'status', message: m })),
          );
      }
      deps.branches.update(tx, id, {
        status: data.status,
        updatedAt: deps.clock.now(),
        updatedBy: actor.userId,
        version: b.version + 1,
      });
      deps.audit.record(
        tx,
        auditEntry(deps, actor, ctx, {
          branchId: id,
          entityType: 'branch',
          entityId: id,
          action: 'branch.status',
          before: { status: b.status },
          after: { status: data.status },
          reason: data.reason,
        }),
      );
      return {
        status: 200,
        body: toBranchDto({ ...b, status: data.status, version: b.version + 1 }),
      };
    },
  );
}

/** Reads the whole company's branches for internal lookups (labels), never for user-facing lists. */
export const companyBranches = (deps: SysDeps, companyId: string) =>
  deps.branches.list(allBranchesScope(companyId));
