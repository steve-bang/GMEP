'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Button } from '@/ui/components/Button';
import { Icon } from '@/ui/components/Icon';
import {
  formatMmSs,
  newKey,
  postJson,
  retryAfter,
  useCountdown,
  type RetryAfter,
} from '@/ui/components/ResourceForm';

export function ForgotForm({
  labels,
}: {
  labels: Record<
    | 'identifier'
    | 'submit'
    | 'back'
    | 'sentTitle'
    | 'sentText'
    | 'required'
    | 'offline'
    | 'wait'
    | 'unexpected',
    string
  >;
}) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<RetryAfter | null>(null);
  const left = useCountdown(retry);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const identifier = String(new FormData(e.currentTarget).get('identifier') ?? '').trim();
    if (!identifier) return setError(labels.required);
    setBusy(true);
    setError(null);
    const r = await postJson('/api/v1/auth/forgot-password', 'POST', { identifier }, newKey());
    setBusy(false);
    if (r.ok) return setSent(true);
    if (r.status === 0) return setError(labels.offline);
    if (r.status === 429) setRetry(retryAfter(r.problem?.retryAfterSeconds ?? 60));
    setError(r.problem?.detail ?? labels.unexpected);
  }

  if (sent)
    return (
      <div className="stack" data-testid="forgot-sent">
        <div className="alert alert--success" role="status">
          <Icon name="circle-check" />
          <div className="alert__body">
            <span className="alert__title">{labels.sentTitle}</span>
            <span>{labels.sentText}</span>
          </div>
        </div>
        <Link className="btn btn--secondary" href="/login">
          {labels.back}
        </Link>
      </div>
    );
  return (
    <form className="g1-form" onSubmit={onSubmit} noValidate>
      {error ? (
        <div className="alert alert--danger" role="alert">
          <Icon name="alert-triangle" />
          <div className="alert__body">
            <span>{error}</span>
            {left > 0 ? <span>{labels.wait.replace('{time}', formatMmSs(left))}</span> : null}
          </div>
        </div>
      ) : null}
      <fieldset className="g1-fs" disabled={busy}>
        <div className="field">
          <label className="field__label" htmlFor="forgot-identifier">
            {labels.identifier}
          </label>
          <input
            className="input"
            id="forgot-identifier"
            name="identifier"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            aria-required="true"
          />
        </div>
      </fieldset>
      <Button type="submit" variant="primary" size="lg" block loading={busy} disabled={left > 0}>
        {labels.submit}
      </Button>
      <div className="g1-auth-links">
        <Link href="/login">{labels.back}</Link>
      </div>
    </form>
  );
}
