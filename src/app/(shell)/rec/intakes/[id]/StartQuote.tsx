'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/ui/components/Button';
import { newKey, postJson } from '@/ui/components/postJson';

/** Starts the quote of a completed intake; one Idempotency-Key per mount so a double click creates one quote. */
export function StartQuote(props: {
  intakeId: string;
  labels: { start: string; unexpected: string };
}) {
  const router = useRouter();
  const [key] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    setError(null);
    const r = await postJson('/api/v1/rec/quotes', 'POST', { intakeId: props.intakeId }, key);
    if (r.ok) {
      router.push(`/rec/quotes/${encodeURIComponent((r.data as { id: string }).id)}`);
      return;
    }
    setBusy(false);
    setError(r.problem?.detail ?? props.labels.unexpected);
  }
  return (
    <>
      <Button variant="primary" loading={busy} onClick={() => void go()} data-testid="quote-start">
        {props.labels.start}
      </Button>
      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : null}
    </>
  );
}
