'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { useOnline } from '../useOnline';
import { Button } from './Button';
import { newKey, postJson, type Problem } from './postJson';
import { CustomerPicker, type CustomerPickerLabels } from './CustomerPicker';
import { Icon } from './Icon';

export interface FieldDef {
  name: string;
  label: string;
  type?:
    | 'text'
    | 'email'
    | 'number'
    | 'date'
    | 'password'
    | 'select'
    | 'textarea'
    | 'checkbox'
    | 'customer';
  required?: boolean;
  options?: { value: string; label: string }[];
  hint?: string;
  defaultValue?: string;
  placeholder?: string;
  maxLength?: number;
  /** textarea of "Hãng Dòng xe" lines sent as [{make, model}] (serialisable, so server components can pass it) */
  parse?: 'pairs';
  /** an empty value is sent as null (clears the field) instead of being left out */
  emptyAs?: 'null';
  /** `customer` fields: a search box instead of a list (C13); the hidden input carries the id */
  picker?: { labels: CustomerPickerLabels; excludeId?: string; canLookup?: boolean };
}

export { newKey, postJson };
export type { Problem };

/** Countdown for 429 (state-copy §2.6): server-provided seconds, nothing hard-coded. */
export interface RetryAfter {
  seconds: number;
  /** distinguishes two consecutive waits of the same length */
  id: number;
}
export const retryAfter = (seconds: number): RetryAfter => ({ seconds, id: Date.now() });

export function useCountdown(retry: RetryAfter | null): number {
  const [st, setSt] = useState({ src: retry, left: retry?.seconds ?? 0 });
  // adjust state when a new wait arrives (React-sanctioned derived-state pattern)
  if (st.src !== retry) setSt({ src: retry, left: retry?.seconds ?? 0 });
  useEffect(() => {
    if (!retry) return;
    const timer = setInterval(
      () => setSt((s) => ({ ...s, left: s.left > 0 ? s.left - 1 : 0 })),
      1000,
    );
    return () => clearInterval(timer);
  }, [retry]);
  return st.src === retry ? st.left : (retry?.seconds ?? 0);
}

