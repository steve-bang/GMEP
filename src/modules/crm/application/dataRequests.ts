import { AppError } from '@/platform/errors/errors';
import {
  decodeCursor,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  type Page,
} from '@/platform/pagination/pagination';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import { hasPermission, resolveScope, resolveWorkingScope, type Actor } from '@/platform/rbac/rbac';
import { businessDate } from '@/platform/format/date';
import { allocateDocumentNumber } from '@/modules/sys';
import { anonymizedPatch } from '../domain/anonymize';
import {
  canTransition,
  dueAtFor,
  isOverdue,
  REQUEST_STATUSES,
  REQUEST_TYPES,
  type DataRequest,
} from '../domain/dataRequest';
import type { CrmDeps } from '../ports/deps';
import {
  auditEntry,
  idemOf,
  notFound,
  parseInput,
  versionConflict,
  writableWorkingBranch,
  z,
  type RequestCtx,
} from './support';

export interface DataRequestDto {
  id: string;
  code: string;
  customerId: string;
  customerName: string | null;
  type: string;
  status: string;
  receivedVia: string;
  receivedAt: string;
  dueAt: string;
  overdue: boolean;
  assigneeId: string | null;
  assigneeName: string | null;
  note: string | null;
  resultNote: string | null;
  closedAt: string | null;
  anonymizedAt: string | null;
  branchId: string;
  version: number;
}

async function toDto(deps: CrmDeps, actor: Actor, rows: DataRequest[]): Promise<DataRequestDto[]> {
  const cscope = hasPermission(actor, 'customer:view')
    ? resolveScope(actor, 'customer:view')
    : null;
  const customers = cscope
    ? new Map(
        (await deps.customers.getMany(cscope, [...new Set(rows.map((r) => r.customerId))])).map(
          (c) => [c.id, c.name] as const,
        ),
      )
    : new Map<string, string>();
  const assignees = new Map<string, string>();
  for (const id of new Set(rows.flatMap((r) => (r.assigneeId ? [r.assigneeId] : [])))) {
    const u = await deps.sys.users.getById(id);
    if (u && u.companyId === actor.companyId) assignees.set(id, u.displayName);
  }
  const now = deps.sys.clock.now();
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    customerId: r.customerId,
    customerName: customers.get(r.customerId) ?? null,
    type: r.type,
    status: r.status,
    receivedVia: r.receivedVia,
    receivedAt: r.receivedAt.toISOString(),
    dueAt: r.dueAt.toISOString(),
    overdue: isOverdue(r, now),
    assigneeId: r.assigneeId,
    assigneeName: r.assigneeId ? (assignees.get(r.assigneeId) ?? null) : null,
    note: r.note ?? null,
    resultNote: r.resultNote ?? null,
    closedAt: r.closedAt?.toISOString() ?? null,
    anonymizedAt: r.anonymizedAt?.toISOString() ?? null,
    branchId: r.branchId,
    version: r.version,
  }));
}

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  cursor: z.string().max(512).optional(),
  status: z.enum(REQUEST_STATUSES).optional(),
  customerId: z.string().trim().max(128).optional(),
});

export async function listDataRequests(
  deps: CrmDeps,
  actor: Actor,
  raw: unknown,
): Promise<Page<DataRequestDto>> {
  const scope = resolveWorkingScope(actor, 'data-request:view');
  const q = parseInput(listSchema, raw);
  const page = await deps.requests.list(scope, {
    limit: q.limit,
    ...(q.status ? { status: q.status } : {}),
    ...(q.customerId ? { customerId: q.customerId } : {}),
    ...(q.cursor ? { cursor: decodeCursor(q.cursor)! } : {}),
  });
  return { items: await toDto(deps, actor, page.items), nextCursor: page.nextCursor };
}

export async function getDataRequest(
  deps: CrmDeps,
  actor: Actor,
  id: string,
): Promise<DataRequestDto> {
  const scope = resolveScope(actor, 'data-request:view');
  const r = await deps.requests.get(scope, id);
  if (!r) throw notFound();
  return (await toDto(deps, actor, [r]))[0]!;
}

