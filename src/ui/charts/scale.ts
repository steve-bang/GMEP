/**
 * Pure helpers for the dashboard charts (G1-DSH): a "nice" axis and compact VND labels.
 * Integer VND in, labels out; nothing here touches the DOM so it is unit tested.
 */

/** Axis top and step for a maximum value: about four steps of 1, 2, 2.5, 5 or 10 times a power of ten. */
export function niceScale(max: number): { top: number; step: number } {
  if (!(max > 0)) return { top: 4, step: 1 };
  const raw = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const unit = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  const step = unit * mag;
  return { step, top: Math.ceil(max / step - 1e-9) * step };
}

const oneDecimal = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
const grouped = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

/** 458.000.000 -> "458 tr ₫", 1.250.000.000 -> "1,3 tỷ ₫", 820.000 -> "820.000 ₫" (axis and bar labels). */
export function compactVnd(v: number): string {
  const a = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  if (a >= 1_000_000_000) return `${sign}${oneDecimal.format(a / 1_000_000_000)} tỷ ₫`;
  if (a >= 1_000_000) return `${sign}${oneDecimal.format(a / 1_000_000)} tr ₫`;
  return `${sign}${grouped.format(a)} ₫`;
}

/** Percent of the axis (0 to 100, one decimal) a value takes; never negative, never above 100. */
export function pctOfAxis(value: number, top: number): number {
  if (!(top > 0) || !(value > 0)) return 0;
  return Math.min(100, Math.round((value / top) * 1000) / 10);
}
