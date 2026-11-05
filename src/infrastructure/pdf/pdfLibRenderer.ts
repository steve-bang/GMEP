import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type {
  PaperFormat,
  PdfRenderer,
  PrintLabelValue,
  PrintModel,
  PrintTotalRow,
  QuotePrintModel,
  ReceiptPrintModel,
} from '@/platform/print/types';

/**
 * Server-side PDF of a print model (FR-REC-008, ADR 0001 §7.5 amended: pure JS `pdf-lib`, no headless browser, so the
 * Cloud Run image stays light). It reads ONLY the model that the browser sheet also reads. Be Vietnam Pro (SIL OFL) is
 * embedded so every Vietnamese diacritic prints; colours are the design tokens used on the printed sheet
 * (`--color-text-primary`, `--color-text-secondary`, `--color-border-strong`). Pages repeat the title and column
 * heading, and carry a real "Trang i/n".
 */

const MM = 72 / 25.4;
const SIZE: Record<PaperFormat, { w: number; h: number; margin: number }> = {
  A4: { w: 210 * MM, h: 297 * MM, margin: 12 * MM },
  A5: { w: 148 * MM, h: 210 * MM, margin: 10 * MM },
};
const INK = rgb(0x11 / 255, 0x18 / 255, 0x27 / 255);
const MUTED = rgb(0x4b / 255, 0x55 / 255, 0x63 / 255);
const RULE = rgb(0xd1 / 255, 0xd5 / 255, 0xdb / 255);

const FONT_DIR = path.join(process.cwd(), 'src', 'infrastructure', 'pdf', 'fonts');
const fontCache = new Map<string, Promise<Buffer>>();
const loadFont = (dir: string, file: string): Promise<Buffer> => {
  const key = path.join(dir, file);
  let p = fontCache.get(key);
  if (!p) fontCache.set(key, (p = readFile(key)));
  return p;
};

/** NFC so a decomposed "e" + accent maps to the precomposed glyph; no-break space becomes a plain space for drawing. */
const clean = (s: string): string => s.normalize('NFC').replace(/[  ]/g, ' ');

class Sheet {
  page!: PDFPage;
  y = 0;
  readonly pages: PDFPage[] = [];
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly width: number;

  constructor(
    readonly pdf: PDFDocument,
    readonly font: PDFFont,
    readonly bold: PDFFont,
    readonly paper: PaperFormat,
    private readonly onNewPage: (s: Sheet, continued: boolean) => void,
  ) {
    const m = SIZE[paper];
    this.left = m.margin;
    this.right = m.w - m.margin;
    this.top = m.h - m.margin;
    this.bottom = m.margin + 16;
    this.width = this.right - this.left;
  }

  newPage(continued: boolean): void {
    const m = SIZE[this.paper];
    this.page = this.pdf.addPage([m.w, m.h]);
    this.pages.push(this.page);
    this.y = this.top;
    this.onNewPage(this, continued);
  }

  ensure(h: number): void {
    if (this.y - h < this.bottom) this.newPage(true);
  }

  widthOf(t: string, size: number, bold = false): number {
    return (bold ? this.bold : this.font).widthOfTextAtSize(clean(t), size);
  }

  /** word wrap; a single word wider than the box is cut by characters */
  wrap(t: string, size: number, maxW: number, bold = false): string[] {
    const f = bold ? this.bold : this.font;
    const out: string[] = [];
    for (const para of clean(t).split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const cand = line ? `${line} ${word}` : word;
        if (f.widthOfTextAtSize(cand, size) <= maxW) {
          line = cand;
          continue;
        }
        if (line) out.push(line);
        line = '';
        let chunk = '';
        for (const ch of word) {
          if (f.widthOfTextAtSize(chunk + ch, size) > maxW && chunk) {
            out.push(chunk);
            chunk = '';
          }
          chunk += ch;
        }
        line = chunk;
      }
      out.push(line);
    }
    return out;
  }

  text(
    t: string,
    x: number,
    baseline: number,
    o: {
      size: number;
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
      align?: 'left' | 'right' | 'center';
      w?: number;
    },
  ): void {
    const s = clean(t);
    if (!s) return;
    const f = o.bold ? this.bold : this.font;
    const tw = f.widthOfTextAtSize(s, o.size);
    const px = o.align === 'right' ? x - tw : o.align === 'center' ? x + ((o.w ?? 0) - tw) / 2 : x;
    this.page.drawText(s, { x: px, y: baseline, size: o.size, font: f, color: o.color ?? INK });
  }

  rule(
    y: number,
    thickness = 0.6,
    color = INK,
    x1 = this.left,
    x2 = this.right,
    dash = false,
  ): void {
    this.page.drawLine({
      start: { x: x1, y },
      end: { x: x2, y },
      thickness,
      color,
      ...(dash ? { dashArray: [1, 1.5] } : {}),
    });
  }

  /** wrapped paragraph, advances y; returns lines drawn */
  paragraph(
    t: string,
    o: {
      size: number;
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
      x?: number;
      w?: number;
      lead?: number;
    },
  ): void {
    const w = o.w ?? this.width;
    const lead = o.lead ?? o.size * 1.4;
    for (const line of this.wrap(t, o.size, w, o.bold)) {
      this.ensure(lead);
      this.y -= lead;
      this.text(line, o.x ?? this.left, this.y + (lead - o.size) / 2 + o.size * 0.2, {
        size: o.size,
        bold: o.bold,
        color: o.color,
      });
    }
  }
}

