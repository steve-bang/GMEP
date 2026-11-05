import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { PdfLibRenderer } from '@/infrastructure/pdf/pdfLibRenderer';
import { buildQuotePrintModel, isReprint, type QuoteDetailDto } from '@/modules/rec';
import { buildReceiptPrintModel } from '@/modules/acc';
import type { PaymentDto } from '@/modules/acc/application/payments';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const NBSP = / /g;
const plain = (s: string) => s.replace(NBSP, ' ');

const line = (lineNo: number, kind: 'labor' | 'part', name: string, amountVnd: number): Any => ({
  lineNo,
  kind,
  name,
  minutes: kind === 'labor' ? 90 : null,
  qty: kind === 'part' ? 2 : null,
  unitVnd: kind === 'part' ? amountVnd / 2 : amountVnd,
  amountVnd,
  taxRateBp: 800,
});

/** Sample VAT 8% is NOT accountant sign-off (NFR-MNT-01): the numbers only exercise the arithmetic. */
function quote(over: { approval?: Any; items?: Any[] } = {}): QuoteDetailDto {
  const items = over.items ?? [
    {
      no: 1,
      name: 'Thay má phanh trước',
      necessity: 'required',
      lines: [line(1, 'labor', 'Công thay má phanh', 300_000)],
    },
    {
      no: 2,
      name: 'Lọc dầu',
      necessity: 'optional',
      lines: [line(2, 'part', 'Lọc dầu động cơ', 100_000)],
    },
  ];
  return {
    id: 'qt_1',
    number: 'BG-Q7-2611-00001',
    plate: '51H-123.45',
    vehicleLabel: 'Toyota Vios 2019',
    customerName: 'Nguyễn Văn An',
    branchName: 'Garage Tuấn Phát · Quận 7',
    shown: {
      n: 2,
      status: over.approval ? 'approved_partial' : 'sent',
      items,
      tax: { name: 'VAT', rateBp: 800 },
      sentAt: '2026-11-05T02:00:00.000Z',
      validUntil: '2026-11-12',
      pricedOn: '2026-11-05',
      approval: over.approval ?? null,
    },
  } as Any;
}

const ctx = (priorPrints = 0) => ({
  printedAt: new Date('2026-11-05T03:30:00.000Z'),
  printedByName: 'Trần Cố Vấn',
  priorPrints,
});

describe('quote print model (FR-REC-008)', () => {
  it('FR-REC-008: item prices include their tax share and add up to the total (R1); tax and net are integers', () => {
    const m = buildQuotePrintModel(quote(), ctx());
    expect(m.amounts).toEqual({
      totalVnd: 432_000,
      taxVnd: 32_000,
      netVnd: 400_000,
      approvedTotalVnd: null,
    });
    expect(m.items.map((i) => plain(i.grossText))).toEqual(['324.000 ₫', '108.000 ₫']);
    expect(plain(m.totals[0]!.text)).toBe('432.000 ₫');
    expect(m.totals[0]!.emphasis).toBe(true);
    expect(m.totals.map((t) => t.label)).toEqual([
      'Tổng cộng (đã gồm thuế)',
      'VAT 8%',
      'Chưa thuế',
    ]);
    expect(Number.isInteger(m.amounts.taxVnd)).toBe(true);
  });

  it('FR-REC-008: lines carry hours for labor, quantity for parts, and the snapshot unit price', () => {
    const m = buildQuotePrintModel(quote(), ctx());
    expect(m.items[0]!.lines[0]).toMatchObject({ qtyText: '1,5' });
    expect(m.items[1]!.lines[0]).toMatchObject({ qtyText: '2' });
    expect(plain(m.items[1]!.lines[0]!.unitText)).toBe('50.000 ₫');
  });

  it('FR-REC-009: a partial approval marks each item and prints the approved total and the evidence prefix', () => {
    const m = buildQuotePrintModel(
      quote({
        approval: {
          approvedItemNos: [1],
          approvedTotalVnd: 324_000,
          hash: 'abcdef0123456789abcdef',
        },
      }),
      ctx(),
    );
    expect(m.items.map((i) => i.decision)).toEqual(['approved', 'declined']);
    expect(m.items.map((i) => i.decisionLabel)).toEqual(['Được duyệt', 'Không duyệt']);
    expect(m.amounts.approvedTotalVnd).toBe(324_000);
    expect(plain(m.totals.at(-1)!.text)).toBe('324.000 ₫');
    expect(m.evidence).toContain('abcdef0123456789…');
  });

  it('FR-REC-008: an undecided quote leaves tick boxes (pending) and no decision text', () => {
    const m = buildQuotePrintModel(quote(), ctx());
    expect(m.items.every((i) => i.decision === 'pending' && i.decisionLabel === '')).toBe(true);
    expect(m.evidence).toBeNull();
  });

  it('BA R28: the first printout is the original, the second and later carry BẢN IN LẠI', () => {
    expect(isReprint(0)).toBe(false);
    expect(isReprint(1)).toBe(true);
    expect(buildQuotePrintModel(quote(), ctx(0)).reprintLabel).toBeNull();
    expect(buildQuotePrintModel(quote(), ctx(1)).reprintLabel).toBe('BẢN IN LẠI');
    expect(buildQuotePrintModel(quote(), ctx(5)).reprintLabel).toBe('BẢN IN LẠI');
  });

  it('PDPL: header and footer show branch, number, version, printer and time; no contact data exists in the model', () => {
    const m = buildQuotePrintModel(quote(), ctx());
    expect(m.subtitle).toBe('Số BG-Q7-2611-00001-v2 · Ngày 05/11/2026 · Hiệu lực đến 12/11/2026');
    expect(m.footer).toEqual({ printedAt: 'In lúc 05/11/2026 10:30', printedBy: 'Trần Cố Vấn' });
    expect(m.fileName).toBe('BG-Q7-2611-00001-v2');
    expect(JSON.stringify(m)).not.toMatch(/phone|address|0900/i);
  });
});

