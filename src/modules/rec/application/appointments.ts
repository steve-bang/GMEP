import { businessDate } from '@/platform/format/date';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import { resolveScope, resolveWorkingScope, type Actor } from '@/platform/rbac/rbac';
import { scopeAllows, type Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import { getVehicle, normalizePlate, relateToWorkingBranch } from '@/modules/crm';
import { allocateDocumentNumber, resolveConfigAt, usersWithRole } from '@/modules/sys';
import {
  allowedAppointmentActions,
  APPOINTMENTS_OFF,
  capacityOf,
  occupiesCapacity,
  transitionAppointment,
  type Appointment,
  type AppointmentPolicy,
  type AppointmentStatus,
  type CapacityView,
} from '../domain/appointment';
import type { RecDeps } from '../ports/deps';
import { listServiceTypes, stageIntake, toIntakeDto } from './intakes';
import {
  addDays,
  assertWritable,
  auditEntry,
  idemOf,
  isoDate,
  notFound,
  parseInput,
  requireWorkingBranch,
  validationFailed,
  versionConflict,
  AppError,
  z,
  type RequestCtx,
} from './support';

/**
 * Appointments (slice 2.8b; FR-REC-019 capacity, FR-REC-027 calendar, states, advisor, walk-in; BR-REC-09). A branch
 * calendar is read for ONE branch over at most a week (one composite index). Booking past the configured daily capacity
 * is answered with `capacity_exceeded` (a warning with the figures); the advisor confirms with
 * `acknowledgeOverCapacity` and the booking goes through, flagged. "Đã đến" opens the intake in the SAME transaction
 * (idempotent: the appointment keeps the intake id, a repeat returns it). Walk-ins keep using `POST /rec/intakes`.
 */

export interface AppointmentDto {
  id: string;
  number: string;
  branchId: string;
  status: AppointmentStatus;
  date: string;
  time: string;
  vehicleId: string;
  customerId: string;
  plate: string;
  vehicleLabel: string;
  customerName: string;
  serviceType: string | null;
  advisorId: string | null;
  note: string | null;
  cancelReason: string | null;
  overCapacity: boolean;
  intakeId: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  allowed: string[];
}

export function toAppointmentDto(a: Appointment): AppointmentDto {
  return {
    id: a.id,
    number: a.number,
    branchId: a.branchId,
    status: a.status,
    date: a.date,
    time: a.time,
    vehicleId: a.vehicleId,
    customerId: a.customerId,
    plate: a.plate,
    vehicleLabel: a.vehicleLabel,
    customerName: a.customerName,
    serviceType: a.serviceType ?? null,
    advisorId: a.advisorId ?? null,
    note: a.note ?? null,
    cancelReason: a.cancelReason ?? null,
    overCapacity: a.overCapacity,
    intakeId: a.intakeId ?? null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    version: a.version,
    allowed: allowedAppointmentActions(a.status),
  };
}

// ---- policy and capacity ----------------------------------------------------------------------------

/** Effective-dated `appointment-policy` of the branch on `date` (branch override, then tenant); none = OFF. */
export async function appointmentPolicyAt(
  deps: RecDeps,
  tenantId: string,
  branchId: string,
  date: string,
): Promise<AppointmentPolicy & { versionId: string | null }> {
  const snap = await resolveConfigAt(deps.sys, {
    tenantId,
    type: 'appointment-policy',
    scopeKey: 'tenant',
    date,
    branchId,
  });
  if (!snap) return { ...APPOINTMENTS_OFF, versionId: null };
  const p = snap.payload as Partial<AppointmentPolicy>;
  return {
    enabled: p.enabled === true,
    dailyCapacity: typeof p.dailyCapacity === 'number' ? p.dailyCapacity : 0,
    versionId: snap.versionId,
  };
}

async function dayCapacity(
  deps: RecDeps,
  scope: Scope,
  branchId: string,
  date: string,
  capacity: number,
  excludeId?: string,
): Promise<CapacityView> {
  const rows = await deps.appointments.listByDates(
    scope,
    branchId,
    date,
    addDays(date, 1),
    deps.rec.appointments.listMax,
  );
  const booked = rows.filter((a) => a.id !== excludeId && occupiesCapacity(a.status)).length;
  return capacityOf(date, booked, capacity);
}

/** FR-REC-019: over capacity warns; the caller may go on by acknowledging. Returns whether the booking is over. */
async function checkCapacity(
  deps: RecDeps,
  scope: Scope,
  branchId: string,
  date: string,
  policy: AppointmentPolicy,
  acknowledged: boolean,
  excludeId?: string,
): Promise<boolean> {
  if (policy.dailyCapacity <= 0) return false;
  const day = await dayCapacity(deps, scope, branchId, date, policy.dailyCapacity, excludeId);
  if (!day.full) return false;
  if (!acknowledged)
    throw new AppError('capacity_exceeded', 409, [
      {
        field: 'date',
        message: `Ngày ${date} đã có ${day.booked}/${day.capacity} xe hẹn. Xác nhận để vẫn đặt.`,
      },
    ]);
  return true;
}

async function assertAdvisor(
  deps: RecDeps,
  tenantId: string,
  branchId: string,
  advisorId: string,
): Promise<void> {
  const ok = (await usersWithRole(deps.sys, tenantId, ['CV', 'QL'], branchId)).includes(advisorId);
  if (!ok)
    throw validationFailed([{ field: 'advisorId', message: 'Cố vấn không thuộc chi nhánh.' }]);
}

async function assertServiceType(deps: RecDeps, actor: Actor, code: string): Promise<void> {
  const t = (await listServiceTypes(deps, actor)).find((x) => x.code === code);
  if (!t || !t.active)
    throw validationFailed([
      { field: 'serviceType', message: 'Loại dịch vụ không có hoặc đã ngừng dùng.' },
    ]);
}

function assertBookableDate(deps: RecDeps, date: string): void {
  const today = businessDate(deps.sys.clock.now());
  if (date < today)
    throw validationFailed([{ field: 'date', message: 'Không đặt lịch vào ngày đã qua.' }]);
  if (date > addDays(today, deps.rec.appointments.horizonDays))
    throw validationFailed([{ field: 'date', message: 'Ngày hẹn quá xa.' }]);
}

// ---- list / get ---------------------------------------------------------------------------------------

const listSchema = z.object({
  from: isoDate.optional(),
  days: z.coerce.number().int().min(1).max(31).default(1),
  branchId: z.string().trim().min(1).max(80).optional(),
  status: z.enum(['pending', 'arrived', 'cancelled', 'no_show']).optional(),
});

export interface AppointmentCalendarDto {
  branchId: string;
  from: string;
  days: CapacityView[];
  enabled: boolean;
  dailyCapacity: number;
  items: AppointmentDto[];
  /** the read hit `listMax`: counts are a minimum */
  truncated: boolean;
}

/** FR-REC-027: the calendar of one branch by day or week, with the capacity of each day (FR-REC-019). */
export async function listAppointments(
  deps: RecDeps,
  actor: Actor,
  raw: unknown,
): Promise<AppointmentCalendarDto> {
  const scope = resolveWorkingScope(actor, 'appointment:view');
  const q = parseInput(listSchema, raw);
  const branchId = q.branchId ?? actor.workingBranchId;
  if (!branchId) throw new AppError('scope_required', 409);
  // NFR-ISO-01: a branch outside the scope reads as an empty calendar would leak nothing, but we refuse it plainly
  if (!scopeAllows(scope, actor.tenantId, branchId)) throw notFound();
  const span = Math.min(q.days, deps.rec.appointments.maxRangeDays);
  const from = q.from ?? businessDate(deps.sys.clock.now());
  const to = addDays(from, span);
  const policy = await appointmentPolicyAt(deps, actor.tenantId, branchId, from);
  const max = deps.rec.appointments.listMax;
  const rows = await deps.appointments.listByDates(scope, branchId, from, to, max + 1);
  const truncated = rows.length > max;
  const kept = rows.slice(0, max);
  const days: CapacityView[] = [];
  for (let d = from; d < to; d = addDays(d, 1))
    days.push(
      capacityOf(
        d,
        kept.filter((a) => a.date === d && occupiesCapacity(a.status)).length,
        policy.dailyCapacity,
      ),
    );
  const items = kept
    .filter((a) => !q.status || a.status === q.status)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    .map(toAppointmentDto);
  return {
    branchId,
    from,
    days,
    enabled: policy.enabled,
    dailyCapacity: policy.dailyCapacity,
    items,
    truncated,
  };
}

export async function getAppointment(
  deps: RecDeps,
  actor: Actor,
  id: string,
): Promise<AppointmentDto> {
  const scope = resolveScope(actor, 'appointment:view');
  const a = await deps.appointments.get(scope, id);
  if (!a) throw notFound();
  return toAppointmentDto(a);
}

// ---- create ---------------------------------------------------------------------------------------------

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const serviceCode = z.string().regex(/^[a-z][a-z0-9_-]{0,29}$/);

export const createAppointmentSchema = z.object({
  vehicleId: z.string().trim().min(1).max(80),
  date: isoDate,
  time,
  serviceType: serviceCode.optional(),
  advisorId: z.string().trim().min(1).max(80).optional(),
  note: z.string().trim().max(500).optional(),
  acknowledgeOverCapacity: z.boolean().optional(),
});

/** FR-REC-019, 027: book a vehicle known to CRM at the working branch. Idempotency-Key required. */
export async function createAppointment(
  deps: RecDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string; sessionId?: string },
) {
  const scope = resolveScope(actor, 'appointment:create');
  const data = parseInput(createAppointmentSchema, input);
  const branchId = requireWorkingBranch(actor);
  assertBookableDate(deps, data.date);
  const policy = await appointmentPolicyAt(deps, actor.tenantId, branchId, data.date);
  if (!policy.enabled) throw new AppError('appointments_disabled', 409);
  if (data.serviceType) await assertServiceType(deps, actor, data.serviceType);
  if (data.advisorId) await assertAdvisor(deps, actor.tenantId, branchId, data.advisorId);
  // the vehicle and its current owner come from CRM; not visible in scope = not found
  const vehicle = await getVehicle(deps.crm, actor, data.vehicleId);
  if (!vehicle.owner) throw new AppError('owner_not_visible', 409);
  const over = await checkCapacity(
    deps,
    scope,
    branchId,
    data.date,
    policy,
    data.acknowledgeOverCapacity === true,
  );
  // BA §10.1.4 / C2: a booking relates the customer to the working branch (source `appointment`)
  await relateToWorkingBranch(
    deps.crm,
    actor,
    vehicle.owner.id,
    {},
    {
      source: 'appointment',
      idempotencyKey: `rel-${ctx.idempotencyKey}`,
      requestId: ctx.requestId,
      ...(ctx.sessionId ? { sessionId: ctx.sessionId } : {}),
    },
  );
  const owner = vehicle.owner;
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: 'POST /api/v1/rec/appointments',
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf(data),
    },
    async (tx) => {
      const branch = await assertWritable(deps, tx, actor, scope, branchId, 'new_order');
      const now = deps.sys.clock.now();
      const id = `apt_${deps.sys.newId()}`;
      const num = await allocateDocumentNumber(deps.sys, tx, {
        branch,
        docType: 'appointment',
        businessDate: businessDate(now),
        stage: 'create',
        documentId: id,
        requestKey: ctx.idempotencyKey,
      });
      const a: Appointment = {
        id,
        tenantId: actor.tenantId,
        branchId: branch.id,
        number: num.number!,
        status: 'pending',
        date: data.date,
        time: data.time,
        vehicleId: vehicle.id,
        customerId: owner.id,
        plate: vehicle.plate,
        plateNorm: normalizePlate(vehicle.plate),
        vehicleLabel: `${vehicle.make} ${vehicle.model} ${vehicle.year}`,
        customerName: owner.name,
        ...(data.serviceType ? { serviceType: data.serviceType } : {}),
        ...(data.advisorId ? { advisorId: data.advisorId } : {}),
        ...(data.note ? { note: data.note } : {}),
        overCapacity: over,
        createdAt: now,
        createdBy: actor.userId,
        updatedAt: now,
        updatedBy: actor.userId,
        version: 1,
      };
      deps.appointments.create(tx, a);
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: branch.id,
          entityType: 'appointment',
          entityId: id,
          action: 'appointment.create',
          after: {
            number: a.number,
            vehicleId: a.vehicleId,
            date: a.date,
            time: a.time,
            overCapacity: over,
            policyVersion: policy.versionId,
          },
        }),
      );
      return { status: 201, body: toAppointmentDto(a) };
    },
  );
}