function header(s: Sheet, m: PrintModel, continued: boolean): void {
  const brandSize = continued ? 10 : m.paper === 'A4' ? 15 : 13;
  s.y -= brandSize;
  s.text(m.branchName, s.left, s.y, { size: brandSize, bold: true });
  if (m.reprintLabel) {
    const size = 10;
    const tw = s.widthOf(m.reprintLabel, size, true);
    s.page.drawRectangle({
      x: s.right - tw - 12,
      y: s.y - 5,
      width: tw + 12,
      height: size + 9,
      borderColor: INK,
      borderWidth: 1,
    });
    s.text(m.reprintLabel, s.right - tw - 6, s.y, { size, bold: true });
  }
  s.y -= 8;
  s.rule(s.y, 1.5);
  if (continued) {
    s.y -= 12;
    s.text(`${m.title} · ${m.subtitle}`, s.left, s.y, { size: 8.5, color: MUTED });
    s.y -= 8;
    return;
  }
  s.y -= m.paper === 'A4' ? 22 : 18;
  const titleSize = m.paper === 'A4' ? 17 : 15;
  s.text(m.title.toUpperCase(), s.left, s.y, {
    size: titleSize,
    bold: true,
    align: 'center',
    w: s.width,
  });
  s.y -= 15;
  s.text(m.subtitle, s.left, s.y, { size: 9.5, color: MUTED, align: 'center', w: s.width });
  s.y -= 14;
}

function infoGrid(s: Sheet, rows: PrintLabelValue[], cols: 1 | 2): void {
  const size = 9;
  const gap = 18;
  const colW = (s.width - gap * (cols - 1)) / cols;
  const labelW = 62;
  for (let i = 0; i < rows.length; i += cols) {
    const group = rows.slice(i, i + cols);
    const wrapped = group.map((r) => s.wrap(r.value, size, colW - labelW - 4, r.strong));
    const lines = Math.max(...wrapped.map((w) => w.length));
    s.ensure(lines * 13 + 2);
    group.forEach((r, c) => {
      const x = s.left + c * (colW + gap);
      s.text(r.label, x, s.y - 11, { size, bold: true, color: MUTED });
      wrapped[c]!.forEach((ln, k) =>
        s.text(ln, x + labelW, s.y - 11 - k * 13, { size, bold: r.strong }),
      );
    });
    s.y -= lines * 13 + 1;
  }
  s.y -= 6;
}

function totalsBlock(s: Sheet, rows: PrintTotalRow[], blockW: number): void {
  const x1 = s.right - blockW;
  s.ensure(rows.length * 16 + 8);
  s.y -= 4;
  for (const r of rows) {
    const size = r.emphasis ? 11 : 9.5;
    s.y -= r.emphasis ? 18 : 15;
    if (r.emphasis) s.rule(s.y + 13, 0.8, INK, x1, s.right);
    s.text(r.label, x1, s.y, { size, bold: r.emphasis });
    s.text(r.text, s.right, s.y, { size, bold: r.emphasis, align: 'right' });
  }
  s.y -= 4;
}

function signatures(s: Sheet, m: PrintModel, spaceFor: number): void {
  s.ensure(spaceFor + 40);
  s.y -= 18;
  const n = m.signatures.length;
  const colW = s.width / n;
  m.signatures.forEach((g, i) => {
    const x = s.left + i * colW;
    s.text(g.label, x, s.y, { size: 9.5, bold: true, align: 'center', w: colW });
    if (g.hint) s.text(g.hint, x, s.y - 11, { size: 7.5, color: MUTED, align: 'center', w: colW });
  });
  s.y -= spaceFor + 11;
}

function footers(s: Sheet, m: PrintModel): void {
  const total = s.pages.length;
  s.pages.forEach((p, i) => {
    s.page = p;
    const y = SIZE[s.paper].margin - 2;
    s.rule(y + 11, 0.5, RULE);
    s.text(`${m.footer.printedAt} · ${m.footer.printedBy}`, s.left, y, { size: 8, color: MUTED });
    s.text(`Trang ${i + 1}/${total}`, s.right, y, { size: 8, color: MUTED, align: 'right' });
  });
}

