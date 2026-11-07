import { businessDate } from '@/platform/format/date';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import { hasPermission, resolveScope, resolveWorkingScope, type Actor } from '@/platform/rbac/rbac';
import { branchesScope } from '@/platform/scope/scope';
import { AlreadyExistsError } from '@/platform/store/docStore';
import { normalizeSearch } from '@/platform/text/normalize';
import { resolveCatalogAt } from '@/modules/sys';
import {
  EMPLOYEE_PII_FIELDS,
  changePosition,
  employeePiiLevel,
  presentEmployeeField,
  type Certificate,
  type Employee,
  type EmployeePii,
  type EmployeePiiField,
  type EmployeeStatus,
  type PresentedEmployeeField,
  type PositionStint,
} from '../domain/employee';
import type { HrmDeps } from '../ports/deps';
import {
  AppError,
  assertWritable,
  auditEntry,
  forbidden,
  hrBranch,
  idemOf,
  notFound,
  parseInput,
  roleCodesOf,
  versionConflict,
  z,
  type RequestCtx,
} from './support';

/**
 * Staff records (FR-HRM-001, G3-HRM-01/02). A record is not a login account (`userId` links them), carries one branch
 * and one current position with its history, and holds NO salary, bank or insurance data. The code is unique in the
 * tenant through a create-only slot. Personal data sits in its own document and leaves the server only as the role
 * allows (ba-answers-04 Phụ lục D); opening a record that shows any of it is written to the access log.
 */

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const code = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);
const certSchema = z.object({
  name: z.string().trim().min(1).max(80),
  issuer: z.string().trim().max(80).optional(),
  expiresOn: day.optional(),
});
const pii = {
  phone: z.string().trim().max(20).nullable().optional(),
  nationalId: z.string().trim().max(20).nullable().optional(),
  address: z.string().trim().max(200).nullable().optional(),
  birthDate: day.nullable().optional(),
};

export const createEmployeeSchema = z.object({
  code,
  fullName: z.string().trim().min(2).max(100),
  positionCode: z.string().trim().min(1).max(30),
  joinedOn: day,
  userId: z.string().trim().min(1).max(128).optional(),
  certificates: z.array(certSchema).max(20).default([]),
  ...pii,
});

export const updateEmployeeSchema = z.object({
  version: z.number().int().min(1),
  fullName: z.string().trim().min(2).max(100).optional(),
  status: z.enum(['active', 'on_leave']).optional(),
  /** a new position starts on `positionFrom` (default today); the old stint is closed, never edited */
  positionCode: z.string().trim().min(1).max(30).optional(),
  positionFrom: day.optional(),
  /** null unlinks the login account */
  userId: z.string().trim().min(1).max(128).nullable().optional(),
  certificates: z.array(certSchema).max(20).optional(),
  ...pii,
});

export const leaveEmployeeSchema = z.object({
  version: z.number().int().min(1),
  leftOn: day,
  reason: z.string().trim().min(5).max(300),
});

export interface EmployeeDto {
  id: string;
  code: string;
  fullName: string;
  status: EmployeeStatus;
  branchId: string;
  positionCode: string;
  positions: PositionStint[];
  joinedOn: string;
  leftOn: string | null;
  userLinked: boolean;
  certificates: Certificate[];
  /** only the fields the role may see; masked ones carry `reveal` for the "Hiện" button */
  pii: Partial<Record<EmployeePiiField, PresentedEmployeeField>>;
  version: number;
}

function present(
  deps: HrmDeps,
  actor: Actor,
  e: Employee,
  p: EmployeePii | null,
): { dto: EmployeeDto; shown: EmployeePiiField[] } {
  const roles = roleCodesOf(actor);
  const own = e.userId !== null && e.userId === actor.userId;
  void deps;
  const out: EmployeeDto['pii'] = {};
  const shown: EmployeePiiField[] = [];
  for (const f of EMPLOYEE_PII_FIELDS) {
    const v = presentEmployeeField(employeePiiLevel(roles, f, own), f, p?.[f] ?? null);
    if (v) {
      out[f] = v;
      if (v.value !== undefined) shown.push(f);
    }
  }
  return {
    dto: {
      id: e.id,
      code: e.code,
      fullName: e.fullName,
      status: e.status,
      branchId: e.branchId,
      positionCode: e.positionCode,
      positions: e.positions,
      joinedOn: e.joinedOn,
      leftOn: e.leftOn,
      userLinked: e.userId !== null,
      certificates: e.certificates,
      pii: out,
      version: e.version,
    },
    shown,
  };
}

