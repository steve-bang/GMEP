import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { formatDate } from '@/platform/format/date';
import { hasPermission, resolveWorkingScope } from '@/platform/rbac/rbac';
import { listCustomerDtos } from '@/modules/crm';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { Button } from '@/ui/components/Button';
import { DataTable } from '@/ui/components/DataTable';
import { FilterBar, SearchField } from '@/ui/components/FilterBar';
import { ErrorFor, first, Pager, ScopeLine, type SearchParams } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { CrmPage } from '../CrmPage';

export const dynamic = 'force-dynamic';

/** G2-CRM-01 / FR-CRM-001, 002: customers inside the working scope; search by name, phone or plate. */
export default async function CustomersPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const sp = await searchParams;
  const q = first(sp.q);
  const type = first(sp.type);
  const cursor = first(sp.cursor);
  const { actor } = await requireSession();
  const crm = getContainer().crm;

  const head = {
    title: t('crm.customers.title'),
    desc: t('crm.customers.lead'),
    actions: (
      <>
        {hasPermission(actor, 'customer-lookup:view') ? (
          <Link className="btn btn--secondary" href="/crm/lookup">
            {t('crm.lookup.title')}
          </Link>
        ) : null}
        {hasPermission(actor, 'customer:export') ? (
          <Link className="btn btn--secondary" href="/crm/export">
            {t('crm.export.open')}
          </Link>
        ) : null}
        {hasPermission(actor, 'customer:create') ? (
          <Link className="btn btn--primary" href="/crm/customers/new">
            {t('crm.customers.create')}
          </Link>
        ) : null}
      </>
    ),
  };
  const res = await load(async () => {
    const scope = resolveWorkingScope(actor, 'customer:view');
    const page = await listCustomerDtos(crm, actor, {
      limit: 25,
      ...(q ? { q } : {}),
      ...(type ? { type } : {}),
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
  const query = { ...(q ? { q } : {}), ...(type ? { type } : {}) };
  return (
    <CrmPage {...head}>
      <ScopeLine
        text={t('crm.scopeLine', {
          scope:
            scope.kind === 'all' ? t('shell.scopeAll') : branches.map((b) => b.name).join(', '),
        })}
      />
      <FilterBar
        action="/crm/customers"
        actions={
          <>
            <Link className="btn btn--ghost" href="/crm/customers">
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
          label={t('crm.customers.search')}
          placeholder={t('crm.customers.searchPlaceholder')}
          defaultValue={q}
        />
        <div className="field">
          <label className="field__label" htmlFor="type">
            {t('crm.customers.type')}
          </label>
          <select className="select" id="type" name="type" defaultValue={type ?? ''}>
            <option value="">{t('common.all')}</option>
            <option value="individual">{t('crm.type.individual')}</option>
            <option value="business">{t('crm.type.business')}</option>
          </select>
        </div>
      </FilterBar>
      {page.items.length === 0 ? (
        <EmptyState
          title={q ? t('crm.customers.filteredTitle') : t('crm.customers.emptyTitle')}
          text={q ? t('crm.customers.filteredText') : t('crm.customers.emptyText')}
        />
      ) : (
        <DataTable
          caption={t('crm.customers.title')}
          rows={page.items}
          rowKey={(c) => c.id}
          columns={[
            {
              key: 'name',
              header: t('crm.customers.colName'),
              render: (c) => (
                <Link
                  href={`/crm/customers/${encodeURIComponent(c.id)}`}
                  data-testid="customer-name"
                >
                  {c.name}
                </Link>
              ),
            },
            { key: 'code', header: t('crm.customers.colCode'), render: (c) => c.code },
            {
              key: 'type',
              header: t('crm.customers.type'),
              render: (c) => t(`crm.type.${c.type}`),
            },
            {
              key: 'phone',
              header: t('crm.customers.phone'),
              render: (c) => <span data-testid="customer-phone">{c.phone.value ?? '—'}</span>,
            },
            {
              key: 'veh',
              header: t('crm.customers.vehicles'),
              numeric: true,
              render: (c) => c.vehicleCount,
            },
            {
              key: 'status',
              header: t('crm.customers.colStatus'),
              render: (c) => (
                <StatusBadge tone={c.status === 'active' ? 'success' : 'neutral'}>
                  {t(`crm.customerStatus.${c.status}`)}
                </StatusBadge>
              ),
            },
            {
              key: 'created',
              header: t('crm.customers.created'),
              render: (c) => formatDate(new Date(c.createdAt)),
            },
          ]}
        />
      )}
      {page.capped ? (
        <p className="text-secondary" data-testid="search-capped">
          {t('crm.searchCapped', { count: page.items.length })}
        </p>
      ) : null}
      <Pager
        base="/crm/customers"
        query={query}
        {...(cursor ? { cursor } : {})}
        next={page.nextCursor}
        labels={{ prev: t('crm.prev'), next: t('crm.next'), aria: t('common.pagination') }}
      />
    </CrmPage>
  );
}
