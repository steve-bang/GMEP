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

export type AppointmentEvent = 'arrive' | 'cancel' | 'no_show' | 'edit';

/** FR-REC-027: pending -> arrived | cancelled (with a reason) | no_show; the three outcomes are final. */
export const APPOINTMENT_TRANSITIONS: Readonly<
  Record<AppointmentStatus, Partial<Record<AppointmentEvent, AppointmentStatus>>>
> = {
  pending: { arrive: 'arrived', cancel: 'cancelled', no_show: 'no_show', edit: 'pending' },
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
}
export const APPOINTMENTS_OFF: AppointmentPolicy = { enabled: false, dailyCapacity: 0 };

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
