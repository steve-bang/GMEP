import type { Transition } from './quoteState';

/**
 * Appointment (lịch hẹn, G2-APT-01/02; FR-REC-019, 027; BR-REC-09). Its OWN object with its own state set, never a
 * status of the intake or the repair order. "Đã đến" opens the intake (pre-filled) once; a walk-in vehicle still gets an
 * intake without any appointment. Whether a branch takes appointments at all is open (BRD Discovery 13), so the feature
 * is switched per branch by the effective-dated `appointment-policy` configuration; the daily workshop capacity (cars per
 * day) is the same configuration: going over it warns, it never blocks.
 */
export type AppointmentStatus = 'pending' | 'arrived' | 'cancelled' | 'no_show';
export const APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  'pending',
  'arrived',
  'cancelled',
  'no_show',
];

export type AppointmentEvent = 'arrive' | 'cancel' | 'no_show' | 'edit' | 'reschedule';

/** FR-REC-027: pending -> arrived | cancelled (with a reason) | no_show; the three outcomes are final. */
export const APPOINTMENT_TRANSITIONS: Readonly<
  Record<AppointmentStatus, Partial<Record<AppointmentEvent, AppointmentStatus>>>
> = {
  pending: {
    arrive: 'arrived',
    cancel: 'cancelled',
    no_show: 'no_show',
    edit: 'pending',
    // FR-REC-046: moving the date/time is an EVENT of the same pending appointment, not a new status
    reschedule: 'pending',
  },
  arrived: {},
  cancelled: {},
  no_show: {},
};

export interface AppointmentCtx {
  /** cancel needs a reason (FR-REC-027 "hủy có lý do") */
  hasReason?: boolean;
  /** no-show is only meaningful once the appointment day has started */
  dayStarted?: boolean;
}

export function transitionAppointment(
  state: AppointmentStatus,
  event: AppointmentEvent,
  ctx: AppointmentCtx = {},
): Transition<AppointmentStatus> {
  const next = APPOINTMENT_TRANSITIONS[state][event];
  if (!next) return { ok: false, reason: 'appointment_state_invalid' };
  if (event === 'cancel' && !ctx.hasReason) return { ok: false, reason: 'reason_required' };
  if (event === 'no_show' && ctx.dayStarted === false)
    return { ok: false, reason: 'appointment_not_due' };
  return { ok: true, state: next };
}

export function allowedAppointmentActions(state: AppointmentStatus): AppointmentEvent[] {
  return Object.keys(APPOINTMENT_TRANSITIONS[state]) as AppointmentEvent[];
}

/** Statuses that occupy a place in the workshop's daily capacity. */
export const occupiesCapacity = (s: AppointmentStatus): boolean =>
  s === 'pending' || s === 'arrived';

/**
 * Effective-dated `appointment-policy` (company default, branch override). No version in force = the feature is OFF
 * for that branch (Discovery 13 not confirmed: nothing is assumed about the client). `dailyCapacity` 0 = no capacity
 * configured, so no warning is computed.
 */
export interface AppointmentPolicy {
  enabled: boolean;
  dailyCapacity: number;
  /** FR-REC-044: minutes after the appointment time before a pending one counts as "Trễ hẹn" (owner decision: 0) */
  overdueGraceMinutes: number;
  /** FR-REC-044: an overdue appointment older than this many days is flagged "Tồn đọng" [Cần xác nhận: Q92] */
  staleDays: number;
  /** FR-REC-046: reschedules per appointment before an advisor is blocked (CH/QL may override) [Q95] */
  maxReschedules: number;
  /** FR-REC-046: a reschedule within this many minutes before the time is only FLAGGED, never blocked [Q95] */
  lateRescheduleMinutes: number;
  /** FR-REC-045/046: minimum trimmed note length of the "other" reason */
  noteMinLength: number;
}
export const APPOINTMENT_RULE_DEFAULTS = {
  overdueGraceMinutes: 0,
  staleDays: 30,
  maxReschedules: 3,
  lateRescheduleMinutes: 120,
  noteMinLength: 3,
} as const;
export const APPOINTMENTS_OFF: AppointmentPolicy = {
  enabled: false,
  dailyCapacity: 0,
  ...APPOINTMENT_RULE_DEFAULTS,
};

// ---- overdue ("Trễ hẹn"), computed on read (FR-REC-044), never a stored status ------------------------------

/** minutes since the epoch of a business date and HH:mm (the wall clock of Asia/Ho_Chi_Minh, no DST, so a plain count) */
export function wallMinutes(date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return Math.floor(Date.UTC(y!, m! - 1, d!, hh!, mm!) / 60_000);
}

export interface LateView {
  /** minutes past the appointment time (0 when not yet due); only for pending appointments */
  lateMinutes: number;
  /** FR-REC-044: pending and later than the time plus the grace */
  overdue: boolean;
  /** overdue for more than `staleDays` days */
  stale: boolean;
}

/**
 * FR-REC-044: a pending appointment is "Trễ hẹn" when the current minute is after the appointment minute plus the
 * grace (08:00 is not late during 08:00:59; 08:01 is, with grace 0). `now` is the server wall clock in the branch time zone.
 */
