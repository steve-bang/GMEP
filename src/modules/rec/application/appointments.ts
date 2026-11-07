import { businessDate, businessTime, isoToVi } from '@/platform/format/date';
import { rootLogger } from '@/platform/logging/logger';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import { hasPermission, resolveScope, resolveWorkingScope, type Actor } from '@/platform/rbac/rbac';
import { scopeAllows, type Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import { getVehicle, normalizePlate, relateToWorkingBranch } from '@/modules/crm';
import {
  allocateDocumentNumber,
  resolveCatalogAt,
  resolveConfigAt,
  usersWithRole,
  type MessageChannel,
} from '@/modules/sys';
import {
  allowedAppointmentActions,
  appointmentTabOf,
  APPOINTMENT_RULE_DEFAULTS,
  APPOINTMENT_TABS,
  APPOINTMENTS_OFF,
  capacityOf,
  checkReason,
  lateViewOf,
  occupiesCapacity,
  OTHER_REASON,
  transitionAppointment,
  wallMinutes,
  type Appointment,
  type AppointmentCancellation,
  type AppointmentPolicy,
  type AppointmentReason,
  type AppointmentReschedule,
  type AppointmentStatus,
  type AppointmentTab,
  type CapacityView,
  type CustomerNotice,
  type LateView,
} from '../domain/appointment';
import { serviceTargetOf, type MessageTarget } from './contact';
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

export interface RescheduleDto {
  fromDate: string;
  fromTime: string;
  toDate: string;
  toTime: string;
  reasonCode: string;
  reasonName: string;
  note: string | null;
  requestedBy: 'customer' | 'workshop';
  by: string;
  byName: string;
  at: string;
  late: boolean;
  overCapacity: boolean;
  overLimit: boolean;
  notice: CustomerNotice;
}

export interface CancellationDto {
  /** `legacy` = cancelled before the reason catalogue existed (free text only) */
  reasonCode: string;
  reasonName: string;
  note: string | null;
  cancelledBy: string | null;
  cancelledByName: string | null;
  cancelledAt: string | null;
  notice: CustomerNotice;
}

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
  /** FR-REC-045: block of the cancellation (null while not cancelled) */
  cancellation: CancellationDto | null;
  overCapacity: boolean;
  intakeId: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  allowed: string[];
  /** FR-REC-044: computed on read by the server clock (never stored) */
  overdue: boolean;
  lateMinutes: number;
  stale: boolean;
  /** FR-REC-046 */
  rescheduleCount: number;
  originalDate: string;
  originalTime: string;
  reschedules: RescheduleDto[];
  /** only when the actor's PII level for phone is `full` and only on the overdue tab ("Gọi khách" tel: link) */
  customerPhone?: string;
}

const NO_LATE: LateView = { lateMinutes: 0, overdue: false, stale: false };
const LEGACY_REASON = 'legacy';

export function toAppointmentDto(
  a: Appointment,
  late: LateView = NO_LATE,
  names: ReadonlyMap<string, string> = new Map(),
): AppointmentDto {
  const rs = a.reschedules ?? [];
  const c = a.cancellation;
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
    cancellation: c
      ? {
          reasonCode: c.reasonCode,
          reasonName: c.reasonName,
          note: c.note ?? null,
          cancelledBy: c.cancelledBy,
          cancelledByName: names.get(c.cancelledBy) ?? null,
          cancelledAt: c.cancelledAt,
          notice: c.notice,
        }
      : a.status === 'cancelled' && a.cancelReason
        ? {
            // RULE-019: cancelled before the catalogue; shown as free text, never counted as a real reason
            reasonCode: LEGACY_REASON,
            reasonName: 'Lý do nhập tự do',
            note: a.cancelReason,
            cancelledBy: null,
            cancelledByName: null,
            cancelledAt: null,
            notice: 'none',
          }
        : null,
    overCapacity: a.overCapacity,
    intakeId: a.intakeId ?? null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    version: a.version,
    allowed: allowedAppointmentActions(a.status),
    overdue: late.overdue,
    lateMinutes: late.lateMinutes,
    stale: late.stale,
    rescheduleCount: rs.length,
    originalDate: rs[0]?.fromDate ?? a.date,
    originalTime: rs[0]?.fromTime ?? a.time,
    // newest first (FR-REC-046 3.6); the stored list is append-only, oldest first
    reschedules: [...rs].reverse().map((r) => ({
      fromDate: r.fromDate,
      fromTime: r.fromTime,
      toDate: r.toDate,
      toTime: r.toTime,
      reasonCode: r.reasonCode,
      reasonName: r.reasonName,
      note: r.note ?? null,
      requestedBy: r.requestedBy,
      by: r.by,
      byName: names.get(r.by) ?? '',
      at: r.at,
      late: r.late,
      overCapacity: r.overCapacity,
      overLimit: r.overLimit,
      notice: r.notice,
    })),
  };
}

