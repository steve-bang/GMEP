import { describe, expect, it } from 'vitest';
import { csvCell } from '@/modules/sys';
import { messages } from '@/platform/i18n/messages';

type Msgs = { rpt: Record<string, Record<string, string>> };
const rpt = (messages as unknown as Msgs).rpt;

describe('R101: CSV formula escaping (NFR-SEC-02)', () => {
  it.each(['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tx', '\rx'])('neutralises %j', (v) => {
    expect(csvCell(v)).toBe(`"'${v}"`);
  });
  it('leaves plain text and doubles quotes', () => {
    expect(csvCell('Nguyễn "An"')).toBe('"Nguyễn ""An"""');
  });
});

describe('R102/R103: labels on cut data and on point-in-time counts', () => {
  it('names the minimum on the screen and in the CSV when data is cut', () => {
    expect(rpt.xcsv!.minimumText).toContain('mức tối thiểu');
    expect(rpt.csv!.truncated).toContain('mức tối thiểu');
    expect(rpt.common!.truncated).toContain('mức tối thiểu');
    expect(JSON.stringify(rpt)).toMatch(/"techTruncated":"[^"]*mức tối thiểu/);
  });
  it('says "tại thời điểm" on every orders-not-invoiced figure', () => {
    for (const v of [
      rpt.xcsv!['invoices.closedWithoutInvoiceCount'],
      rpt.xcsv!.notInvoicedCount,
      rpt.csv!['invoices.closedWithoutInvoiceCount'],
    ])
      expect(v).toContain('tại thời điểm');
  });
});
