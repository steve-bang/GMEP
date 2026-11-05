import { describe, expect, it } from 'vitest';
import {
  lastFinishAt,
  shortCustomerName,
  summariseDay,
  workedMsWithin,
  type TimeEvent,
} from '@/modules/rec';

// 2026-11-04 00:00 in Asia/Ho_Chi_Minh is 2026-11-03T17:00Z
const DAY = new Date('2026-11-04T00:00:00+07:00');
const NEXT = new Date(DAY.getTime() + 24 * 3_600_000);
const at = (h: number, m = 0) => new Date(DAY.getTime() + (h * 60 + m) * 60_000);
let n = 0;
const ev = (type: TimeEvent['type'], when: Date, undone = false): TimeEvent => ({
  n: ++n,
  type,
  from: 'not_started',
  to: 'in_progress',
  at: when,
  by: 'u1',
  ...(undone ? { undone: true } : {}),
});

describe('shortCustomerName (G1-DSH-07: no full name on the technician card)', () => {
  it('shows a person by the given name and a business without its legal form', () => {
    expect(shortCustomerName('Nguyễn Văn An')).toBe('An');
    expect(shortCustomerName('Lê Lan')).toBe('Lê Lan');
    expect(shortCustomerName('Công ty TNHH Hòa Phát Auto')).toBe('Hòa Phát');
    expect(shortCustomerName('  CTY CP  Minh   Long ')).toBe('Minh Long');
    expect(shortCustomerName('')).toBe('');
  });
  it('is capped in length', () => {
    expect(
      shortCustomerName('Công ty Supercalifragilistic Expialidocious').length,
    ).toBeLessThanOrEqual(24);
  });
});

describe('workedMsWithin and summariseDay (FR-REC-013, hours only, no commission)', () => {
  it('clips closed and open segments to the day and ignores undone events', () => {
    const events = [
      ev('start', at(-1)), // yesterday 23:00
      ev('pause', at(0, 30)), // 30 minutes fall into today
      ev('start', at(9)),
      ev('finish', at(10), true), // undone: the segment stays open
      ev('start', at(11), true),
    ];
    expect(workedMsWithin(events, DAY, at(12))).toBe((30 + 180) * 60_000);
    expect(workedMsWithin([], DAY, NEXT)).toBe(0);
  });

  it('counts only items finished today as done, items still open as to do', () => {
    const doneToday = {
      status: 'done',
      approvedMinutes: 90,
      events: [ev('start', at(8)), ev('finish', at(9))],
    };
    const doneBefore = {
      status: 'done',
      approvedMinutes: 60,
      events: [ev('start', at(-30)), ev('finish', at(-29))],
    };
    const open = { status: 'in_progress', approvedMinutes: 30, events: [ev('start', at(10))] };
    const s = summariseDay([doneToday, doneBefore, open], DAY, at(11));
    expect(s).toEqual({
      standardDoneMinutes: 90,
      workedMinutes: 120,
      doneCount: 1,
      totalCount: 2,
    });
    expect(lastFinishAt(doneToday.events)).toEqual(at(9));
    expect(lastFinishAt([ev('finish', at(9), true)])).toBeNull();
  });
});
