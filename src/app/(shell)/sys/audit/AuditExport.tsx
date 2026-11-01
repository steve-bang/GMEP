'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/ui/components/Button';

/** Audit export (BA §9): reason required, row cap enforced by the server, the export is itself logged. */
export function AuditExport(props: {
  filter: Record<string, string>;
  labels: { title: string; reason: string; submit: string; failed: string; hint: string };
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const reason = String(new FormData(e.currentTarget).get('reason') ?? '').trim();
    const { limit: _l, ...rest } = props.filter;
    void _l;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/sys/audit/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...rest, reason }),
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { detail?: string } | null;
        setError(p?.detail ?? props.labels.failed);
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = 'audit-log.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(props.labels.failed);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="exp-h" className="g1-auth-card g1-auth-card--wide">
      <h2 id="exp-h">{props.labels.title}</h2>
      <p className="text-secondary">{props.labels.hint}</p>
      <form className="g1-form" onSubmit={onSubmit} data-testid="audit-export">
        {error ? (
          <div className="alert alert--danger" role="alert">
            <div className="alert__body">{error}</div>
          </div>
        ) : null}
        <div className="field">
          <label className="field__label" htmlFor="exp-reason">
            {props.labels.reason}
          </label>
          <input
            className="input"
            id="exp-reason"
            name="reason"
            required
            minLength={5}
            maxLength={300}
            autoComplete="off"
          />
        </div>
        <Button type="submit" variant="secondary" loading={busy}>
          {props.labels.submit}
        </Button>
      </form>
    </section>
  );
}
