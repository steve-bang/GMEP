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
// I12 (BA §16): manufacturer codes often contain "/" ; spaces inside a code stay forbidden (barcode scanning).
export const PART_CODE_PATTERN = /^[A-Z0-9][A-Z0-9._/-]{1,39}$/;

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

/**
 * Initial data of the company-level catalogues of part groups and units of measure (I14, BA §16).
 * These are SEED values only: the live lists are effective-dated `part-group` / `part-unit`
 * configuration (code = scope key) that a stock keeper proposes and the branch owner approves.
 * Nothing in the domain validates against this list.
 */
export const SEED_PART_GROUPS: readonly { code: string; name: string }[] = [
  { code: 'oil', name: 'Dầu nhớt' },
  { code: 'filter', name: 'Lọc' },
  { code: 'brake', name: 'Phanh' },
  { code: 'tire', name: 'Lốp' },
  { code: 'electrical', name: 'Điện' },
  { code: 'suspension', name: 'Treo' },
  { code: 'engine', name: 'Động cơ' },
  { code: 'body', name: 'Thân vỏ' },
  { code: 'consumable', name: 'Vật tư' },
  { code: 'other', name: 'Khác' },
];
export const SEED_PART_UNITS: readonly { code: string; name: string }[] = [
  { code: 'piece', name: 'Cái' },
  { code: 'set', name: 'Bộ' },
  { code: 'pair', name: 'Cặp' },
  { code: 'litre', name: 'Lít' },
  { code: 'kg', name: 'Kg' },
  { code: 'metre', name: 'Mét' },
  { code: 'box', name: 'Hộp' },
];

/** Catalogue codes are scope keys of the config: lower-case slug. */
export const CATALOG_CODE_PATTERN = /^[a-z][a-z0-9-]{0,29}$/;

/** I4: displayed quantity = stored integer / quantityScale (1 = whole units, 1000 = 3 decimals). */
export const QUANTITY_SCALES = [1, 10, 100, 1000] as const;
