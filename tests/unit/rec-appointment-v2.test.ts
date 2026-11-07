import { describe, expect, it } from 'vitest';
import {
  addIsoDays,
  businessDate,
  businessTime,
  isoToVi,
  isoWeekOf,
  isoWeekStart,
  isoWeekday,
  viToIso,
} from '@/platform/format/date';
import { renderShortText } from '@/infrastructure/messaging/templates';
import {
  allowedAppointmentActions,
  appointmentTabOf,
  checkReason,
  lateViewOf,
  transitionAppointment,
  wallMinutes,
  type AppointmentReason,
  type AppointmentStatus,
} from '@/modules/rec';

/**
 * FR-REC-044 (overdue is computed on read, grace default 0), FR-REC-045/046 (reason catalogue, reschedule is an event of
 * the same pending appointment), FR-REC-047 (server time zone, ISO week, dd/MM/yyyy). Examples are the BA acceptance
 * criteria AC-01, AC-02, AC-06, AC-24, AC-25 (now = 05/11/2026 10:00 Asia/Ho_Chi_Minh).
 */
const policy = (grace = 0, staleDays = 30) => ({ overdueGraceMinutes: grace, staleDays });
const apt = (date: string, time: string, status: AppointmentStatus = 'pending') => ({
  status,
  date,
  time,
});

describe('FR-REC-044 overdue (Trễ hẹn) computed on read', () => {
  it('AC-01: pending at 09:00, now 10:00 -> overdue (late 60)', () => {
    const v = lateViewOf(
      apt('2026-11-05', '09:00'),
      { date: '2026-11-05', time: '10:00' },
      policy(),
    );
    expect(v).toEqual({ lateMinutes: 60, overdue: true, stale: false });
    expect(appointmentTabOf('pending', v)).toBe('overdue');
  });

  it('AC-02: grace 0: 10:00 is not late at 10:00, late at 10:01 ("Trễ 1 phút")', () => {
    const a = apt('2026-11-05', '10:00');
    expect(lateViewOf(a, { date: '2026-11-05', time: '10:00' }, policy()).overdue).toBe(false);
    const late = lateViewOf(a, { date: '2026-11-05', time: '10:01' }, policy());
    expect(late).toMatchObject({ overdue: true, lateMinutes: 1 });
  });

  it('AC-02/06: with a grace the appointment stays upcoming but reports the minutes ("Trễ 10 phút", "Trễ 60 phút")', () => {
    const a = apt('2026-11-05', '10:00');
    const v = lateViewOf(a, { date: '2026-11-05', time: '10:10' }, policy(15));
    expect(v).toMatchObject({ overdue: false, lateMinutes: 10 });
    expect(appointmentTabOf('pending', v)).toBe('upcoming');
    const w = lateViewOf(
      apt('2026-11-05', '09:00'),
      { date: '2026-11-05', time: '10:00' },
      policy(90),
    );
    expect(w).toMatchObject({ overdue: false, lateMinutes: 60 });
    expect(lateViewOf(a, { date: '2026-11-05', time: '10:16' }, policy(15)).overdue).toBe(true);
  });

  it('days before count too (not bounded by the viewed day) and an old one is flagged stale (Tồn đọng)', () => {
    const v = lateViewOf(
      apt('2026-11-04', '08:00'),
      { date: '2026-11-05', time: '10:00' },
      policy(),
    );
    expect(v.overdue).toBe(true);
    expect(v.lateMinutes).toBe(26 * 60);
    const old = lateViewOf(
      apt('2026-09-01', '08:00'),
      { date: '2026-11-05', time: '10:00' },
      policy(),
    );
    expect(old.stale).toBe(true);
  });

  it('only pending can be late; the outcomes are never overdue', () => {
    for (const s of ['arrived', 'cancelled', 'no_show'] as const) {
      const v = lateViewOf(
        apt('2026-11-04', '08:00', s),
        { date: '2026-11-05', time: '10:00' },
        policy(),
      );
      expect(v.overdue).toBe(false);
      expect(appointmentTabOf(s, v)).toBe(s);
    }
  });

  it('the wall clock of Asia/Ho_Chi_Minh, not the machine zone: 23:30 UTC on 04/11 is 06:30 on 05/11', () => {
    const at = new Date('2026-11-04T23:30:00.000Z');
    expect(businessDate(at)).toBe('2026-11-05');
    expect(businessTime(at)).toBe('06:30');
    expect(wallMinutes('2026-11-05', '10:00') - wallMinutes('2026-11-05', '09:00')).toBe(60);
  });
});