/** display names of the people named on the given appointments (reschedules, cancellation); no PII beyond the name */
async function namesOf(
  deps: RecDeps,
  tenantId: string,
  rows: readonly Appointment[],
): Promise<Map<string, string>> {
  const ids = new Set<string>();
  for (const a of rows) {
    for (const r of a.reschedules ?? []) ids.add(r.by);
    if (a.cancellation) ids.add(a.cancellation.cancelledBy);
  }
  const m = new Map<string, string>();
  await Promise.all(
    [...ids].map(async (id) => {
      const u = await deps.sys.users.getById(tenantId, id);
      if (u) m.set(id, u.displayName);
    }),
  );
  return m;
}

/** the server wall clock of the branch time zone (Asia/Ho_Chi_Minh), never the browser's */
function nowOf(deps: RecDeps): { date: string; time: string } {
  const n = deps.sys.clock.now();
  return { date: businessDate(n), time: businessTime(n) };
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
  const n = (v: unknown, d: number) => (typeof v === 'number' ? v : d);
  const D = APPOINTMENT_RULE_DEFAULTS;
  return {
    enabled: p.enabled === true,
    dailyCapacity: n(p.dailyCapacity, 0),
    overdueGraceMinutes: n(p.overdueGraceMinutes, D.overdueGraceMinutes),
    staleDays: n(p.staleDays, D.staleDays),
    maxReschedules: n(p.maxReschedules, D.maxReschedules),
    lateRescheduleMinutes: n(p.lateRescheduleMinutes, D.lateRescheduleMinutes),
    noteMinLength: n(p.noteMinLength, D.noteMinLength),
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
        message: `Ngày ${isoToVi(date)} đã có ${day.booked}/${day.capacity} xe hẹn. Xác nhận để vẫn đặt.`,
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
  /** FR-REC-044: the five tabs; the list and its counter use the same rule */
  tab: z.enum(APPOINTMENT_TABS).optional(),
});

export interface TabCount {
  n: number;
  /** the read hit `listMax`: the figure is a minimum ("500+") */
  more: boolean;
}

export interface AppointmentCalendarDto {
  branchId: string;
  from: string;
  days: CapacityView[];
  enabled: boolean;
  dailyCapacity: number;
  items: AppointmentDto[];
  /** the read hit `listMax`: counts are a minimum */
  truncated: boolean;
  tab: AppointmentTab | null;
  /** FR-REC-044: counters of the five tabs (overdue ignores the viewed range) */
  counts: Record<AppointmentTab, TabCount>;
  /** server wall clock, Asia/Ho_Chi_Minh (FR-REC-047: "hôm nay" never comes from the browser) */
  now: { date: string; time: string };
  /** thresholds the dialogs show as hints (FR-REC-044..046) */
  policy: Omit<AppointmentPolicy, 'enabled' | 'dailyCapacity'>;
}

const byDateTime = (x: Appointment, y: Appointment) =>
  `${x.date} ${x.time}`.localeCompare(`${y.date} ${y.time}`);

