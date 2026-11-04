'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/ui/components/Button';
import { newKey, postJson } from '@/ui/components/ResourceForm';

/**
 * Cancel / reverse need a reason: a small inline form with its own Idempotency-Key, so a double
 * click cannot post twice (the server stays authoritative).
 */
export function ReasonAction(props: {
  endpoint: string;
  body: Record<string, unknown>;
  open: string;
  reasonLabel: string;
  submit: string;
  cancel: string;
  unexpected: string;
  variant?: 'danger' | 'secondary';
  testId?: string;
}) {
  const router = useRouter();
  const [key] = useState(newKey);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const reason = String(new FormData(e.currentTarget).get('reason') ?? '').trim();
    setBusy(true);
    setError(null);
    const r = await postJson(props.endpoint, 'POST', { ...props.body, reason }, key);
    setBusy(false);
    if (r.ok) {
      setShow(false);
      router.refresh();
      return;
    }
    setError(r.problem?.errors?.[0]?.message ?? r.problem?.detail ?? props.unexpected);
  }
  if (!show)
    return (
      <Button
        variant={props.variant ?? 'secondary'}
        onClick={() => setShow(true)}
        data-testid={props.testId}
      >
        {props.open}
      </Button>
    );
  return (
    <form className="inv-reason" onSubmit={onSubmit} noValidate>
      <div className="field">
        <label className="field__label" htmlFor={`${props.testId}-reason`}>
          {props.reasonLabel}
        </label>
        <textarea
          id={`${props.testId}-reason`}
          name="reason"
          className="textarea"
          rows={2}
          maxLength={300}
          required
        />
        {error ? (
          <span className="field__error" role="alert">
            {error}
          </span>
        ) : null}
      </div>
      <div className="g5-actions">
        <Button type="submit" variant={props.variant ?? 'secondary'} loading={busy}>
          {props.submit}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setShow(false)}>
          {props.cancel}
        </Button>
      </div>
    </form>
  );
}
