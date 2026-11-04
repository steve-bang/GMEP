import { createHash } from 'node:crypto';
import {
  ProviderError,
  type EInvoiceProvider,
  type ProviderArtifacts,
  type ProviderDraft,
  type ProviderQueryResult,
  type ProviderRegistry,
  type ProviderResult,
} from '@/modules/ein';

/**
 * The fake e-invoice provider (FR-EIN-004): deterministic, in memory, scriptable. It is the ONLY adapter built (no real
 * provider is chosen yet) and it behaves like a well-built real one: IDEMPOTENT by `clientRequestId`, numbers issued in
 * sequence per symbol, a tax authority code derived from the invoice, an asynchronous status, XML and PDF. Tests and the
 * local demo script the trouble: timeouts before or after the invoice was created, data errors, rejections, outages and
 * slow "processing" answers.
 */
export type FakeOutcome =
  | 'ok'
  /** the call fails and NOTHING was created */
  | 'timeout_before'
  /** the invoice WAS created but the answer is lost (the dangerous case) */
  | 'timeout_after'
  | 'data_error'
  | 'rejected'
  | 'unavailable'
  /** the invoice is accepted for processing; it becomes `issued` after `processingQueries` status calls */
  | 'processing';

export type FakeOp = 'issue' | 'cancel' | 'query' | 'status' | 'artifacts';

interface Rule {
  op: FakeOp;
  outcome: FakeOutcome;
  /** how many calls it applies to (default 1) */
  times: number;
  /** only for calls whose key contains this text */
  matchKey?: string;
}

interface StoredInvoice {
  providerInvoiceId: string;
  number: string;
  symbol: string;
  draft: ProviderDraft;
  state: 'issued' | 'processing' | 'cancelled';
  taxAuthorityCode: string;
  issuedAt: Date;
  /** status calls left before a `processing` invoice becomes `issued` */
  processingLeft: number;
}

const xmlEscape = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!,
  );

export class FakeProvider implements EInvoiceProvider {
  readonly code = 'fake';
  private readonly byClient = new Map<
    string,
    { providerInvoiceId: string; op: 'issue' | 'cancel' }
  >();
  private readonly invoices = new Map<string, StoredInvoice>();
  private readonly counters = new Map<string, number>();
  private rules: Rule[] = [];
  /** status calls a `processing` invoice needs before it is issued */
  processingQueries = 1;
  /** calls seen, for assertions: how many invoices exist and how many times each operation was called */
  readonly calls: Record<FakeOp, number> = {
    issue: 0,
    cancel: 0,
    query: 0,
    status: 0,
    artifacts: 0,
  };

  constructor(private readonly now: () => Date = () => new Date()) {}

  /** The next `times` calls of `op` (optionally only those with a key containing `matchKey`) end with `outcome`. */
  script(op: FakeOp, outcome: FakeOutcome, times = 1, matchKey?: string): this {
    this.rules.push({ op, outcome, times, ...(matchKey ? { matchKey } : {}) });
    return this;
  }
  clearScript(): void {
    this.rules = [];
  }
  /** number of distinct invoices the provider holds (the duplicate-invoice assertion) */
  get invoiceCount(): number {
    return this.invoices.size;
  }
  invoicesFor(clientRequestId: string): StoredInvoice[] {
    const ref = this.byClient.get(clientRequestId);
    return ref ? [this.invoices.get(ref.providerInvoiceId)!] : [];
  }
  reset(): void {
    this.byClient.clear();
    this.invoices.clear();
    this.counters.clear();
    this.rules = [];
    for (const k of Object.keys(this.calls) as FakeOp[]) this.calls[k] = 0;
  }

  private take(op: FakeOp, key: string): FakeOutcome {
    this.calls[op]++;
    const i = this.rules.findIndex((r) => r.op === op && (!r.matchKey || key.includes(r.matchKey)));
    if (i < 0) return 'ok';
    const r = this.rules[i]!;
    if (--r.times <= 0) this.rules.splice(i, 1);
    return r.outcome;
  }