function drawQuote(s: Sheet, m: QuotePrintModel): void {
  const qtyW = 44;
  const unitW = 70;
  const amtW = 76;
  const gap = 8;
  const itemW = s.width - qtyW - unitW - amtW - gap * 3;
  const xQty = s.left + itemW + gap + qtyW; // right edges
  const xUnit = xQty + gap + unitW;
  const xAmt = s.right;
  const colHeader = () => {
    s.ensure(22);
    s.y -= 14;
    s.text(m.columns.item, s.left, s.y, { size: 9, bold: true });
    s.text(m.columns.qty, xQty, s.y, { size: 9, bold: true, align: 'right' });
    s.text(m.columns.unit, xUnit, s.y, { size: 9, bold: true, align: 'right' });
    s.text(m.columns.amount, xAmt, s.y, { size: 9, bold: true, align: 'right' });
    s.y -= 5;
    s.rule(s.y, 0.8);
  };
  infoGrid(s, m.info, 2);
  colHeader();
  for (const it of m.items) {
    const head = it.decisionLabel ? `${it.heading} · ${it.decisionLabel}` : it.heading;
    const headLines = s.wrap(head, 9.5, s.width - amtW - gap, true);
    s.ensure(headLines.length * 13 + 16 + (it.decision === 'pending' ? 14 : 0));
    s.y -= 5;
    headLines.forEach((ln, k) => s.text(ln, s.left, s.y - 10 - k * 13, { size: 9.5, bold: true }));
    s.text(it.grossText, xAmt, s.y - 10, { size: 9.5, bold: true, align: 'right' });
    s.y -= headLines.length * 13 + 1;
    if (it.decision === 'pending') {
      // tick boxes for the customer's choice on paper
      let x = s.left;
      for (const label of [m.agreeLabel, m.disagreeLabel]) {
        s.page.drawRectangle({
          x,
          y: s.y - 9,
          width: 8.5,
          height: 8.5,
          borderColor: INK,
          borderWidth: 0.8,
        });
        s.text(label, x + 13, s.y - 8, { size: 9 });
        x += 13 + s.widthOf(label, 9) + 16;
      }
      s.y -= 14;
    }
    s.rule(s.y - 1, 0.8);
    for (const l of it.lines) {
      const nameLines = s.wrap(l.name, 9, itemW);
      const h = nameLines.length * 12 + 4;
      if (s.y - h < s.bottom) {
        s.newPage(true);
        colHeader();
      }
      nameLines.forEach((ln, k) => s.text(ln, s.left, s.y - 11 - k * 12, { size: 9 }));
      s.text(l.qtyText, xQty, s.y - 11, { size: 9, align: 'right' });
      s.text(l.unitText, xUnit, s.y - 11, { size: 9, align: 'right' });
      s.text(l.amountText, xAmt, s.y - 11, { size: 9, align: 'right' });
      s.y -= h;
      s.rule(s.y, 0.4, RULE, s.left, s.right, true);
    }
  }
  totalsBlock(s, m.totals, 226);
  s.y -= 4;
  s.paragraph(m.note, { size: 8.5, color: MUTED });
  if (m.evidence) s.paragraph(m.evidence, { size: 8, color: MUTED });
  signatures(s, m, 52);
}

function drawReceipt(s: Sheet, m: ReceiptPrintModel): void {
  infoGrid(s, m.info, 1);
  s.ensure(30);
  s.y -= 12;
  s.text(m.linesHeading, s.left, s.y, { size: 9, bold: true });
  s.y -= 5;
  s.rule(s.y, 0.8);
  for (const l of m.lines) {
    const label = l.reference ? `${l.method} · ${l.reference}` : l.method;
    const lines = s.wrap(label, 9.5, s.width - 100);
    s.ensure(lines.length * 13 + 5);
    lines.forEach((ln, k) => s.text(ln, s.left, s.y - 12 - k * 13, { size: 9.5 }));
    s.text(l.amountText, s.right, s.y - 12, { size: 9.5, align: 'right' });
    s.y -= lines.length * 13 + 4;
    s.rule(s.y, 0.4, RULE, s.left, s.right, true);
  }
  totalsBlock(s, m.totals, 200);
  s.y -= 4;
  s.paragraph(m.note, { size: 8, color: MUTED });
  signatures(s, m, 40);
}

export class PdfLibRenderer implements PdfRenderer {
  constructor(
    private readonly now: () => Date = () => new Date(),
    private readonly fontDir: string = FONT_DIR,
  ) {}

  async render(model: PrintModel): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const [regular, bold] = await Promise.all([
      loadFont(this.fontDir, 'BeVietnamPro_400Regular.ttf'),
      loadFont(this.fontDir, 'BeVietnamPro_700Bold.ttf'),
    ]);
    const font = await pdf.embedFont(regular, { subset: true });
    const boldFont = await pdf.embedFont(bold, { subset: true });
    const at = this.now();
    pdf.setTitle(`${model.title} ${model.fileName}`);
    pdf.setProducer('GMEP');
    pdf.setCreator('GMEP');
    pdf.setLanguage('vi-VN');
    pdf.setCreationDate(at);
    pdf.setModificationDate(at);

    const sheet = new Sheet(pdf, font, boldFont, model.paper, (s, continued) =>
      header(s, model, continued),
    );
    sheet.newPage(false);
    if (model.kind === 'quote') drawQuote(sheet, model);
    else drawReceipt(sheet, model);
    footers(sheet, model);
    return pdf.save();
  }
}
