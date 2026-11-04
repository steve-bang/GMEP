import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseTabular, TabularError } from '@/platform/files/tabular';
import {
  autoMap,
  canTransition,
  chunk,
  extractRows,
  missingRequired,
  sanitizeMapping,
  templateCsv,
  type ImportColumn,
  type ImportStatus,
} from '@/modules/sys';

const cols: ImportColumn[] = [
  { field: 'name', label: 'Tên khách hàng', aliases: ['Họ tên'], required: true, example: 'A' },
  { field: 'phone', label: 'Số điện thoại', aliases: ['SĐT'], required: false, example: '0901' },
];
const limits = { maxBytes: 1_000_000, maxRows: 100 };

describe('FR-SYS-007 column mapping', () => {
  it('guesses the mapping from headers ignoring accents, case and punctuation', () => {
    expect(autoMap(['STT', 'HỌ TÊN', 'sđt.'], cols)).toEqual({ name: 1, phone: 2 });
    expect(autoMap(['ten khach hang'], cols)).toEqual({ name: 0, phone: null });
  });
  it('reports missing required columns and extracts rows with their spreadsheet number', () => {
    const m = autoMap(['Số điện thoại'], cols);
    expect(missingRequired(m, cols).map((c) => c.field)).toEqual(['name']);
    const grid = [
      ['Tên', 'SĐT'],
      ['An', '09'],
      ['', ''],
      ['Bình', '08'],
    ];
    const rows = extractRows(grid, { name: 0, phone: 1 }, cols);
    expect(rows).toEqual([
      { row: 2, cells: { name: 'An', phone: '09' } },
      { row: 4, cells: { name: 'Bình', phone: '08' } },
    ]);
  });
  it('a client mapping is untrusted: unknown, out-of-range and repeated columns are dropped', () => {
    expect(sanitizeMapping({ name: 9, phone: 0, evil: 1 }, cols, 2)).toEqual({
      name: null,
      phone: 0,
    });
    expect(sanitizeMapping({ name: 0, phone: 0 }, cols, 2)).toEqual({ name: 0, phone: null });
    expect(sanitizeMapping('x', cols, 2)).toEqual({ name: null, phone: null });
  });
  it('template is CSV with BOM, header and example, quoting commas', () => {
    const t = templateCsv([{ ...cols[0]!, example: 'A, B' }]);
    expect(t.startsWith('﻿Tên khách hàng')).toBe(true);
    expect(t).toContain('"A, B"');
  });
  it('chunks lists', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});

describe('FR-SYS-007 batch state machine', () => {
  const allow: [ImportStatus, ImportStatus][] = [
    ['validated', 'committing'],
    ['validated', 'discarded'],
    ['committing', 'committed'],
    ['committing', 'failed'],
    ['failed', 'committing'],
    ['failed', 'undone'],
    ['committed', 'undone'],
  ];
  it('allows only the documented transitions', () => {
    for (const [a, b] of allow) expect(canTransition(a, b)).toBe(true);
    const all: ImportStatus[] = [
      'validated',
      'rejected',
      'discarded',
      'committing',
      'committed',
      'failed',
      'undone',
    ];
    const count = all.flatMap((a) => all.map((b) => canTransition(a, b))).filter(Boolean).length;
    expect(count).toBe(allow.length);
    expect(canTransition('rejected', 'committing')).toBe(false);
    expect(canTransition('undone', 'committed')).toBe(false);
    expect(canTransition('committing', 'undone')).toBe(false);
  });
});

describe('FR-SYS-007 file reading', () => {
  it('reads csv with BOM and semicolons, Vietnamese text intact', async () => {
    const g = await parseTabular(Buffer.from('﻿Tên;SĐT\r\nNguyễn Văn Á;0901\r\n'), limits);
    expect(g).toEqual([
      ['Tên', 'SĐT'],
      ['Nguyễn Văn Á', '0901'],
    ]);
  });
  it('reads xlsx by content: numbers lose no digits, blank trailing rows are dropped', async () => {
    const g = await parseTabular(readFileSync('tests/fixtures/import/customers.xlsx'), limits);
    expect(g[0]![2]).toBe('Họ tên');
    expect(g[1]![3]).toBe('912345678');
    expect(g).toHaveLength(4);
  });
  it('refuses empty, oversized, too long and unreadable files', async () => {
    const code = async (b: Buffer, l = limits) =>
      parseTabular(b, l).catch((e: unknown) => (e as TabularError).code);
    expect(await code(Buffer.alloc(0))).toBe('empty');
    expect(await code(Buffer.from('a,b\n'), { ...limits, maxBytes: 2 })).toBe('too_large');
    expect(await code(Buffer.from('a\n1\n2\n3\n'), { ...limits, maxRows: 2 })).toBe(
      'too_many_rows',
    );
    expect(await code(Buffer.from('PK\u0003\u0004garbage'))).toBe('unreadable');
  });
  it('does not evaluate formulas: a leading = stays text', async () => {
    const g = await parseTabular(Buffer.from('a\r\n=1+1\r\n'), limits);
    expect(g[1]![0]).toBe('=1+1');
  });
});
