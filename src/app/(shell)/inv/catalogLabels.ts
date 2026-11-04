import type { CatalogEntry } from '@/modules/inv';

/** I14: label of a catalogue code (the catalogue is company configuration; an unknown code shows as is). */
export const catalogName = (entries: readonly CatalogEntry[], code: string): string =>
  entries.find((e) => e.code === code)?.name ?? code;

/** Options for a select: active entries, plus the part's current value even if deactivated since. */
export const catalogOptions = (
  entries: readonly CatalogEntry[],
  current?: string,
): { value: string; label: string }[] =>
  entries
    .filter((e) => e.active || e.code === current)
    .map((e) => ({ value: e.code, label: e.name }));