async function assertPosition(deps: HrmDeps, tenantId: string, positionCode: string) {
  const list = await resolveCatalogAt(deps.sys, {
    tenantId,
    type: 'labor-position',
    date: businessDate(deps.sys.clock.now()),
  });
  const hit = list.find((p) => p.code === `position:${positionCode}`);
  if (!hit || (hit.payload as { status?: string }).status !== 'active')
    throw new AppError('validation_failed', 422, [
      { field: 'positionCode', message: 'Chức danh chưa được khai báo hoặc đã ngừng dùng.' },
    ]);
}

async function assertUser(deps: HrmDeps, tenantId: string, userId: string) {
  const u = await deps.sys.users.getById(tenantId, userId);
  if (!u)
    throw new AppError('validation_failed', 422, [
      { field: 'userId', message: 'Không tìm thấy tài khoản.' },
    ]);
}

const piiOf = (
  id: string,
  e: { tenantId: string; branchId: string },
  prev: EmployeePii | null,
  d: Partial<Record<EmployeePiiField, string | null | undefined>>,
): EmployeePii => ({
  id,
  tenantId: e.tenantId,
  branchId: e.branchId,
  phone: d.phone === undefined ? (prev?.phone ?? null) : d.phone || null,
  nationalId: d.nationalId === undefined ? (prev?.nationalId ?? null) : d.nationalId || null,
  address: d.address === undefined ? (prev?.address ?? null) : d.address || null,
  birthDate: d.birthDate === undefined ? (prev?.birthDate ?? null) : d.birthDate || null,
});

export async function createEmployee(
  deps: HrmDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'employee:create');
  const branchId = hrBranch(actor, scope);
  const data = parseInput(createEmployeeSchema, input);
  await assertPosition(deps, actor.tenantId, data.positionCode);
  if (data.userId) await assertUser(deps, actor.tenantId, data.userId);
  try {
    return await runIdempotent(
      idemOf(deps),
      {
        userId: actor.userId,
        route: 'POST /api/v1/hrm/employees',
        key: ctx.idempotencyKey,
        // personal values are part of the request but never of a stored fingerprint in clear text
        fingerprint: fingerprintOf({ ...data }),
      },
      async (tx) => {
        await assertWritable(deps, tx, actor, scope, branchId, 'edit_open_order');
        const now = deps.sys.clock.now();
        const id = `emp_${deps.sys.newId()}`;
        const e: Employee = {
          id,
          tenantId: actor.tenantId,
          branchId,
          code: data.code.toUpperCase(),
          fullName: data.fullName,
          nameNorm: normalizeSearch(data.fullName),
          status: 'active',
          positionCode: data.positionCode,
          positions: [{ positionCode: data.positionCode, from: data.joinedOn, to: null }],
          joinedOn: data.joinedOn,
          leftOn: null,
          leftReason: null,
          userId: data.userId ?? null,
          certificates: data.certificates,
          createdAt: now,
          createdBy: actor.userId,
          updatedAt: now,
          updatedBy: actor.userId,
          version: 1,
        };
        deps.employees.create(tx, e, piiOf(id, e, null, data));
        if (e.userId) deps.employees.linkUser(tx, actor.tenantId, e.userId, id, branchId);
        deps.sys.audit.record(
          tx,
          auditEntry(deps.sys, actor, ctx, {
            branchId,
            entityType: 'employee',
            entityId: id,
            action: 'employee.create',
            after: { code: e.code, positionCode: e.positionCode, linked: e.userId !== null },
          }),
        );
        return { status: 201, body: { id, code: e.code, version: 1 } };
      },
    );
  } catch (e) {
    if (e instanceof AlreadyExistsError) throw new AppError('employee_code_exists', 409);
    throw e;
  }
}