describe('FR-REC-046 reschedule is an event of the pending appointment, not a status', () => {
  it('pending -> pending on reschedule; the outcomes cannot be rescheduled (AC-20)', () => {
    expect(transitionAppointment('pending', 'reschedule')).toEqual({ ok: true, state: 'pending' });
    expect(allowedAppointmentActions('pending')).toContain('reschedule');
    for (const s of ['arrived', 'cancelled', 'no_show'] as const) {
      expect(transitionAppointment(s, 'reschedule').ok).toBe(false);
      expect(allowedAppointmentActions(s)).not.toContain('reschedule');
    }
  });
});

describe('FR-REC-045/046 reasons: stable code, `other` needs a note of at least 3 characters (AC-08, AC-09)', () => {
  const reasons: AppointmentReason[] = [
    {
      code: 'customer_busy',
      name: 'Khách bận',
      party: 'customer',
      noteRequired: false,
      order: 10,
      active: true,
    },
    { code: 'old', name: 'Cũ', party: 'garage', noteRequired: false, order: 20, active: false },
    { code: 'other', name: 'Khác', party: 'other', noteRequired: true, order: 999, active: true },
  ];
  it('accepts an active reason, rejects an unknown or inactive one', () => {
    expect(checkReason(reasons, 'customer_busy', undefined, 3).ok).toBe(true);
    expect(checkReason(reasons, 'old', undefined, 3)).toEqual({ ok: false, field: 'reasonCode' });
    expect(checkReason(reasons, 'nope', undefined, 3)).toEqual({ ok: false, field: 'reasonCode' });
  });
  it('other: the trimmed note must reach the minimum length', () => {
    expect(checkReason(reasons, 'other', '  ab ', 3)).toEqual({ ok: false, field: 'note' });
    expect(checkReason(reasons, 'other', undefined, 3)).toEqual({ ok: false, field: 'note' });
    expect(checkReason(reasons, 'other', ' abc ', 3).ok).toBe(true);
  });
});

describe('FR-REC-047 dates: ISO week from Monday, dd/MM/yyyy, no ISO text for people', () => {
  it('AC-24: Thursday 05/11/2026 is in week 45 (02/11 - 08/11)', () => {
    expect(isoWeekday('2026-11-05')).toBe(4);
    expect(isoWeekOf('2026-11-05')).toEqual({ week: 45, year: 2026 });
    expect(isoWeekStart('2026-11-05')).toBe('2026-11-02');
    expect(addIsoDays(isoWeekStart('2026-11-05'), 6)).toBe('2026-11-08');
  });
  it('AC-25: 01/01/2026 belongs to week 1, 29/12/2025 - 04/01/2026', () => {
    expect(isoWeekOf('2026-01-01')).toEqual({ week: 1, year: 2026 });
    expect(isoWeekStart('2026-01-01')).toBe('2025-12-29');
    expect(addIsoDays('2025-12-29', 6)).toBe('2026-01-04');
    expect(isoWeekOf('2027-01-01')).toEqual({ week: 53, year: 2026 });
  });
  it('AC-27: 31/02/2026 does not exist; dates shown to people are dd/MM/yyyy', () => {
    expect(viToIso('31/02/2026')).toBeNull();
    expect(viToIso('05/11/2026')).toBe('2026-11-05');
    expect(isoToVi('2026-11-05')).toBe('05/11/2026');
  });
  it('the customer notice text carries dd/MM/yyyy and no internal reason', () => {
    const t = renderShortText('appointment-notice', {
      kind: 'reschedule',
      number: 'LH-Q7-2611-00040',
      date: '09/11/2026',
      time: '14:00',
    });
    expect(t).toContain('09/11/2026');
    expect(t).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(
      renderShortText('appointment-notice', { kind: 'cancel', number: 'LH-Q7-2611-00040' }),
    ).toContain('hủy');
    expect(() =>
      renderShortText('appointment-notice', {
        kind: 'reschedule',
        number: 'LH-Q7-2611-00040',
        date: '2026-11-09',
        time: '14:00',
      }),
    ).toThrow();
  });
});