export function lateViewOf(
  a: Pick<Appointment, 'status' | 'date' | 'time'>,
  now: { date: string; time: string },
  policy: Pick<AppointmentPolicy, 'overdueGraceMinutes' | 'staleDays'>,
): LateView {
  if (a.status !== 'pending') return { lateMinutes: 0, overdue: false, stale: false };
  const late = Math.max(0, wallMinutes(now.date, now.time) - wallMinutes(a.date, a.time));
  const overdue = late > policy.overdueGraceMinutes;
  return { lateMinutes: late, overdue, stale: overdue && late > policy.staleDays * 24 * 60 };
}

export const APPOINTMENT_TABS = ['upcoming', 'overdue', 'arrived', 'cancelled', 'no_show'] as const;
export type AppointmentTab = (typeof APPOINTMENT_TABS)[number];

/** FR-REC-044: the tab of an appointment (the same rule feeds the list and its counter) */
export function appointmentTabOf(status: AppointmentStatus, late: LateView): AppointmentTab {
  if (status === 'pending') return late.overdue ? 'overdue' : 'upcoming';
  return status;
}

// ---- reasons (FR-REC-045, 046) ---------------------------------------------------------------------------

/** the system code that is always offered and always needs a note */
export const OTHER_REASON = 'other';
export type ReasonParty = 'customer' | 'garage' | 'other';

export interface AppointmentReason {
  code: string;
  name: string;
  party: ReasonParty;
  noteRequired: boolean;
  order: number;
  active: boolean;
}

/** FR-REC-045/046: the reason must exist and be active, and the note is mandatory (min length) when the reason says so */
export function checkReason(
  reasons: readonly AppointmentReason[],
  code: string,
  note: string | undefined,
  noteMinLength: number,
): { ok: true; reason: AppointmentReason } | { ok: false; field: 'reasonCode' | 'note' } {
  const r = reasons.find((x) => x.code === code && x.active);
  if (!r) return { ok: false, field: 'reasonCode' };
  const n = (note ?? '').trim();
  if ((r.noteRequired || r.code === OTHER_REASON) && n.length < noteMinLength)
    return { ok: false, field: 'note' };
  return { ok: true, reason: r };
}

/** how the customer was told (FR-REC-046 3.7); `queued` / `sent_fake` only through the message gateway */
export type CustomerNotice = 'none' | 'phoned' | 'queued' | 'sent_fake';

export interface AppointmentCancellation {
  reasonCode: string;
  /** name AT the time of cancelling (RULE-019: renaming the reason later changes nothing here) */
  reasonName: string;
  party: ReasonParty;
  note?: string;
  cancelledBy: string;
  /** ISO instant (a string so the nested value survives every store the same way) */
  cancelledAt: string;
  notice: CustomerNotice;
}

/** one append-only reschedule entry (FR-REC-046); dates are plain strings, `at` is an ISO instant */
export interface AppointmentReschedule {
  fromDate: string;
  fromTime: string;
  toDate: string;
  toTime: string;
  reasonCode: string;
  reasonName: string;
  note?: string;
  requestedBy: 'customer' | 'workshop';
  by: string;
  at: string;
  late: boolean;
  overCapacity: boolean;
  overLimit: boolean;
  notice: CustomerNotice;
  /** `<userId>:<Idempotency-Key>`: lets a repeated request be answered from the stored response without re-validating */
  idem?: string;
  tenantId: string;
  branchId: string;
}

export interface CapacityView {
  date: string;
  booked: number;
  capacity: number;
  /** booked > capacity (only when a capacity is configured) */
  over: boolean;
  /** booked >= capacity: the next booking would go over */
  full: boolean;
}

/** FR-REC-019: capacity of one day, from the number of appointments that occupy a place. */
export function capacityOf(date: string, booked: number, capacity: number): CapacityView {
  const has = capacity > 0;
  return {
    date,
    booked,
    capacity,
    over: has && booked > capacity,
    full: has && booked >= capacity,
  };
}

export interface Appointment {
  id: string;
  tenantId: string;
  branchId: string;
  /** LH-<MÃCN>-YYMM-STT, from the SYS numbering service (tenant and branch scoped) */
  number: string;
  status: AppointmentStatus;
  /** yyyy-MM-dd, Asia/Ho_Chi_Minh business date */
  date: string;
  /** HH:mm */
  time: string;
  vehicleId: string;
  customerId: string;
  plate: string;
  plateNorm: string;
  vehicleLabel: string;
  customerName: string;
  serviceType?: string;
  /** the advisor who will receive the car (FR-REC-027 "phân cố vấn") */
  advisorId?: string;
  note?: string;
  cancelReason?: string;
  /** FR-REC-045: code, name at the time, note, who and when (absent on appointments cancelled before the catalogue: `cancelReason` only) */
  cancellation?: AppointmentCancellation;
  /** FR-REC-046: append-only, oldest first; the first entry holds the original date and time */
  reschedules?: AppointmentReschedule[];
  /** the booking was made (or moved) knowing the day was over capacity: kept for the record, never a block */
  overCapacity: boolean;
  /** set once by "Đã đến": the intake opened from this appointment */
  intakeId?: string;
  arrivedAt?: Date;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}
