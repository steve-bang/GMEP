'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/ui/components/Button';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { useAction } from '@/ui/components/useAction';

type Labels = Record<string, string>;
const fill = (s: string, v: Record<string, string | number>) =>
  Object.entries(v).reduce((acc, [k, x]) => acc.replace(`{${k}}`, String(x)), s);

export interface PanelField {
  name: string;
  label: string;
  kind: 'text' | 'integer' | 'select' | 'textarea';
  options?: { value: string; label: string }[];
  optional?: boolean;
}

/**
 * Two-step money action with an approval in between (RULE-010/011): request (a different manager decides in /approvals),
 * then execute once. Used by the customer refund (FR-ACC-016) and reopening a closed day (FR-ACC-005). The server owns
 * every check; this panel only shows the state of the approval and sends the two calls.
 */
export function ApprovedActionPanel(props: {
  testId: string;
  requestUrl: string;
  executeUrl: string;
  /** fixed part of the request body (order id, date) */
  fixed: Record<string, unknown>;
  fields: PanelField[];
  approval: { id: string; number: string; status: string; consumed: boolean } | null;
  labels: Labels; // title, lead, send, sent, pending, approvedExec, execute, done
  common: Labels;
}) {
  const l = props.labels;
  const c = props.common;
  const { run, busy, error } = useAction(c.unexpected!, c.offline);
  const [values, setValues] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const a = props.approval;
  const valid = props.fields.every((f) => {
    const v = (values[f.name] ?? (f.kind === 'select' ? f.options?.[0]?.value : '') ?? '').trim();
    if (f.optional) return true;
    if (f.kind === 'integer') return /^\d+$/.test(v) && Number(v) > 0;
    if (f.name === 'reason') return v.length >= 5;
    return v.length > 0;
  });
  function body() {
    const out: Record<string, unknown> = { ...props.fixed };
    for (const f of props.fields) {
      const v = (values[f.name] ?? (f.kind === 'select' ? f.options?.[0]?.value : '') ?? '').trim();
      if (!v) continue;
      out[f.name] = f.kind === 'integer' ? Number(v) : v;
    }
    return out;
  }
  async function request() {
    const r = await run<{ number: string }>('request', props.requestUrl, body());
    if (r) setSent(fill(l.sent!, { number: r.number }));
  }
  async function execute() {
    const r = await run('execute', props.executeUrl, { approvalId: a!.id });
    setOpen(false);
    if (r) setDone(true);
  }
  return (
    <section className="card" aria-labelledby={`${props.testId}-h`} data-testid={props.testId}>
      <div className="card__header">
        <h2 className="card__title" id={`${props.testId}-h`}>
          {l.title}
        </h2>
      </div>
      <div className="card__body stack">
        <p className="text-secondary">{l.lead}</p>
        {done ? (
          <div className="alert alert--success" role="status" data-testid={`${props.testId}-done`}>
            <div className="alert__body">{l.done}</div>
          </div>
        ) : null}
        {sent ? (
          <div className="alert alert--success" role="status" data-testid={`${props.testId}-sent`}>
            <div className="alert__body">
              {sent} <Link href="/approvals">{c.pending}</Link>
            </div>
          </div>
        ) : null}
        {a && a.status === 'pending' ? (
          <div className="alert alert--info" role="note" data-testid={`${props.testId}-pending`}>
            <div className="alert__body">{fill(l.pending!, { number: a.number })}</div>
          </div>
        ) : null}
        {a && a.status === 'approved' && !a.consumed && !done ? (
          <>
            <div
              className="alert alert--success"
              role="note"
              data-testid={`${props.testId}-approved`}
            >
              <div className="alert__body">{fill(l.approvedExec!, { number: a.number })}</div>
            </div>
            <div>
              <Button
                variant="primary"
                onClick={() => setOpen(true)}
                data-testid={`${props.testId}-execute`}
              >
                {l.execute}
              </Button>
            </div>
          </>
        ) : null}
        {!a && !sent && !done ? (
          <>
            {props.fields.map((f) => {
              const id = `${props.testId}-${f.name}`;
              return (
                <div className="field" key={f.name}>
                  <label className="field__label" htmlFor={id}>
                    {f.label}
                  </label>
                  {f.kind === 'textarea' ? (
                    <textarea
                      id={id}
                      className="textarea"
                      rows={2}
                      maxLength={300}
                      value={values[f.name] ?? ''}
                      onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                    />
                  ) : f.kind === 'select' ? (
                    <select
                      id={id}
                      className="select"
                      value={values[f.name] ?? f.options?.[0]?.value ?? ''}
                      onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                    >
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={id}
                      className="input"
                      inputMode={f.kind === 'integer' ? 'numeric' : 'text'}
                      maxLength={f.kind === 'integer' ? 14 : 80}
                      value={values[f.name] ?? ''}
                      onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                    />
                  )}
                </div>
              );
            })}
            <div>
              <Button
                variant="primary"
                loading={busy === 'request'}
                disabled={!valid}
                onClick={() => void request()}
                data-testid={`${props.testId}-send`}
              >
                {l.send}
              </Button>
            </div>
          </>
        ) : null}
        {error ? (
          <div className="alert alert--danger" role="alert" data-testid={`${props.testId}-error`}>
            <div className="alert__body">{error}</div>
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        open={open}
        title={l.title!}
        confirmLabel={l.execute!}
        cancelLabel={c.cancel!}
        busy={busy === 'execute'}
        onConfirm={() => void execute()}
        onCancel={() => setOpen(false)}
      >
        <p>{l.lead}</p>
      </ConfirmDialog>
    </section>
  );
}
