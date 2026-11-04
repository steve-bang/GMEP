import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { formatDateTime } from '@/platform/format/date';
import { hasPermission } from '@/platform/rbac/rbac';
import { listPartRequests } from '@/modules/rec';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { AutoRefresh } from '@/ui/components/AutoRefresh';
import { DataTable } from '@/ui/components/DataTable';
import { ErrorFor, first, type SearchParams } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { chip, pickLabels, qtyText, REQUEST_TONE } from '../orderUi';
import { RecPage } from '../RecPage';
import { RequestRow } from './RequestRow';

export const dynamic = 'force-dynamic';

const KEYS = ['issue', 'reject', 'rejectConfirm', 'reason', 'unexpected'] as const;
const TABS = ['requested', 'issued', 'rejected'] as const;

/** G2-TEC-03 (storekeeper side) / RULE-005, 007: requests for parts of approved lines; issuing creates a goods issue against the order. */
export default async function PartRequestsPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const status = (first((await searchParams).status) ?? 'requested') as (typeof TABS)[number];
  const { actor } = await requireSession();
  const head = { title: t('rec.requests.title'), desc: t('rec.requests.lead') };
  const res = await load(() => listPartRequests(getContainer().rec, actor, { status }));
  if (res.error)
    return (
      <RecPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </RecPage>
    );
  const canIssue = hasPermission(actor, 'stock-doc:create');
  const canDecide = hasPermission(actor, 'part-request:update');
  return (
    <RecPage {...head}>
      <AutoRefresh seconds={30} />
      <nav className="rec-chips" aria-label={t('rec.status')}>
        {TABS.map((s) => (
          <Link key={s} {...chip(s === status)} href={`/rec/part-requests?status=${s}`}>
            {t(`rec.requests.status_${s}`)}
          </Link>
        ))}
      </nav>
      {res.data.items.length === 0 ? (
        <EmptyState title={t('rec.requests.emptyTitle')} text={t('rec.requests.emptyText')} />
      ) : (
        <DataTable
          caption={t('rec.requests.title')}
          rows={res.data.items}
          rowKey={(x) => x.id}
          columns={[
            {
              key: 'ord',
              header: t('rec.orders.no'),
              render: (x) => (
                <Link className="code" href={`/rec/orders/${encodeURIComponent(x.orderId)}`}>
                  {x.orderNumber}
                </Link>
              ),
            },
            {
              key: 'part',
              header: t('rec.requests.part'),
              render: (x) => (
                <>
                  <span className="cell-primary">{x.partName}</span>
                  <span className="cell-sub num">{x.partCode}</span>
                </>
              ),
            },
            {
              key: 'qty',
              header: t('rec.requests.qty'),
              numeric: true,
              render: (x) => qtyText(x.qty, x.qtyScale),
            },
            {
              key: 'at',
              header: t('rec.requests.at'),
              render: (x) => formatDateTime(new Date(x.requestedAt)),
            },
            {
              key: 'st',
              header: t('rec.status'),
              render: (x) => (
                <StatusBadge tone={REQUEST_TONE[x.status] ?? 'neutral'}>
                  {t(`rec.requests.status_${x.status}`)}
                </StatusBadge>
              ),
            },
            {
              key: 'act',
              header: '',
              render: (x) =>
                x.status === 'requested' && canDecide ? (
                  <RequestRow
                    id={x.id}
                    version={x.version}
                    canIssue={canIssue}
                    labels={pickLabels(t, 'rec.requests', KEYS)}
                  />
                ) : (
                  (x.issueDocumentNo ?? x.rejectReason ?? '')
                ),
            },
          ]}
        />
      )}
    </RecPage>
  );
}
