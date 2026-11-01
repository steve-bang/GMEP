import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/platform/http/cookies';
import { resolveSession } from '@/modules/sys';
import { getContainer } from '@/composition/container';
import { AuthLayout } from '@/ui/components/AuthLayout';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const t = await getTranslations();
  const sp = await searchParams;
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (cookie) {
    const ok = await resolveSession(getContainer().sys, cookie).then(
      () => true,
      () => false,
    );
    if (ok) redirect('/');
  }
  return (
    <AuthLayout
      brand={t('app.name')}
      skip={t('shell.skip')}
      title={t('login.title')}
      lead={t('login.lead')}
      footer={`${t('app.name')} · ${t('app.support')}`}
    >
      {sp.expired ? (
        <div className="alert alert--info" role="status">
          <div className="alert__body">
            <span className="alert__title">{t('login.expiredTitle')}</span>
            <span>{t('login.expiredText')}</span>
          </div>
        </div>
      ) : null}
      <LoginForm />
      <div className="g1-auth-links">
        <Link href="/forgot-password">{t('login.forgot')}</Link>
      </div>
    </AuthLayout>
  );
}
