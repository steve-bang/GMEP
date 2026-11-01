import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { hasPermission, resolveScope } from '@/platform/rbac/rbac';
import { formatDateTime } from '@/platform/format/date';
import { ROLE_CODES, ROLE_NAMES, searchUsers, USER_PAGE_SIZE, type UserDto } from '@/modules/sys';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { FilterBar, SearchField } from '@/ui/components/FilterBar';
import { Button } from '@/ui/components/Button';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { EmptyState } from '@/ui/components/States';
import { ErrorFor, first, PageNav, type SearchParams } from '@/ui/components/PageParts';
import { SettingsPage } from '../SettingsPage';

export const dynamic = 'force-dynamic';

const TONE = { active: 'success', invited: 'warning', disabled: 'danger' } as const;
/** role tag colour as in G4-SYS-01: management roles stand out */
const ROLE_TAG: Record<string, string> = {
  CH: 'purple',
  AD: 'purple',
  QV: 'info',
  QL: 'info',
  KT: 'info',
};

const initials = (name: string) => {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? (p.at(-1)?.[0] ?? '') : '')).toUpperCase();
};

/** G4-SYS-01: users visible in the working scope; phone masked by PiiPolicy (NFR-SEC-03). */
export default async function UsersPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const sp = await searchParams;
  const { actor } = await requireSession();
  const deps = getContainer().sys;
  const filters: Record<string, string> = {};
  for (const k of ['q', 'roleCode', 'branchId', 'status'] as const)
    if (first(sp[k])) filters[k] = first(sp[k])!;
  const sort = first(sp.sort) ?? 'lastLogin';
  const dir = first(sp.dir) ?? (sort === 'lastLogin' ? 'desc' : 'asc');
  const page = first(sp.page) ?? '1';
  const res = await load(async () => ({
    list: await searchUsers(deps, actor, { ...filters, sort, dir, page }),
    branches: await deps.branches.list(resolveScope(actor, 'user:view')),
  }));
  const head = {
    current: 'users',
    code: 'G4-SYS-01',
    title: t('users.title'),
    desc: t('users.lead'),
    actions: hasPermission(actor, 'user:create') ? (
      <Link className="btn btn--primary" href="/sys/users/new">
        {t('users.invite')}
      </Link>
    ) : undefined,
  };
  if (res.error)
    return (
      <SettingsPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </SettingsPage>
    );
  const { list, branches } = res.data;
  const branchName = (id: string) =>
    id === '*' ? t('users.allBranches') : (branches.find((b) => b.id === id)?.name ?? id);
  const filtered = Object.keys(filters).length > 0;
  const keep = { ...filters };
  const sortLink = (key: string, defaultDir: 'asc' | 'desc') => {
    const active = sort === key;
    const next = active ? (dir === 'asc' ? 'desc' : 'asc') : defaultDir;
    const qs = new URLSearchParams({ ...keep, sort: key, dir: next }).toString();
    return {
      dir: active ? (dir === 'asc' ? ('asc' as const) : ('desc' as const)) : null,
      href: `/sys/users?${qs}`,
      label: t('users.sortBy', { column: t(`users.sortNames.${key}`) }),
    };
  };
  const sortNote = t('users.sortNote', {
    column: t(`users.sortNames.${sort}`),
    direction: t(
      `users.${sort === 'lastLogin' ? 'dirLast' : 'dir'}.${dir === 'asc' ? 'asc' : 'desc'}`,
    ),
  });
  return (
    <SettingsPage {...head}>
      <FilterBar
        action="/sys/users"
        actions={
          <>
            <Link className="btn btn--ghost" href="/sys/users">
              {t('warehouses.reset')}
            </Link>
            <Button type="submit" variant="primary">
              {t('warehouses.apply')}
            </Button>
          </>
        }
      >
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <SearchField
          id="u-s"
          label={t('users.searchLabel')}
          name="q"
          placeholder={t('users.searchPlaceholder')}
          {...(filters.q ? { defaultValue: filters.q } : {})}
        />
        <div className="field">
          <label className="field__label" htmlFor="u-r">
            {t('users.role')}
          </label>
          <select className="select" id="u-r" name="roleCode" defaultValue={filters.roleCode ?? ''}>
            <option value="">{t('users.allRoles')}</option>
            {ROLE_CODES.map((r) => (
              <option key={r} value={r}>
                {ROLE_NAMES[r]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="u-b">
            {t('users.branch')}
          </label>
          <select className="select" id="u-b" name="branchId" defaultValue={filters.branchId ?? ''}>
            <option value="">{t('users.allBranchesViewable')}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="u-t">
            {t('users.colStatus')}
          </label>
          <select className="select" id="u-t" name="status" defaultValue={filters.status ?? ''}>
            <option value="">{t('common.all')}</option>
            {(['invited', 'active', 'disabled'] as const).map((s) => (
              <option key={s} value={s}>
                {t(`users.status.${s}`)}
              </option>
            ))}
          </select>
        </div>
      </FilterBar>
      {list.total === 0 ? (
        filtered ? (
          <EmptyState
            title={t('users.emptyFilteredTitle')}
            text={t('users.emptyFilteredText')}
            actions={
              <Link className="btn btn--secondary" href="/sys/users">
                {t('warehouses.reset')}
              </Link>
            }
          />
        ) : (
          <EmptyState title={t('users.emptyTitle')} text={t('users.emptyText')} />
        )
      ) : (
        <DataTable
          caption={t('users.title')}
          rows={list.items}
          rowKey={(u: UserDto) => u.id}
          toolbar={
            <>
              <span className="table-meta" data-testid="user-summary">
                {t('users.summary', {
                  total: list.total,
                  invited: list.invited,
                  disabled: list.disabled,
                })}
              </span>
              <span className="table-meta" style={{ marginLeft: 'auto' }}>
                {sortNote}
              </span>
            </>
          }
          footer={
            <span className="table-meta">
              {t('users.showing', {
                from: (list.page - 1) * USER_PAGE_SIZE + 1,
                to: (list.page - 1) * USER_PAGE_SIZE + list.items.length,
                total: list.total,
              })}
            </span>
          }
          columns={[
            {
              key: 'name',
              header: t('users.colName'),
              sort: sortLink('name', 'asc'),
              render: (u) => (
                <div className="row row--nowrap">
                  <span className="avatar avatar--sm" aria-hidden="true">
                    {initials(u.displayName)}
                  </span>
                  <span>
                    {u.displayName}
                    <span className="t-caption text-secondary" style={{ display: 'block' }}>
                      <span data-testid="user-code">{u.employeeCode}</span> · {u.email}
                    </span>
                  </span>
                </div>
              ),
            },
            {
              key: 'roles',
              header: t('users.colRoles'),
              render: (u) =>
                u.assignments?.length ? (
                  <div className="stack-2">
                    {u.assignments.map((a) => (
                      <div key={a.id}>
                        <span className={`tag tag--${ROLE_TAG[a.roleCode] ?? 'neutral'}`}>
                          {ROLE_NAMES[a.roleCode as keyof typeof ROLE_NAMES] ?? a.roleCode}
                        </span>{' '}
                        {branchName(a.branchId)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-secondary">{t('users.noAssignments')}</span>
                ),
            },
            { key: 'phone', header: t('users.colPhone'), render: (u) => u.phone ?? '—' },
            {
              key: 'status',
              header: t('users.colStatus'),
              render: (u) => (
                <span style={{ whiteSpace: 'nowrap' }}>
                  <StatusBadge tone={TONE[u.status as keyof typeof TONE]}>
                    {t(`users.status.${u.status}`)}
                  </StatusBadge>
                </span>
              ),
            },
            {
              key: 'last',
              header: t('users.colLastLogin'),
              sort: sortLink('lastLogin', 'desc'),
              render: (u) =>
                u.lastLoginAt ? (
                  <span className="num" style={{ whiteSpace: 'nowrap' }}>
                    {formatDateTime(new Date(u.lastLoginAt))}
                  </span>
                ) : (
                  <span className="text-secondary">{t('users.neverLoggedIn')}</span>
                ),
            },
            {
              key: 'open',
              header: '',
              render: (u) => (
                <Link
                  className="btn btn--secondary btn--sm"
                  href={`/sys/users/${u.id}`}
                  aria-label={t('users.openUser', { name: u.displayName })}
                >
                  {t('users.open')}
                </Link>
              ),
            },
          ]}
        />
      )}
      <PageNav
        base="/sys/users"
        query={{ ...filters, sort, dir }}
        page={list.page}
        pageCount={list.pageCount}
        labels={{
          prev: t('warehouses.prev'),
          next: t('warehouses.next'),
          aria: t('common.pagination'),
          of: t('users.pageOf', { page: list.page, count: list.pageCount }),
        }}
      />
    </SettingsPage>
  );
}
