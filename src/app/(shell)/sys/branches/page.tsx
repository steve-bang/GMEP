import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { hasPermission } from '@/platform/rbac/rbac';
import { listBranches } from '@/modules/sys';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { EmptyState } from '@/ui/components/States';
import { SettingsPage } from '../SettingsPage';
import { ErrorFor } from '@/ui/components/PageParts';

export const dynamic = 'force-dynamic';

const TONE = { active: 'success', closing: 'warning', locked: 'danger' } as const;

/** FR-SYS-005/011/018: organisation structure, branch state visible at a glance. */
export default async function BranchesPage() {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const res = await load(() => listBranches(getContainer().sys, actor));
  const head = {
    current: 'branches',
    code: 'G4-SYS-05',
    title: t('branches.title'),
    desc: t('branches.lead'),
    actions: hasPermission(actor, 'org:create') ? (
      <Link className="btn btn--primary" href="/sys/branches/new">
        {t('branches.create')}
      </Link>
    ) : undefined,
  };
  if (res.error)
    return (
      <SettingsPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </SettingsPage>
    );
  return (
    <SettingsPage {...head}>
      {res.data.length === 0 ? (
        <EmptyState title={t('branches.emptyTitle')} text={t('branches.emptyText')} />
      ) : (
        <DataTable
          caption={t('branches.title')}
          rows={res.data}
          rowKey={(b) => b.id}
          columns={[
            {
              key: 'code',
              header: t('branches.colCode'),
              render: (b) => <Link href={`/sys/branches/${b.id}`}>{b.code}</Link>,
            },
            { key: 'name', header: t('branches.colName'), render: (b) => b.name },
            {
              key: 'status',
              header: t('branches.colStatus'),
              render: (b) => (
                <StatusBadge tone={TONE[b.status as keyof typeof TONE]}>
                  {t(`scope.status.${b.status}`)}
                </StatusBadge>
              ),
            },
          ]}
        />
      )}
    </SettingsPage>
  );
}
