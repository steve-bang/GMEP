'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  formatMmSs,
  retryAfter,
  useCountdown,
  type RetryAfter,
} from '@/ui/components/ResourceForm';
import { Button } from '@/ui/components/Button';
import { Icon } from '@/ui/components/Icon';
import { PasswordInput } from '@/ui/components/PasswordInput';

type Mode = 'email' | 'employee';
type FieldKey = 'identifier' | 'companyCode' | 'employeeCode' | 'password';

/**
 * G1-AUT-01. Posts to our API only; the browser never contacts Firebase. P2-C: an explicit switch between the email
 * sign-in and the employee-code sign-in (company code + employee code); the kind is never guessed from what is typed.
 * No field is checked against the server before the password is sent (no existence oracle, no autocomplete of codes).
 */
export function LoginForm({ next = '/' }: { next?: string }) {
  const t = useTranslations('login');
  const [mode, setMode] = useState<Mode>('email');
  const [error, setError] = useState<{ title: string; detail: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState<RetryAfter | null>(null);
  const left = useCountdown(retry);
  const alertRef = useRef<HTMLDivElement>(null);
  // server errors: move focus to the alert so screen reader and keyboard users land on it
  useEffect(() => {
    if (error) alertRef.current?.focus();
  }, [error]);

  function switchMode(m: Mode) {
    setMode(m);
    setFieldErrors({});
    setError(null);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const value = (k: FieldKey) => String(form.get(k) ?? '').trim();
    const password = String(form.get('password') ?? '');
    const required: [FieldKey, string][] =
      mode === 'email'
        ? [['identifier', t('identifierRequired')]]
        : [
            ['companyCode', t('companyCodeRequired')],
            ['employeeCode', t('employeeCodeRequired')],
          ];
    const fe: Partial<Record<FieldKey, string>> = {};
    for (const [k, msg] of required) if (!value(k)) fe[k] = msg;
    if (!password) fe.password = t('passwordRequired');
    setFieldErrors(fe);
    const first = (Object.keys(fe) as FieldKey[])[0];
    if (first) {
      // first invalid field gets focus
      document.getElementById(`login-${first}`)?.focus();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const body =
        mode === 'email'
          ? { identifier: value('identifier'), password }
          : { companyCode: value('companyCode'), employeeCode: value('employeeCode'), password };
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const ok = (await res.json().catch(() => null)) as {
          user?: unknown;
          passwordChangeRequired?: boolean;
        } | null;
        // Full navigation on purpose: the session cookie changed, so the server layout must re-render.
        window.location.assign(
          ok?.passwordChangeRequired
            ? `/login/change-password?next=${encodeURIComponent(next)}`
            : ok && ok.user === null
              ? // two or more companies: the session reads nothing until one is chosen (FR-TEN-017)
                `/login/tenant?next=${encodeURIComponent(next)}`
              : next,
        );
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

  const textField = (k: Exclude<FieldKey, 'password'>, label: string, hint?: string) => {
    const err = fieldErrors[k];
    const describedBy = [err ? `login-${k}-err` : '', hint ? `login-${k}-hint` : '']
      .filter(Boolean)
      .join(' ');
    return (
      <div className="field">
        <label className="field__label" htmlFor={`login-${k}`}>
          {label}
          <span className="field__req" aria-hidden="true">
            *
          </span>
        </label>
        <input
          id={`login-${k}`}
          name={k}
          className="input"
          autoComplete={k === 'identifier' || k === 'employeeCode' ? 'username' : 'off'}
          autoCapitalize="none"
          spellCheck={false}
          aria-required="true"
          aria-invalid={err ? true : undefined}
          aria-describedby={describedBy || undefined}
        />
        {hint ? (
          <span className="field__hint" id={`login-${k}-hint`}>
            {hint}
          </span>
        ) : null}
        {err ? (
          <span className="field__error" id={`login-${k}-err`}>
            {err}
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <form className="g1-form" onSubmit={onSubmit} noValidate>
      <div className="segmented" role="group" aria-label={t('modeLabel')}>
        <button
          type="button"
          className="segmented__item"
          aria-pressed={mode === 'email'}
          onClick={() => switchMode('email')}
          data-testid="login-mode-email"
        >
          {t('modeEmail')}
        </button>
        <button
          type="button"
          className="segmented__item"
          aria-pressed={mode === 'employee'}
          onClick={() => switchMode('employee')}
          data-testid="login-mode-employee"
        >
          {t('modeEmployee')}
        </button>
      </div>
      {error ? (
        <div className="alert alert--danger" role="alert" tabIndex={-1} ref={alertRef}>
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
      <fieldset className="g1-fs" disabled={loading} key={mode}>
        <legend className="sr-only">{mode === 'email' ? t('modeEmail') : t('modeEmployee')}</legend>
        {mode === 'email' ? (
          textField('identifier', t('identifier'))
        ) : (
          <>
            {textField('companyCode', t('companyCode'), t('companyCodeHint'))}
            {textField('employeeCode', t('employeeCode'))}
          </>
        )}
        <div className="field">
          <label className="field__label" htmlFor="login-password">
            {t('password')}
            <span className="field__req" aria-hidden="true">
              *
            </span>
          </label>
          <PasswordInput
            id="login-password"
            name="password"
            autoComplete="current-password"
            showLabel={t('showPassword')}
            capsLockText={t('capsLock')}
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
      {mode === 'employee' ? <p className="g1-lead">{t('employeeForgot')}</p> : null}
    </form>
  );
}
