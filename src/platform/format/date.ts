/**
 * Date formatting for the Vietnamese UI: dd/MM/yyyy, 24h time, Asia/Ho_Chi_Minh by default.
 * Instants are stored in UTC; `businessDate` (yyyy-MM-dd) is derived in the branch timezone.
 */
export const DEFAULT_TIME_ZONE = 'Asia/Ho_Chi_Minh';

function parts(date: Date, timeZone: string, withTime: boolean): Record<string, string> {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}),
  });
  return Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
}

export function formatDate(date: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  const p = parts(date, timeZone, false);
  return `${p.day}/${p.month}/${p.year}`;
}

export function formatDateTime(date: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  const p = parts(date, timeZone, true);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/** yyyy-MM-dd of the instant in the given timezone (the document's businessDate). */
export function businessDate(date: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  const p = parts(date, timeZone, false);
  return `${p.year}-${p.month}-${p.day}`;
}

/** yyyy-MM-dd -> dd/MM/yyyy; anything that is not a business date yields ''. */
export function isoToVi(iso: string | undefined | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/**
 * dd/MM/yyyy -> yyyy-MM-dd, or null when it is not a real calendar date (31/02/2026 is rejected).
 * Also accepts an already ISO value so server pages can take either form from the query string.
 */
export function viToIso(vi: string | undefined | null): string | null {
  const s = (vi ?? '').trim();
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  const iso = m ? `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}` : s;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null;
}

/** HH:mm (24 h) of the instant in the given timezone: the wall-clock minute used by "Trễ hẹn" (FR-REC-044). */
export function businessTime(date: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  const p = parts(date, timeZone, true);
  return `${p.hour}:${p.minute}`;
}

/** yyyy-MM-dd plus n days (calendar arithmetic, no timezone involved). */
export function addIsoDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 1 (Monday) .. 7 (Sunday) of a business date. */
export function isoWeekday(iso: string): number {
  const d = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Monday of the ISO 8601 week containing the date (FR-REC-047, Q98). */
export function isoWeekStart(iso: string): string {
  return addIsoDays(iso, 1 - isoWeekday(iso));
}

/** ISO 8601 week number and the week-based year (29/12/2025 belongs to week 1 of 2026). */
export function isoWeekOf(iso: string): { week: number; year: number } {
  const thursday = addIsoDays(iso, 4 - isoWeekday(iso));
  const year = Number(thursday.slice(0, 4));
  const jan1 = `${year}-01-01`;
  const days = Math.round(
    (new Date(`${thursday}T00:00:00Z`).getTime() - new Date(`${jan1}T00:00:00Z`).getTime()) /
      86_400_000,
  );
  return { week: Math.floor(days / 7) + 1, year };
}

const WEEKDAY_FULL = [
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
  'Chủ nhật',
] as const;
const WEEKDAY_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const;

/** "Thứ Sáu, 30/10/2026" (FR-REC-047): the full weekday name, then dd/MM/yyyy. */
export function viDayTitle(iso: string): string {
  return `${WEEKDAY_FULL[isoWeekday(iso) - 1]}, ${isoToVi(iso)}`;
}

/** "T6, 30/10/2026": the short form for phones and grid columns. */
export function viDayShort(iso: string): string {
  return `${WEEKDAY_SHORT[isoWeekday(iso) - 1]}, ${isoToVi(iso)}`;
}

/** "T6 30/10": a day inside a week strip. */
export function viDayChip(iso: string): string {
  return `${WEEKDAY_SHORT[isoWeekday(iso) - 1]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** Whole days from `b` to `a` (a - b). */
export function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()) / 86_400_000,
  );
}

/**
 * "Tuần 45 (02/11 – 08/11/2026)", Monday to Sunday, ISO 8601 numbering; a week across two years shows both years:
 * "Tuần 1 (29/12/2025 – 04/01/2026)" (FR-REC-047, Q98).
 */
export function viWeekTitle(iso: string): string {
  const start = isoWeekStart(iso);
  const end = addIsoDays(start, 6);
  const { week } = isoWeekOf(iso);
  const from =
    start.slice(0, 4) === end.slice(0, 4)
      ? `${start.slice(8, 10)}/${start.slice(5, 7)}`
      : isoToVi(start);
  return `Tuần ${week} (${from} – ${isoToVi(end)})`;
}
