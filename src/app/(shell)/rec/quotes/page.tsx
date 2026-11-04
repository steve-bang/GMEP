import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { formatDateTime } from '@/platform/format/date';
import { listQuotes } from '@/modules/rec';
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
import { RecPage } from '../RecPage';
import { QUOTE_STATUS_LIST, QUOTE_TONE } from './statusTone';

export const dynamic = 'force-dynamic';

/** G2-QUO-01 / FR-REC-004: one row per quote = its current version (ba-answers-03 Câu 1). */
export default async function QuotesPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const sp = await searchParams;
  const q = first(sp.q);
  const status = first(sp.status);
  const cursor = first(sp.cursor);
  const { actor } = await requireSession();
  const head = { title: t('rec.quotes.title'), desc: t('rec.quotes.lead') };
  const res = await load(() =>
    listQuotes(getContainer().rec, actor, {
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
    <RecPage {...head}>
      <FilterBar
        action="/rec/quotes"
        actions={
          <>
            <Link className="btn btn--ghost" href="/rec/quotes">
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
            {t('rec.quotes.search')}
          </label>
          <input
            id="q"
            name="q"
            type="search"
            className="input"
            defaultValue={q ?? ''}
            placeholder={t('rec.quotes.searchPlaceholder')}
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="status">
            {t('rec.quotes.statusLabel')}
          </label>
          <select id="status" name="status" className="select" defaultValue={status ?? ''}>
            <option value="">{t('rec.allStatus')}</option>
            {QUOTE_STATUS_LIST.map((x) => (
              <option key={x} value={x}>
                {t(`rec.quotes.status_${x}`)}
              </option>
            ))}
          </select>
        </div>
      </FilterBar>
      {page.items.length === 0 ? (
        <EmptyState
          title={t('rec.quotes.emptyTitle')}
          text={t('rec.quotes.emptyText')}
          actions={
            <Link className="btn btn--secondary" href="/rec/intakes">
              {t('rec.quotes.toIntakes')}
            </Link>
          }
        />
      ) : (
        <DataTable
          caption={t('rec.quotes.title')}
          rows={page.items}
          rowKey={(x) => x.id}
          toolbar={<span className="table-meta">{t('rec.quotes.totalNote')}</span>}
          columns={[
            {
              key: 'no',
              header: t('rec.quotes.no'),
              render: (x) => (
                <Link
                  className="code"
                  href={`/rec/quotes/${encodeURIComponent(x.id)}`}
                  data-testid="quote-no"
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
              key: 'ver',
              header: t('rec.quotes.version'),
              numeric: true,
              render: (x) => `v${x.currentN}`,
            },
            {
              key: 'st',
              header: t('rec.quotes.statusLabel'),
              render: (x) => (
                <StatusBadge tone={QUOTE_TONE[x.status] ?? 'neutral'}>
                  {t(`rec.quotes.status_${x.status}`)}
                </StatusBadge>
              ),
            },
            {
              key: 'tot',
              header: t('rec.quotes.total'),
              numeric: true,
              render: (x) => money(x.totalVnd),
            },
            {
              key: 'at',
              header: t('rec.updatedAt'),
              render: (x) => formatDateTime(new Date(x.updatedAt)),
            },
          ]}
        />
      )}
      <Pager
        base="/rec/quotes"
        query={{ ...(q ? { q } : {}), ...(status ? { status } : {}) }}
        {...(cursor ? { cursor } : {})}
        next={page.nextCursor}
        labels={{ prev: t('rec.prev'), next: t('rec.next'), aria: t('common.pagination') }}
      />
    </RecPage>
  );
}