  private fail(outcome: FakeOutcome): never {
    switch (outcome) {
      case 'timeout_before':
      case 'timeout_after':
        throw new ProviderError('timeout', 'provider_timeout', 'the provider did not answer');
      case 'data_error':
        throw new ProviderError(
          'data',
          'buyer_address_invalid',
          'the provider refused the buyer data',
          ['buyer.address'],
        );
      case 'rejected':
        throw new ProviderError(
          'rejected',
          'symbol_not_registered',
          'the invoice symbol is not registered for this branch',
        );
      case 'unavailable':
        throw new ProviderError('unavailable', 'provider_unavailable', 'the provider is down');
      default:
        throw new Error('not a failure');
    }
  }

  private resultOf(i: StoredInvoice): ProviderResult {
    return {
      state: i.state,
      providerInvoiceId: i.providerInvoiceId,
      ...(i.state === 'processing'
        ? {}
        : { number: i.number, symbol: i.symbol, taxAuthorityCode: i.taxAuthorityCode }),
      issuedAt: i.issuedAt,
      rawStatus:
        i.state === 'processing' ? 'PROCESSING' : i.state === 'cancelled' ? 'CANCELLED' : 'ISSUED',
    };
  }

  private create(draft: ProviderDraft, state: 'issued' | 'processing'): StoredInvoice {
    const symbol = draft.issuer.symbol;
    const n = (this.counters.get(symbol) ?? 0) + 1;
    this.counters.set(symbol, n);
    const number = String(n).padStart(7, '0');
    const providerInvoiceId = `FAKE-${symbol}-${number}`;
    const inv: StoredInvoice = {
      providerInvoiceId,
      number,
      symbol,
      draft,
      state,
      taxAuthorityCode: `00${createHash('sha256').update(providerInvoiceId).digest('hex').slice(0, 30).toUpperCase()}`,
      issuedAt: this.now(),
      processingLeft: state === 'processing' ? this.processingQueries : 0,
    };
    this.invoices.set(providerInvoiceId, inv);
    this.byClient.set(draft.clientRequestId, { providerInvoiceId, op: 'issue' });
    return inv;
  }

  async issue(draft: ProviderDraft): Promise<ProviderResult> {
    const outcome = this.take('issue', draft.clientRequestId);
    if (
      outcome === 'timeout_before' ||
      outcome === 'data_error' ||
      outcome === 'rejected' ||
      outcome === 'unavailable'
    )
      this.fail(outcome);
    // idempotent by the client key: a second send returns the invoice that already exists, never a second one
    const known = this.byClient.get(draft.clientRequestId);
    if (known) {
      const inv = this.invoices.get(known.providerInvoiceId)!;
      if (outcome === 'timeout_after') this.fail(outcome);
      return this.resultOf(inv);
    }
    if (draft.totalVnd === 0 && draft.docType === 'original')
      throw new ProviderError('data', 'zero_total', 'an invoice needs a value', ['totalVnd']);
    const inv = this.create(draft, outcome === 'processing' ? 'processing' : 'issued');
    if (outcome === 'timeout_after') this.fail(outcome);
    return this.resultOf(inv);
  }

  async cancel(input: {
    clientRequestId: string;
    providerInvoiceId: string;
    reason: string;
  }): Promise<ProviderResult> {
    const outcome = this.take('cancel', input.clientRequestId);
    if (
      outcome === 'timeout_before' ||
      outcome === 'data_error' ||
      outcome === 'rejected' ||
      outcome === 'unavailable'
    )
      this.fail(outcome);
    const inv = this.invoices.get(input.providerInvoiceId);
    if (!inv)
      throw new ProviderError('data', 'invoice_unknown', 'no such invoice', ['providerInvoiceId']);
    this.byClient.set(input.clientRequestId, {
      providerInvoiceId: inv.providerInvoiceId,
      op: 'cancel',
    });
    inv.state = 'cancelled';
    if (outcome === 'timeout_after') this.fail(outcome);
    return this.resultOf(inv);
  }

  async query(input: { clientRequestId: string }): Promise<ProviderQueryResult> {
    const outcome = this.take('query', input.clientRequestId);
    if (outcome === 'timeout_before' || outcome === 'timeout_after') this.fail('timeout_before');
    if (outcome === 'unavailable') this.fail(outcome);
    const ref = this.byClient.get(input.clientRequestId);
    if (!ref) return { found: false };
    const inv = this.invoices.get(ref.providerInvoiceId)!;
    // asynchronous status: a `processing` invoice settles after the configured number of looks
    if (inv.state === 'processing' && --inv.processingLeft <= 0) inv.state = 'issued';
    return { found: true, result: this.resultOf(inv) };
  }

