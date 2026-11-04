import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { hasPermission } from '@/platform/rbac/rbac';
import { previewIssue } from '@/modules/ein';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ErrorFor } from '@/ui/components/PageParts';
import { EinPage, einLabels, Note } from '../../../einUi';
import { IssueForm } from './IssueForm';

export const dynamic = 'force-dynamic';

/** G4-EIN-02 / FR-EIN-001, 002, 011, 013: issue the invoice of ONE repair order. */
export default async function IssuePage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations();
  const { id } = await params;
  const { actor } = await requireSession();
  const l = einLabels('issue');
  const crumbs = [{ label: t('shell.nav.invoices'), href: '/ein' }];
  const res = await load(() => previewIssue(getContainer().ein, actor, id));
  if (res.error)
    return (
      <EinPage title={l.title!} crumbs={crumbs}>
        <ErrorFor error={res.error} t={t} />
      </EinPage>
    );
  const chk = res.data;
  return (
    <EinPage
      title={`${l.title} · ${chk.orderNumber}`}
      desc={l.lead}
      crumbs={crumbs}
      actions={
        <Link
          className="btn btn--secondary"
          href={`/rec/orders/${encodeURIComponent(chk.orderId)}`}
        >
          {t('rec.orders.title')}
        </Link>
      }
    >
      {chk.existingInvoiceId ? (
        <Note tone="info" testId="issue-existing">
          {l.existing}{' '}
          <Link href={`/ein/invoices/${encodeURIComponent(chk.existingInvoiceId)}`}>
            {einLabels('common').openInvoice}
          </Link>
        </Note>
      ) : null}
      <IssueForm
        orderId={chk.orderId}
        initial={chk}
        canIssue={hasPermission(actor, 'invoice:create')}
        labels={l}
        common={einLabels('common')}
      />
    </EinPage>
  );
}
