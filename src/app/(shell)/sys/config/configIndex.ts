/** Client-safe: no value imports from the server modules (the list component runs in the browser). */
type ConfigGroup = string;

/** Lower-case, no Vietnamese diacritics (d with stroke included): "Thuế" -> "thue", "Đơn giá" -> "don gia". */
export function foldVi(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export interface IndexCard {
  type: string;
  group: ConfigGroup;
  title: string;
  lead: string;
  href: string;
  pending: number;
  upcoming: boolean;
}

export interface IndexGroup<T> {
  group: ConfigGroup;
  cards: T[];
}

/** Cards by menu group, in the given group order; a group with no card is dropped. */
export function groupCards<T extends { group: ConfigGroup }>(
  cards: readonly T[],
  order: readonly ConfigGroup[],
): IndexGroup<T>[] {
  return order
    .map((group) => ({ group, cards: cards.filter((c) => c.group === group) }))
    .filter((g) => g.cards.length > 0);
}

/** Search on title and lead, diacritics and case ignored; every word of the query must match. */
export function filterCards<T extends { title: string; lead: string }>(
  cards: readonly T[],
  query: string,
): T[] {
  const words = foldVi(query).split(' ').filter(Boolean);
  if (words.length === 0) return [...cards];
  return cards.filter((c) => {
    const hay = foldVi(`${c.title} ${c.lead}`);
    return words.every((w) => hay.includes(w));
  });
}
