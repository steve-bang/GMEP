'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/ui/components/Button';
import { newKey, postJson } from '@/ui/components/postJson';

/** Send (draft) and "khách từ chối" (sent). One Idempotency-Key per action so a double click or a retry cannot repeat it. */
export function QuoteActions(props: {
  quoteId: string;
  version: number;
  allowed: string[];
  hasLines: boolean;
  labels: Record<string, string>;
}) {
  const l = props.labels;
  const router = useRouter();
  const [keys] = useState(() => ({ send: newKey(), reject: newKey() }));
  const [busy, setBusy] = useState<'send' | 'reject' | null>(null);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function run(kind: 'send' | 'reject') {
    setBusy(kind);
    setError(null);
    const r = await postJson(
      `/api/v1/rec/quotes/${props.quoteId}/${kind}`,
      'POST',
      kind === 'send' ? { version: props.version } : { version: props.version, reason },
      keys[kind],
    );
    setBusy(null);
    if (r.ok) {
      setAsking(false);
      router.refresh();
      return;
    }
    setError(r.problem?.errors?.[0]?.message ?? r.problem?.detail ?? l.unexpected!);
  }
  return (
    <div className="stack" data-testid="quote-actions">
      <div className="rec-actions">
        {props.allowed.includes('send') ? (
          <Button
            variant="primary"
            loading={busy === 'send'}
            disabled={!props.hasLines}
            onClick={() => void run('send')}
            data-testid="quote-send"
          >
            {l.send}
          </Button>
        ) : null}
        {props.allowed.includes('reject') ? (
          <Button variant="danger" onClick={() => setAsking(true)} data-testid="quote-reject">
            {l.reject}
          </Button>
        ) : null}
      </div>
      {props.allowed.includes('send') && !props.hasLines ? (
        <span className="text-secondary">{l.sendNeedsLines}</span>
      ) : null}
      {asking ? (
        <div className="stack">
          <div className="field">
            <label className="field__label" htmlFor="reject-reason">
              {l.rejectReason}
            </label>
            <textarea
              id="reject-reason"
              className="textarea"
              rows={2}
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <span className="field__hint">{l.rejectHint}</span>
          </div>
          <div className="rec-actions">
            <Button variant="danger" loading={busy === 'reject'} onClick={() => void run('reject')}>
              {l.rejectConfirm}
            </Button>
            <Button variant="ghost" onClick={() => setAsking(false)}>
              {l.keep}
            </Button>
          </div>
        </div>
      ) : null}
      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
