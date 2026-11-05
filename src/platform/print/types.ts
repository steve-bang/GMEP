/**
 * Print models (FR-REC-008, ADR 0001 §7.5, review DS-04): ONE pure-data model per printed document. The browser print
 * sheet (React) and the server PDF renderer both read the SAME model, so the two cannot drift (UAT: numbers identical).
 *
 * Everything a reader sees is already a finished Vietnamese string (labels from `vi.json`, money formatted vi-VN from
 * integer VND, dates dd/MM/yyyy), built once by the module that owns the document. The raw integer amounts are kept
 * next to the text for tests and reconciliation. No phone number or address is ever part of a model (PDPL 2025).
 */
export type PaperFormat = 'A4' | 'A5';

export interface PrintLabelValue {
  label: string;
  value: string;
  /** plate, document number: shown in the monospace/emphasis style */
  strong?: boolean;
}

export interface PrintSignature {
  label: string;
  hint?: string;
}

export interface PrintFooter {
  /** "In lúc 05/11/2026 09:30" */
  printedAt: string;
  printedBy: string;
}

interface PrintModelBase {
  paper: PaperFormat;
  /** download file name without extension (ASCII) */
  fileName: string;
  branchName: string;
  /** "BẢN IN LẠI" from the second print on, else null (BA answer: quote reprint) */
  reprintLabel: string | null;
  title: string;
  /** under the title: number, date, validity */
  subtitle: string;
  signatures: PrintSignature[];
  footer: PrintFooter;
}

export interface QuotePrintLine {
  name: string;
  qtyText: string;
  unitText: string;
  amountText: string;
}

export interface QuotePrintItem {
  no: number;
  /** "1. Thay má phanh (bắt buộc)" */
  heading: string;
  /** approved/declined once the customer decided; pending = tick boxes on paper */
  decision: 'approved' | 'declined' | 'pending';
  decisionLabel: string;
  /** item price including its share of the tax (R1): the items add up to the grand total */
  grossText: string;
  lines: QuotePrintLine[];
}

export interface PrintTotalRow {
  label: string;
  text: string;
  emphasis?: boolean;
}

export interface QuotePrintModel extends PrintModelBase {
  kind: 'quote';
  paper: 'A4';
  /** version printed */
  version: number;
  info: PrintLabelValue[];
  columns: { item: string; qty: string; unit: string; amount: string };
  agreeLabel: string;
  disagreeLabel: string;
  items: QuotePrintItem[];
  totals: PrintTotalRow[];
  note: string;
  /** hash prefix of the approval evidence, when approved */
  evidence: string | null;
  /** integers for reconciliation and tests */
  amounts: {
    totalVnd: number;
    taxVnd: number;
    netVnd: number;
    approvedTotalVnd: number | null;
  };
}

export interface ReceiptPrintLine {
  method: string;
  reference: string | null;
  amountText: string;
}

export interface ReceiptPrintModel extends PrintModelBase {
  kind: 'receipt';
  paper: 'A5';
  info: PrintLabelValue[];
  linesHeading: string;
  lines: ReceiptPrintLine[];
  totals: PrintTotalRow[];
  note: string;
  amounts: { totalVnd: number; appliedVnd: number };
}

export type PrintModel = QuotePrintModel | ReceiptPrintModel;

/**
 * Port of the PDF renderer (adapter in infrastructure). Takes a print model and returns the bytes of a PDF with
 * the Vietnamese font embedded; it never reads data on its own.
 */
export interface PdfRenderer {
  render(model: PrintModel): Promise<Uint8Array>;
}
