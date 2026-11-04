import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { formatDateTime } from '@/platform/format/date';
import { hasPermission } from '@/platform/rbac/rbac';
import { listIntakes } from '@/modules/rec';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { Button } from '@/ui/components/Button';
import { DataTable } from '@/ui/components/DataTable';
import { FilterBar } from '@/ui/components/FilterBar';
import { ErrorFor, first, Pager, type SearchParams } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { RecPage } from '../RecPage';

export const dynamic = 'force-dynamic';

/** G2-REC-01 entry: intakes of the working scope, drafts first to resume (FR-REC-001). */
export default async function IntakesPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const sp = await searchParams;
  const q = first(sp.q);
  const status = first(sp.status);
  const cursor = first(sp.cursor);
  const { actor } = await requireSession();
  const head = {
    title: t('rec.intakes.title'),
    desc: t('rec.intakes.lead'),
    actions: hasPermission(actor, 'intake:create') ? (
      <Link className="btn btn--primary" href="/rec/intakes/new" data-testid="intake-new">
        {t('rec.intakes.new')}
      </Link>
    ) : undefined,
  };
  const res = await load(() =>
    listIntakes(getContainer().rec, actor, {
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
  const tone = { draft: 'neutral', completed: 'success', cancelled: 'danger' } as const;
  return (
    <RecPage {...head}>
      <FilterBar
        action="/rec/intakes"
        actions={
          <>
            <Link className="btn btn--ghost" href="/rec/intakes">
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
            {t('rec.intakes.search')}
          </label>
          <input
            id="q"
            name="q"
            type="search"
            className="input"
            defaultValue={q ?? ''}
            placeholder={t('rec.intakes.searchPlaceholder')}
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="status">
            {t('rec.status')}
          </label>
          <select id="status" name="status" className="select" defaultValue={status ?? ''}>
            <option value="">{t('rec.allStatus')}</option>
            {(['draft', 'completed', 'cancelled'] as const).map((x) => (
              <option key={x} value={x}>
                {t(`rec.intakes.status_${x}`)}
              </option>
            ))}
          </select>
        </div>
      </FilterBar>
      {page.items.length === 0 ? (
        <EmptyState title={t('rec.intakes.emptyTitle')} text={t('rec.intakes.emptyText')} />
      ) : (
        <DataTable
          caption={t('rec.intakes.title')}
          rows={page.items}
          rowKey={(i) => i.id}
          columns={[
            {
              key: 'no',
              header: t('rec.intakes.no'),
              render: (i) => (
                <Link className="code" href={`/rec/intakes/${encodeURIComponent(i.id)}`}>
                  {i.number}
                </Link>
              ),
            },
            {
              key: 'plate',
              header: t('rec.plate'),
              render: (i) => <span className="plate">{i.plate}</span>,
            },
            { key: 'veh', header: t('rec.vehicle'), render: (i) => i.vehicleLabel },
            { key: 'cust', header: t('rec.customer'), render: (i) => i.customerName },
            {
              key: 'st',
              header: t('rec.status'),
              render: (i) => (
                <StatusBadge tone={tone[i.status]}>
                  {t(`rec.intakes.status_${i.status}`)}
                </StatusBadge>
              ),
            },
            {
              key: 'step',
              header: t('rec.intakes.step'),
              numeric: true,
              render: (i) => (i.status === 'draft' ? `${i.step}/5` : '—'),
            },
            {
              key: 'at',
              header: t('rec.updatedAt'),
              render: (i) => formatDateTime(new Date(i.updatedAt)),
            },
          ]}
        />
      )}
      <Pager
        base="/rec/intakes"
        query={{ ...(q ? { q } : {}), ...(status ? { status } : {}) }}
        {...(cursor ? { cursor } : {})}
        next={page.nextCursor}
        labels={{ prev: t('rec.prev'), next: t('rec.next'), aria: t('common.pagination') }}
      />
    </RecPage>
  );
}
