import { describe, expect, it } from 'vitest';
import {
  allowedAppointmentActions,
  APPOINTMENT_STATUSES,
  capacityOf,
  occupiesCapacity,
  transitionAppointment,
} from '@/modules/rec';

describe('FR-REC-027 appointment state machine (its own object, not an intake or order status)', () => {
  it('pending -> arrived | cancelled | no_show; the outcomes are final', () => {
    expect(transitionAppointment('pending', 'arrive')).toEqual({ ok: true, state: 'arrived' });
    expect(transitionAppointment('pending', 'cancel', { hasReason: true })).toEqual({
      ok: true,
      state: 'cancelled',
    });
    expect(transitionAppointment('pending', 'no_show', { dayStarted: true })).toEqual({
      ok: true,
      state: 'no_show',
    });
    for (const s of ['arrived', 'cancelled', 'no_show'] as const) {
      expect(allowedAppointmentActions(s)).toEqual([]);
      for (const e of ['arrive', 'cancel', 'no_show', 'edit', 'reschedule'] as const)
        expect(transitionAppointment(s, e, { hasReason: true, dayStarted: true }).ok).toBe(false);
    }
  });

  it('FR-REC-027: cancel needs a reason; no-show only from the appointment day on', () => {
    expect(transitionAppointment('pending', 'cancel')).toEqual({
      ok: false,
      reason: 'reason_required',
    });
    expect(transitionAppointment('pending', 'no_show', { dayStarted: false })).toEqual({
      ok: false,
      reason: 'appointment_not_due',
    });
  });

  it('only pending and arrived occupy a place in the daily capacity', () => {
    expect(APPOINTMENT_STATUSES.filter(occupiesCapacity)).toEqual(['pending', 'arrived']);
  });
});

describe('FR-REC-019 workshop capacity (cars per day, configured; over capacity warns, never blocks)', () => {
  it('full at the capacity, over above it', () => {
    expect(capacityOf('2026-11-10', 1, 2)).toMatchObject({ full: false, over: false });
    expect(capacityOf('2026-11-10', 2, 2)).toMatchObject({ full: true, over: false });
    expect(capacityOf('2026-11-10', 3, 2)).toMatchObject({ full: true, over: true });
  });
  it('no capacity configured (0) never warns', () => {
    expect(capacityOf('2026-11-10', 50, 0)).toMatchObject({ full: false, over: false });
  });
});
