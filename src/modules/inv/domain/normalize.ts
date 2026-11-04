/**
 * INV identity normalisation (FR-INV-001, 002). The same functions write the search/uniqueness
 * columns and read them, so lookups and duplicate checks agree.
 */

/** Part code as stored and searched: upper-case, diacritics and spaces removed (04152 YZZA1 -> 04152YZZA1). */
export function normalizePartCode(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toUpperCase()
    .replace(/\s+/g, '');
}

/**
 * Uniqueness key (FR-INV-002): letters and digits only, so "04152-YZZA1", "04152YZZA1" and
 * "04152 yzza1" are the same part and creating the second is blocked with a suggestion.
 */
export const partCodeKey = (raw: string): string =>
  normalizePartCode(raw).replace(/[^A-Z0-9]/g, '');

/** Allowed shape after normalisation; also the shape accepted in a `price-item` config scope key. */
export const PART_CODE_PATTERN = /^[A-Z0-9][A-Z0-9._-]{1,39}$/;

/** Barcode (EAN-8/13, UPC, Code128 text): digits and letters only, 4-32 characters. */
export const normalizeBarcode = (raw: string): string => raw.replace(/\s+/g, '').toUpperCase();
export const isValidBarcode = (v: string): boolean => /^[A-Z0-9]{4,32}$/.test(v);

/** Compatible vehicle line key: "Toyota Vios" -> "toyota vios" (diacritics-free, single spaces). */
export function compatKey(make: string, model: string): string {
  return `${make} ${model}`
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Part groups offered in the catalogue (G3-INV-01 filter). Catalogue data, not a legal rule. */
export const PART_GROUPS = [
  'oil',
  'filter',
  'brake',
  'tire',
  'electrical',
  'suspension',
  'engine',
  'body',
  'consumable',
  'other',
] as const;
export type PartGroup = (typeof PART_GROUPS)[number];

/** Units of measure offered for parts. Quantities are whole numbers (see open-questions I2). */
export const PART_UNITS = ['piece', 'set', 'pair', 'litre', 'kg', 'metre', 'box'] as const;
export type PartUnit = (typeof PART_UNITS)[number];
