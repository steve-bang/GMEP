import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { safeNext } from '@/platform/http/safeNext';
import { SESSION_COOKIE } from '@/platform/http/cookies';
import { getContainer } from '@/composition/container';
import { AuthLayout } from '@/ui/components/AuthLayout';
import { ChangePasswordForm } from './ChangePasswordForm';

export const dynamic = 'force-dynamic';

/**
 * P2-C: forced password change after a sign-in with a temporary password (staff without email). Minimal functional
 * version built from the existing auth classes; the designed screen is pending (designer).
 */
export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const t = await getTranslations();
  const next = safeNext((await searchParams).next);
  if (!(await cookies()).get(SESSION_COOKIE)?.value) redirect('/login');
  const { consentPolicyVersion } = getContainer().sys.config;
  return (
    <AuthLayout
      brand={t('app.name')}
      skip={t('shell.skip')}
      title={t('login.change.title')}
      lead={t('login.change.lead')}
      footer={`${t('app.name')} · ${t('app.support')}`}
    >
      <ChangePasswordForm next={next} policyVersion={consentPolicyVersion} />
    </AuthLayout>
  );
}
