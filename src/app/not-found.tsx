import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { EmptyState } from '@/ui/components/States';

/** 404 (state-copy §2.3): the same page for a missing route and for anything the user may not see. */
export default async function NotFound() {
  const t = await getTranslations();
  return (
    <main className="main" id="main">
      <div className="main__inner">
        <EmptyState
          title={t('states.notFoundTitle')}
          text={t('states.notFoundText')}
          actions={
            <Link className="btn btn--primary" href="/">
              {t('states.home')}
            </Link>
          }
        />
      </div>
    </main>
  );
}