// ---- edit (move, advisor, service, note) ------------------------------------------------------------------

export const patchAppointmentSchema = z.object({
  version: z.number().int().min(1),
  date: isoDate.optional(),
  time: time.optional(),
  serviceType: serviceCode.nullable().optional(),
  advisorId: z.string().trim().min(1).max(80).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  acknowledgeOverCapacity: z.boolean().optional(),
});

/** FR-REC-027: move a pending appointment, change ("chuyển") the advisor, the service or the note. */
export async function updateAppointment(
  deps: RecDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'appointment:update');
  const data = parseInput(patchAppointmentSchema, input);
  const cur = await deps.appointments.get(scope, id);
  if (!cur) throw notFound();
  const moved = data.date !== undefined && data.date !== cur.date;
  let over = cur.overCapacity;
  if (moved) {
    assertBookableDate(deps, data.date!);
    const policy = await appointmentPolicyAt(deps, actor.tenantId, cur.branchId, data.date!);
    if (!policy.enabled) throw new AppError('appointments_disabled', 409);
    over = await checkCapacity(
      deps,
      scope,
      cur.branchId,
      data.date!,
      policy,
      data.acknowledgeOverCapacity === true,
      cur.id,
    );
  }
  if (data.serviceType) await assertServiceType(deps, actor, data.serviceType);
  if (data.advisorId) await assertAdvisor(deps, actor.tenantId, cur.branchId, data.advisorId);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `PATCH /api/v1/rec/appointments/${id}`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ id, ...data }),
    },
    async (tx) => {
      const a = await deps.appointments.getInTx(tx, scope, id);
      if (!a) throw notFound();
      if (a.version !== data.version) throw versionConflict();
      const t = transitionAppointment(a.status, 'edit');
      if (!t.ok) throw new AppError(t.reason, 409);
      await assertWritable(deps, tx, actor, scope, a.branchId, 'edit_open_order');
      const now = deps.sys.clock.now();
      const next: Appointment = { ...a, overCapacity: over };
      const patch: Record<string, unknown> = { overCapacity: over };
      const set = <K extends 'date' | 'time' | 'serviceType' | 'advisorId' | 'note'>(
        k: K,
        v: string | null | undefined,
      ) => {
        if (v === undefined) return;
        patch[k] = v === null || v === '' ? null : v;
        if (v === null || v === '') delete (next as Partial<Appointment>)[k];
        else (next as unknown as Record<string, unknown>)[k] = v;
      };
      set('date', data.date);
      set('time', data.time);
      set('serviceType', data.serviceType);
      set('advisorId', data.advisorId);
      set('note', data.note);
      Object.assign(patch, { updatedAt: now, updatedBy: actor.userId, version: a.version + 1 });
      deps.appointments.update(tx, id, patch);
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: a.branchId,
          entityType: 'appointment',
          entityId: id,
          action: 'appointment.update',
          before: {
            date: a.date,
            time: a.time,
            advisorId: a.advisorId ?? null,
            serviceType: a.serviceType ?? null,
          },
          after: {
            date: next.date,
            time: next.time,
            advisorId: next.advisorId ?? null,
            serviceType: next.serviceType ?? null,
            overCapacity: over,
          },
        }),
      );
      return {
        status: 200,
        body: toAppointmentDto({
          ...next,
          updatedAt: now,
          updatedBy: actor.userId,
          version: a.version + 1,
        }),
      };
    },
  );
}

