import { isoToVi } from '@/platform/format/date';

/** Replaces `{name}` placeholders of a vi.json string (the client components get the plain label map). */
export function fill(template: string | undefined, vars: Record<string, string | number>): string {
  return (template ?? '').replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

/** FR-REC-044 "Trễ N phút", "Trễ 1 giờ 10 phút", "Trễ 2 ngày" (the minutes come from the server clock). */
export function lateText(l: Record<string, string>, minutes: number): string {
  if (minutes < 60) return fill(l.late_min, { n: minutes });
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? fill(l.late_hm, { h, m }) : fill(l.late_h, { h });
  }
  return fill(l.late_d, { d: Math.floor(minutes / 1440) });
}

/** "09/11/2026 14:00": a stored business date and time shown to people (never yyyy-MM-dd). */
export const atText = (date: string, time: string): string => `${isoToVi(date)} ${time}`;

/** minutes since the epoch of a business date and HH:mm (the wall clock of the branch, a plain count) */
export function minutesOf(date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return Math.floor(Date.UTC(y!, m! - 1, d!, hh!, mm!) / 60_000);
}

/** Half-hour slots of the working day (G2-APT-02). */
export const SLOTS = Array.from({ length: 24 }, (_, i) => {
  const m = 7 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
});

/** the digits of a phone number for a `tel:` link */
export const telHref = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, '')}`;