export async function updateEmployee(
  deps: HrmDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'employee:update');
  const branchId = hrBranch(actor, scope);
  const data = parseInput(updateEmployeeSchema, input);
  if (data.positionCode) await assertPosition(deps, actor.tenantId, data.positionCode);
  if (data.userId) await assertUser(deps, actor.tenantId, data.userId);
  try {
    return await runIdempotent(
      idemOf(deps),
      {
        userId: actor.userId,
        route: `PATCH /api/v1/hrm/employees/${id}`,
        key: ctx.idempotencyKey,
        fingerprint: fingerprintOf({ id, ...data }),
      },
      async (tx) => {
        const e = await deps.employees.getInTx(tx, scope, id);
        if (!e || e.branchId !== branchId) throw notFound();
        const prevPii = await deps.employees.getPiiInTx(tx, scope, id);
        if (e.version !== data.version) throw versionConflict();
        if (e.status === 'left') throw new AppError('employee_left', 409);
        await assertWritable(deps, tx, actor, scope, branchId, 'edit_open_order');
        const now = deps.sys.clock.now();
        const today = businessDate(now);
        const patch: Record<string, unknown> = {
          updatedAt: now,
          updatedBy: actor.userId,
          version: e.version + 1,
        };
        const changed: string[] = [];
        if (data.fullName !== undefined) {
          patch.fullName = data.fullName;
          patch.nameNorm = normalizeSearch(data.fullName);
          changed.push('fullName');
        }
        if (data.status !== undefined && data.status !== e.status) {
          patch.status = data.status;
          changed.push('status');
        }
        if (data.certificates !== undefined) {
          patch.certificates = data.certificates;
          changed.push('certificates');
        }
        if (data.positionCode !== undefined && data.positionCode !== e.positionCode) {
          const from = data.positionFrom ?? today;
          try {
            patch.positions = changePosition(e.positions, data.positionCode, from);
          } catch {
            throw new AppError('validation_failed', 422, [
              {
                field: 'positionFrom',
                message: 'Ngày hiệu lực phải sau ngày bắt đầu của chức danh hiện tại.',
              },
            ]);
          }
          patch.positionCode = data.positionCode;
          changed.push('positionCode');
        }
        if (data.userId !== undefined && data.userId !== e.userId) {
          if (e.userId) deps.employees.unlinkUser(tx, actor.tenantId, e.userId);
          if (data.userId)
            deps.employees.linkUser(tx, actor.tenantId, data.userId, e.id, e.branchId);
          patch.userId = data.userId;
          changed.push('userId');
        }
        const piiTouched = EMPLOYEE_PII_FIELDS.filter((f) => data[f] !== undefined);
        if (piiTouched.length) {
          deps.employees.savePii(tx, piiOf(e.id, e, prevPii, data));
          changed.push(...piiTouched.map((f) => `pii.${f}`));
        }
        deps.employees.update(tx, id, patch);
        deps.sys.audit.record(
          tx,
          // field NAMES only: the audit trail never carries personal values (PDPL)
          auditEntry(deps.sys, actor, ctx, {
            branchId,
            entityType: 'employee',
            entityId: id,
            action: 'employee.update',
            after: { changed },
          }),
        );
        return { status: 200, body: { id, version: e.version + 1 } };
      },
    );
  } catch (e) {
    if (e instanceof AlreadyExistsError) throw new AppError('employee_user_linked', 409);
    throw e;
  }
}

