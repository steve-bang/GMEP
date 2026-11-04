import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { hasPermission, resolveWorkingScope } from '@/platform/rbac/rbac';
import { listVehicles } from '@/modules/crm';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { Button } from '@/ui/components/Button';
import { DataTable } from '@/ui/components/DataTable';
import { FilterBar, SearchField } from '@/ui/components/FilterBar';
import { ErrorFor, first, Pager, ScopeLine, type SearchParams } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { CrmPage } from '../CrmPage';

export const dynamic = 'force-dynamic';

/** G2-CRM-04 / FR-CRM-002: vehicles inside the working scope, plate search ignores dots, dashes and case. */
export default async function VehiclesPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const sp = await searchParams;
  const q = first(sp.q);
  const cursor = first(sp.cursor);
  const { actor } = await requireSession();
  const crm = getContainer().crm;
  const head = {
    title: t('crm.vehicles.title'),
    desc: t('crm.vehicles.lead'),
    actions: hasPermission(actor, 'customer-lookup:view') ? (
      <Link className="btn btn--secondary" href="/crm/lookup">
        {t('crm.lookup.title')}
      </Link>
    ) : undefined,
  };
  const res = await load(async () => {
    const scope = resolveWorkingScope(actor, 'vehicle:view');
    const page = await listVehicles(crm, actor, {
      limit: 25,
      ...(q ? { q } : {}),
      ...(cursor ? { cursor } : {}),
    });
    const branches = await crm.sys.branches.list(scope);
    return { page, branches, scope };
  });
  if (res.error)
    return (
      <CrmPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </CrmPage>
    );
  const { page, branches, scope } = res.data;
  return (
    <CrmPage {...head}>
      <ScopeLine
        text={t('crm.scopeLine', {
          scope:
            scope.kind === 'all' ? t('shell.scopeAll') : branches.map((b) => b.name).join(', '),
        })}
      />
      <FilterBar
        action="/crm/vehicles"
        actions={
          <>
            <Link className="btn btn--ghost" href="/crm/vehicles">
              {t('crm.reset')}
            </Link>
            <Button type="submit" variant="primary">
              {t('crm.apply')}
            </Button>
          </>
        }
      >
        <SearchField
          id="q"
          name="q"
          label={t('crm.vehicles.search')}
          placeholder={t('crm.vehicles.searchPlaceholder')}
          defaultValue={q}
        />
      </FilterBar>
      {page.items.length === 0 ? (
        <EmptyState
          title={q ? t('crm.vehicles.filteredTitle') : t('crm.vehicles.emptyTitle')}
          text={q ? t('crm.vehicles.filteredText') : t('crm.vehicles.emptyText')}
        />
      ) : (
        <DataTable
          caption={t('crm.vehicles.title')}
          rows={page.items}
          rowKey={(v) => v.id}
          columns={[
            {
              key: 'plate',
              header: t('crm.vehicles.plate'),
              render: (v) => (
                <Link
                  className="plate-tag"
                  href={`/crm/vehicles/${encodeURIComponent(v.id)}`}
                  data-testid="vehicle-plate"
                >
                  {v.plate}
                </Link>
              ),
            },
            {
              key: 'model',
              header: t('crm.vehicles.model'),
              render: (v) => `${v.make} ${v.model}`,
            },
            { key: 'year', header: t('crm.vehicles.year'), numeric: true, render: (v) => v.year },
            {
              key: 'owner',
              header: t('crm.vehicles.owner'),
              render: (v) =>
                v.owner ? (
                  <Link href={`/crm/customers/${encodeURIComponent(v.owner.id)}`}>
                    {v.owner.name}
                  </Link>
                ) : (
                  '—'
                ),
            },
            {
              key: 'km',
              header: t('crm.vehicles.lastKm'),
              numeric: true,
              render: (v) => (v.lastKm !== null ? v.lastKm.toLocaleString('vi-VN') : '—'),
            },
          ]}
        />
      )}
      <Pager
        base="/crm/vehicles"
        query={q ? { q } : {}}
        {...(cursor ? { cursor } : {})}
        next={page.nextCursor}
        labels={{ prev: t('crm.prev'), next: t('crm.next'), aria: t('common.pagination') }}
      />
    </CrmPage>
  );
}
