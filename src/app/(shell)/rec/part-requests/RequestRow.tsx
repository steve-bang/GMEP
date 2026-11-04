'use client';

import { useState } from 'react';
import { Button } from '@/ui/components/Button';
import { useAction } from '@/ui/components/useAction';

/** Storekeeper: issue the parts against the order (one tap) or refuse with a reason. */
export function RequestRow(props: {
  id: string;
  version: number;
  canIssue: boolean;
  labels: Record<string, string>;
}) {
  const l = props.labels;
  const { run, busy, error } = useAction(l.unexpected!);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const url = `/api/v1/rec/part-requests/${props.id}/decide`;
  return (
    <div className="stack">
      <div className="rec-actions">
        {props.canIssue ? (
          <Button
            variant="primary"
            size="sm"
            loading={busy === 'issue'}
            onClick={() => void run('issue', url, { decision: 'issue', version: props.version })}
            data-testid="request-issue"
          >
            {l.issue}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAsking((x) => !x)}
          data-testid="request-reject"
        >
          {l.reject}
        </Button>
      </div>
      {asking ? (
        <div className="rec-actions">
          <input
            className="input"
            aria-label={l.reason}
            placeholder={l.reason}
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            variant="danger"
            size="sm"
            disabled={reason.trim().length < 3}
            loading={busy === 'reject'}
            onClick={() =>
              void run('reject', url, {
                decision: 'reject',
                version: props.version,
                reason: reason.trim(),
              })
            }
          >
            {l.rejectConfirm}
          </Button>
        </div>
      ) : null}
      {error ? <span className="field__error">{error}</span> : null}
    </div>
  );
}