const payment = (over: Partial<PaymentDto> = {}): PaymentDto =>
  ({
    id: 'pay_1',
    number: 'PT-Q7-2611-00001',
    kind: 'receipt',
    customerName: 'Nguyễn Văn An',
    orderNumber: 'RO-Q7-2611-00001',
    lines: [
      { method: 'cash', amountVnd: 200_000 },
      { method: 'transfer', amountVnd: 232_000, reference: 'FT2611-001' },
    ],
    totalVnd: 432_000,
    applicationVnd: 0,
    cashTenderedVnd: 500_000,
    changeVnd: 300_000,
    businessDate: '2026-11-05',
    createdAt: '2026-11-05T02:41:00.000Z',
    createdByName: 'Phạm Thị Lan',
    ...over,
  }) as Any;

describe('receipt print model (FR-ACC-001)', () => {
  const c = (priorPrints = 0) => ({ ...ctx(priorPrints), branchName: 'Garage Tuấn Phát · Quận 7' });

  it('FR-ACC-001: A5 receipt with the lines, the total and the cash change', () => {
    const m = buildReceiptPrintModel(payment(), c());
    expect(m.paper).toBe('A5');
    expect(m.title).toBe('Phiếu thu');
    expect(m.lines.map((l) => [l.method, l.reference, plain(l.amountText)])).toEqual([
      ['Tiền mặt', null, '200.000 ₫'],
      ['Chuyển khoản', 'FT2611-001', '232.000 ₫'],
    ]);
    expect(m.amounts).toEqual({ totalVnd: 432_000, appliedVnd: 0 });
    expect(m.totals.map((t) => plain(t.text))).toEqual(['432.000 ₫', '500.000 ₫', '300.000 ₫']);
    expect(m.subtitle).toBe('Số PT-Q7-2611-00001 · Ngày 05/11/2026');
  });

  it('FR-ACC-002: a deposit has its own title; an applied deposit shows on the receipt', () => {
    expect(buildReceiptPrintModel(payment({ kind: 'deposit' }), c()).title).toBe(
      'Phiếu thu tiền cọc',
    );
    const m = buildReceiptPrintModel(payment({ applicationVnd: 100_000 }), c());
    expect(m.totals.some((t) => t.label === 'Cọc đã trừ vào lệnh')).toBe(true);
    expect(m.amounts.appliedVnd).toBe(100_000);
  });

  it('BA R28: reprint label from the second print', () => {
    expect(buildReceiptPrintModel(payment(), c(0)).reprintLabel).toBeNull();
    expect(buildReceiptPrintModel(payment(), c(1)).reprintLabel).toBe('BẢN IN LẠI');
  });
});

describe('PdfLibRenderer (FR-REC-008, DS-04)', () => {
  const renderer = new PdfLibRenderer(() => new Date('2026-11-05T03:30:00.000Z'));
  const head = (b: Uint8Array) => Buffer.from(b.slice(0, 5)).toString('latin1');

  it('renders a quote as an A4 PDF with Vietnamese text and the embedded font', async () => {
    const bytes = await renderer.render(buildQuotePrintModel(quote(), ctx(1)));
    expect(head(bytes)).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
    expect(doc.getTitle()).toContain('BG-Q7-2611-00001-v2');
    // the TrueType font program is embedded (Vietnamese diacritics need it)
    expect(bytes.length).toBeGreaterThan(8_000);
  });

  it('a long quote flows onto more pages and each page is numbered', async () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      no: i + 1,
      name: `Hạng mục số ${i + 1} có tên khá dài để kiểm tra việc xuống dòng trong báo giá in`,
      necessity: i % 2 ? 'optional' : 'required',
      lines: [
        line(i * 2 + 1, 'labor', `Công ${i + 1}`, 100_000),
        line(i * 2 + 2, 'part', `Phụ tùng ${i + 1}`, 60_000),
      ],
    }));
    const model = buildQuotePrintModel(quote({ items: many }), ctx());
    const doc = await PDFDocument.load(await renderer.render(model));
    expect(doc.getPageCount()).toBeGreaterThan(1);
    expect(model.amounts.totalVnd).toBe(Math.round(40 * 160_000 * 1.08));
  });

  it('renders a receipt as an A5 PDF', async () => {
    const bytes = await renderer.render(
      buildReceiptPrintModel(payment(), { ...ctx(0), branchName: 'Garage Tuấn Phát' }),
    );
    expect(head(bytes)).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(Math.round(doc.getPage(0).getSize().width)).toBe(420);
  });
});
