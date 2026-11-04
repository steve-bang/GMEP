import { parse as parseCsv } from 'csv-parse/sync';
import { readSheet } from 'read-excel-file/node';

/**
 * Reads an uploaded .xlsx or .csv into a grid of trimmed strings (FR-SYS-007). Pure parsing, no business
 * meaning: the import engine maps columns. Spreadsheet formulas are never evaluated and cells that start with
 * a formula marker stay plain text. The file type is decided from the CONTENT (zip signature = xlsx), not from
 * the name the browser sent.
 */
export type Grid = string[][];

export class TabularError extends Error {
  constructor(
    readonly code: 'empty' | 'unreadable' | 'too_large' | 'too_many_rows',
    message: string,
  ) {
    super(message);
    this.name = 'TabularError';
  }
}

export interface TabularLimits {
  maxBytes: number;
  maxRows: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** One cell as the text a person would type: dates as dd/MM/yyyy, numbers without exponent. */
export function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date)
    return `${pad(v.getUTCDate())}/${pad(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '';
    return Number.isInteger(v) ? v.toFixed(0) : String(v);
  }
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v).trim();
}

const isXlsx = (b: Buffer) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b; // "PK" zip container

/** Parses the first sheet (xlsx) or the whole text (csv, comma or semicolon). Empty trailing rows are dropped. */
export async function parseTabular(bytes: Buffer, limits: TabularLimits): Promise<Grid> {
  if (bytes.length === 0) throw new TabularError('empty', 'empty file');
  if (bytes.length > limits.maxBytes) throw new TabularError('too_large', 'file too large');
  let rows: unknown[][];
  try {
    if (isXlsx(bytes)) {
      rows = (await readSheet(bytes)) as unknown[][];
    } else {
      let text = bytes.toString('utf8');
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
      const delimiter = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';
      rows = parseCsv(text, {
        delimiter,
        relax_column_count: true,
        skip_empty_lines: true,
        bom: true,
      }) as string[][];
    }
  } catch {
    throw new TabularError('unreadable', 'cannot read file');
  }
  const grid = rows.map((r) => r.map(cellText));
  while (grid.length > 0 && grid[grid.length - 1]!.every((c) => c === '')) grid.pop();
  if (grid.length === 0) throw new TabularError('empty', 'empty file');
  if (grid.length - 1 > limits.maxRows) throw new TabularError('too_many_rows', 'too many rows');
  return grid;
}
