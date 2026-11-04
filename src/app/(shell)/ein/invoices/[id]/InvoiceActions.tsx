'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/ui/components/Button';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { useAction } from '@/ui/components/useAction';

type Labels = Record<string, string>;
type Allowed = { allowed: boolean; reasonCode?: string };

/**
 * G4-EIN-03: the actions of one invoice. Which are allowed comes from the server (`actions`), with the reason when not.
 * Files are plain downloads through the API (the browser never reads storage). A cancel asks for the password again.
 */
export function InvoiceActions(props: {
  invoice: { id: string; orderId: string; status: string; number: string | null };
  actions: Record<'correct' | 'sync' | 'download' | 'report', Allowed>;
  approvals: { id: string; number: string; kind: string; status: string; consumed: boolean }[];
  canRequestPassword: boolean;
  labels: Labels; // ein.detail
  common: Labels; // ein.common
}) {
  const l = props.labels;
  const c = props.common;
  const a = props.actions;
  const { run, busy, error } = useAction(c.unexpected!, c.offline);
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const [password, setPassword] = useState('');
  const why = (x: Allowed) => (x.reasonCode ? (c[`reason_${x.reasonCode}`] ?? '') : '');
  const ready = props.approvals.find((x) => x.status === 'approved' && !x.consumed);
  return (
    <section className="card ein-no-print" aria-label={l.title}>
      <div className="card__body stack">
        <div className="rec-actions">
          {a.download.allowed ? (
            <>
              <a
                className="btn btn--secondary"
                href={`/api/v1/ein/invoices/${encodeURIComponent(props.invoice.id)}/files/pdf`}
                data-testid="dl-pdf"
              >
                {l.pdf}
              </a>
              <a
                className="btn btn--secondary"
                href={`/api/v1/ein/invoices/${encodeURIComponent(props.invoice.id)}/files/xml`}
                data-testid="dl-xml"
              >
                {l.xml}
              </a>
              <Button variant="secondary" onClick={() => window.print()} data-testid="inv-print">
                {l.print}
              </Button>
            </>
          ) : (
            <span className="text-secondary" data-testid="files-not-ready">
              {props.invoice.status === 'issued' ? l.filesNotReady : why(a.download)}
            </span>
          )}
          {a.sync.allowed ? (
            <Button
              variant="secondary"
              loading={busy === 'sync'}
              onClick={() => void run('sync', `/api/v1/ein/invoices/${props.invoice.id}/sync`, {})}
              data-testid="inv-sync"
            >
              {l.sync}
            </Button>
          ) : null}
          {a.correct.allowed ? (
            <Link
              className="btn btn--secondary"
              href={`/ein/invoices/${encodeURIComponent(props.invoice.id)}/correct`}
              data-testid="inv-correct"
            >
              {l.correct}
            </Link>
          ) : a.correct.reasonCode && a.correct.reasonCode !== 'no_permission' ? (
            <span className="text-secondary">{why(a.correct)}</span>
          ) : null}
          {a.report.allowed ? (
            <Button variant="ghost" onClick={() => setReporting(true)} data-testid="inv-report">
              {l.report}
            </Button>
          ) : null}
        </div>
        {ready ? (
          <div className="alert alert--info" role="note" data-testid="banner-approved">
            <div className="alert__body stack-2">
              <strong>{l.banner_approved!.replace('{number}', ready.number)}</strong>
              <span>{l.banner_approvedText}</span>
              {ready.kind === 'invoice_cancel' ? (
                <div className="field">
                  <label className="field__label" htmlFor="exec-pass">
                    {l.executePassword}
                  </label>
                  <input
                    id="exec-pass"
                    className="input"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              ) : null}
              <div>
                <Button
                  variant="primary"
                  loading={busy === 'exec'}
                  onClick={() =>
                    void run('exec', '/api/v1/ein/corrections/execute', {
                      approvalId: ready.id,
                      ...(ready.kind === 'invoice_cancel' ? { password } : {}),
                    })
                  }
                  data-testid="inv-execute"
                >
                  {l.execute}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        {sent ? (
          <div className="alert alert--success" role="status">
            <div className="alert__body">{l.reportDone}</div>
          </div>
        ) : null}
        {error ? (
          <div className="alert alert--danger" role="alert" data-testid="inv-error">
            <div className="alert__body">{error}</div>
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        open={reporting}
        title={l.reportTitle!}
        confirmLabel={l.reportSend!}
        cancelLabel={c.cancel!}
        busy={busy === 'report'}
        confirmDisabled={note.trim().length < 5}
        onConfirm={() =>
          void run(
            'report',
            `/api/v1/ein/invoices/${props.invoice.id}/report-error`,
            { note: note.trim() },
            { refresh: false },
          ).then((r) => {
            if (r) {
              setReporting(false);
              setSent(true);
              setNote('');
            }
          })
        }
        onCancel={() => setReporting(false)}
        testId="report-dialog"
      >
        <p className="text-secondary">{l.reportLead}</p>
        <div className="field">
          <label className="field__label" htmlFor="report-note">
            {l.reportNote} *
          </label>
          <input
            id="report-note"
            className="input"
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </ConfirmDialog>
    </section>
  );
}
