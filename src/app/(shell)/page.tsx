import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@/ui/components/States';

export default async function DashboardPage() {
  const t = await getTranslations('dashboard');
  return (
    <>
      <div className="page-header">
        <div className="page-header__text">
          <h1>{t('title')}</h1>
        </div>
      </div>
      <EmptyState title={t('emptyTitle')} text={t('emptyText')} />
    </>
  );
}
