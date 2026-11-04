'use client';

import { useState } from 'react';
import { Button } from '@/ui/components/Button';
import { useAction } from '@/ui/components/useAction';

type Labels = Record<string, string>;

/** FR-SYS-004: approve, reject (with a reason) or withdraw. The server checks permission, level, branch and "not your own request". */
export function ApprovalActions(props: {
  id: string;
  version: number;
  canDecide: boolean;
  canWithdraw: boolean;
  selfNote: boolean;
  labels: Labels;
}) {
  const l = props.labels;
  const { run, busy, error } = useAction(l.unexpected!);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  // R106: some kinds (reopen day) need the decider's password again; the server says which, so the field is optional here
  const [password, setPassword] = useState('');
  const base = `/api/v1/sys/approvals/${props.id}`;
  return (
    <div className="stack-2" data-testid={`apr-${props.id}`}>
      {props.canDecide ? (
        <input
          className="input"
          type="password"
          aria-label={l.password}
          placeholder={l.password}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          data-testid="apr-password"
        />
      ) : null}
      {props.canDecide ? (
        <div className="rec-actions">
          <Button
            variant="primary"
            size="sm"
            loading={busy === 'approve'}
            onClick={() =>
              void run('approve', `${base}/decide`, {
                version: props.version,
                decision: 'approve',
                ...(password ? { reauthPassword: password } : {}),
              })
            }
            data-testid="apr-approve"
          >
            {l.approve}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setRejecting((v) => !v)}
            data-testid="apr-reject"
          >
            {l.reject}
          </Button>
        </div>
      ) : props.selfNote ? (
        <span className="text-secondary">{l.self}</span>
      ) : null}
      {rejecting ? (
        <div className="stack-2">
          <label className="field__label" htmlFor={`rn-${props.id}`}>
            {l.note}
          </label>
          <input
            id={`rn-${props.id}`}
            className="input"
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div>
            <Button
              variant="danger"
              size="sm"
              loading={busy === 'reject'}
              disabled={note.trim().length < 5}
              onClick={() =>
                void run('reject', `${base}/decide`, {
                  version: props.version,
                  decision: 'reject',
                  note: note.trim(),
                })
              }
              data-testid="apr-reject-go"
            >
              {l.sendReject}
            </Button>
          </div>
        </div>
      ) : null}
      {props.canWithdraw ? (
        <Button
          variant="ghost"
          size="sm"
          loading={busy === 'withdraw'}
          onClick={() => void run('withdraw', `${base}/withdraw`, { version: props.version })}
          data-testid="apr-withdraw"
        >
          {l.withdraw}
        </Button>
      ) : null}
      {error ? (
        <div className="alert alert--danger" role="alert">
          <div className="alert__body">{error}</div>
        </div>
      ) : null}
    </div>
  );
}