/** FR-REC-027, 044: the calendar of one branch by day or week, with the capacity of each day (FR-REC-019) and the tabs. */
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
  const now = nowOf(deps);
  const from = q.from ?? now.date;
  const to = addDays(from, span);
  const policy = await appointmentPolicyAt(deps, actor.tenantId, branchId, from);
  // the overdue threshold is the one in force today, whatever day is viewed
  const todayPolicy =
    from === now.date
      ? policy
      : await appointmentPolicyAt(deps, actor.tenantId, branchId, now.date);
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
  const lateOf = (a: Appointment) => lateViewOf(a, now, todayPolicy);
  // FR-REC-044: "Trễ hẹn" = pending and past the time (+ grace), every day up to today, not bounded by the viewed range
  const pendingUpToToday = await deps.appointments.listByStatus(
    scope,
    branchId,
    'pending',
    null,
    addDays(now.date, 1),
    max + 1,
  );
  const overdueMore = pendingUpToToday.length > max;
  const overdueRows = pendingUpToToday
    .slice(0, max)
    .filter((a) => lateOf(a).overdue)
    .sort(byDateTime);
  const inTab = (t: AppointmentTab) =>
    kept.filter((a) => appointmentTabOf(a.status, lateOf(a)) === t);
  const counts = {
    upcoming: { n: inTab('upcoming').length, more: truncated },
    overdue: { n: overdueRows.length, more: overdueMore },
    arrived: { n: inTab('arrived').length, more: truncated },
    cancelled: { n: inTab('cancelled').length, more: truncated },
    no_show: { n: inTab('no_show').length, more: truncated },
  } satisfies Record<AppointmentTab, TabCount>;

  let chosen: Appointment[];
  switch (q.tab) {
    case 'overdue':
      chosen = overdueRows;
      break;
    case 'arrived':
      chosen = inTab('arrived').sort(
        (x, y) => (y.arrivedAt?.getTime() ?? 0) - (x.arrivedAt?.getTime() ?? 0),
      );
      break;
    case 'cancelled':
      chosen = inTab('cancelled').sort((x, y) =>
        (y.cancellation?.cancelledAt ?? '').localeCompare(x.cancellation?.cancelledAt ?? ''),
      );
      break;
    case 'no_show':
      chosen = inTab('no_show').sort((x, y) => byDateTime(y, x));
      break;
    case 'upcoming':
      chosen = inTab('upcoming').sort(byDateTime);
      break;
    default:
      chosen = kept.filter((a) => !q.status || a.status === q.status).sort(byDateTime);
  }
  const names = await namesOf(deps, actor.tenantId, chosen);
  const items = chosen.map((a) => toAppointmentDto(a, lateOf(a), names));
  // "Gọi khách": the full number only for roles whose PII level is `full`; everyone else gets no phone here
  if (q.tab === 'overdue' && deps.sys.pii.level(actor, 'phone') === 'full') {
    const phones = new Map<string, string>();
    await Promise.all(
      [...new Set(items.map((i) => i.customerId))].map(async (id) => {
        const pii = await deps.crm.customers.getPii(actor.tenantId, id);
        if (pii?.phone) phones.set(id, pii.phone);
      }),
    );
    for (const i of items) {
      const ph = phones.get(i.customerId);
      if (ph) i.customerPhone = ph;
    }
  }
  const rules = {
    overdueGraceMinutes: todayPolicy.overdueGraceMinutes,
    staleDays: todayPolicy.staleDays,
    maxReschedules: todayPolicy.maxReschedules,
    lateRescheduleMinutes: todayPolicy.lateRescheduleMinutes,
    noteMinLength: todayPolicy.noteMinLength,
  };
  return {
    branchId,
    from,
    days,
    enabled: policy.enabled,
    dailyCapacity: policy.dailyCapacity,
    items,
    truncated,
    tab: q.tab ?? null,
    counts,
    now,
    policy: rules,
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
  return dtoWithLate(deps, actor.tenantId, a);
}

/** the DTO of one appointment with the overdue view of the server clock and the names of the people named on it */
async function dtoWithLate(
  deps: RecDeps,
  tenantId: string,
  a: Appointment,
): Promise<AppointmentDto> {
  const now = nowOf(deps);
  const pol = await appointmentPolicyAt(deps, tenantId, a.branchId, now.date);
  return toAppointmentDto(a, lateViewOf(a, now, pol), await namesOf(deps, tenantId, [a]));
}

