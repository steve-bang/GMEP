import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { hasPermission } from '@/platform/rbac/rbac';
import { listUsers } from '@/modules/sys';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { EmptyState } from '@/ui/components/States';
import { ErrorFor, first, PageHeader, Pager, type SearchParams } from '@/ui/components/PageParts';

export const dynamic = 'force-dynamic';

const TONE = { active: 'success', invited: 'info', disabled: 'neutral' } as const;

/** G4-SYS-01: users visible in the working scope; phone masked by PiiPolicy (NFR-SEC-03). */
export default async function UsersPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const cursor = first((await searchParams).cursor);
  const { actor } = await requireSession();
  const res = await load(() =>
    listUsers(getContainer().sys, actor, { limit: 25, ...(cursor ? { cursor } : {}) }),
  );
  const header = (
    <PageHeader
      title={t('users.title')}
      actions={
        hasPermission(actor, 'user:create') ? (
          <Link className="btn btn--primary" href="/sys/users/new">
            {t('users.invite')}
          </Link>
        ) : undefined
      }
    />
  );
  if (res.error)
    return (
      <>
        {header}
        <ErrorFor error={res.error} t={t} />
      </>
    );
  const page = res.data;
  return (
    <>
      {header}
      {page.items.length === 0 ? (
        <EmptyState title={t('users.emptyTitle')} text={t('users.emptyText')} />
      ) : (
        <DataTable
          caption={t('users.title')}
          rows={page.items}
          rowKey={(u) => u.id}
          columns={[
            {
              key: 'code',
              header: t('users.colCode'),
              render: (u) => (
                <Link href={`/sys/users/${u.id}`} data-testid="user-code">
                  {u.employeeCode}
                </Link>
              ),
            },
            { key: 'name', header: t('users.colName'), render: (u) => u.displayName },
            { key: 'email', header: t('users.colEmail'), render: (u) => u.email },
            { key: 'phone', header: t('users.colPhone'), render: (u) => u.phone ?? '—' },
            {
              key: 'status',
              header: t('users.colStatus'),
              render: (u) => (
                <StatusBadge tone={TONE[u.status as keyof typeof TONE]}>
                  {t(`users.status.${u.status}`)}
                </StatusBadge>
              ),
            },
          ]}
        />
      )}
      <Pager
        base="/sys/users"
        query={{}}
        {...(cursor ? { cursor } : {})}
        next={page.nextCursor}
        labels={{
          prev: t('warehouses.prev'),
          next: t('warehouses.next'),
          aria: t('common.pagination'),
        }}
      />
    </>
  );
}
