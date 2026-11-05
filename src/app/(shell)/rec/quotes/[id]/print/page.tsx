import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { getQuotePrintModel } from '@/modules/rec';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ErrorFor, first, type SearchParams } from '@/ui/components/PageParts';
import { PrintLogButton } from '@/ui/components/PrintLogButton';
import { RecPage } from '../../../RecPage';
import { QuoteSheet } from './QuoteSheet';

export const dynamic = 'force-dynamic';

/**
 * G2-PRT-01 (quote, A4): the browser print sheet of the quote print model (the PDF reads the same model, FR-REC-008).
 * Viewing writes nothing; the "In" button records the print first (`quote.printed`, BA answer on printing). Phone and
 * address of the customer are never printed (PDPL).
 */
export default async function QuotePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const t = await getTranslations();
  const { id } = await params;
  const v = Number(first((await searchParams).v));
  const { actor } = await requireSession();
  const crumbs = [{ label: t('rec.quotes.title'), href: '/rec/quotes' }];
  const res = await load(() =>
    getQuotePrintModel(getContainer().rec, actor, id, Number.isInteger(v) && v > 0 ? v : undefined),
  );
  if (res.error)
    return (
      <RecPage title={t('rec.print.title')} crumbs={crumbs}>
        <ErrorFor error={res.error} t={t} />
      </RecPage>
    );
  const model = res.data;
  const n = model.version;
  const q = encodeURIComponent(id);
  return (
    <RecPage title={model.fileName} desc={t('rec.print.preview')} crumbs={crumbs}>
      <div className="rec-actions no-print">
        <PrintLogButton
          label={t('rec.print.printButton')}
          logUrl={`/api/v1/rec/quotes/${q}/print-log`}
          body={{ n }}
          failedLabel={t('rec.print.logFailed')}
          testId="quote-print"
        />
        <a
          className="btn btn--secondary"
          href={`/api/v1/rec/quotes/${q}/pdf?v=${n}`}
          data-testid="quote-pdf"
        >
          {t('rec.print.downloadPdf')}
        </a>
        <Link className="btn btn--ghost" href={`/rec/quotes/${q}?v=${n}`}>
          {t('rec.print.back')}
        </Link>
      </div>
      <div className="g2q-paper-wrap">
        <QuoteSheet model={model} />
      </div>
    </RecPage>
  );
}
