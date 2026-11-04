import { normalizeSearch } from '@/platform/text/normalize';

/**
 * FR-SYS-007 data import (pure rules): importable kinds, column mapping, batch state machine.
 * What a column means for a kind (CRM, INV) is described by the owning module's handler; this file only knows
 * generic mechanics so SYS never imports CRM or INV.
 */
export const IMPORT_KINDS = ['customers-vehicles', 'parts', 'opening-stock'] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

export interface ImportColumn {
  /** stable field key used in the mapping and in the handler */
  field: string;
  /** Vietnamese header of the template */
  label: string;
  /** other headers a client file is likely to use (matched without accents or case) */
  aliases: readonly string[];
  required: boolean;
  example: string;
}

export interface RowIssue {
  /** spreadsheet row number (header = row 1); 0 = the file as a whole */
  row: number;
  field?: string;
  message: string;
}

/**
 * A batch is its own object with its own states: validated -> committing -> committed | failed; a failed run can be
 * resumed (committing again) or undone; committed -> undone. `rejected` (the file had errors, nothing was stored but
 * the report) and `discarded` (replaced by a re-run with another mapping) are final.
 */
export type ImportStatus =
  'validated' | 'rejected' | 'discarded' | 'committing' | 'committed' | 'failed' | 'undone';

export const IMPORT_TRANSITIONS: Record<ImportStatus, readonly ImportStatus[]> = {
  validated: ['committing', 'discarded'],
  rejected: [],
  discarded: [],
  committing: ['committed', 'failed'],
  committed: ['undone'],
  failed: ['committing', 'undone'],
  undone: [],
};

export function canTransition(from: ImportStatus, to: ImportStatus): boolean {
  return IMPORT_TRANSITIONS[from].includes(to);
}

/** A file whose content is still held by an active batch blocks a second upload of the same bytes. */
export const ACTIVE_STATUSES: readonly ImportStatus[] = [
  'validated',
  'committing',
  'committed',
  'failed',
];

export type ColumnMapping = Record<string, number | null>;

const key = (s: string) => normalizeSearch(s).replace(/[^a-z0-9]/g, '');

/** Guesses the mapping from the header row: label, field key or any alias, ignoring accents, case and punctuation. */
export function autoMap(
  headers: readonly string[],
  columns: readonly ImportColumn[],
): ColumnMapping {
  const keys = headers.map(key);
  const used = new Set<number>();
  const mapping: ColumnMapping = {};
  for (const c of columns) {
    const wanted = [c.label, c.field, ...c.aliases].map(key);
    const i = keys.findIndex((k, idx) => !used.has(idx) && k !== '' && wanted.includes(k));
    mapping[c.field] = i >= 0 ? i : null;
    if (i >= 0) used.add(i);
  }
  return mapping;
}

/** Keeps only valid column indexes of known fields (a client-supplied mapping is untrusted). */
export function sanitizeMapping(
  raw: unknown,
  columns: readonly ImportColumn[],
  width: number,
): ColumnMapping {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: ColumnMapping = {};
  const used = new Set<number>();
  for (const c of columns) {
    const v = src[c.field];
    const ok = typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < width && !used.has(v);
    out[c.field] = ok ? v : null;
    if (ok) used.add(v);
  }
  return out;
}

export function missingRequired(
  mapping: ColumnMapping,
  columns: readonly ImportColumn[],
): ImportColumn[] {
  return columns.filter((c) => c.required && mapping[c.field] === null);
}

export interface RawRow {
  /** spreadsheet row number */
  row: number;
  cells: Record<string, string>;
}

/** Data rows (everything under the header) as field -> text; completely blank rows are skipped. */
export function extractRows(
  grid: readonly (readonly string[])[],
  mapping: ColumnMapping,
  columns: readonly ImportColumn[],
): RawRow[] {
  const out: RawRow[] = [];
  grid.slice(1).forEach((r, i) => {
    if (r.every((c) => c === '')) return;
    const cells: Record<string, string> = {};
    for (const c of columns) {
      const idx = mapping[c.field];
      cells[c.field] = idx === null || idx === undefined ? '' : (r[idx] ?? '');
    }
    out.push({ row: i + 2, cells });
  });
  return out;
}

/** Template as CSV text (header + one example row), UTF-8 with BOM so Excel shows the accents. */
export function templateCsv(columns: readonly ImportColumn[]): string {
  const q = (s: string) => (/[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return `﻿${columns.map((c) => q(c.label)).join(',')}\r\n${columns.map((c) => q(c.example)).join(',')}\r\n`;
}

/** Chunks a list (commit runs in bounded transactions). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
