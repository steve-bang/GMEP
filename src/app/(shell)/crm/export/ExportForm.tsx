'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/ui/components/Button';

/** Posts the filter and downloads the CSV; the browser never keeps the password beyond the request. */
export function ExportForm(props: {
  canIncludePii: boolean;
  labels: Record<
    | 'type'
    | 'all'
    | 'individual'
    | 'business'
    | 'q'
    | 'includePii'
    | 'includePiiHint'
    | 'reason'
    | 'password'
    | 'submit'
    | 'done'
    | 'failed'
    | 'limits',
    string
  >;
}) {
  const l = props.labels;
  const [pii, setPii] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {};
    for (const k of ['q', 'type', 'reason', 'reauthPassword'])
      if (String(f.get(k) ?? '').trim()) body[k] = String(f.get(k)).trim();
    if (pii) body.includePii = true;
    else {
      delete body.reason;
      delete body.reauthPassword;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/v1/crm/customers/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as {
          detail?: string;
          errors?: { message: string }[];
        } | null;
        setMsg({ ok: false, text: p?.errors?.[0]?.message ?? p?.detail ?? l.failed });
        return;
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'customers.csv';
      a.click();
      URL.revokeObjectURL(a.href);
      setMsg({ ok: true, text: l.done });
    } catch {
      setMsg({ ok: false, text: l.failed });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="g1-form g1-auth-card g1-auth-card--wide"
      onSubmit={onSubmit}
      data-testid="export-form"
      noValidate
    >
      <p className="text-secondary">{l.limits}</p>
      <div className="field">
        <label className="field__label" htmlFor="ex-q">
          {l.q}
        </label>
        <input className="input" id="ex-q" name="q" autoComplete="off" />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="ex-type">
          {l.type}
        </label>
        <select className="select" id="ex-type" name="type" defaultValue="">
          <option value="">{l.all}</option>
          <option value="individual">{l.individual}</option>
          <option value="business">{l.business}</option>
        </select>
      </div>
      {props.canIncludePii ? (
        <>
          <div className="field">
            <label className="check">
              <input
                type="checkbox"
                checked={pii}
                onChange={(e) => setPii(e.target.checked)}
                data-testid="export-pii"
              />
              <span className="check__box" aria-hidden="true" />
              <span>{l.includePii}</span>
            </label>
            <span className="field__hint">{l.includePiiHint}</span>
          </div>
          {pii ? (
            <>
              <div className="field">
                <label className="field__label" htmlFor="ex-reason">
                  {l.reason}
                </label>
                <input
                  className="input"
                  id="ex-reason"
                  name="reason"
                  required
                  minLength={5}
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="ex-pw">
                  {l.password}
                </label>
                <input
                  className="input"
                  id="ex-pw"
                  name="reauthPassword"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </div>
            </>
          ) : null}
        </>
      ) : null}
      {msg ? (
        <div
          className={`alert alert--${msg.ok ? 'success' : 'danger'}`}
          role={msg.ok ? 'status' : 'alert'}
        >
          <div className="alert__body">{msg.text}</div>
        </div>
      ) : null}
      <div className="g5-actions">
        <Button type="submit" variant="primary" loading={busy}>
          {l.submit}
        </Button>
      </div>
    </form>
  );
}
