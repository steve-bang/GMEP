import { AppError } from './support';
import { dateRange } from '../domain/reports';

export interface DashboardRange {
  from: string;
  to: string;
  days: number;
  /** every date of the range, oldest first */
  dates: string[];
}

/**
 * The range a dashboard request asks for (FR-RPT-001). Default is today. `date` alone (the old single-day link) is a range
 * of that one day; `from` alone runs to today; `to` alone is that one day. `from` after `to` is `invalid_range`, a range
 * longer than `maxDays` is `range_too_long` (both 422). Pure: the page uses it too, to draw the filter even when the
 * request is refused.
 */
export function resolveRange(
  q: { date?: string | undefined; from?: string | undefined; to?: string | undefined },
  today: string,
  maxDays: number,
): DashboardRange {
  const to = q.to ?? (q.from ? today : (q.date ?? today));
  const from = q.from ?? q.to ?? q.date ?? today;
  if (from > to) throw new AppError('invalid_range', 422);
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  if (days > maxDays) throw new AppError('range_too_long', 422);
  return { from, to, days, dates: dateRange(from, to) };
}
