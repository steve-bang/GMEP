/** Progressive dd/MM/yyyy mask while typing digits: "3110" -> "31/10", "31102026" -> "31/10/2026". */
export function maskViDate(raw: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim()); // pasted yyyy-MM-dd
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
