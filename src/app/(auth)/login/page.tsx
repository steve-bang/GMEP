import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/platform/http/cookies';
import { resolveSession } from '@/modules/sys';
import { getContainer } from '@/composition/container';
import { Icon } from '@/ui/components/Icon';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const t = await getTranslations();
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (cookie) {
    const ok = await resolveSession(getContainer().sys, cookie).then(
      () => true,
      () => false,
    );
    if (ok) redirect('/');
  }
  return (
    <div className="g1-auth-body">
      <a className="skip-link" href="#main">
        {t('shell.skip')}
      </a>
      <div className="g1-auth-brand">
        <span className="g1-auth-brand__logo" aria-hidden="true">
          <Icon name="wrench" />
        </span>
        {t('app.name')}
      </div>
      <div className="g1-wrap">
        <main className="g1-auth-card" id="main" aria-labelledby="t">
          <div>
            <h1 id="t">{t('login.title')}</h1>
            <p className="g1-lead">{t('login.lead')}</p>
          </div>
          <LoginForm />
        </main>
        <footer className="g1-auth-foot">
          <span>
            {t('app.name')} · {t('app.version')}
          </span>
        </footer>
      </div>
    </div>
  );
}
