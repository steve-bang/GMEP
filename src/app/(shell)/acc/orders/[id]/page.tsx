import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { formatDateTime } from '@/platform/format/date';
import { getOrderMoney } from '@/modules/acc';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { ErrorFor } from '@/ui/components/PageParts';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { EmptyState } from '@/ui/components/States';
import { AccPage, accLabels, KIND_TONE, KpiRow, METHODS, money, Note } from '../../accUi';
import { PayPanel } from './PayPanel';

export const dynamic = 'force-dynamic';

const fill = (s: string, v: Record<string, string | number>) =>
  Object.entries(v).reduce((acc, [k, x]) => acc.replace(`{${k}}`, String(x)), s);

/** G4-ACC-01 / FR-ACC-001, 002 / R44: money of ONE repair order (RULE-007). */
export default async function AccOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations();
  const { id } = await params;
  const { actor } = await requireSession();
  const crumbs = [{ label: t('shell.nav.payments'), href: '/acc/payments' }];
  const res = await load(() => getOrderMoney(getContainer().acc, actor, id));
  if (res.error)
    return (
      <AccPage title={t('acc.order.title')} crumbs={crumbs}>
        <ErrorFor error={res.error} t={t} />
      </AccPage>
    );
  const m = res.data;
  const b = m.balance;
  const l = accLabels('order');
  const c = accLabels('common');
  const collectReason = m.actions.collect.allowed
    ? null
    : m.actions.collect.reasonCode === 'qc_required'
      ? fill(l.qcText!, { status: t(`rec.orders.status_${m.order.status}`) })
      : (c[`reason_${m.actions.collect.reasonCode}`] ?? null);
  return (
    <AccPage
      title={`${t('acc.order.title')} · ${m.order.number}`}
      desc={l.lead}
      crumbs={crumbs}
      actions={
        <Link className="btn btn--secondary" href={`/rec/orders/${encodeURIComponent(m.order.id)}`}>
          {c.openOrder}
        </Link>
      }
    >
      <section className="card" aria-label={l.summary}>
        <dl className="detail-list">
          <div>
            <dt>{t('rec.plate')}</dt>
            <dd>
              <span className="plate">{m.order.plate}</span>
            </dd>
          </div>
          <div>
            <dt>{t('rec.customer')}</dt>
            <dd>{m.order.customerName}</dd>
          </div>
          <div>
            <dt>{t('rec.status')}</dt>
            <dd>
              <StatusBadge>{t(`rec.orders.status_${m.order.status}`)}</StatusBadge>
            </dd>
          </div>
        </dl>
      </section>
      <KpiRow
        items={[
          { label: l.receivable!, value: money(b.receivableVnd), testId: 'kpi-receivable' },
          { label: l.received!, value: money(b.receivedVnd), testId: 'kpi-received' },
          { label: l.deposit!, value: money(b.depositHeldVnd), testId: 'kpi-deposit' },
          { label: l.outstanding!, value: money(b.outstandingVnd), testId: 'kpi-outstanding' },
        ]}
      />
      {b.debt ? (
        <Note tone="warning" testId="debt-note">
          {fill(l.debtLine!, {
            amount: money(b.debt.amountVnd),
            due: b.debt.dueDate.split('-').reverse().join('/'),
          })}
        </Note>
      ) : m.debtApproval?.status === 'pending' ? (
        <Note testId="debt-pending">{fill(l.debtPending!, { number: m.debtApproval.number })}</Note>
      ) : null}
      <PayPanel
        orderId={m.order.id}
        outstandingVnd={b.outstandingVnd}
        depositHeldVnd={b.depositHeldVnd}
        canCollect={m.actions.collect.allowed}
        canDeposit={m.actions.deposit.allowed}
        canRequestDebt={m.actions.requestDebt.allowed}
        collectReason={collectReason}
        shiftOpen={m.shiftOpen}
        methods={[...METHODS]}
        labels={l}
        common={c}
      />
      <section className="card" aria-labelledby="pays-h">
        <div className="card__header">
          <h2 className="card__title" id="pays-h">
            {l.paymentsTitle}
          </h2>
        </div>
        {m.payments.length === 0 ? (
          <EmptyState title={l.noPayments!} />
        ) : (
          <DataTable
            caption={l.paymentsTitle!}
            rows={m.payments}
            rowKey={(p) => p.id}
            columns={[
              {
                key: 'n',
                header: l.colNumber!,
                render: (p) => (
                  <Link className="code" href={`/acc/payments/${encodeURIComponent(p.id)}`}>
                    {p.number}
                  </Link>
                ),
              },
              {
                key: 'k',
                header: t('rec.status'),
                render: (p) => (
                  <>
                    <StatusBadge tone={KIND_TONE[p.kind] ?? 'neutral'}>
                      {c[`kind_${p.kind}`]}
                    </StatusBadge>
                    {p.reversedBy ? <span className="tag tag--danger">{c.reversed}</span> : null}
                  </>
                ),
              },
              {
                key: 't',
                header: l.colTime!,
                render: (p) => formatDateTime(new Date(p.createdAt)),
              },
              {
                key: 'm',
                header: l.colMethods!,
                render: (p) =>
                  [...new Set(p.lines.map((x) => c[`method_${x.method}`]))].join(', ') +
                  (p.applicationVnd > 0 ? ` + ${l.depositUsedLabel}` : ''),
              },
              { key: 'by', header: l.colBy!, render: (p) => p.createdByName },
              {
                key: 'a',
                header: l.colAmount!,
                numeric: true,
                render: (p) => money(p.totalVnd + p.applicationVnd),
              },
            ]}
          />
        )}
      </section>
    </AccPage>
  );
}