// ---- reason catalogues (FR-REC-045, 046) ------------------------------------------------------------

export type ReasonKind = 'cancel' | 'reschedule';
const REASON_TYPE = {
  cancel: 'appointment-cancel-reason',
  reschedule: 'appointment-reschedule-reason',
} as const;

/**
 * The tenant's reason catalogue in force today: stable code, name, active flag, order. `other` is the system code: it is
 * always there, always active, always needs a note, even when the tenant configured nothing (RULE-019: a reason that
 * was switched off keeps its name for the appointments that used it, those carry the name copied at that time).
 */
async function loadReasons(
  deps: RecDeps,
  tenantId: string,
  kind: ReasonKind,
  date: string,
): Promise<AppointmentReason[]> {
  const rows = await resolveCatalogAt(deps.sys, { tenantId, type: REASON_TYPE[kind], date });
  const out: AppointmentReason[] = rows
    .filter((r) => r.code !== OTHER_REASON)
    .map((r) => ({
      code: r.code,
      name: String(r.payload.name ?? r.code),
      party: (r.payload.party as AppointmentReason['party']) ?? 'other',
      noteRequired: r.payload.noteRequired === true,
      order: typeof r.payload.order === 'number' ? r.payload.order : 500,
      active: r.payload.status !== 'inactive',
    }))
    .sort((x, y) => x.order - y.order || x.code.localeCompare(y.code));
  const cfg = rows.find((r) => r.code === OTHER_REASON);
  out.push({
    code: OTHER_REASON,
    name: cfg ? String(cfg.payload.name ?? 'Khác') : 'Khác',
    party: 'other',
    noteRequired: true,
    order: 999,
    active: true,
  });
  return out;
}

/** Active reasons offered by the dialogs (cancel or reschedule). */
export async function listAppointmentReasons(
  deps: RecDeps,
  actor: Actor,
  kind: ReasonKind,
): Promise<{ items: AppointmentReason[]; noteMinLength: number }> {
  resolveScope(actor, 'appointment:view');
  const now = nowOf(deps);
  const reasons = (await loadReasons(deps, actor.tenantId, kind, now.date)).filter((r) => r.active);
  const pol = actor.workingBranchId
    ? await appointmentPolicyAt(deps, actor.tenantId, actor.workingBranchId, now.date)
    : { ...APPOINTMENTS_OFF, versionId: null };
  return { items: reasons, noteMinLength: pol.noteMinLength };
}

// ---- notifying the customer (FR-REC-046 3.7, FR-REC-045; RULE-024/028) ---------------------------------------

const noticeFields = {
  /** none = not told, phoned = staff phoned (manual record), send = through the message gateway (consented channels only) */
  notice: z.enum(['none', 'phoned', 'send']).default('none'),
  noticeChannel: z.enum(['sms', 'zalo']).optional(),
};

interface NoticePlan {
  recorded: CustomerNotice;
  target?: MessageTarget;
}

/** Decide BEFORE the transaction: `send` needs an available channel, a granted service consent and a usable contact. */
async function planNotice(
  deps: RecDeps,
  tenantId: string,
  customerId: string,
  mode: 'none' | 'phoned' | 'send',
  channel: MessageChannel | undefined,
): Promise<NoticePlan> {
  if (mode !== 'send') return { recorded: mode };
  if (!channel)
    throw validationFailed([{ field: 'noticeChannel', message: 'Chọn kênh báo khách.' }]);
  if (!deps.sys.messages.availableChannels().includes(channel))
    throw new AppError('message_channel_unavailable', 409);
  const target = await serviceTargetOf(deps, { tenantId, customerId }, channel);
  return { recorded: deps.sys.messages.isSimulated(channel) ? 'sent_fake' : 'queued', target };
}

