import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { hasPermission, resolveWorkingScope } from '@/platform/rbac/rbac';
import { listWarehouses } from '@/modules/sys';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { FilterBar, SearchField } from '@/ui/components/FilterBar';
import { Button } from '@/ui/components/Button';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { EmptyState } from '@/ui/components/States';
import { SettingsPage } from '../SettingsPage';
import { ErrorFor, first, Pager, ScopeLine, type SearchParams } from '@/ui/components/PageParts';

export const dynamic = 'force-dynamic';

/** FR-SYS-005 list, rendered on the server through the application layer (same Scope enforcement as the API). */
export default async function WarehousesPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const sp = await searchParams;
  const q = first(sp.q);
  const cursor = first(sp.cursor);
  const deps = getContainer().sys;
  const { actor } = await requireSession();

  const canCreate = hasPermission(actor, 'warehouse:create');
  const head = {
    current: 'warehouses',
    title: t('warehouses.title'),
    desc: t('warehouses.lead'),
    actions: canCreate ? (
      <Link className="btn btn--primary" href="/sys/warehouses/new">
        {t('warehouses.create')}
      </Link>
    ) : undefined,
  };

  const res = await load(async () => {
    const scope = resolveWorkingScope(actor, 'warehouse:view');
    const page = await listWarehouses(deps, actor, {
      ...(q ? { q } : {}),
      ...(cursor ? { cursor } : {}),
      limit: 25,
    });
    const branches = await deps.branches.list(scope);
    return { page, branches, scope };
  });
  if (res.error)
    return (
      <SettingsPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </SettingsPage>
    );
  const { page, branches, scope } = res.data;
  const branchNames = new Map(branches.map((b) => [b.id, b.name]));

  return (
    <SettingsPage {...head}>
      <ScopeLine
        text={t('warehouses.scopeLine', {
          scope:
            scope.kind === 'all' ? t('shell.scopeAll') : branches.map((b) => b.name).join(', '),
        })}
      />
      <FilterBar
        action="/sys/warehouses"
        actions={
          <>
            <Link className="btn btn--ghost" href="/sys/warehouses">
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
          placeholder={t('warehouses.searchPlaceholder')}
          defaultValue={q}
        />
      </FilterBar>
      {page.items.length === 0 ? (
        <EmptyState title={t('warehouses.emptyTitle')} text={t('warehouses.emptyText')} />
      ) : (
        <DataTable
          caption={t('warehouses.title')}
          rows={page.items}
          rowKey={(w) => w.id}
          columns={[
            {
              key: 'code',
              header: t('warehouses.colCode'),
              render: (w) => (
                <Link href={`/sys/warehouses/${encodeURIComponent(w.id)}`} data-testid="wh-code">
                  {w.code}
                </Link>
              ),
            },
            { key: 'name', header: t('warehouses.colName'), render: (w) => w.name },
            {
              key: 'branch',
              header: t('warehouses.colBranch'),
              render: (w) => branchNames.get(w.branchId) ?? w.branchId,
            },
            {
              key: 'status',
              header: t('warehouses.colStatus'),
              render: (w) => (
                <StatusBadge tone={w.status === 'active' ? 'success' : 'neutral'}>
                  {t(`warehouses.${w.status}`)}
                </StatusBadge>
              ),
            },
          ]}
        />
      )}
      <Pager
        base="/sys/warehouses"
        query={q ? { q } : {}}
        {...(cursor ? { cursor } : {})}
        next={page.nextCursor}
        labels={{
          prev: t('warehouses.prev'),
          next: t('warehouses.next'),
          aria: t('common.pagination'),
        }}
      />
    </SettingsPage>
  );
}
