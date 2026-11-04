'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/ui/components/Button';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { useAction } from '@/ui/components/useAction';

type Labels = Record<string, string>;
interface Row {
  requestId: string;
  number: string;
  purpose: string;
  orderId: string;
  orderNumber: string;
  invoiceId: string;
  status: string;
  errorKind: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  attemptCount: number;
  maxAttempts: number;
  version: number;
  nextLabel: string | null;
  valueLabel: string;
  actions: Record<'retry' | 'fixBuyer' | 'cancel', { allowed: boolean; reasonCode?: string }>;
}
const fill = (s: string, v: Record<string, string | number>) =>
  Object.entries(v).reduce((acc, [k, x]) => acc.replace(`{${k}}`, String(x)), s);

/** G4-EIN-06: the queue. Retry and cancel are server decisions shown with their reason; both ask the provider first. */
export function QueueTable(props: {
  rows: Row[];
  total: number;
  count: string;
  labels: Labels; // ein.queue
  common: Labels;
}) {
  const l = props.labels;
  const c = props.common;
  const { run, busy, error } = useAction(c.unexpected!, c.offline);
  const [msg, setMsg] = useState<string | null>(null);
  const [cancelRow, setCancelRow] = useState<Row | null>(null);
  const [reason, setReason] = useState('');
  const [guard, setGuard] = useState('');
  const [fixRow, setFixRow] = useState<Row | null>(null);
  const [fix, setFix] = useState({ name: '', taxCode: '', address: '' });
  const why = (a: { reasonCode?: string }) =>
    a.reasonCode ? (c[`reason_${a.reasonCode}`] ?? '') : '';
  return (
    <div className="stack">
      <div className="rec-actions">
        <span data-testid="queue-count">{props.count}</span>
        <Button
          variant="secondary"
          loading={busy === 'due'}
          onClick={() =>
            void run<{ handled: number }>('due', '/api/v1/ein/jobs/run-due', {}).then((r) =>
              setMsg(r ? fill(l.runDone!, { n: r.handled }) : null),
            )
          }
          data-testid="queue-run-due"
        >
          {l.runDue}
        </Button>
      </div>
      {msg ? (
        <div className="alert alert--success" role="status">
          <div className="alert__body">{msg}</div>
        </div>
      ) : null}
      {error ? (
        <div className="alert alert--danger" role="alert" data-testid="queue-error">
          <div className="alert__body">{error}</div>
        </div>
      ) : null}
      {props.rows.length === 0 ? (
        <div className="card">
          <div className="card__body">
            <strong>{l.emptyTitle}</strong>
            <p className="text-secondary">{l.emptyText}</p>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <div className="table-scroll">
            <table className="table" data-testid="queue-table">
              <caption className="sr-only">{l.title}</caption>
              <thead>
                <tr>
                  <th scope="col">{l.colRequest}</th>
                  <th scope="col">{l.colKind}</th>
                  <th scope="col">{l.colReason}</th>
                  <th scope="col">{l.colTry}</th>
                  <th scope="col">{l.colNext}</th>
                  <th scope="col" className="num">
                    {l.colValue}
                  </th>
                  <th scope="col">{l.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {props.rows.map((r) => (
                  <tr key={r.requestId} data-testid="queue-row">
                    <td>
                      <span className="code">{r.number}</span>
                      <br />
                      <Link href={`/ein/invoices/${encodeURIComponent(r.invoiceId)}`}>
                        {r.orderNumber}
                      </Link>{' '}
                      <span className="tag tag--neutral">{c[`purpose_${r.purpose}`]}</span>
                    </td>
                    <td>
                      <span className="tag tag--warning">
                        {r.errorKind ? c[`err_${r.errorKind}`] : c[`req_${r.status}`]}
                      </span>
                      <br />
                      <span className="text-secondary">{c[`req_${r.status}`]}</span>
                    </td>
                    <td>{r.errorMessage ?? '—'}</td>
                    <td>{fill(l.tries!, { n: r.attemptCount, max: r.maxAttempts })}</td>
                    <td>{r.nextLabel ?? l.noAuto}</td>
                    <td className="num">{r.valueLabel}</td>
                    <td>
                      <div className="rec-actions">
                        <Button
                          variant="secondary"
                          disabled={!r.actions.retry.allowed}
                          loading={busy === `retry-${r.requestId}`}
                          title={why(r.actions.retry)}
                          onClick={() =>
                            void run(
                              `retry-${r.requestId}`,
                              `/api/v1/ein/queue/${r.requestId}/retry`,
                              {},
                            )
                          }
                          data-testid="queue-retry"
                        >
                          {r.status === 'unknown' || r.status === 'awaiting_provider'
                            ? l.query
                            : l.retry}
                        </Button>
                        {r.actions.fixBuyer.allowed ? (
                          <Button
                            variant="secondary"
                            onClick={() => setFixRow(r)}
                            data-testid="queue-fix"
                          >
                            {l.fixBuyer}
                          </Button>
                        ) : null}
                        {r.actions.cancel.allowed ? (
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setReason('');
                              setGuard('');
                              setCancelRow(r);
                            }}
                            data-testid="queue-cancel"
                          >
                            {l.cancel}
                          </Button>
                        ) : null}
                      </div>
                      {!r.actions.retry.allowed && r.actions.retry.reasonCode ? (
                        <span className="field__hint">{why(r.actions.retry)}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={!!cancelRow}
        title={fill(l.cancelTitle!, { number: cancelRow?.number ?? '' })}
        confirmLabel={l.cancelGo!}
        cancelLabel={l.cancelKeep!}
        tone="danger"
        busy={busy === 'cancel'}
        confirmDisabled={reason.trim().length < 5 || guard.trim() !== cancelRow?.number}
        onConfirm={() => {
          if (!cancelRow) return;
          void run('cancel', `/api/v1/ein/queue/${cancelRow.requestId}/cancel`, {
            version: cancelRow.version,
            reason: reason.trim(),
            confirm: guard.trim(),
          }).then((r) => r && setCancelRow(null));
        }}
        onCancel={() => setCancelRow(null)}
        testId="queue-cancel-dialog"
      >
        <p className="text-secondary">{l.cancelLead}</p>
        <div className="field">
          <label className="field__label" htmlFor="q-reason">
            {l.cancelReason} *
          </label>
          <input
            id="q-reason"
            className="input"
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="q-guard">
            {l.cancelGuard} *
          </label>
          <input
            id="q-guard"
            className="input"
            value={guard}
            onChange={(e) => setGuard(e.target.value)}
            data-testid="queue-guard"
          />
        </div>
      </ConfirmDialog>
      <ConfirmDialog
        open={!!fixRow}
        title={l.fixTitle!}
        confirmLabel={l.fixSave!}
        cancelLabel={c.cancel!}
        busy={busy === 'fix'}
        onConfirm={() => {
          if (!fixRow) return;
          void run('fix', `/api/v1/ein/queue/${fixRow.requestId}/fix-buyer`, {
            version: fixRow.version,
            buyer: {
              ...(fix.name.trim() ? { name: fix.name.trim() } : {}),
              ...(fix.taxCode.trim() ? { kind: 'business', taxCode: fix.taxCode.trim() } : {}),
              ...(fix.address.trim() ? { address: fix.address.trim() } : {}),
            },
          }).then((r) => r && setFixRow(null));
        }}
        onCancel={() => setFixRow(null)}
        testId="queue-fix-dialog"
      >
        <p className="text-secondary">{l.fixLead}</p>
        <div className="field">
          <label className="field__label" htmlFor="fx-name">
            {l.fixName}
          </label>
          <input
            id="fx-name"
            className="input"
            value={fix.name}
            onChange={(e) => setFix({ ...fix, name: e.target.value })}
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="fx-tax">
            {l.fixTax}
          </label>
          <input
            id="fx-tax"
            className="input"
            value={fix.taxCode}
            onChange={(e) => setFix({ ...fix, taxCode: e.target.value })}
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="fx-addr">
            {l.fixAddress}
          </label>
          <input
            id="fx-addr"
            className="input"
            value={fix.address}
            onChange={(e) => setFix({ ...fix, address: e.target.value })}
            data-testid="fix-address"
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
