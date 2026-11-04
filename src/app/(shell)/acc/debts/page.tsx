import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { isoToVi } from '@/platform/format/date';
import { listDebts } from '@/modules/acc';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { ErrorFor } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { AccPage, accLabels, KpiRow, money } from '../accUi';

export const dynamic = 'force-dynamic';

/** G4-ACC-10 (minimal) / FR-ACC-006: approved debts of the working branch with their age; the buckets add up to the total. */
export default async function DebtsPage() {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const l = accLabels('debts');
  const res = await load(() => listDebts(getContainer().acc, actor));
  const head = { title: l.title!, desc: l.lead! };
  if (res.error)
    return (
      <AccPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </AccPage>
    );
  const { items, totals } = res.data;
  return (
    <AccPage {...head}>
      <KpiRow
        items={[
          { label: l.total!, value: money(totals.totalVnd), testId: 'kpi-debt-total' },
          { label: l.aging_notDue!, value: money(totals.notDue) },
          { label: l.aging_d1_30!, value: money(totals.d1_30) },
          { label: l.aging_d31_60!, value: money(totals.d31_60) },
          { label: l.aging_over60!, value: money(totals.over60) },
        ]}
      />
      {items.length === 0 ? (
        <EmptyState title={l.emptyTitle!} text={l.emptyText} />
      ) : (
        <DataTable
          caption={l.title!}
          rows={items}
          rowKey={(d) => d.id}
          columns={[
            {
              key: 'o',
              header: l.colOrder!,
              render: (d) => (
                <Link className="code" href={`/acc/orders/${encodeURIComponent(d.orderId)}`}>
                  {d.orderNumber}
                </Link>
              ),
            },
            { key: 'c', header: l.colCustomer!, render: (d) => d.customerName },
            { key: 'd', header: l.colDue!, numeric: true, render: (d) => isoToVi(d.dueDate) },
            {
              key: 'g',
              header: l.colAge!,
              render: (d) => (
                <StatusBadge
                  tone={
                    d.aging === 'notDue' ? 'success' : d.aging === 'over60' ? 'danger' : 'warning'
                  }
                >
                  {d.aging === 'notDue'
                    ? l.aging_notDue
                    : l.overdueDays!.replace('{n}', String(d.daysOverdue))}
                </StatusBadge>
              ),
            },
            { key: 'r', header: l.colReason!, render: (d) => d.reason },
            { key: 'a', header: l.colApproved!, numeric: true, render: (d) => money(d.amountVnd) },
            {
              key: 'm',
              header: l.colRemaining!,
              numeric: true,
              render: (d) => money(d.remainingVnd),
            },
          ]}
        />
      )}
    </AccPage>
  );
}
