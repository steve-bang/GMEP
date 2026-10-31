'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button } from '@/ui/components/Button';
import { Icon } from '@/ui/components/Icon';

/** G1-AUT-01. Posts to our API only; the browser never contacts Firebase. */
export function LoginForm() {
  const t = useTranslations('login');
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

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
      } | null;
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
          </div>
        </div>
      ) : null}
      <fieldset className="g1-fs" disabled={loading}>
        <legend className="sr-only">{t('title')}</legend>
        <div className="field">
          <label className="field__label" htmlFor="identifier">
            {t('identifier')}
            <span className="field__req" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="identifier"
            name="identifier"
            className="input"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            aria-required="true"
            aria-invalid={fieldErrors.identifier ? true : undefined}
            aria-describedby={fieldErrors.identifier ? 'identifier-err' : undefined}
          />
          {fieldErrors.identifier ? (
            <span className="field__error" id="identifier-err">
              {fieldErrors.identifier}
            </span>
          ) : null}
        </div>
        <div className="field">
          <label className="field__label" htmlFor="password">
            {t('password')}
            <span className="field__req" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className="input"
            autoComplete="current-password"
            aria-required="true"
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={fieldErrors.password ? 'password-err' : undefined}
          />
          {fieldErrors.password ? (
            <span className="field__error" id="password-err">
              {fieldErrors.password}
            </span>
          ) : null}
        </div>
      </fieldset>
      <Button type="submit" variant="primary" size="lg" block loading={loading}>
        {t('submit')}
      </Button>
    </form>
  );
}
