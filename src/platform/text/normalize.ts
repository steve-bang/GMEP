/**
 * Diacritics-safe search normalisation (ADR 0001 §6.1, plan §2.6, DoD 8).
 * "Đỗ Văn  Ánh" -> "do van anh". Used for plateNorm / nameNorm style columns and queries.
 */
export function normalizeSearch(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
