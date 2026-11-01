import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { headers } from 'next/headers';
import { clientAddressFromHeaders } from '@/composition/api';
import { peekToken } from '@/modules/sys';
import { getContainer } from '@/composition/container';
import { AuthLayout } from '@/ui/components/AuthLayout';
import { PasswordSetForm } from '../PasswordSetForm';

export const dynamic = 'force-dynamic';

/** G5-AUT-03: activation from a 72 h invitation. Name, branch and role are read-only facts set by the inviter. */
export default async function ActivatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const t = await getTranslations();
  const token = (await searchParams).token ?? '';
  const deps = getContainer().sys;
  const address = clientAddressFromHeaders(await headers());
  const limited = await deps.limiter.hit('token', address).then(
    () => false,
    () => true,
  );
  const peek = limited ? { state: 'invalid' as const } : await peekToken(deps, 'invite', token);
  const footer = `${t('app.name')} · ${t('app.support')}`;
  if (peek.state !== 'valid' || !('invitee' in peek) || !peek.invitee) {
    const key = limited
      ? 'rateLimited'
      : peek.state === 'used'
        ? 'used'
        : peek.state === 'revoked'
          ? 'revoked'
          : 'expired';
    return (
      <AuthLayout
        brand={t('app.name')}
        skip={t('shell.skip')}
        title={t(`activate.${key}.title`)}
        footer={footer}
      >
        <p className="text-secondary">{t(`activate.${key}.text`)}</p>
        <Link className="btn btn--primary" href="/login">
          {t('forgot.back')}
        </Link>
      </AuthLayout>
    );
  }
  const inv = peek.invitee;
  return (
    <AuthLayout
      brand={t('app.name')}
      skip={t('shell.skip')}
      title={t('activate.title')}
      lead={t('activate.lead')}
      footer={footer}
      wide
    >
      <dl className="stack" data-testid="invitee">
        <div>
          <dt className="text-secondary">{t('users.colName')}</dt>
          <dd>{inv.displayName}</dd>
        </div>
        <div>
          <dt className="text-secondary">{t('users.colEmail')}</dt>
          <dd>{inv.email}</dd>
        </div>
        <div>
          <dt className="text-secondary">{t('users.branch')}</dt>
          <dd>{inv.branches.join(', ')}</dd>
        </div>
        <div>
          <dt className="text-secondary">{t('users.role')}</dt>
          <dd>{inv.roles.join(', ')}</dd>
        </div>
      </dl>
      <p className="text-secondary">{t('activate.readonlyNote')}</p>
      <PasswordSetForm
        mode="activate"
        token={token}
        minLength={deps.config.passwordPolicy.minLength}
        historyDepth={deps.config.passwordPolicy.historyDepth}
        labels={{
          password: t('reset.password'),
          confirm: t('reset.confirm'),
          submit: t('activate.submit'),
          ruleLength: t('reset.ruleLength', { min: deps.config.passwordPolicy.minLength }),
          ruleHistory: '',
          mismatch: t('reset.mismatch'),
          capsLock: t('login.capsLock'),
          show: t('login.showPassword'),
          doneTitle: t('activate.doneTitle'),
          doneText: t('activate.doneText'),
          toLogin: t('activate.toLogin'),
          offline: t('login.offline'),
          wait: t('forgot.wait'),
          unexpected: t('common.unexpected'),
          consent: t('activate.consent', { version: deps.config.consentPolicyVersion }),
          consentLink: t('activate.consentLink'),
        }}
      />
    </AuthLayout>
  );
}
