import type { TimeEvent } from './order';

/**
 * Technician's "Việc của tôi" helpers (G1-DSH-07, FR-REC-013). Pure functions, no I/O.
 * The summary is hours and counts only: no commission or pay figure (labor pay is out of scope, CLAUDE.md).
 */

/** Legal-form words that are dropped when a business name is shortened. */
const LEGAL_FORM =
  /^(công|ty|cty|tnhh|cổ|phần|cp|mtv|dntn|doanh|nghiệp|tư|nhân|hộ|kinh|doanh|hợp|tác|xã)$/i;
const MAX_SHORT = 24;

/**
 * The name shown on a technician's card: no phone, no address, no full legal name.
 * A business keeps its first two words after the legal form ("Công ty TNHH Hòa Phát Auto" -> "Hòa Phát"); a person
 * is shown by the given name, the last word ("Nguyễn Văn An" -> "An").
 * [Cần xác nhận: BA/Khách] the exact shortening rule; the order does not store the customer type.
 */
export function shortCustomerName(full: string): string {
  const words = full.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const isBusiness = LEGAL_FORM.test(words[0]!);
  let picked: string[];
  if (isBusiness) {
    let k = 0;
    while (k < words.length && LEGAL_FORM.test(words[k]!)) k++;
    picked = words.slice(k, k + 2);
    if (picked.length === 0) picked = words.slice(0, 2);
  } else {
    picked = words.length <= 2 ? words : [words[words.length - 1]!];
  }
  const s = picked.join(' ');
  return s.length > MAX_SHORT ? `${s.slice(0, MAX_SHORT - 1)}…` : s;
}

/** Milliseconds worked inside [from, to): closed segments are clipped, an open one counts up to `to`. Undone events are ignored. */
export function workedMsWithin(events: readonly TimeEvent[], from: Date, to: Date): number {
  const lo = from.getTime();
  const hi = to.getTime();
  const clip = (a: number, b: number) => Math.max(0, Math.min(b, hi) - Math.max(a, lo));
  let total = 0;
  let openAt: number | null = null;
  for (const e of events) {
    if (e.undone || e.type === 'undo') continue;
    if (e.type === 'start') openAt = e.at.getTime();
    else if ((e.type === 'pause' || e.type === 'finish') && openAt !== null) {
      total += clip(openAt, e.at.getTime());
      openAt = null;
    }
  }
  if (openAt !== null) total += clip(openAt, hi);
  return total;
}

/** When the item was last finished (the finish not undone), or null. */
export function lastFinishAt(events: readonly TimeEvent[]): Date | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!;
    if (e.type === 'finish' && !e.undone) return e.at;
  }
  return null;
}

export interface DaySummary {
  /** approved (standard) minutes of the items finished inside the day */
  standardDoneMinutes: number;
  /** minutes actually worked inside the day, from the time events */
  workedMinutes: number;
  doneCount: number;
  /** items done today plus items still to do */
  totalCount: number;
}

export interface DayItem {
  status: string;
  approvedMinutes: number;
  events: readonly TimeEvent[];
}

/** "Công hôm nay": `items` are the technician's items touched in the lookback; only today's work is counted. */
export function summariseDay(items: readonly DayItem[], from: Date, to: Date): DaySummary {
  let standard = 0;
  let worked = 0;
  let done = 0;
  let open = 0;
  for (const it of items) {
    worked += workedMsWithin(it.events, from, to);
    if (it.status === 'done') {
      const f = lastFinishAt(it.events);
      if (f && f >= from && f < to) {
        done++;
        standard += it.approvedMinutes;
      }
    } else open++;
  }
  return {
    standardDoneMinutes: standard,
    workedMinutes: Math.round(worked / 60_000),
    doneCount: done,
    totalCount: done + open,
  };
}