// ---- cancel / no-show ---------------------------------------------------------------------------------

export const cancelAppointmentSchema = z.object({
  version: z.number().int().min(1),
  reason: z.string().trim().min(3).max(300),
});
const versionOnly = z.object({ version: z.number().int().min(1) });

async function closeAppointment(
  deps: RecDeps,
  actor: Actor,
  id: string,
  event: 'cancel' | 'no_show',
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'appointment:update');
  const data =
    event === 'cancel'
      ? parseInput(cancelAppointmentSchema, input)
      : { ...parseInput(versionOnly, input), reason: undefined };
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/rec/appointments/${id}/${event === 'cancel' ? 'cancel' : 'no-show'}`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ id, ...data }),
    },
    async (tx) => {
      const a = await deps.appointments.getInTx(tx, scope, id);
      if (!a) throw notFound();
      if (a.version !== data.version) throw versionConflict();
      const today = businessDate(deps.sys.clock.now());
      const t = transitionAppointment(a.status, event, {
        hasReason: !!data.reason,
        dayStarted: a.date <= today,
      });
      if (!t.ok) throw new AppError(t.reason, 409);
      await assertWritable(deps, tx, actor, scope, a.branchId, 'edit_open_order');
      const now = deps.sys.clock.now();
      deps.appointments.update(tx, id, {
        status: t.state,
        ...(data.reason ? { cancelReason: data.reason } : {}),
        updatedAt: now,
        updatedBy: actor.userId,
        version: a.version + 1,
      });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: a.branchId,
          entityType: 'appointment',
          entityId: id,
          action: event === 'cancel' ? 'appointment.cancel' : 'appointment.no_show',
          before: { status: a.status },
          after: { status: t.state },
          ...(data.reason ? { reason: data.reason } : {}),
        }),
      );
      return {
        status: 200,
        body: toAppointmentDto({
          ...a,
          status: t.state,
          ...(data.reason ? { cancelReason: data.reason } : {}),
          updatedAt: now,
          updatedBy: actor.userId,
          version: a.version + 1,
        }),
      };
    },
  );
}

/** FR-REC-027: cancel with a reason. */
export const cancelAppointment = (
  deps: RecDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) => closeAppointment(deps, actor, id, 'cancel', input, ctx);

/** FR-REC-027: the customer did not come ("vắng"); only from the appointment day on. */
export const markNoShow = (
  deps: RecDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) => closeAppointment(deps, actor, id, 'no_show', input, ctx);

// ---- arrive -> intake -------------------------------------------------------------------------------------

/**
 * FR-REC-027: "Đã đến" turns the appointment into a pre-filled intake draft (advisor, service type, the note as the
 * customer's request) through the existing intake flow, in ONE transaction with the appointment change. Idempotent
 * twice over: the same Idempotency-Key replays the response, and an appointment already arrived returns its intake
 * (whoever presses again) instead of opening a second one.
 */
export async function arriveAppointment(
  deps: RecDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string; sessionId?: string },
): Promise<{ response: { status: number; body: unknown }; replayed: boolean }> {
  resolveScope(actor, 'intake:create');
  const scope = resolveScope(actor, 'appointment:update');
  const data = parseInput(versionOnly, input);
  const cur = await deps.appointments.get(scope, id);
  if (!cur) throw notFound();
  if (cur.status === 'arrived' && cur.intakeId) {
    const intake = await deps.intakes.get(scope, cur.intakeId);
    return {
      response: {
        status: 200,
        body: { appointment: toAppointmentDto(cur), intake: intake ? toIntakeDto(intake) : null },
      },
      replayed: true,
    };
  }
  if (cur.branchId !== requireWorkingBranch(actor)) throw notFound();
  const vehicle = await getVehicle(deps.crm, actor, cur.vehicleId);
  if (!vehicle.owner) throw new AppError('owner_not_visible', 409);
  await relateToWorkingBranch(
    deps.crm,
    actor,
    vehicle.owner.id,
    {},
    {
      source: 'intake',
      idempotencyKey: `rel-${ctx.idempotencyKey}`,
      requestId: ctx.requestId,
      ...(ctx.sessionId ? { sessionId: ctx.sessionId } : {}),
    },
  );
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/rec/appointments/${id}/arrive`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ id, ...data }),
    },
    async (tx: Tx) => {
      // Firestore: every read before the first write (appointment, then branch and numbering inside stageIntake)
      const a = await deps.appointments.getInTx(tx, scope, id);
      if (!a) throw notFound();
      if (a.status === 'arrived' && a.intakeId) {
        const intake = await deps.intakes.getInTx(tx, scope, a.intakeId);
        return {
          status: 200,
          body: { appointment: toAppointmentDto(a), intake: intake ? toIntakeDto(intake) : null },
        };
      }
      if (a.version !== data.version) throw versionConflict();
      const t = transitionAppointment(a.status, 'arrive');
      if (!t.ok) throw new AppError(t.reason, 409);
      const intake = await stageIntake(deps, tx, actor, scope, vehicle, ctx, {
        ...(a.advisorId ? { advisorId: a.advisorId } : {}),
        ...(a.serviceType ? { serviceType: a.serviceType } : {}),
        ...(a.note ? { customerRequest: a.note } : {}),
        appointmentId: a.id,
      });
      const now = deps.sys.clock.now();
      const next: Appointment = {
        ...a,
        status: t.state,
        intakeId: intake.id,
        arrivedAt: now,
        updatedAt: now,
        updatedBy: actor.userId,
        version: a.version + 1,
      };
      deps.appointments.update(tx, id, {
        status: t.state,
        intakeId: intake.id,
        arrivedAt: now,
        updatedAt: now,
        updatedBy: actor.userId,
        version: a.version + 1,
      });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: a.branchId,
          entityType: 'appointment',
          entityId: id,
          action: 'appointment.arrive',
          before: { status: a.status },
          after: { status: t.state, intakeId: intake.id },
        }),
      );
      return {
        status: 200,
        body: { appointment: toAppointmentDto(next), intake: toIntakeDto(intake) },
      };
    },
  );
}
