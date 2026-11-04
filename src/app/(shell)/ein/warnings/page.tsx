import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { isoToVi } from '@/platform/format/date';
import { hasPermission } from '@/platform/rbac/rbac';
import { listWarnings, type WarningRow } from '@/modules/ein';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { ErrorFor } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { EinPage, einLabels, fill, Kpis, money, Note } from '../einUi';

export const dynamic = 'force-dynamic';

/** G4-EIN-05 / FR-EIN-009: orders handed over without a valid invoice (and without an open request, so nobody issues twice). */
export default async function WarningsPage() {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const l = einLabels('warnings');
  const crumbs = [{ label: t('shell.nav.invoices'), href: '/ein' }];
  const res = await load(() => listWarnings(getContainer().ein, actor));
  const head = { title: l.title!, desc: l.lead!, crumbs };
  if (res.error)
    return (
      <EinPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </EinPage>
    );
  const w = res.data;
  const mayIssue = hasPermission(actor, 'invoice:create');
  return (
    <EinPage {...head}>
      <Kpis
        items={[
          {
            label: l.count!.replace('{n}', ''),
            value: String(w.items.length),
            testId: 'warn-count',
          },
          { label: l.totalValue!, value: money(w.totalVnd), testId: 'warn-total' },
          { label: l.oldest!, value: fill(l.days!, { n: w.oldestDays }) },
        ]}
      />
      {w.truncated ? <Note tone="warning">{l.truncated}</Note> : null}
      {w.items.length === 0 ? (
        <EmptyState title={l.emptyTitle!} text={l.emptyText} />
      ) : (
        <DataTable<WarningRow>
          caption={l.title!}
          rows={w.items}
          rowKey={(r) => r.orderId}
          toolbar={fill(l.count!, { n: w.items.length })}
          footer={<span className="text-secondary">{l.noInvoiceNote}</span>}
          columns={[
            {
              key: 'o',
              header: l.colOrder!,
              render: (r) => (
                <>
                  <Link href={`/rec/orders/${encodeURIComponent(r.orderId)}`} className="code">
                    {r.orderNumber}
                  </Link>
                  <br />
                  <span className="plate">{r.plate}</span>
                </>
              ),
            },
            { key: 'c', header: l.colCustomer!, render: (r) => r.customerName },
            {
              key: 'd',
              header: l.colDone!,
              render: (r) => (r.completedAt ? isoToVi(r.completedAt.slice(0, 10)) : '—'),
            },
            { key: 'a', header: l.colAge!, render: (r) => fill(l.days!, { n: r.ageDays }) },
            { key: 'r', header: l.colReason!, render: (r) => l[`reason_${r.reason}`] },
            { key: 'v', header: l.colValue!, numeric: true, render: (r) => money(r.totalVnd) },
            {
              key: 'x',
              header: '',
              render: (r) =>
                mayIssue ? (
                  <Link
                    className="btn btn--secondary"
                    href={`/ein/orders/${encodeURIComponent(r.orderId)}/issue`}
                    data-testid="warn-issue"
                  >
                    {l.issue}
                  </Link>
                ) : null,
            },
          ]}
        />
      )}
      <Note tone="info">
        <strong>{l.customerRefuses}</strong> {l.customerRefusesText}
      </Note>
    </EinPage>
  );
}