/** After commit: a gateway failure never undoes the change (the screen offers "Đã gọi" instead); nothing personal is logged. */
async function sendNotice(
  deps: RecDeps,
  plan: NoticePlan,
  id: string,
  vars: Record<string, string>,
): Promise<void> {
  if (!plan.target) return;
  try {
    await deps.sys.messages.send({
      id,
      channel: plan.target.channel,
      to: plan.target.to,
      template: 'appointment-notice',
      vars,
    });
  } catch (e) {
    rootLogger.warn(
      { err: e instanceof Error ? e.name : 'error', id },
      'appointment notice failed',
    );
  }
}

/** FR-REC-027: who can be named advisor of an appointment at the working branch (CV and QL, the same rule as the write). */
export async function listAppointmentAdvisors(
  deps: RecDeps,
  actor: Actor,
): Promise<{ id: string; name: string }[]> {
  resolveScope(actor, 'appointment:view');
  const branchId = actor.workingBranchId;
  if (!branchId) return [];
  const ids = await usersWithRole(deps.sys, actor.tenantId, ['CV', 'QL'], branchId);
  const users = await Promise.all(ids.map((id) => deps.sys.users.getById(actor.tenantId, id)));
  return users
    .flatMap((u) => (u ? [{ id: u.id, name: u.displayName }] : []))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
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

// ---- edit (advisor, service, note) -------------------------------------------------------------------------

/** FR-REC-046: date and time are NOT editable here; they go through the reschedule action (reason, history, capacity) */
export const patchAppointmentSchema = z.object({
  version: z.number().int().min(1),
  serviceType: serviceCode.nullable().optional(),
  advisorId: z.string().trim().min(1).max(80).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

/** FR-REC-027: change ("chuyển") the advisor, the service or the note of a pending appointment. */
export async function updateAppointment(
  deps: RecDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'appointment:update');
  if (input && typeof input === 'object' && ('date' in input || 'time' in input))
    throw validationFailed([
      { field: 'date', message: 'Đổi ngày giờ bằng thao tác Dời lịch (cần lý do và bên đề nghị).' },
    ]);
  const data = parseInput(patchAppointmentSchema, input);
  const cur = await deps.appointments.get(scope, id);
  if (!cur) throw notFound();
  if (data.serviceType) await assertServiceType(deps, actor, data.serviceType);
  if (data.advisorId) await assertAdvisor(deps, actor.tenantId, cur.branchId, data.advisorId);
  const now0 = nowOf(deps);
  const pol = await appointmentPolicyAt(deps, actor.tenantId, cur.branchId, now0.date);
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
      const next: Appointment = { ...a };
      const patch: Record<string, unknown> = {};
      const set = <K extends 'serviceType' | 'advisorId' | 'note'>(
        k: K,
        v: string | null | undefined,
      ) => {
        if (v === undefined) return;
        patch[k] = v === null || v === '' ? null : v;
        if (v === null || v === '') delete (next as Partial<Appointment>)[k];
        else (next as unknown as Record<string, unknown>)[k] = v;
      };
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
          before: { advisorId: a.advisorId ?? null, serviceType: a.serviceType ?? null },
          after: { advisorId: next.advisorId ?? null, serviceType: next.serviceType ?? null },
        }),
      );
      const upd = { ...next, updatedAt: now, updatedBy: actor.userId, version: a.version + 1 };
      return {
        status: 200,
        body: toAppointmentDto(
          upd,
          lateViewOf(upd, now0, pol),
          await namesOf(deps, a.tenantId, [upd]),
        ),
      };
    },
  );
}

// ---- reschedule (FR-REC-046) -------------------------------------------------------------------------------

export const rescheduleAppointmentSchema = z.object({
  version: z.number().int().min(1),
  date: isoDate,
  time,
  reasonCode: z.string().trim().min(1).max(30),
  note: z.string().trim().max(300).optional(),
  /** who asked for the move; mandatory, never guessed from the reason */
  requestedBy: z.enum(['customer', 'workshop']),
  acknowledgeOverCapacity: z.boolean().optional(),
  /** QL/CH only: go past the reschedule limit (a note is mandatory) */
  overrideLimit: z.boolean().optional(),
  ...noticeFields,
});

