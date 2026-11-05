import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { requireSession } from '@/composition/session';
import { first, type SearchParams } from '@/ui/components/PageParts';
import { DashboardHome, DashboardSkeleton } from './DashboardHome';

export const dynamic = 'force-dynamic';

/** Home dashboard (G1-DSH, FR-RPT-001): header at once, the figures stream in behind a skeleton. */
export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations('dashboard');
  const session = await requireSession();
  const sp = await searchParams;
  const date = first(sp.date);
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
        <DashboardHome session={session} date={date} branchId={branchId} />
      </Suspense>
    </div>
  );
}
