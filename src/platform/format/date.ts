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
