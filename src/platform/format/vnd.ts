/**
 * VND helpers. Money is an integer number of đồng; floats are rejected (RULE-010 / NFR).
 * Output: "1.250.000 ₫" (vi-VN, non-breaking space before the symbol).
 */
const formatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

export function assertVnd(amount: number): asserts amount is number {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError(`VND amount must be a safe integer, got ${amount}`);
  }
}

export function formatVnd(amount: number): string {
  assertVnd(amount);
  return formatter.format(amount);
}

/** Parses user input such as "1.250.000", "1 250 000 ₫", "-500.000". Returns null when not a whole number. */
export function parseVndInput(input: string): number | null {
  const cleaned = input.replace(/[\s ₫đ]/gi, '').replace(/\./g, '');
  if (!/^-?\d+$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isSafeInteger(value) ? value : null;
}
