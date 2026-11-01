import { getTranslations } from 'next-intl/server';
import { AuthLayout } from '@/ui/components/AuthLayout';
import { ForgotForm } from './ForgotForm';

export const dynamic = 'force-dynamic';

/** G5-AUT-01: request a reset link. The answer is the same whether or not the account exists. */
export default async function ForgotPasswordPage() {
  const t = await getTranslations();
  return (
    <AuthLayout
      brand={t('app.name')}
      skip={t('shell.skip')}
      title={t('forgot.title')}
      lead={t('forgot.lead')}
      footer={`${t('app.name')} · ${t('app.version')}`}
    >
      <ForgotForm
        labels={{
          identifier: t('login.identifier'),
          submit: t('forgot.submit'),
          back: t('forgot.back'),
          sentTitle: t('forgot.sentTitle'),
          sentText: t('forgot.sentText'),
          required: t('login.identifierRequired'),
          offline: t('login.offline'),
          wait: t('forgot.wait'),
          unexpected: t('common.unexpected'),
        }}
      />
    </AuthLayout>
  );
}
