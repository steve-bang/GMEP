/**
 * Rates are stored as integer basis points (8% = 800, 8,5% = 850): never floats (NFR-MNT-01).
 * `formatBp(1000)` -> "10%", `formatBp(850)` -> "8,5%"; `parsePercentToBp("8,5")` -> 850.
 */
export function formatBp(bp: number): string {
  if (!Number.isSafeInteger(bp) || bp < 0)
    throw new RangeError(`basis points must be a non-negative integer, got ${bp}`);
  const whole = Math.floor(bp / 100);
  const frac = String(bp % 100)
    .padStart(2, '0')
    .replace(/0$/, '');
  return `${whole}${frac && frac !== '0' ? `,${frac}` : ''}%`;
}

/** "10", "8,5", "8.25" -> basis points; null for anything else (more than 2 decimals, text, negative). */
export function parsePercentToBp(input: string): number | null {
  const m = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(input.trim().replace('%', '').trim());
  if (!m) return null;
  const bp = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || '0');
  return bp <= 10_000 ? bp : null;
}
