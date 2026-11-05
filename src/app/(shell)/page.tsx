import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { hasPermission } from '@/platform/rbac/rbac';
import { requireSession } from '@/composition/session';
import { first, type SearchParams } from '@/ui/components/PageParts';
import { DashboardHome, DashboardSkeleton } from './DashboardHome';

export const dynamic = 'force-dynamic';

/** Home dashboard (G1-DSH, FR-RPT-001): header at once, the figures stream in behind a skeleton. */
export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations('dashboard');
  const session = await requireSession();
  // G1-DSH-07: a role with no overview but with its own repair work (the technician) lands on "Việc của tôi"
  if (
    !hasPermission(session.actor, 'report-dashboard:view') &&
    hasPermission(session.actor, 'repair-item:view')
  )
    redirect('/rec/work');
  const sp = await searchParams;
  const date = first(sp.date);
  const from = first(sp.from);
  const to = first(sp.to);
  const branchId = first(sp.branchId);
  return (
    <div className="stack">
      <div className="page-header">
        <div className="page-header__text">
          <h1>{t('title')}</h1>
          <p className="text-secondary">{t('lead')}</p>
        </div>
      </div>
      <Suspense fallback={<DashboardSkeleton label={t('loading')} />}>
        <DashboardHome session={session} date={date} from={from} to={to} branchId={branchId} />
      </Suspense>
    </div>
  );
}
