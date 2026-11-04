import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { businessDate, formatDateTime } from '@/platform/format/date';
import { listPayments, type PaymentListQuery } from '@/modules/acc';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { DateFilter } from '@/ui/components/DateFilter';
import { ErrorFor, first, type SearchParams } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { AccPage, accLabels, KIND_TONE, KpiRow, METHODS, money } from '../accUi';

export const dynamic = 'force-dynamic';

const KINDS = ['receipt', 'deposit', 'expense', 'reversal'] as const;

/** G4-ACC-02 / FR-ACC-001: payments of the working branch; reversals are their own rows and the net total subtracts them. */
export default async function PaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const sp = await searchParams;
  const { actor } = await requireSession();
  const c = accLabels('common');
  const l = accLabels('payments');
  const today = businessDate(new Date());
  const from = first(sp.from) ?? today;
  const to = first(sp.to) ?? from;
  const kind = KINDS.find((k) => k === first(sp.kind));
  const method = METHODS.find((m) => m === first(sp.method));
  const q: PaymentListQuery = {
    from,
    to,
    ...(kind ? { kind } : {}),
    ...(method ? { method } : {}),
  };
  const res = await load(() => listPayments(getContainer().acc, actor, q));
  const head = { title: l.title!, desc: l.lead! };
  if (res.error)
    return (
      <AccPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </AccPage>
    );
  const page = res.data;
  return (
    <AccPage
      {...head}
      actions={
        <Link className="btn btn--secondary" href="/rec/orders?status=ready_for_delivery">
          {l.collectByOrder}
        </Link>
      }
    >
      <KpiRow
        items={[
          { label: l.net!, value: money(page.netVnd), meta: l.netNote, testId: 'kpi-net' },
          { label: l.cash!, value: money(page.cashVnd) },
          { label: l.other!, value: money(page.otherVnd) },
        ]}
      />
      <section className="card">
        <div className="card__body stack">
          <DateFilter
            base="/acc/payments"
            fields={[
              { name: 'from', label: c.from!, iso: from },
              { name: 'to', label: c.to!, iso: to },
            ]}
            keep={{ ...(kind ? { kind } : {}), ...(method ? { method } : {}) }}
            applyLabel={c.apply!}
            resetLabel={c.reset!}
          />
          <div className="rec-chips">
            {[undefined, ...KINDS].map((k) => (
              <Link
                key={k ?? 'all'}
                className={`chip${kind === k ? ' is-selected' : ''}`}
                href={`/acc/payments?from=${from}&to=${to}${k ? `&kind=${k}` : ''}${method ? `&method=${method}` : ''}`}
              >
                {k ? c[`kind_${k}`] : c.allKinds}
              </Link>
            ))}
            {METHODS.map((mm) => (
              <Link
                key={mm}
                className={`chip${method === mm ? ' is-selected' : ''}`}
                href={`/acc/payments?from=${from}&to=${to}${kind ? `&kind=${kind}` : ''}&method=${mm}`}
              >
                {c[`method_${mm}`]}
              </Link>
            ))}
          </div>
        </div>
      </section>
      {page.items.length === 0 ? (
        <EmptyState title={l.emptyTitle!} text={l.emptyText} />
      ) : (
        <DataTable
          caption={l.title!}
          rows={page.items}
          rowKey={(p) => p.id}
          toolbar={l.count!.replace('{n}', String(page.items.length))}
          columns={[
            {
              key: 'n',
              header: l.colNumber!,
              render: (p) => (
                <Link
                  className="code"
                  href={`/acc/payments/${encodeURIComponent(p.id)}`}
                  data-testid="pay-no"
                >
                  {p.number}
                </Link>
              ),
            },
            { key: 't', header: l.colTime!, render: (p) => formatDateTime(new Date(p.createdAt)) },
            {
              key: 'o',
              header: l.colOrder!,
              render: (p) =>
                p.orderId ? (
                  <Link href={`/acc/orders/${encodeURIComponent(p.orderId)}`}>{p.orderNumber}</Link>
                ) : (
                  '—'
                ),
            },
            {
              key: 'm',
              header: l.colMethod!,
              render: (p) => [...new Set(p.lines.map((x) => c[`method_${x.method}`]))].join(', '),
            },
            { key: 'by', header: l.colBy!, render: (p) => p.createdByName },
            {
              key: 's',
              header: l.colState!,
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
              key: 'a',
              header: l.colAmount!,
              numeric: true,
              render: (p) =>
                p.direction === 'out'
                  ? `−${money(p.totalVnd)}`
                  : money(p.totalVnd + p.applicationVnd),
            },
          ]}
        />
      )}
    </AccPage>
  );
}