/** Records the leaving date (G3-HRM-02): the record stays, labor and history are kept; the account is only suggested for locking. */
export async function leaveEmployee(
  deps: HrmDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'employee:update');
  const branchId = hrBranch(actor, scope);
  const data = parseInput(leaveEmployeeSchema, input);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/hrm/employees/${id}/leave`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ id, ...data }),
    },
    async (tx) => {
      const e = await deps.employees.getInTx(tx, scope, id);
      if (!e || e.branchId !== branchId) throw notFound();
      if (e.version !== data.version) throw versionConflict();
      if (e.status === 'left') throw new AppError('employee_left', 409);
      if (data.leftOn < e.joinedOn)
        throw new AppError('validation_failed', 422, [
          { field: 'leftOn', message: 'Ngày nghỉ trước ngày vào làm.' },
        ]);
      await assertWritable(deps, tx, actor, scope, branchId, 'edit_open_order');
      const now = deps.sys.clock.now();
      deps.employees.update(tx, id, {
        status: 'left',
        leftOn: data.leftOn,
        leftReason: data.reason,
        updatedAt: now,
        updatedBy: actor.userId,
        version: e.version + 1,
      });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId,
          entityType: 'employee',
          entityId: id,
          action: 'employee.leave',
          before: { status: e.status },
          after: { status: 'left', leftOn: data.leftOn },
          reason: data.reason,
        }),
      );
      return {
        status: 200,
        body: { id, version: e.version + 1, suggestDisableAccount: e.userId !== null },
      };
    },
  );
}

export async function listEmployees(deps: HrmDeps, actor: Actor) {
  // a company-wide user who picked a working branch sees that branch's staff (same rule as every list)
  const scope = resolveWorkingScope(actor, 'employee:view');
  const { items, truncated } = await deps.employees.list(scope, deps.hrm.employeesMax);
  const piis = await Promise.all(items.map((e) => deps.employees.getPii(scope, e.id)));
  return {
    items: items.map((e, i) => present(deps, actor, e, piis[i] ?? null).dto),
    truncated,
  };
}

export async function getEmployee(
  deps: HrmDeps,
  actor: Actor,
  id: string,
  ctx: { requestId: string },
): Promise<EmployeeDto> {
  // a person may always open the record linked to their own account (G1-PRF); anyone else needs `employee:view`
  const own = await deps.employees.getByUser(actor.tenantId, actor.userId);
  const mine = own !== null && own.id === id ? own : null;
  const scope = hasPermission(actor, 'employee:view') ? resolveScope(actor, 'employee:view') : null;
  if (!scope && !mine) throw forbidden();
  const e = mine ?? (scope ? await deps.employees.get(scope, id) : null);
  if (!e) throw notFound();
  const p = await deps.employees.getPii(scope ?? branchesScope(actor.tenantId, [e.branchId]), id);
  const { dto, shown } = present(deps, actor, e, p);
  if (shown.length)
    await deps.sys.piiLog.record({
      id: deps.sys.newId(),
      at: deps.sys.clock.now(),
      requestId: ctx.requestId,
      actorId: actor.userId,
      actorRoles: roleCodesOf(actor),
      tenantId: actor.tenantId,
      branchId: e.branchId,
      entityType: 'employee',
      entityId: e.id,
      fields: shown,
      purpose: 'open_record',
      result: 'allowed',
    });
  return dto;
}

export const revealEmployeeSchema = z.object({
  field: z.enum(['phone', 'nationalId', 'address', 'birthDate']),
});

/** "Hiện": the full value leaves the server only for a level that allows it, inside the scope, always logged. */
export async function revealEmployeeField(
  deps: HrmDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: { requestId: string },
): Promise<{ field: EmployeePiiField; value: string }> {
  const scope = resolveScope(actor, 'employee:view');
  const data = parseInput(revealEmployeeSchema, input);
  await deps.sys.limiter.hit('reveal', actor.userId);
  const e = await deps.employees.get(scope, id);
  const entry = (result: 'allowed' | 'denied') => ({
    id: deps.sys.newId(),
    at: deps.sys.clock.now(),
    requestId: ctx.requestId,
    actorId: actor.userId,
    actorRoles: roleCodesOf(actor),
    tenantId: actor.tenantId,
    branchId: e?.branchId ?? null,
    entityType: 'employee',
    entityId: id,
    fields: [data.field],
    purpose: result === 'allowed' ? ('reveal' as const) : ('denied' as const),
    result,
  });
  const level = employeePiiLevel(roleCodesOf(actor), data.field, e?.userId === actor.userId);
  if (!e || (level !== 'reveal' && level !== 'reveal_reason')) {
    await deps.sys.piiLog.record(entry('denied'));
    throw !e ? notFound() : new AppError('pii_reveal_denied', 403);
  }
  const p = await deps.employees.getPii(scope, id);
  const value = p?.[data.field];
  if (!value) {
    await deps.sys.piiLog.record(entry('denied'));
    throw notFound();
  }
  await deps.sys.piiLog.record(entry('allowed'));
  return { field: data.field, value };
}