export const createRequestSchema = z.object({
  customerId: z.string().trim().min(1).max(128),
  type: z.enum(REQUEST_TYPES),
  receivedVia: z.enum(['in_person', 'phone', 'email', 'web']),
  /** what the customer asked; staff must not paste personal data */
  note: z.string().trim().max(300).optional(),
});

/** FR-CRM-011: registers a request with a deadline; numbered `CD-<branch>-YYMM-nnnnn`. */
export async function createDataRequest(
  deps: CrmDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'data-request:create');
  const cscope = resolveScope(actor, 'customer:view');
  const data = parseInput(createRequestSchema, input);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: 'POST /api/v1/crm/data-requests',
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf(data),
    },
    async (tx) => {
      const customer = await deps.customers.getInTx(tx, cscope, data.customerId);
      if (!customer) throw notFound();
      const branch = await writableWorkingBranch(deps, tx, actor, scope);
      const now = deps.sys.clock.now();
      const id = `dsr_${deps.sys.newId()}`;
      const num = await allocateDocumentNumber(deps.sys, tx, {
        branch,
        docType: 'data-subject-request',
        businessDate: businessDate(now),
        stage: 'create',
        documentId: id,
        requestKey: ctx.idempotencyKey,
      });
      const r: DataRequest = {
        id,
        companyId: actor.companyId,
        branchId: branch.id,
        code: num.number!,
        customerId: customer.id,
        type: data.type,
        status: 'received',
        receivedVia: data.receivedVia,
        receivedAt: now,
        dueAt: dueAtFor(now, deps.crm.requestDeadlineHours),
        assigneeId: null,
        ...(data.note ? { note: data.note } : {}),
        createdBy: actor.userId,
        updatedAt: now,
        updatedBy: actor.userId,
        version: 1,
      };
      deps.requests.create(tx, r);
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: branch.id,
          entityType: 'dataRequest',
          entityId: id,
          action: 'dataRequest.create',
          after: { code: r.code, customerId: r.customerId, type: r.type, dueAt: r.dueAt },
        }),
      );
      return { status: 201, body: (await toDto(deps, actor, [r]))[0]! };
    },
  );
}

export const assignSchema = z.object({
  assigneeId: z.string().trim().min(1).max(128),
  version: z.number().int().min(1),
});

/** received -> in_progress with an assignee who works inside the request's branch scope. */
export async function assignDataRequest(
  deps: CrmDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx,
): Promise<DataRequestDto> {
  const scope = resolveScope(actor, 'data-request:update');
  const data = parseInput(assignSchema, input);
  const assignee = await deps.sys.users.getById(data.assigneeId);
  if (!assignee || assignee.companyId !== actor.companyId || assignee.status !== 'active')
    throw new AppError('validation_failed', 422, [
      { field: 'assigneeId', message: 'Người xử lý không hợp lệ.' },
    ]);
  const assignments = await deps.sys.assignments.listInScope(scope, assignee.id);
  if (assignments.length === 0)
    throw new AppError('validation_failed', 422, [
      { field: 'assigneeId', message: 'Người xử lý phải thuộc phạm vi chi nhánh của bạn.' },
    ]);
  return deps.sys.uow.run(async (tx) => {
    const r = await deps.requests.getInTx(tx, scope, id);
    if (!r) throw notFound();
    if (r.version !== data.version) throw versionConflict();
    if (r.status !== 'received' && r.status !== 'in_progress')
      throw new AppError('request_transition_invalid', 409);
    const now = deps.sys.clock.now();
    const patch = {
      assigneeId: assignee.id,
      status: 'in_progress' as const,
      updatedAt: now,
      updatedBy: actor.userId,
      version: r.version + 1,
    };
    deps.requests.update(tx, id, patch);
    deps.sys.audit.record(
      tx,
      auditEntry(deps.sys, actor, ctx, {
        branchId: r.branchId,
        entityType: 'dataRequest',
        entityId: id,
        action: 'dataRequest.assign',
        before: { status: r.status, assigneeId: r.assigneeId },
        after: { status: patch.status, assigneeId: assignee.id },
      }),
    );
    return (await toDto(deps, actor, [{ ...r, ...patch }]))[0]!;
  });
}

