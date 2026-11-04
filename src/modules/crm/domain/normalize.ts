/**
 * CRM identity normalisation (FR-CRM-001/002). Pure functions: the same normalisation is used when
 * writing the search columns (`plateNorm`, `phoneNorm`) and when reading, so lookups are exact.
 */

/** Plate as stored for uniqueness and search: upper-case letters and digits only (51H-123.45 -> 51H12345). */
export function normalizePlate(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Lenient on purpose: Vietnamese plates come in many shapes (cars, motorbikes, trailers, army, temporary).
 * [Cần xác nhận: Khách] if the client wants a stricter format per vehicle type.
 */
export const isPlausiblePlate = (norm: string): boolean =>
  /^[0-9A-Z]{5,12}$/.test(norm) && /\d/.test(norm) && /[A-Z]/.test(norm);

/** Digits only, +84 / 84 prefix turned into 0: "+84 912 345 678" -> "0912345678". */
export function normalizePhone(raw: string): string {
  const d = raw.replace(/[^\d+]/g, '');
  if (d.startsWith('+84')) return `0${d.slice(3).replace(/\D/g, '')}`;
  const digits = d.replace(/\D/g, '');
  return digits.startsWith('84') && digits.length >= 11 ? `0${digits.slice(2)}` : digits;
}

/** Vietnamese mobile/landline written with the leading 0 (10 digits; 11 for some legacy lines). */
export const isPlausiblePhone = (norm: string): boolean => /^0\d{9,10}$/.test(norm);

/** Tax code (MST): 10 digits, optionally followed by -NNN for a dependent unit. */
export function normalizeTaxCode(raw: string): string {
  return raw.replace(/\s+/g, '');
}
export const isValidTaxCode = (v: string): boolean => /^\d{10}(-\d{3})?$/.test(v);

/** VIN: 17 characters, no I, O, Q. */
export const normalizeVin = (raw: string): string => raw.replace(/\s+/g, '').toUpperCase();
export const isValidVin = (v: string): boolean => /^[A-HJ-NPR-Z0-9]{17}$/.test(v);

/** Marks all but the last four characters (VIN and engine number are shown partly masked in projections, BA §10.2 P2). */
export function maskIdentifier(v: string): string {
  return v.length <= 4 ? '••••' : `${'•'.repeat(v.length - 4)}${v.slice(-4)}`;
}

/** yyyy-MM-dd arithmetic in UTC (no timezone drift for pure calendar dates). */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
