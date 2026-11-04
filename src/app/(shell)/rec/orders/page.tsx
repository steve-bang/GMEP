import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { isoToVi } from '@/platform/format/date';
import { listOrders } from '@/modules/rec';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { Button } from '@/ui/components/Button';
import { DataTable } from '@/ui/components/DataTable';
import { FilterBar } from '@/ui/components/FilterBar';
import { ErrorFor, first, Pager, type SearchParams } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { money } from '../format';
import { ORDER_STATUS_LIST, ORDER_TONE } from '../orderUi';
import { RecPage } from '../RecPage';

export const dynamic = 'force-dynamic';

/** G2-REC-02 / FR-REC-015: repair orders of the working branch, newest first. */
export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const sp = await searchParams;
  const q = first(sp.q);
  const status = first(sp.status);
  const cursor = first(sp.cursor);
  const { actor } = await requireSession();
  const head = { title: t('rec.orders.title'), desc: t('rec.orders.lead') };
  const res = await load(() =>
    listOrders(getContainer().rec, actor, {
      limit: 25,
      ...(q ? { q } : {}),
      ...(status ? { status } : {}),
      ...(cursor ? { cursor } : {}),
    }),
  );
  if (res.error)
    return (
      <RecPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </RecPage>
    );
  const page = res.data;
  return (
    <RecPage
      {...head}
      actions={
        <Link className="btn btn--secondary" href="/rec/board">
          {t('rec.orders.toBoard')}
        </Link>
      }
    >
      <FilterBar
        action="/rec/orders"
        actions={
          <>
            <Link className="btn btn--ghost" href="/rec/orders">
              {t('rec.reset')}
            </Link>
            <Button type="submit" variant="primary">
              {t('rec.apply')}
            </Button>
          </>
        }
      >
        <div className="field filter-bar__search">
          <label className="field__label" htmlFor="q">
            {t('rec.orders.search')}
          </label>
          <input
            id="q"
            name="q"
            type="search"
            className="input"
            defaultValue={q ?? ''}
            placeholder={t('rec.orders.searchPlaceholder')}
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="status">
            {t('rec.status')}
          </label>
          <select id="status" name="status" className="select" defaultValue={status ?? ''}>
            <option value="">{t('rec.allStatus')}</option>
            {ORDER_STATUS_LIST.map((x) => (
              <option key={x} value={x}>
                {t(`rec.orders.status_${x}`)}
              </option>
            ))}
          </select>
        </div>
      </FilterBar>
      {page.items.length === 0 ? (
        <EmptyState title={t('rec.orders.emptyTitle')} text={t('rec.orders.emptyText')} />
      ) : (
        <DataTable
          caption={t('rec.orders.title')}
          rows={page.items}
          rowKey={(x) => x.id}
          columns={[
            {
              key: 'no',
              header: t('rec.orders.no'),
              render: (x) => (
                <Link
                  className="code"
                  href={`/rec/orders/${encodeURIComponent(x.id)}`}
                  data-testid="order-no"
                >
                  {x.number}
                </Link>
              ),
            },
            {
              key: 'plate',
              header: t('rec.plate'),
              render: (x) => <span className="plate">{x.plate}</span>,
            },
            { key: 'cust', header: t('rec.customer'), render: (x) => x.customerName },
            {
              key: 'st',
              header: t('rec.status'),
              render: (x) => (
                <>
                  <StatusBadge tone={ORDER_TONE[x.status] ?? 'neutral'}>
                    {t(`rec.orders.status_${x.status}`)}
                  </StatusBadge>
                  {x.late ? <span className="tag tag--danger">{t('rec.orders.late')}</span> : null}
                  {x.unmetLines > 0 && x.open ? (
                    <span className="tag tag--warning">{t('rec.orders.waitingParts')}</span>
                  ) : null}
                </>
              ),
            },
            {
              key: 'prog',
              header: t('rec.orders.progress'),
              numeric: true,
              render: (x) => `${x.doneCount}/${x.itemCount}`,
            },
            {
              key: 'due',
              header: t('rec.orders.promised'),
              numeric: true,
              render: (x) => (x.promisedDate ? isoToVi(x.promisedDate) : '—'),
            },
            {
              key: 'tot',
              header: t('rec.orders.total'),
              numeric: true,
              render: (x) => money(x.totalVnd),
            },
          ]}
        />
      )}
      <Pager
        base="/rec/orders"
        query={{ ...(q ? { q } : {}), ...(status ? { status } : {}) }}
        {...(cursor ? { cursor } : {})}
        next={page.nextCursor}
        labels={{ prev: t('rec.prev'), next: t('rec.next'), aria: t('common.pagination') }}
      />
    </RecPage>
  );
}
