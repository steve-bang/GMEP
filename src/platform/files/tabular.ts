import { inflateRawSync } from 'node:zlib';
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

/** zip-bomb guard: a small .xlsx may inflate to gigabytes, so the unpacked size is bounded, not only the file size */
const MAX_ZIP_ENTRIES = 200;
const MAX_PART_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 40 * 1024 * 1024;
const MAX_COLUMNS = 200;

/**
 * Walks the zip central directory and really inflates every part with a hard output cap (the sizes written in the
 * header are not trusted), BEFORE the spreadsheet reader allocates anything. Zip64 and encrypted parts are refused.
 */
export function assertSafeZip(b: Buffer): void {
  const fail = () => new TabularError('too_large', 'unsafe or oversized zip container');
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65_535); i--)
    if (b.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  if (eocd < 0) throw new TabularError('unreadable', 'not a zip file');
  const count = b.readUInt16LE(eocd + 10);
  let off = b.readUInt32LE(eocd + 16);
  if (count === 0xffff || off === 0xffffffff || count > MAX_ZIP_ENTRIES) throw fail();
  let total = 0;
  for (let n = 0; n < count; n++) {
    if (off + 46 > b.length || b.readUInt32LE(off) !== 0x02014b50) throw fail();
    const flags = b.readUInt16LE(off + 8);
    const method = b.readUInt16LE(off + 10);
    const comp = b.readUInt32LE(off + 20);
    const uncomp = b.readUInt32LE(off + 24);
    const nameLen = b.readUInt16LE(off + 28);
    const extraLen = b.readUInt16LE(off + 30);
    const commentLen = b.readUInt16LE(off + 32);
    const local = b.readUInt32LE(off + 42);
    off += 46 + nameLen + extraLen + commentLen;
    if ((flags & 1) !== 0 || comp === 0xffffffff || uncomp === 0xffffffff) throw fail();
    if (uncomp > MAX_PART_BYTES || (total += uncomp) > MAX_TOTAL_BYTES) throw fail();
    if (uncomp === 0) continue;
    if (local + 30 > b.length || b.readUInt32LE(local) !== 0x04034b50) throw fail();
    const start = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
    const data = b.subarray(start, start + comp);
    if (method === 0) {
      if (comp > MAX_PART_BYTES) throw fail();
    } else if (method === 8) {
      try {
        // throws when the real output exceeds the cap, whatever the header claims
        inflateRawSync(data, { maxOutputLength: Math.min(uncomp, MAX_PART_BYTES) + 1 });
      } catch {
        throw fail();
      }
    } else throw fail();
  }
}

/** Parses the first sheet (xlsx) or the whole text (csv, comma or semicolon). Empty trailing rows are dropped. */
export async function parseTabular(bytes: Buffer, limits: TabularLimits): Promise<Grid> {
  if (bytes.length === 0) throw new TabularError('empty', 'empty file');
  if (bytes.length > limits.maxBytes) throw new TabularError('too_large', 'file too large');
  let rows: unknown[][];
  try {
    if (isXlsx(bytes)) {
      assertSafeZip(bytes);
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
        // stop reading as soon as the limit is passed (header + maxRows + one more to detect an overflow)
        to: limits.maxRows + 2,
      }) as string[][];
    }
  } catch (e) {
    if (e instanceof TabularError) throw e;
    throw new TabularError('unreadable', 'cannot read file');
  }
  if (rows.length - 1 > limits.maxRows) throw new TabularError('too_many_rows', 'too many rows');
  if (rows.some((r) => r.length > MAX_COLUMNS))
    throw new TabularError('unreadable', 'too many columns');
  const grid = rows.map((r) => r.map(cellText));
  while (grid.length > 0 && grid[grid.length - 1]!.every((c) => c === '')) grid.pop();
  if (grid.length === 0) throw new TabularError('empty', 'empty file');
  if (grid.length - 1 > limits.maxRows) throw new TabularError('too_many_rows', 'too many rows');
  return grid;
}
