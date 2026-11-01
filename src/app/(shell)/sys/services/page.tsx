import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { hasPermission, resolveScope } from '@/platform/rbac/rbac';
import { listServices } from '@/modules/sys';
import { formLabels } from '@/composition/labels';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { FilterBar, SearchField } from '@/ui/components/FilterBar';
import { Button } from '@/ui/components/Button';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { ResourceForm } from '@/ui/components/ResourceForm';
import { EmptyState } from '@/ui/components/States';
import { ErrorFor, first, PageHeader, Pager, type SearchParams } from '@/ui/components/PageParts';

export const dynamic = 'force-dynamic';

/** G4-SYS-07: service catalogue (company level). Standard hours and hourly rates are effective-dated config. */
export default async function ServicesPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const sp = await searchParams;
  const q = first(sp.q);
  const cursor = first(sp.cursor);
  const { actor } = await requireSession();
  const res = await load(() =>
    listServices(getContainer().sys, actor, {
      limit: 25,
      ...(q ? { q } : {}),
      ...(cursor ? { cursor } : {}),
    }),
  );
  const header = <PageHeader title={t('services.title')} lead={t('services.lead')} />;
  if (res.error)
    return (
      <>
        {header}
        <ErrorFor error={res.error} t={t} />
      </>
    );
  const canCreate =
    hasPermission(actor, 'service-catalog:create') &&
    resolveScope(actor, 'service-catalog:create').kind === 'all';
  return (
    <>
      {header}
      <FilterBar
        action="/sys/services"
        actions={
          <>
            <Link className="btn btn--ghost" href="/sys/services">
              {t('warehouses.reset')}
            </Link>
            <Button type="submit" variant="primary">
              {t('warehouses.apply')}
            </Button>
          </>
        }
      >
        <SearchField
          id="q"
          name="q"
          label={t('warehouses.search')}
          placeholder={t('services.searchPlaceholder')}
          defaultValue={q}
        />
      </FilterBar>
      {res.data.items.length === 0 ? (
        <EmptyState title={t('services.emptyTitle')} text={t('services.emptyText')} />
      ) : (
        <DataTable
          caption={t('services.title')}
          rows={res.data.items}
          rowKey={(s) => s.id}
          columns={[
            {
              key: 'code',
              header: t('warehouses.colCode'),
              render: (s) => <span data-testid="svc-code">{s.code}</span>,
            },
            { key: 'name', header: t('warehouses.colName'), render: (s) => s.name },
            { key: 'group', header: t('services.colGroup'), render: (s) => s.group },
            {
              key: 'status',
              header: t('warehouses.colStatus'),
              render: (s) => (
                <StatusBadge tone={s.status === 'active' ? 'success' : 'neutral'}>
                  {t(`warehouses.${s.status}`)}
                </StatusBadge>
              ),
            },
          ]}
        />
      )}
      <Pager
        base="/sys/services"
        query={q ? { q } : {}}
        {...(cursor ? { cursor } : {})}
        next={res.data.nextCursor}
        labels={{
          prev: t('warehouses.prev'),
          next: t('warehouses.next'),
          aria: t('common.pagination'),
        }}
      />
      {canCreate ? (
        <section aria-labelledby="new-h" className="g1-auth-card g1-auth-card--wide">
          <h2 id="new-h">{t('services.create')}</h2>
          <ResourceForm
            testId="service-form"
            endpoint="/api/v1/sys/services"
            labels={formLabels(t, 'warehouses.save', false)}
            fields={[
              { name: 'code', label: t('warehouses.colCode'), required: true, maxLength: 30 },
              { name: 'name', label: t('warehouses.colName'), required: true, maxLength: 120 },
              { name: 'group', label: t('services.colGroup'), required: true, maxLength: 60 },
            ]}
          />
        </section>
      ) : null}
    </>
  );
}
