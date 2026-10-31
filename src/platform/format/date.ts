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