export const closeSchema = z.object({
  outcome: z.enum(['completed', 'rejected']),
  resultNote: z.string().trim().min(5).max(500),
  version: z.number().int().min(1),
});

/**
 * Closes a request with a result. Completing a `delete` request anonymises the customer, but only
 * after the retention check says nothing blocks it (open orders, debt, warranty) and only for a
 * holder of `data-request:approve`; data kept for legal reasons is listed in the audit entry
 * [Cần xác nhận: Luật sư khách].
 */
export async function closeDataRequest(
  deps: CrmDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx,
): Promise<DataRequestDto> {
  const scope = resolveScope(actor, 'data-request:update');
  const data = parseInput(closeSchema, input);
  return deps.sys.uow.run(async (tx) => {
    const r = await deps.requests.getInTx(tx, scope, id);
    if (!r) throw notFound();
    if (r.version !== data.version) throw versionConflict();
    if (!canTransition(r.status, data.outcome))
      throw new AppError('request_transition_invalid', 409);
    const now = deps.sys.clock.now();
    let anonymizedAt: Date | undefined;
    let retained: string[] = [];
    if (r.type === 'delete' && data.outcome === 'completed') {
      resolveScope(actor, 'data-request:approve'); // 403 for anyone else
      const check = await deps.retention.check(actor.companyId, r.customerId);
      if (check.blockers.length)
        throw new AppError(
          'request_blocked',
          409,
          check.blockers.map((b) => ({ field: 'blockers', message: b })),
        );
      retained = check.retained;
      const c = await deps.customers.getCompanyWideInTx(tx, actor.companyId, r.customerId);
      if (!c) throw notFound();
      if (c.status !== 'anonymized') {
        const keepLegal = c.type === 'business' && retained.length > 0;
        const patch = anonymizedPatch(c, keepLegal);
        deps.customers.update(tx, c.id, {
          ...patch,
          anonymizedAt: now,
          updatedAt: now,
          updatedBy: actor.userId,
          version: c.version + 1,
        });
        deps.customers.relink(tx, { ...c, nameNorm: patch.nameNorm });
        deps.customers.setPii(tx, c.id, {
          phone: null,
          phoneNorm: null,
          email: null,
          address: null,
        });
        deps.sys.audit.record(
          tx,
          auditEntry(deps.sys, actor, ctx, {
            branchId: c.branchId,
            entityType: 'customer',
            entityId: c.id,
            action: 'customer.anonymize',
            before: { status: c.status },
            after: { status: 'anonymized', retained },
            reason: r.code,
          }),
        );
      }
      anonymizedAt = now;
    }
    const patch = {
      status: data.outcome,
      resultNote: data.resultNote,
      closedAt: now,
      closedBy: actor.userId,
      ...(anonymizedAt ? { anonymizedAt } : {}),
      updatedAt: now,
      updatedBy: actor.userId,
      version: r.version + 1,
    };
    deps.requests.update(tx, id, patch);
    deps.sys.audit.record(
      tx,
      auditEntry(deps.sys, actor, ctx, {
        branchId: r.branchId,
        entityType: 'dataRequest',
        entityId: id,
        action: data.outcome === 'completed' ? 'dataRequest.complete' : 'dataRequest.reject',
        before: { status: r.status },
        after: { status: data.outcome, anonymized: !!anonymizedAt },
        reason: data.resultNote,
      }),
    );
    return (await toDto(deps, actor, [{ ...r, ...patch } as DataRequest]))[0]!;
  });
}
