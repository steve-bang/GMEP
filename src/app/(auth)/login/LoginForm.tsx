'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import {
  formatMmSs,
  retryAfter,
  useCountdown,
  type RetryAfter,
} from '@/ui/components/ResourceForm';
import { Button } from '@/ui/components/Button';
import { Icon } from '@/ui/components/Icon';

/** G1-AUT-01. Posts to our API only; the browser never contacts Firebase. */
export function LoginForm() {
  const t = useTranslations('login');
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState<RetryAfter | null>(null);
  const left = useCountdown(retry);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const identifier = String(form.get('identifier') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const fe = {
      ...(identifier ? {} : { identifier: t('identifierRequired') }),
      ...(password ? {} : { password: t('passwordRequired') }),
    };
    setFieldErrors(fe);
    if (Object.keys(fe).length) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      if (res.ok) {
        // Full navigation on purpose: the session cookie changed, so the server layout must re-render.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign('/');
        return;
      }
      const problem = (await res.json().catch(() => null)) as {
        title?: string;
        detail?: string;
        retryAfterSeconds?: number;
      } | null;
      // 429 / lockout: the wait comes from the server (Retry-After), identical for every account
      if (res.status === 429) setRetry(retryAfter(problem?.retryAfterSeconds ?? 30));
      setError({ title: problem?.title ?? '', detail: problem?.detail ?? '' });
    } catch {
      setError({ title: '', detail: t('offline') });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="g1-form" onSubmit={onSubmit} noValidate>
      {error ? (
        <div className="alert alert--danger" role="alert">
          <Icon name="alert-triangle" />
          <div className="alert__body">
            {error.title ? <span className="alert__title">{error.title}</span> : null}
            <span>{error.detail}</span>
            {left > 0 ? (
              <span data-testid="login-wait">{t('wait', { time: formatMmSs(left) })}</span>
            ) : null}
          </div>
        </div>
      ) : null}
      <fieldset className="g1-fs" disabled={loading}>
        <legend className="sr-only">{t('title')}</legend>
        <div className="field">
          <label className="field__label" htmlFor="login-identifier">
            {t('identifier')}
            <span className="field__req" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="login-identifier"
            name="identifier"
            className="input"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            aria-required="true"
            aria-invalid={fieldErrors.identifier ? true : undefined}
            aria-describedby={fieldErrors.identifier ? 'login-identifier-err' : undefined}
          />
          {fieldErrors.identifier ? (
            <span className="field__error" id="login-identifier-err">
              {fieldErrors.identifier}
            </span>
          ) : null}
        </div>
        <div className="field">
          <label className="field__label" htmlFor="login-password">
            {t('password')}
            <span className="field__req" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            className="input"
            autoComplete="current-password"
            aria-required="true"
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={fieldErrors.password ? 'login-password-err' : undefined}
          />
          {fieldErrors.password ? (
            <span className="field__error" id="login-password-err">
              {fieldErrors.password}
            </span>
          ) : null}
        </div>
      </fieldset>
      <Button
        type="submit"
        variant="primary"
        size="lg"
        block
        loading={loading}
        disabled={left > 0}
        aria-disabled={left > 0}
      >
        {t('submit')}
      </Button>
    </form>
  );
}
