import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { clientAddressFromHeaders } from '@/composition/api';
import { peekToken } from '@/modules/sys';
import { getContainer } from '@/composition/container';
import { AuthLayout } from '@/ui/components/AuthLayout';
import { PasswordSetForm } from '../PasswordSetForm';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

/** G5-AUT-02: set a new password from a single-use link (30 min). Expired / used / revoked links get their own states. */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const t = await getTranslations();
  const token = (await searchParams).token ?? '';
  const deps = getContainer().sys;
  // viewing a link is limited per address too (token guessing)
  const address = clientAddressFromHeaders(await headers());
  const limited = await deps.limiter.hit('token', address).then(
    () => false,
    () => true,
  );
  const peek = limited ? { state: 'invalid' as const } : await peekToken(deps, 'reset', token);
  const footer = `${t('app.name')} · ${t('app.version')}`;
  if (peek.state !== 'valid') {
    const key = limited
      ? 'rateLimited'
      : peek.state === 'invalid' || peek.state === 'revoked'
        ? 'expired'
        : peek.state;
    return (
      <AuthLayout
        brand={t('app.name')}
        skip={t('shell.skip')}
        title={t(`reset.${key}.title`)}
        footer={footer}
      >
        <p className="text-secondary">{t(`reset.${key}.text`)}</p>
        <div className="g5-actions">
          <Link className="btn btn--primary" href="/forgot-password">
            {t('reset.requestNew')}
          </Link>
          <Link className="btn btn--ghost" href="/login">
            {t('forgot.back')}
          </Link>
        </div>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout
      brand={t('app.name')}
      skip={t('shell.skip')}
      title={t('reset.title')}
      lead={t('reset.lead')}
      footer={footer}
    >
      <PasswordSetForm
        mode="reset"
        token={token}
        minLength={deps.config.passwordPolicy.minLength}
        historyDepth={deps.config.passwordPolicy.historyDepth}
        labels={{
          password: t('reset.password'),
          confirm: t('reset.confirm'),
          submit: t('reset.submit'),
          ruleLength: t('reset.ruleLength', { min: deps.config.passwordPolicy.minLength }),
          ruleHistory: t('reset.ruleHistory', { n: deps.config.passwordPolicy.historyDepth }),
          mismatch: t('reset.mismatch'),
          capsLock: t('login.capsLock'),
          show: t('login.showPassword'),
          doneTitle: t('reset.doneTitle'),
          doneText: t('reset.doneText'),
          toLogin: t('forgot.back'),
          offline: t('login.offline'),
          wait: t('forgot.wait'),
          unexpected: t('common.unexpected'),
          consent: '',
          consentLink: '',
        }}
      />
    </AuthLayout>
  );
}
