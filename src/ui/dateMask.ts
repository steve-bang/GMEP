/** Progressive dd/MM/yyyy mask while typing digits: "3110" -> "31/10", "31102026" -> "31/10/2026". */
export function maskViDate(raw: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim()); // pasted yyyy-MM-dd
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** yyyy-MM-dd -> dd/MM/yyyy for display in browser components (the server uses platform/format/date). */
export function isoToViDisplay(iso: string | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** dd/MM/yyyy -> yyyy-MM-dd, or null when it is not a real calendar date. */
export function viToIsoDisplay(vi: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(vi.trim());
  if (!m) return null;
  const iso = `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null;
}
