import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { AppError } from '@/platform/errors/errors';
import { getShellInfo, listWarehouses } from '@/modules/sys';
import { resolveScope } from '@/platform/rbac/rbac';
import { scopeAllows } from '@/platform/scope/scope';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { FilterBar, SearchField } from '@/ui/components/FilterBar';
import { Button } from '@/ui/components/Button';
import { Icon } from '@/ui/components/Icon';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { EmptyState, ErrorState, NoPermissionState } from '@/ui/components/States';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** FR-SYS-005 list, rendered on the server through the application layer (same Scope enforcement as the API). */
export default async function WarehousesPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const sp = await searchParams;
  const q = first(sp.q);
  const cursor = first(sp.cursor);
  const deps = getContainer().sys;
  const session = await requireSession();
  const info = await getShellInfo(deps, session.actor);

  const header = (
    <div className="page-header">
      <div className="page-header__text">
        <h1>{t('warehouses.title')}</h1>
      </div>
    </div>
  );

  if (!info.canViewWarehouses) {
    return (
      <>
        {header}
        <NoPermissionState
          title={t('states.noPermissionTitle')}
          text={t('states.noPermissionText')}
        />
      </>
    );
  }

  let page;
  try {
    page = await listWarehouses(deps, session.actor, {
      ...(q ? { q } : {}),
      ...(cursor ? { cursor } : {}),
      limit: 25,
    });
  } catch (err) {
    if (err instanceof AppError && err.status === 400) {
      return (
        <>
          {header}
          <ErrorState
            title={err.title}
            text={err.detail}
            actions={
              <Link className="btn btn--secondary" href="/sys/warehouses">
                {t('states.retry')}
              </Link>
            }
          />
        </>
      );
    }
    throw err;
  }
  // label the scope by the branches this PERMISSION covers (not every assignment of the user)
  const viewScope = resolveScope(session.actor, 'warehouse:view');
  const visibleBranches = info.branches.filter((b) =>
    scopeAllows(viewScope, session.actor.companyId, b.id),
  );
  const branchNames = new Map(visibleBranches.map((b) => [b.id, b.name]));

  return (
    <>
      {header}
      <div className="scope-line">
        <Icon name="map-pin" size="sm" />
        <span>
          {t('warehouses.scopeLine', {
            scope:
              viewScope.kind === 'all'
                ? t('shell.scopeAll')
                : visibleBranches.map((b) => b.name).join(', '),
          })}
        </span>
      </div>
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
              render: (w) => <span data-testid="wh-code">{w.code}</span>,
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
      {cursor || page.nextCursor ? (
        <nav className="pagination" aria-label="Phân trang">
          {cursor ? (
            <Link
              className="pagination__item"
              href={{ pathname: '/sys/warehouses', query: q ? { q } : {} }}
            >
              {t('warehouses.prev')}
            </Link>
          ) : null}
          {page.nextCursor ? (
            <Link
              className="pagination__item"
              rel="next"
              href={{
                pathname: '/sys/warehouses',
                query: { ...(q ? { q } : {}), cursor: page.nextCursor },
              }}
            >
              {t('warehouses.next')}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
