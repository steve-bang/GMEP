/**
 * Splits the tax of a set of items so that the tax-inclusive item prices add up to EXACTLY the
 * total payable (R1, ba-answers-for-dev §17: the "remainder" function for the customer page).
 * Browser safe and pure: integers only (BigInt for the proportional share, no floats).
 *
 * Tax is computed ONCE per rate on the net sum of the items (round half up to a whole VND), then
 * shared out across the items by the largest-remainder method; ties go to the lower item index.
 * [Cần xác nhận: Kế toán khách] (rounding rule, NFR-MNT-01).
 */
export interface TaxableItem {
  no: number;
  lines: readonly { amountVnd: number; taxRateBp: number }[];
}

export interface ItemGross {
  no: number;
  /** sum of the item's lines, before tax */
  netVnd: number;
  /** the item's share of the tax */
  taxVnd: number;
  /** net + share of tax */
  grossVnd: number;
}

export interface GrossSplit {
  items: ItemGross[];
  netVnd: number;
  taxVnd: number;
  totalVnd: number;
}

const halfUpDiv = (n: number, d: number): number => Math.floor((2 * n + d) / (2 * d));

export function splitTaxByItems(items: readonly TaxableItem[]): GrossSplit {
  const rows = items.map((i) => ({
    no: i.no,
    net: i.lines.reduce((s, l) => s + l.amountVnd, 0),
    byRate: new Map<number, number>(),
    tax: 0,
  }));
  items.forEach((item, idx) => {
    for (const l of item.lines)
      rows[idx]!.byRate.set(l.taxRateBp, (rows[idx]!.byRate.get(l.taxRateBp) ?? 0) + l.amountVnd);
  });
  const rates = [...new Set(rows.flatMap((r) => [...r.byRate.keys()]))].sort((a, b) => a - b);
  for (const bp of rates) {
    const nets = rows.map((r) => r.byRate.get(bp) ?? 0);
    const total = nets.reduce((s, n) => s + n, 0);
    if (total === 0) continue;
    const tax = halfUpDiv(total * bp, 10_000);
    const T = BigInt(tax);
    const N = BigInt(total);
    const parts = nets.map((n, idx) => {
      const num = T * BigInt(n);
      return { idx, floor: Number(num / N), rem: num % N };
    });
    let left = tax - parts.reduce((s, p) => s + p.floor, 0);
    const order = [...parts].sort((a, b) =>
      a.rem === b.rem ? a.idx - b.idx : a.rem > b.rem ? -1 : 1,
    );
    for (const p of order) {
      if (left <= 0) break;
      p.floor += 1;
      left -= 1;
    }
    for (const p of parts) rows[p.idx]!.tax += p.floor;
  }
  const out: ItemGross[] = rows.map((r) => ({
    no: r.no,
    netVnd: r.net,
    taxVnd: r.tax,
    grossVnd: r.net + r.tax,
  }));
  const netVnd = out.reduce((s, i) => s + i.netVnd, 0);
  const taxVnd = out.reduce((s, i) => s + i.taxVnd, 0);
  return { items: out, netVnd, taxVnd, totalVnd: netVnd + taxVnd };
}
