import { describe, expect, it } from 'vitest';
import { FakeProvider } from '@/infrastructure/einvoice/fakeProvider';
import { ProviderError, type ProviderDraft } from '@/modules/ein';

/** FR-EIN-004 / FR-EIN-013: the fake behaves like a well-built provider, so the application's rules are tested against it. */
const draft = (key: string, over: Partial<ProviderDraft> = {}): ProviderDraft => ({
  clientRequestId: key,
  docType: 'original',
  issuer: {
    sellerName: 'Garage Demo',
    sellerTaxCode: '0312000111',
    symbol: 'C26TAA',
    invoiceType: 'vat',
    templateCode: '1',
  },
  buyer: { kind: 'retail', name: 'An' },
  lines: [{ no: 1, description: 'Dịch vụ', netVnd: 100_000, rateBp: 800 }],
  taxSummary: [{ rateBp: 800, netVnd: 100_000, taxVnd: 8_000 }],
  netVnd: 100_000,
  taxVnd: 8_000,
  totalVnd: 108_000,
  orderNumber: 'RO-1',
  ...over,
});

describe('FakeProvider', () => {
  it('is idempotent by the client key: sending twice returns the same invoice', async () => {
    const p = new FakeProvider();
    const a = await p.issue(draft('k1'));
    const b = await p.issue(draft('k1'));
    expect(b.providerInvoiceId).toBe(a.providerInvoiceId);
    expect(p.invoiceCount).toBe(1);
  });
  it('numbers are sequential per symbol and the tax authority code is derived, not random', async () => {
    const p = new FakeProvider(() => new Date('2026-11-04T00:00:00Z'));
    const a = await p.issue(draft('a'));
    const b = await p.issue(draft('b'));
    expect([a.number, b.number]).toEqual(['0000001', '0000002']);
    const again = new FakeProvider();
    expect((await again.issue(draft('a'))).taxAuthorityCode).toBe(a.taxAuthorityCode);
  });
  it('timeout_before creates nothing; timeout_after creates the invoice and loses the answer; query finds it', async () => {
    const p = new FakeProvider();
    p.script('issue', 'timeout_before').script('issue', 'timeout_after');
    await expect(p.issue(draft('k'))).rejects.toMatchObject({ kind: 'timeout' });
    expect(p.invoiceCount).toBe(0);
    expect(await p.query({ clientRequestId: 'k' })).toEqual({ found: false });
    await expect(p.issue(draft('k'))).rejects.toMatchObject({ kind: 'timeout' });
    expect(p.invoiceCount).toBe(1);
    const q = await p.query({ clientRequestId: 'k' });
    expect(q.found && q.result.state).toBe('issued');
    // a resend after the lost answer still creates nothing new
    await p.issue(draft('k'));
    expect(p.invoiceCount).toBe(1);
  });
  it('data errors, rejections and outages are typed', async () => {
    const p = new FakeProvider();
    p.script('issue', 'data_error').script('issue', 'rejected').script('issue', 'unavailable');
    const kinds: string[] = [];
    for (let i = 0; i < 3; i++)
      await p.issue(draft('x')).catch((e: ProviderError) => kinds.push(`${e.kind}:${e.code}`));
    expect(kinds).toEqual([
      'data:buyer_address_invalid',
      'rejected:symbol_not_registered',
      'unavailable:provider_unavailable',
    ]);
  });
  it('processing answers settle asynchronously on the following looks', async () => {
    const p = new FakeProvider();
    p.script('issue', 'processing');
    const first = await p.issue(draft('k'));
    expect(first.state).toBe('processing');
    const q = await p.query({ clientRequestId: 'k' });
    expect(q.found && q.result.state).toBe('issued');
  });
  it('cancel is idempotent and artifacts are a real XML and a PDF', async () => {
    const p = new FakeProvider();
    const a = await p.issue(draft('k'));
    const c1 = await p.cancel({
      clientRequestId: 'c',
      providerInvoiceId: a.providerInvoiceId,
      reason: 'trùng',
    });
    const c2 = await p.cancel({
      clientRequestId: 'c',
      providerInvoiceId: a.providerInvoiceId,
      reason: 'trùng',
    });
    expect([c1.state, c2.state]).toEqual(['cancelled', 'cancelled']);
    const f = await p.fetchArtifacts(a.providerInvoiceId);
    expect(f.xml).toContain('<MCCQT>');
    expect(new TextDecoder().decode(f.pdf.slice(0, 5))).toBe('%PDF-');
  });
  it('an empty invoice is a data error', async () => {
    await expect(new FakeProvider().issue(draft('z', { totalVnd: 0 }))).rejects.toMatchObject({
      kind: 'data',
    });
  });
});
