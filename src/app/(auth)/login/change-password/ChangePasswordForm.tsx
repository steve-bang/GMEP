'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/ui/components/Button';
import { Icon } from '@/ui/components/Icon';
import { PasswordInput } from '@/ui/components/PasswordInput';
import {
  formatMmSs,
  retryAfter,
  useCountdown,
  type RetryAfter,
} from '@/ui/components/ResourceForm';

type Field = 'currentPassword' | 'newPassword' | 'confirm' | 'consent';

/** P2-C forced change. Passwords live in component state only and go to our API only (never to Firebase). */
export function ChangePasswordForm(props: { next: string; policyVersion: string }) {
  const t = useTranslations('login');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState<RetryAfter | null>(null);
  const left = useCountdown(retry);
  const alertRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) alertRef.current?.focus();
  }, [error]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const currentPassword = String(f.get('currentPassword') ?? '');
    const newPassword = String(f.get('newPassword') ?? '');
    const confirm = String(f.get('confirm') ?? '');
    const consent = f.get('consent') === 'on';
    const fe: Partial<Record<Field, string>> = {};
    if (!currentPassword) fe.currentPassword = t('passwordRequired');
    if (!newPassword) fe.newPassword = t('passwordRequired');
    else if (newPassword !== confirm) fe.confirm = t('change.mismatch');
    if (!consent) fe.consent = t('change.consentRequired');
    setErrors(fe);
    setError(null);
    const first = (Object.keys(fe) as Field[])[0];
    if (first) return document.getElementById(`cp-${first}`)?.focus();
    setBusy(true);
    try {
      const res = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, consent: true }),
      });
      if (res.ok) {
        window.location.assign(props.next); // full navigation: the session cookie changed
        return;
      }
      const p = (await res.json().catch(() => null)) as {
        detail?: string;
        errors?: { field: string; message: string }[];
        retryAfterSeconds?: number;
      } | null;
      if (res.status === 422 && p?.errors?.length) {
        const byField: Partial<Record<Field, string>> = {};
        for (const x of p.errors)
          if (x.field === 'currentPassword' || x.field === 'newPassword')
            byField[x.field] = x.message;
        setErrors(byField);
        const firstField = (Object.keys(byField) as Field[])[0];
        if (firstField) document.getElementById(`cp-${firstField}`)?.focus();
      } else if (res.status === 401 || res.status === 409) {
        setExpired(true);
        setError(t('change.failed'));
      } else {
        if (res.status === 429) setRetry(retryAfter(p?.retryAfterSeconds ?? 30));
        setError(p?.detail ?? t('change.failed'));
      }
    } catch {
      setError(t('offline'));
    } finally {
      setBusy(false);
    }
  }

  const pw = (k: 'currentPassword' | 'newPassword' | 'confirm', label: string, auto: string) => (
    <div className="field">
      <label className="field__label" htmlFor={`cp-${k}`}>
        {label}
        <span className="field__req" aria-hidden="true">
          *
        </span>
      </label>
      <PasswordInput
        id={`cp-${k}`}
        name={k}
        autoComplete={auto}
        showLabel={t('showPassword')}
        capsLockText={t('capsLock')}
        aria-required="true"
        aria-invalid={errors[k] ? true : undefined}
        aria-describedby={errors[k] ? `cp-${k}-err` : undefined}
      />
      {errors[k] ? (
        <span className="field__error" id={`cp-${k}-err`}>
          {errors[k]}
        </span>
      ) : null}
    </div>
  );

  return (
    <form className="g1-form" onSubmit={onSubmit} noValidate>
      {error ? (
        <div className="alert alert--danger" role="alert" tabIndex={-1} ref={alertRef}>
          <Icon name="alert-triangle" />
          <div className="alert__body">
            <span>{error}</span>
            {left > 0 ? <span>{t('wait', { time: formatMmSs(left) })}</span> : null}
            {expired ? <Link href="/login">{t('submit')}</Link> : null}
          </div>
        </div>
      ) : null}
      <fieldset className="g1-fs" disabled={busy}>
        <legend className="sr-only">{t('change.title')}</legend>
        {pw('currentPassword', t('change.current'), 'current-password')}
        {pw('newPassword', t('change.new'), 'new-password')}
        {pw('confirm', t('change.confirm'), 'new-password')}
        <label className={`check${errors.consent ? ' is-error' : ''}`}>
          <input
            id="cp-consent"
            type="checkbox"
            name="consent"
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby={errors.consent ? 'cp-consent-err' : undefined}
          />
          <span className="check__box" aria-hidden="true">
            <Icon name="check" />
          </span>
          <span>{t('change.consent', { version: props.policyVersion })}</span>
        </label>
        {errors.consent ? (
          <span className="field__error" id="cp-consent-err">
            {errors.consent}
          </span>
        ) : null}
      </fieldset>
      <Button type="submit" variant="primary" size="lg" block loading={busy} disabled={left > 0}>
        {t('change.submit')}
      </Button>
    </form>
  );
}
