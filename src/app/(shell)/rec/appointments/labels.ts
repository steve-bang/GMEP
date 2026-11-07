import { messages } from '@/platform/i18n/messages';

/** The `rec.appointments` strings as a plain map for the client components (the strings are the vi.json resources). */
export const aptLabels = (): Record<string, string> =>
  (messages as unknown as { rec: { appointments: Record<string, string> } }).rec.appointments;

/** Friendly Vietnamese text of an RFC 9457 problem: a known code first, then the field message, then the detail. */
export function problemText(
  l: Record<string, string>,
  p: { code?: string; detail?: string; errors?: { message: string }[] } | null,
  fallback: string,
): string {
  if (p?.code && l[`e_${p.code}`]) return l[`e_${p.code}`]!;
  return p?.errors?.[0]?.message ?? p?.detail ?? fallback;
}
