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

interface Labels {
  password: string;
  confirm: string;
  submit: string;
  ruleLength: string;
  ruleHistory: string;
  mismatch: string;
  capsLock: string;
  show: string;
  doneTitle: string;
  doneText: string;
  toLogin: string;
  offline: string;
  wait: string;
  unexpected: string;
  consent: string;
  consentLink: string;
}

/**
 * G5-AUT-02 (reset) and G5-AUT-03 (activate). Only the two documented password rules exist
 * (length, not one of the last N); the server is the authority and returns field errors.
 * The password is kept in component state only, never persisted (state-copy principle 6).
 */
export function PasswordSetForm(props: {
  mode: 'reset' | 'activate';
  token: string;
  minLength: number;
  historyDepth: number;
  labels: Labels;
}) {
  const L = props.labels;
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<RetryAfter | null>(null);
  const left = useCountdown(retry);
  const [key] = useState(newKey);

  const lengthOk = [...pw].length >= props.minLength;
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldError(null);
    if (pw !== pw2) return setFieldError(L.mismatch);
    setBusy(true);
    const r = await postJson(
      props.mode === 'reset' ? '/api/v1/auth/reset-password' : '/api/v1/auth/activate',
      'POST',
      { token: props.token, password: pw, ...(props.mode === 'activate' ? { consent: true } : {}) },
      key,
    );
    setBusy(false);
    if (r.ok) {
      setPw('');
      setPw2('');
      return setDone(true);
    }
    if (r.status === 0) return setError(L.offline);
    if (r.status === 429) setRetry(retryAfter(r.problem?.retryAfterSeconds ?? 60));
    if (r.status === 422 && r.problem?.errors?.length)
      return setFieldError(r.problem.errors[0]!.message);
    if (r.status === 410) return window.location.reload(); // expired/used meanwhile: the server renders the right state
    setError(r.problem?.detail ?? L.unexpected);
  }

  if (done)
    return (
      <div className="stack" data-testid="password-done">
        <div className="alert alert--success" role="status">
          <Icon name="circle-check" />
          <div className="alert__body">
            <span className="alert__title">{L.doneTitle}</span>
            <span>{L.doneText}</span>
          </div>
        </div>
        <Link className="btn btn--primary" href="/login">
          {L.toLogin}
        </Link>
      </div>
    );
  return (
    <form
      className="g1-form"
      onSubmit={onSubmit}
      noValidate
      data-gm-draft={pw || pw2 ? 'true' : undefined}
    >
      {error ? (
        <div className="alert alert--danger" role="alert">
          <Icon name="alert-triangle" />
          <div className="alert__body">
            <span>{error}</span>
            {left > 0 ? <span>{L.wait.replace('{time}', formatMmSs(left))}</span> : null}
          </div>
        </div>
      ) : null}
      <fieldset className="g1-fs" disabled={busy}>
        <div className="field">
          <label className="field__label" htmlFor="pw">
            {L.password}
            <span className="field__req" aria-hidden="true">
              *
            </span>
          </label>
          <div className="g1-pw">
            <input
              className="input"
              id="pw"
              name="password"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyUp={(e) => setCaps(e.getModifierState('CapsLock'))}
              aria-required="true"
              aria-invalid={fieldError ? true : undefined}
              aria-describedby="pw-rules"
            />
            <button
              type="button"
              className="btn-icon g1-pw__toggle"
              aria-label={L.show}
              aria-pressed={show}
              onClick={() => setShow((v) => !v)}
            >
              <Icon name={show ? 'eye-off' : 'eye'} />
            </button>
          </div>
          {caps ? <span className="field__hint">{L.capsLock}</span> : null}
          <ul id="pw-rules" className="g5-contract">
            <li className={lengthOk ? 'g5-field-ok' : ''}>{L.ruleLength}</li>
            {L.ruleHistory ? <li>{L.ruleHistory}</li> : null}
          </ul>
          {fieldError ? (
            <span className="field__error" role="alert">
              {fieldError}
            </span>
          ) : null}
        </div>
        <div className="field">
          <label className="field__label" htmlFor="pw2">
            {L.confirm}
            <span className="field__req" aria-hidden="true">
              *
            </span>
          </label>
          <input
            className="input"
            id="pw2"
            name="confirm"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            aria-required="true"
          />
        </div>
        {props.mode === 'activate' ? (
          <label className="check">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              data-testid="consent"
            />
            <span className="check__box" aria-hidden="true">
              <Icon name="check" size="sm" />
            </span>
            <span>{L.consent}</span>
          </label>
        ) : null}
      </fieldset>
      <Button
        type="submit"
        variant="primary"
        size="lg"
        block
        loading={busy}
        disabled={left > 0 || (props.mode === 'activate' && !consent)}
        aria-disabled={props.mode === 'activate' && !consent}
      >
        {L.submit}
      </Button>
    </form>
  );
}
