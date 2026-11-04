import { getTranslations } from 'next-intl/server';
import { getInvoice } from '@/modules/ein';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ErrorFor } from '@/ui/components/PageParts';
import { EinPage, einLabels, Note } from '../../../einUi';
import { CorrectionForm } from './CorrectionForm';

export const dynamic = 'force-dynamic';

/** G4-EIN-04 / FR-EIN-007: propose an adjustment, replacement or cancel of an issued invoice. */
export default async function CorrectPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations();
  const { id } = await params;
  const { actor } = await requireSession();
  const l = einLabels('correct');
  const crumbs = [
    { label: t('shell.nav.invoices'), href: '/ein' },
    { label: t('ein.detail.title'), href: `/ein/invoices/${encodeURIComponent(id)}` },
  ];
  const res = await load(() => getInvoice(getContainer().ein, actor, id, { requestId: 'page' }));
  if (res.error)
    return (
      <EinPage title={l.title!} crumbs={crumbs}>
        <ErrorFor error={res.error} t={t} />
      </EinPage>
    );
  const inv = res.data;
  const c = einLabels('common');
  return (
    <EinPage title={l.title!} desc={l.lead} crumbs={crumbs}>
      {!inv.actions.correct.allowed ? (
        <Note tone="warning" testId="correct-blocked">
          {c[`reason_${inv.actions.correct.reasonCode ?? ''}`] ?? ''}
        </Note>
      ) : null}
      <CorrectionForm
        invoice={{
          id: inv.id,
          number: inv.number ?? inv.requestNumber,
          totalVnd: inv.totalVnd,
          buyerName: inv.buyerName,
          buyerTaxCode: inv.buyerTaxCode,
          rates: inv.taxSummary.map((r) => r.rateBp),
        }}
        allowed={inv.actions.correct.allowed}
        labels={l}
        common={c}
      />
    </EinPage>
  );
}
