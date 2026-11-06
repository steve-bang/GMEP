import { viToIsoDisplay } from './dateMask';

/** Pure date-range helpers of the dashboard filter (dates are yyyy-MM-dd; the caller passes today in the business time zone). */

export type PresetId = 'today' | 'yesterday' | 'd7' | 'd30';
export const PRESETS: PresetId[] = ['today', 'yesterday', 'd7', 'd30'];

export function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Inclusive number of days between two dates (1 for the same day). */
export function daysBetween(from: string, to: string): number {
  return (
    Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1
  );
}

export function presetRange(id: PresetId, today: string): { from: string; to: string } {
  switch (id) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const y = addDaysIso(today, -1);
      return { from: y, to: y };
    }
    case 'd7':
      return { from: addDaysIso(today, -6), to: today };
    case 'd30':
      return { from: addDaysIso(today, -29), to: today };
  }
}

/** The preset the range equals, or null (then it is a custom range). */
export function activePreset(from: string, to: string, today: string): PresetId | null {
  return (
    PRESETS.find((p) => {
      const r = presetRange(p, today);
      return r.from === from && r.to === to;
    }) ?? null
  );
}

export type RangeError = 'format' | 'future' | 'order' | 'tooLong';
export type RangeCheck =
  | { ok: true; from: string; to: string; days: number }
  | { ok: false; field: 'from' | 'to'; error: RangeError; days?: number };

/** Validates what the user typed (dd/MM/yyyy) before it is sent; the server checks again (`invalid_range`, `range_too_long`). */
export function validateRange(
  fromVi: string,
  toVi: string,
  today: string,
  maxDays: number,
): RangeCheck {
  const from = viToIsoDisplay(fromVi);
  if (!from) return { ok: false, field: 'from', error: 'format' };
  const to = viToIsoDisplay(toVi);
  if (!to) return { ok: false, field: 'to', error: 'format' };
  if (from > today) return { ok: false, field: 'from', error: 'future' };
  if (to > today) return { ok: false, field: 'to', error: 'future' };
  if (from > to) return { ok: false, field: 'to', error: 'order' };
  const days = daysBetween(from, to);
  if (days > maxDays) return { ok: false, field: 'to', error: 'tooLong', days };
  return { ok: true, from, to, days };
}

/** "Từ" moved after "Đến" pushes "Đến" to the same day (both valid ISO dates in; the new `to` out). */
export function pushEnd(fromIso: string, toIso: string): string {
  return fromIso > toIso ? fromIso : toIso;
}