export function formatMmSs(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export interface FormLabels {
  submit: string;
  cancel?: string;
  offline: string;
  /** templates with {count} / {time}: plain strings so they can be passed from server components */
  errorSummary: string;
  rateLimited: string;
  versionConflict: string;
  unexpected: string;
}

/**
 * Generic create/edit form for the SYS pages: validation errors come back from the server (422
 * `errors[]`) and are shown next to the field; typed data is never cleared on failure; the
 * Idempotency-Key is created once per form instance so a double click or retry cannot duplicate.
 */
export function ResourceForm(props: {
  endpoint: string;
  method?: 'POST' | 'PATCH' | 'PUT';
  fields: FieldDef[];
  labels: FormLabels;
  /** static fields merged into the body (e.g. version) */
  extra?: Record<string, unknown>;
  redirectTo?: string;
  cancelHref?: string;
  onDone?: () => void;
  testId?: string;
}) {
  const router = useRouter();
  const uid = useId();
  const [key] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [retry, setRetry] = useState<RetryAfter | null>(null);
  const left = useCountdown(retry);
  const offline = !useOnline();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body: Record<string, unknown> = { ...(props.extra ?? {}) };
    for (const f of props.fields) {
      const raw =
        f.type === 'checkbox'
          ? form.get(f.name) === 'on'
          : f.type === 'password'
            ? String(form.get(f.name) ?? '') // a password is sent exactly as typed
            : String(form.get(f.name) ?? '').trim();
      if (f.type === 'checkbox') body[f.name] = raw;
      else if (f.parse === 'pairs')
        body[f.name] = String(raw)
          .split('\n')
          .map((l) => l.trim().split(/\s+/))
          .filter((w) => w[0])
          .map((w) => ({ make: w[0]!, model: w.slice(1).join(' ') || w[0]! }));
      else if (raw === '') {
        if (f.emptyAs === 'null') body[f.name] = null;
        continue;
      } else body[f.name] = f.type === 'number' ? Number(raw) : raw;
    }
    setBusy(true);
    setBanner(null);
    setErrors({});
    const r = await postJson(props.endpoint, props.method ?? 'POST', body, key);
    setBusy(false);
    if (r.ok) {
      setDirty(false);
      props.onDone?.();
      if (props.redirectTo) router.push(props.redirectTo);
      router.refresh();
      return;
    }
    if (r.status === 0) return setBanner(props.labels.offline);
    const p = r.problem;
    if (r.status === 429) setRetry(retryAfter(p?.retryAfterSeconds ?? 30));
    if (r.status === 409 && p?.code === 'version_conflict')
      return setBanner(props.labels.versionConflict);
    const fe: Record<string, string> = {};
    for (const x of p?.errors ?? []) fe[x.field.replace(/^payload\./, '')] ??= x.message;
    setErrors(fe);
    setBanner(
      Object.keys(fe).length
        ? props.labels.errorSummary.replace('{count}', String(Object.keys(fe).length))
        : (p?.detail ?? props.labels.unexpected),
    );
  }

  return (
    <form
      className="g1-form"
      onSubmit={onSubmit}
      noValidate
      data-testid={props.testId}
      data-gm-draft={dirty ? 'true' : undefined}
      onChange={() => setDirty(true)}
    >
      {banner ? (
        <div className="alert alert--danger" role="alert">
          <Icon name="alert-triangle" />
          <div className="alert__body">
            {left > 0 ? props.labels.rateLimited.replace('{time}', formatMmSs(left)) : banner}
          </div>
        </div>
      ) : null}
      <fieldset className="g1-fs" disabled={busy}>
        {props.fields.map((f) => {
          const id = `${uid}-${f.name}`;
          const err = errors[f.name];
          const common = {
            id,
            name: f.name,
            'aria-required': f.required || undefined,
            'aria-invalid': err ? true : undefined,
            'aria-describedby': err ? `${id}-err` : f.hint ? `${id}-hint` : undefined,
          } as const;
          return (
            <div className="field" key={f.name}>
              {f.type === 'checkbox' ? (
                <label className="check">
                  <input type="checkbox" {...common} defaultChecked={f.defaultValue === 'on'} />
                  <span className="check__box" aria-hidden="true">
                    <Icon name="check" size="sm" />
                  </span>
                  <span>{f.label}</span>
                </label>
              ) : (
                <>
                  <label className="field__label" htmlFor={id}>
                    {f.label}
                    {f.required ? (
                      <span className="field__req" aria-hidden="true">
                        *
                      </span>
                    ) : null}
                  </label>
                  {f.type === 'customer' && f.picker ? (
                    <CustomerPicker
                      name={f.name}
                      inputId={id}
                      labels={f.picker.labels}
                      required={f.required}
                      invalid={!!err}
                      {...(f.picker.excludeId ? { excludeId: f.picker.excludeId } : {})}
                      {...(f.picker.canLookup ? { canLookup: true } : {})}
                      {...(common['aria-describedby']
                        ? { describedBy: common['aria-describedby'] }
                        : {})}
                    />
                  ) : f.type === 'select' ? (
                    <select className="select" {...common} defaultValue={f.defaultValue ?? ''}>
                      {!f.required || !f.defaultValue ? <option value="">—</option> : null}
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea
                      className="textarea"
                      rows={3}
                      {...common}
                      defaultValue={f.defaultValue}
                      maxLength={f.maxLength}
                    />
                  ) : (
                    <input
                      className="input"
                      type={f.type ?? 'text'}
                      {...common}
                      defaultValue={f.defaultValue}
                      placeholder={f.placeholder}
                      maxLength={f.maxLength}
                      autoComplete={f.type === 'password' ? 'new-password' : 'off'}
                    />
                  )}
                </>
              )}
              {f.hint && !err ? (
                <span className="field__hint" id={`${id}-hint`}>
                  {f.hint}
                </span>
              ) : null}
              {err ? (
                <span className="field__error" id={`${id}-err`}>
                  {err}
                </span>
              ) : null}
            </div>
          );
        })}
      </fieldset>
      <div className="g5-actions">
        <Button
          type="submit"
          variant="primary"
          loading={busy}
          disabled={left > 0 || offline}
          aria-disabled={left > 0 || offline}
        >
          {props.labels.submit}
        </Button>
        {props.cancelHref ? (
          <a className="btn btn--ghost" href={props.cancelHref}>
            {props.labels.cancel}
          </a>
        ) : null}
        {offline ? <span className="g5-reason">{props.labels.offline}</span> : null}
      </div>
    </form>
  );
}

/** A single-action button (approve, reject, deactivate, revoke ...) with the same error handling. */
export function ActionButton(props: {
  endpoint: string;
  method?: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  label: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  confirm?: string;
  errorFallback: string;
  testId?: string;
}) {
  const router = useRouter();
  const [key] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run() {
    if (props.confirm && !window.confirm(props.confirm)) return;
    setBusy(true);
    setError(null);
    const r = await postJson(props.endpoint, props.method ?? 'POST', props.body ?? {}, key);
    setBusy(false);
    if (r.ok) return router.refresh();
    setError(r.problem?.detail ?? props.errorFallback);
  }
  return (
    <span className="g5-actions">
      <Button
        variant={props.variant ?? 'secondary'}
        size="sm"
        loading={busy}
        onClick={run}
        data-testid={props.testId}
      >
        {props.label}
      </Button>
      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
