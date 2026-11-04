import { crc32, deflateRawSync } from 'node:zlib';

/**
 * Minimal .xlsx writer (one sheet, no styles beyond a bold header): a hand-built OOXML package inside a zip made with
 * node:zlib, so no extra dependency is added to the server bundle (FR-RPT-009, NFR-EXP-01). Pure; no I/O.
 *
 * Safety: every text cell is written as an inline string (never a formula) and, on top of that, text that starts with a
 * formula marker gets a leading apostrophe like the CSV export (`= + - @ TAB CR`), so a copy to another tool stays
 * inert. Whole numbers are written as numeric cells (VND is integer money); other values are text.
 */
export type XlsxCell = string | number | null;

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/** characters not allowed in XML 1.0 are dropped; the five markup characters are escaped */
const esc = (s: string): string =>
  s
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** neutralise spreadsheet formula injection (NFR-SEC-02), same rule as csvCell */
export const safeText = (v: string): string => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);

/** column letters of a zero-based index: 0 -> A, 26 -> AA */
export function columnName(i: number): string {
  let n = i + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function sheetXml(rows: readonly (readonly XlsxCell[])[], headerRow: number | null): string {
  const lines = rows.map((row, r) => {
    const cells = row.flatMap((v, c) => {
      if (v === null || v === '') return [];
      const ref = `${columnName(c)}${r + 1}`;
      const style = r === headerRow ? ' s="1"' : '';
      if (typeof v === 'number' && Number.isFinite(v))
        return [`<c r="${ref}"${style}><v>${Math.trunc(v)}</v></c>`];
      return [
        `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${esc(safeText(String(v)))}</t></is></c>`,
      ];
    });
    return `<row r="${r + 1}">${cells.join('')}</row>`;
  });
  return (
    `${XML_HEAD}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${lines.join('')}</sheetData></worksheet>`
  );
}

const STYLES =
  `${XML_HEAD}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
  '</styleSheet>';

/** Excel limits a sheet name to 31 characters and forbids : \ / ? * [ ] */
const sheetName = (s: string): string => s.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Sheet1';

/** zip with deflate; fixed timestamp so the same input gives the same bytes */
function zip(files: readonly { name: string; data: Buffer }[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  const DOS_TIME = 0;
  const DOS_DATE = (46 << 9) | (1 << 5) | 1; // 2026-01-01
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8');
    const comp = deflateRawSync(f.data);
    const crc = crc32(f.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    parts.push(local, name, comp);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(8, 10);
    c.writeUInt16LE(DOS_TIME, 12);
    c.writeUInt16LE(DOS_DATE, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(comp.length, 20);
    c.writeUInt32LE(f.data.length, 24);
    c.writeUInt16LE(name.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, name);
    offset += local.length + name.length + comp.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

/**
 * One-sheet workbook. `headerRow` is the zero-based row printed in bold (the table header), or null.
 * `rows` is a rectangular-or-ragged list of cells; empty cells are left out of the file.
 */
export function buildXlsx(
  name: string,
  rows: readonly (readonly XlsxCell[])[],
  headerRow: number | null = null,
): Buffer {
  const utf8 = (s: string) => Buffer.from(s, 'utf8');
  return zip([
    {
      name: '[Content_Types].xml',
      data: utf8(
        `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
          '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
          '</Types>',
      ),
    },
    {
      name: '_rels/.rels',
      data: utf8(
        `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
          '</Relationships>',
      ),
    },
    {
      name: 'xl/workbook.xml',
      data: utf8(
        `${XML_HEAD}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
          `<sheets><sheet name="${esc(sheetName(name))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      ),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: utf8(
        `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
          '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
          '</Relationships>',
      ),
    },
    { name: 'xl/styles.xml', data: utf8(STYLES) },
    { name: 'xl/worksheets/sheet1.xml', data: utf8(sheetXml(rows, headerRow)) },
  ]);
}

export const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