/**
 * FR-REC-046: move a PENDING appointment (also an overdue one) to another date/time in ONE transaction: version check,
 * an append-only history entry (old -> new, reason, requester, who, when), the LH number and the branch stay, the old day
 * gets its place back and the new day is checked like a new booking (409 `capacity_exceeded`, confirm with
 * `acknowledgeOverCapacity`; the same day is not re-checked). The limit of reschedules blocks an advisor, QL/CH override
 * with a note; a move close to the time is only flagged. Idempotency-Key required.
 */
export async function rescheduleAppointment(
  deps: RecDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
): Promise<{ response: { status: number; body: unknown }; replayed: boolean }> {
  const scope = resolveScope(actor, 'appointment:update');
  const data = parseInput(rescheduleAppointmentSchema, input);
  const cur = await deps.appointments.get(scope, id);
  if (!cur) throw notFound();
  const now = nowOf(deps);
  const todayPolicy = await appointmentPolicyAt(deps, actor.tenantId, cur.branchId, now.date);
  const replayKey = `${actor.userId}:${ctx.idempotencyKey}`;
  // a repeat of a request that already went through: answer from the stored response, do not re-validate the new state
  const isReplay = (cur.reschedules ?? []).some((x) => x.idem === replayKey);
  const prepareReschedule = async () => {
    if (cur.status !== 'pending') throw new AppError('appointment_state_invalid', 409);
    const newPolicy = await appointmentPolicyAt(deps, actor.tenantId, cur.branchId, data.date);
    if (!newPolicy.enabled || !todayPolicy.enabled)
      throw new AppError('appointments_disabled', 409);
    assertBookableDate(deps, data.date);
    const dateChanged = data.date !== cur.date;
    if (!dateChanged && data.time === cur.time)
      throw validationFailed([
        { field: 'time', message: 'Chọn ngày hoặc giờ khác với lịch hiện tại.' },
      ]);
    // the new time must be ahead of now; an overdue appointment only has to leave the overdue set (grace may allow a minute behind)
    const wasLate = lateViewOf(cur, now, todayPolicy);
    const newLate = lateViewOf(
      { status: 'pending', date: data.date, time: data.time },
      now,
      todayPolicy,
    );
    const nowMin = wallMinutes(now.date, now.time);
    const newMin = wallMinutes(data.date, data.time);
    if (wasLate.overdue ? newLate.overdue : newMin <= nowMin)
      throw validationFailed([
        { field: 'time', message: 'Giờ hẹn mới phải sau thời điểm hiện tại.' },
      ]);
    const reasons = await loadReasons(deps, actor.tenantId, 'reschedule', now.date);
    const rc = checkReason(reasons, data.reasonCode, data.note, newPolicy.noteMinLength);
    if (!rc.ok)
      throw validationFailed([
        {
          field: rc.field,
          message:
            rc.field === 'note'
              ? `Ghi chú lý do ít nhất ${newPolicy.noteMinLength} ký tự.`
              : 'Chọn lý do dời lịch.',
        },
      ]);
    // limit of reschedules (blocks an advisor; QL and CH with the policy right override with a note)
    const count = cur.reschedules?.length ?? 0;
    const overLimit = count >= todayPolicy.maxReschedules;
    if (overLimit) {
      const mayOverride = hasPermission(actor, 'appointment-policy:update');
      if (!mayOverride) throw new AppError('reschedule_limit_reached', 409);
      if (data.overrideLimit !== true || (data.note ?? '').trim().length < newPolicy.noteMinLength)
        throw new AppError('reschedule_limit_reached', 409, [
          {
            field: 'note',
            message: `Vượt giới hạn dời: ghi chú ít nhất ${newPolicy.noteMinLength} ký tự.`,
          },
        ]);
    }
    const minutesToOld = wallMinutes(cur.date, cur.time) - nowMin;
    const late = minutesToOld >= 0 && minutesToOld <= todayPolicy.lateRescheduleMinutes;
    const over = dateChanged
      ? await checkCapacity(
          deps,
          scope,
          cur.branchId,
          data.date,
          newPolicy,
          data.acknowledgeOverCapacity === true,
          cur.id,
        )
      : false;
    const plan = await planNotice(
      deps,
      actor.tenantId,
      cur.customerId,
      data.notice,
      data.noticeChannel,
    );
    return { rc, over, late, overLimit, plan, dateChanged };
  };
  const prep = isReplay ? null : await prepareReschedule();
  const r = await runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/rec/appointments/${id}/reschedule`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ id, ...data }),
    },
    async (tx) => {
      // the stored response expired but the history still has this key: the client must reload and decide again
      if (!prep) throw versionConflict();
      const { rc, over, late, overLimit, plan, dateChanged } = prep;
      const a = await deps.appointments.getInTx(tx, scope, id);
      if (!a) throw notFound();
      if (a.version !== data.version) throw versionConflict();
      const t = transitionAppointment(a.status, 'reschedule');
      if (!t.ok) throw new AppError(t.reason, 409);
      await assertWritable(deps, tx, actor, scope, a.branchId, 'edit_open_order');
      const at = deps.sys.clock.now();
      const entry: AppointmentReschedule = {
        fromDate: a.date,
        fromTime: a.time,
        toDate: data.date,
        toTime: data.time,
        reasonCode: rc.reason.code,
        reasonName: rc.reason.name,
        ...(data.note ? { note: data.note } : {}),
        requestedBy: data.requestedBy,
        by: actor.userId,
        at: at.toISOString(),
        late,
        overCapacity: over,
        overLimit,
        notice: plan.recorded,
        idem: replayKey,
        tenantId: a.tenantId,
        branchId: a.branchId,
      };
      const reschedules = [...(a.reschedules ?? []), entry];
      const nextOver = dateChanged ? over : a.overCapacity;
      deps.appointments.update(tx, id, {
        date: data.date,
        time: data.time,
        overCapacity: nextOver,
        reschedules,
        updatedAt: at,
        updatedBy: actor.userId,
        version: a.version + 1,
      });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: a.branchId,
          entityType: 'appointment',
          entityId: id,
          action: 'appointment.reschedule',
          before: { date: a.date, time: a.time },
          after: {
            date: data.date,
            time: data.time,
            reasonCode: entry.reasonCode,
            reasonName: entry.reasonName,
            requestedBy: entry.requestedBy,
            late,
            overCapacity: over,
            overLimit,
            notice: plan.recorded,
            count: reschedules.length,
          },
          ...(data.note ? { reason: data.note } : {}),
        }),
      );
      const upd: Appointment = {
        ...a,
        date: data.date,
        time: data.time,
        overCapacity: nextOver,
        reschedules,
        updatedAt: at,
        updatedBy: actor.userId,
        version: a.version + 1,
      };
      return {
        status: 200,
        body: toAppointmentDto(
          upd,
          lateViewOf(upd, now, todayPolicy),
          await namesOf(deps, a.tenantId, [upd]),
        ),
      };
    },
  );
  if (!r.replayed && prep)
    await sendNotice(deps, prep.plan, `apt-rs-${ctx.idempotencyKey}`, {
      kind: 'reschedule',
      number: cur.number,
      date: isoToVi(data.date),
      time: data.time,
    });
  return r;
}

// ---- cancel / no-show ---------------------------------------------------------------------------------

/** FR-REC-045: a reason of the tenant catalogue (`other` needs a note), plus how the customer was told */
export const cancelAppointmentSchema = z.object({
  version: z.number().int().min(1),
  reasonCode: z.string().trim().min(1).max(30),
  note: z.string().trim().max(300).optional(),
  ...noticeFields,
});
const versionOnly = z.object({ version: z.number().int().min(1) });

/** FR-REC-027, 045: cancel with a catalogue reason; the name is copied onto the appointment (RULE-019). */
export async function cancelAppointment(
  deps: RecDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'appointment:update');
  const data = parseInput(cancelAppointmentSchema, input);
  const cur = await deps.appointments.get(scope, id);
  if (!cur) throw notFound();
  const now0 = nowOf(deps);
  const pol = await appointmentPolicyAt(deps, actor.tenantId, cur.branchId, now0.date);
  const reasons = await loadReasons(deps, actor.tenantId, 'cancel', now0.date);
  const rc = checkReason(reasons, data.reasonCode, data.note, pol.noteMinLength);
  if (!rc.ok)
    throw validationFailed([
      {
        field: rc.field,
        message:
          rc.field === 'note'
            ? `Ghi chú lý do ít nhất ${pol.noteMinLength} ký tự.`
            : 'Chọn lý do hủy.',
      },
    ]);
  const plan = await planNotice(
    deps,
    actor.tenantId,
    cur.customerId,
    data.notice,
    data.noticeChannel,
  );
  const r = await runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/rec/appointments/${id}/cancel`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ id, ...data }),
    },
    async (tx) => {
      const a = await deps.appointments.getInTx(tx, scope, id);
      if (!a) throw notFound();
      if (a.version !== data.version) throw versionConflict();
      const t = transitionAppointment(a.status, 'cancel', { hasReason: true });
      if (!t.ok) throw new AppError(t.reason, 409);
      await assertWritable(deps, tx, actor, scope, a.branchId, 'edit_open_order');
      const at = deps.sys.clock.now();
      const cancellation: AppointmentCancellation = {
        reasonCode: rc.reason.code,
        reasonName: rc.reason.name,
        party: rc.reason.party,
        ...(data.note ? { note: data.note } : {}),
        cancelledBy: actor.userId,
        cancelledAt: at.toISOString(),
        notice: plan.recorded,
      };
      const text = data.note || rc.reason.name;
      deps.appointments.update(tx, id, {
        status: t.state,
        cancelReason: text,
        cancellation,
        updatedAt: at,
        updatedBy: actor.userId,
        version: a.version + 1,
      });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: a.branchId,
          entityType: 'appointment',
          entityId: id,
          action: 'appointment.cancel',
          before: { status: a.status },
          after: {
            status: t.state,
            reasonCode: cancellation.reasonCode,
            reasonName: cancellation.reasonName,
            party: cancellation.party,
            notice: plan.recorded,
          },
          ...(data.note ? { reason: data.note } : {}),
        }),
      );
      const upd: Appointment = {
        ...a,
        status: t.state,
        cancelReason: text,
        cancellation,
        updatedAt: at,
        updatedBy: actor.userId,
        version: a.version + 1,
      };
      return {
        status: 200,
        body: toAppointmentDto(upd, NO_LATE, await namesOf(deps, a.tenantId, [upd])),
      };
    },
  );
  if (!r.replayed)
    await sendNotice(deps, plan, `apt-cx-${ctx.idempotencyKey}`, {
      kind: 'cancel',
      number: cur.number,
    });
  return r;
}

/** FR-REC-027: the customer did not come ("vắng"); only from the appointment day on. */
export async function markNoShow(
  deps: RecDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'appointment:update');
  const data = parseInput(versionOnly, input);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/rec/appointments/${id}/no-show`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ id, ...data }),
    },
    async (tx) => {
      const a = await deps.appointments.getInTx(tx, scope, id);
      if (!a) throw notFound();
      if (a.version !== data.version) throw versionConflict();
      const today = businessDate(deps.sys.clock.now());
      const t = transitionAppointment(a.status, 'no_show', { dayStarted: a.date <= today });
      if (!t.ok) throw new AppError(t.reason, 409);
      await assertWritable(deps, tx, actor, scope, a.branchId, 'edit_open_order');
      const now = deps.sys.clock.now();
      deps.appointments.update(tx, id, {
        status: t.state,
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
          action: 'appointment.no_show',
          before: { status: a.status },
          after: { status: t.state },
        }),
      );
      return {
        status: 200,
        body: toAppointmentDto({
          ...a,
          status: t.state,
          updatedAt: now,
          updatedBy: actor.userId,
          version: a.version + 1,
        }),
      };
    },
  );
}

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
