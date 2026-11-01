'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/ui/components/Button';
import { newKey, postJson } from '@/ui/components/ResourceForm';

/** Approve / reject (FR-SYS-004). The proposer's own change needs the owner role and a password re-entry. */
export function DecideButtons(props: {
  type: string;
  id: string;
  own: boolean;
  labels: { approve: string; reject: string; password: string; unexpected: string };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  async function decide(decision: 'approve' | 'reject') {
    setBusy(true);
    setError(null);
    const r = await postJson(
      `/api/v1/sys/config/${props.type}/${encodeURIComponent(props.id)}/decide`,
      'POST',
      { decision, ...(props.own && password ? { reauthPassword: password } : {}) },
      newKey(),
    );
    setBusy(false);
    if (r.ok) return router.refresh();
    setError(r.problem?.detail ?? props.labels.unexpected);
  }
  return (
    <span className="g5-actions">
      {props.own ? (
        <input
          className="input"
          type="password"
          aria-label={props.labels.password}
          placeholder={props.labels.password}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      ) : null}
      <Button
        size="sm"
        variant="primary"
        loading={busy}
        data-testid="cfg-approve"
        onClick={() => decide('approve')}
      >
        {props.labels.approve}
      </Button>
      <Button size="sm" variant="ghost" loading={busy} onClick={() => decide('reject')}>
        {props.labels.reject}
      </Button>
      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