  async getStatus(providerInvoiceId: string): Promise<ProviderResult> {
    const outcome = this.take('status', providerInvoiceId);
    if (outcome === 'timeout_before' || outcome === 'timeout_after') this.fail('timeout_before');
    if (outcome === 'unavailable') this.fail(outcome);
    const inv = this.invoices.get(providerInvoiceId);
    if (!inv)
      throw new ProviderError('data', 'invoice_unknown', 'no such invoice', ['providerInvoiceId']);
    if (inv.state === 'processing' && --inv.processingLeft <= 0) inv.state = 'issued';
    return this.resultOf(inv);
  }

  /** Simulates the provider side cancelling an invoice (the tax authority or a user at the provider's portal). */
  cancelAtProvider(providerInvoiceId: string): void {
    const inv = this.invoices.get(providerInvoiceId);
    if (inv) inv.state = 'cancelled';
  }

  async fetchArtifacts(providerInvoiceId: string): Promise<ProviderArtifacts> {
    const outcome = this.take('artifacts', providerInvoiceId);
    if (outcome === 'timeout_before' || outcome === 'unavailable')
      this.fail(outcome === 'unavailable' ? 'unavailable' : 'timeout_before');
    const inv = this.invoices.get(providerInvoiceId);
    if (!inv)
      throw new ProviderError('data', 'invoice_unknown', 'no such invoice', ['providerInvoiceId']);
    const d = inv.draft;
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<HDon>',
      `  <DLHDon><TTChung><KHHDon>${xmlEscape(inv.symbol)}</KHHDon><SHDon>${inv.number}</SHDon><LoaiHD>${d.docType}</LoaiHD></TTChung>`,
      `  <NDHDon><NBan><Ten>${xmlEscape(d.issuer.sellerName)}</Ten><MST>${xmlEscape(d.issuer.sellerTaxCode)}</MST></NBan>`,
      `  <NMua><Ten>${xmlEscape(d.buyer.name)}</Ten>${d.buyer.taxCode ? `<MST>${xmlEscape(d.buyer.taxCode)}</MST>` : ''}${d.buyer.address ? `<DChi>${xmlEscape(d.buyer.address)}</DChi>` : ''}</NMua>`,
      `  <DSHHDVu>${d.lines
        .map(
          (l) =>
            `<HHDVu><STT>${l.no}</STT><THHDVu>${xmlEscape(l.description)}</THHDVu><ThTien>${l.netVnd}</ThTien><TSuat>${l.rateBp / 100}%</TSuat></HHDVu>`,
        )
        .join('')}</DSHHDVu>`,
      `  <TToan><TgTCThue>${d.netVnd}</TgTCThue><TgTThue>${d.taxVnd}</TgTThue><TgTTTBSo>${d.totalVnd}</TgTTTBSo></TToan></NDHDon></DLHDon>`,
      `  <MCCQT>${inv.taxAuthorityCode}</MCCQT>`,
      '</HDon>',
    ].join('\n');
    return { xml, pdf: minimalPdf(`${inv.symbol}-${inv.number}`, d.totalVnd) };
  }
}

/** A tiny but valid single-page PDF (ASCII only) so the stored file really is a PDF. */
function minimalPdf(title: string, totalVnd: number): Uint8Array {
  const text = `FAKE E-INVOICE ${title} TOTAL ${totalVnd} VND`.replace(/[()\\]/g, '');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${`BT /F1 14 Tf 50 780 Td (${text}) Tj ET`.length} >>\nstream\nBT /F1 14 Tf 50 780 Td (${text}) Tj ET\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

/** Registry of the adapters this build can talk to. `fake` serves both environments (it is in memory either way). */
export class StaticProviderRegistry implements ProviderRegistry {
  /** `liveCodes`: adapters allowed in the live environment. The fake never is: a live issuer on `fake` is "not activated". */
  constructor(
    private readonly providers: Record<string, EInvoiceProvider>,
    private readonly liveCodes: readonly string[] = [],
  ) {}
  get(code: string, environment: 'test' | 'live'): EInvoiceProvider | null {
    if (environment === 'live' && !this.liveCodes.includes(code)) return null;
    return this.providers[code] ?? null;
  }
  codes(): string[] {
    return Object.keys(this.providers);
  }
}
