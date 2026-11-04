'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/ui/components/Button';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { useAction } from '@/ui/components/useAction';

type Labels = Record<string, string>;
const fill = (s: string, v: Record<string, string | number>) =>
  Object.entries(v).reduce((acc, [k, x]) => acc.replace(`{${k}}`, String(x)), s);

/** RULE-010: a posted payment is reversed, not edited: request (a manager approves), then execute once. */
export function ReversalPanel(props: {
  paymentId: string;
  number: string;
  approval: {
    id: string;
    number: string;
    status: string;
    consumed: boolean;
    decisionNote: string | null;
  } | null;
  canRequest: boolean;
  labels: Labels; // acc.payment
  common: Labels;
}) {
  const l = props.labels;
  const c = props.common;
  const { run, busy, error } = useAction(c.unexpected!, c.offline);
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const a = props.approval;
  if (!props.canRequest) return null;
  async function request() {
    const r = await run<{ number: string }>(
      'request',
      `/api/v1/acc/payments/${props.paymentId}/reversal-request`,
      { reason: reason.trim() },
    );
    if (r) setSent(fill(l.sent!, { number: r.number }));
  }
  async function execute() {
    await run('execute', `/api/v1/acc/payments/${props.paymentId}/reverse`, { approvalId: a!.id });
    setOpen(false);
  }
  return (
    <section className="card" aria-labelledby="rev-h" data-testid="reversal-panel">
      <div className="card__header">
        <h2 className="card__title" id="rev-h">
          {l.reverseTitle}
        </h2>
      </div>
      <div className="card__body stack">
        <p className="text-secondary">{l.reverseLead}</p>
        {sent ? (
          <div className="alert alert--success" role="status" data-testid="rev-sent">
            <div className="alert__body">
              {sent} <Link href="/approvals">{c.pending}</Link>
            </div>
          </div>
        ) : null}
        {a && a.status === 'pending' ? (
          <div className="alert alert--info" role="note" data-testid="rev-pending">
            <div className="alert__body">{fill(l.pending!, { number: a.number })}</div>
          </div>
        ) : null}
        {a && a.status === 'approved' && !a.consumed ? (
          <>
            <div className="alert alert--success" role="note" data-testid="rev-approved">
              <div className="alert__body">{fill(l.approvedExec!, { number: a.number })}</div>
            </div>
            <div>
              <Button variant="danger" onClick={() => setOpen(true)} data-testid="rev-execute">
                {l.execute}
              </Button>
            </div>
          </>
        ) : null}
        {!a && !sent ? (
          <>
            <div className="field">
              <label className="field__label" htmlFor="rev-reason">
                {l.reason_label}
              </label>
              <textarea
                id="rev-reason"
                className="textarea"
                rows={2}
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div>
              <Button
                variant="danger"
                loading={busy === 'request'}
                disabled={reason.trim().length < 5}
                onClick={() => void request()}
                data-testid="rev-send"
              >
                {l.send}
              </Button>
            </div>
          </>
        ) : null}
        {error ? (
          <div className="alert alert--danger" role="alert">
            <div className="alert__body">{error}</div>
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        open={open}
        title={fill(l.reverseTitle!, {}) + ' ' + props.number}
        confirmLabel={l.execute!}
        cancelLabel={c.cancel!}
        tone="danger"
        busy={busy === 'execute'}
        onConfirm={() => void execute()}
        onCancel={() => setOpen(false)}
      >
        <p>{l.reverseLead}</p>
      </ConfirmDialog>
    </section>
  );
}
