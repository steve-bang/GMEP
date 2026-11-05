import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { getReceiptPrintModel } from '@/modules/acc';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ErrorFor } from '@/ui/components/PageParts';
import { PrintLogButton } from '@/ui/components/PrintLogButton';
import { AccPage } from '../../../accUi';
import { ReceiptSheet } from './ReceiptSheet';

export const dynamic = 'force-dynamic';

/**
 * G4-ACC-03 receipt print (A5): browser sheet of the receipt print model; the PDF reads the same model (FR-REC-008).
 * Viewing writes nothing; the "In" button records the print (`payment.printed`) first.
 */
export default async function ReceiptPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations();
  const { id } = await params;
  const { actor } = await requireSession();
  const crumbs = [{ label: t('shell.nav.payments'), href: '/acc/payments' }];
  const res = await load(() => getReceiptPrintModel(getContainer().acc, actor, id));
  if (res.error)
    return (
      <AccPage title={t('acc.payment.title')} crumbs={crumbs}>
        <ErrorFor error={res.error} t={t} />
      </AccPage>
    );
  const model = res.data;
  const q = encodeURIComponent(id);
  return (
    <AccPage title={model.fileName} desc={t('acc.print.preview')} crumbs={crumbs}>
      <div className="rec-actions no-print">
        <PrintLogButton
          label={t('acc.print.printButton')}
          logUrl={`/api/v1/acc/payments/${q}/print-log`}
          failedLabel={t('acc.print.logFailed')}
          testId="receipt-print"
        />
        <a
          className="btn btn--secondary"
          href={`/api/v1/acc/payments/${q}/pdf`}
          data-testid="receipt-pdf"
        >
          {t('acc.payment.downloadPdf')}
        </a>
        <Link className="btn btn--ghost" href={`/acc/payments/${q}`}>
          {t('acc.print.back')}
        </Link>
      </div>
      <div className="acc-paper-wrap">
        <ReceiptSheet model={model} />
      </div>
    </AccPage>
  );
}
