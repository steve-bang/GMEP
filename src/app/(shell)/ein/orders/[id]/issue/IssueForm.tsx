'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatBp } from '@/platform/format/percent';
import { formatVnd } from '@/platform/format/vnd';
import { Button } from '@/ui/components/Button';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { newKey, postJson } from '@/ui/components/postJson';
import { useAction } from '@/ui/components/useAction';

type Labels = Record<string, string>;
const fill = (s: string, v: Record<string, string | number>) =>
  Object.entries(v).reduce((acc, [k, x]) => acc.replace(`{${k}}`, String(x)), s);

interface Check {
  eligible: boolean;
  issues: { code: string; field?: string }[];
  warnings: { code: string; taxKey: string; quotedRateBp: number; currentRateBp: number }[];
  buyer: {
    kind: string;
    name: string;
    taxCode: string | null;
    address: { value: string | null; masked: boolean };
    email: { value: string | null; masked: boolean };
  };
  lines: { no: number; description: string; netVnd: number; rateBp: number }[];
  taxSummary: { rateBp: number; netVnd: number; taxVnd: number }[];
  netVnd: number;
  taxVnd: number;
  totalVnd: number;
  provider: { activated: boolean; environment: string | null; symbol: string | null };
}

/**
 * G4-EIN-02: the buyer form, the conditions and the confirmation. The server decides (nothing is sent while a condition
 * fails); this form shows the list, re-checks after an edit and sends the intent with ONE Idempotency-Key per attempt, so a
 * double click or a timeout can never make a second invoice (FR-EIN-013, the server also guards by order).
 */
export function IssueForm(props: {
  orderId: string;
  initial: Check;
  canIssue: boolean;
  labels: Labels; // ein.issue
  common: Labels; // ein.common
}) {
  const l = props.labels;
  const c = props.common;
  const router = useRouter();
  const { run, busy, error } = useAction(c.unexpected!, c.offline);
  const [chk, setChk] = useState<Check>(props.initial);
  const b0 = props.initial.buyer;
  const [kind, setKind] = useState(b0.kind);
  const [name, setName] = useState(b0.name);
  const [taxCode, setTaxCode] = useState(b0.taxCode ?? '');
  const [address, setAddress] = useState(b0.address.masked ? '' : (b0.address.value ?? ''));
  const [email, setEmail] = useState(b0.email.masked ? '' : (b0.email.value ?? ''));
  const [confirming, setConfirming] = useState(false);
  const [ack, setAck] = useState(false);
  const [checking, setChecking] = useState(false);
  const override = () => ({
    kind,
    name,
    taxCode: kind === 'business' ? taxCode : '',
    ...(address.trim() ? { address } : {}),
    ...(email.trim() ? { email } : {}),
  });
  async function recheck() {
    setChecking(true);
    const r = await postJson(
      `/api/v1/ein/orders/${props.orderId}/invoice-check`,
      'POST',
      { buyer: override() },
      newKey(),
    );
    setChecking(false);
    if (r.ok) setChk(r.data as Check);
  }
  async function issue() {
    const r = await run<{ invoiceId: string }>(
      'issue',
      `/api/v1/ein/orders/${props.orderId}/invoices`,
      { buyer: override() },
      { refresh: false },
    );
    setConfirming(false);
    if (r) router.push(`/ein/invoices/${encodeURIComponent(r.invoiceId)}`);
  }
  const field = (f: string) => chk.issues.find((i) => i.field === f);
  const blocked = !props.canIssue || !chk.eligible;
  return (
    <div className="stack">
      <section className="card" aria-labelledby="iss-buyer">
        <div className="card__header">
          <h2 className="card__title" id="iss-buyer">
            {l.buyer}
          </h2>
        </div>
        <div className="card__body stack">
          <p className="text-secondary">{l.buyerLead}</p>
          <div className="acc-grid-2">
            <div className="field">
              <label className="field__label" htmlFor="iss-kind">
                {l.kind}
              </label>
              <select
                id="iss-kind"
                className="select"
                value={kind}
                disabled={!props.canIssue}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="retail">{c.kind_retail}</option>
                <option value="business">{c.kind_business}</option>
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="iss-name">
                {l.name} *
              </label>
              <input
                id="iss-name"
                className="input"
                maxLength={200}
                value={name}
                disabled={!props.canIssue}
                aria-invalid={!!field('name')}
                onChange={(e) => setName(e.target.value)}
              />
              {field('name') ? (
                <span className="field__error">{l[`issue_${field('name')!.code}`]}</span>
              ) : null}
            </div>
            {kind === 'business' ? (
              <div className="field">
                <label className="field__label" htmlFor="iss-tax">
                  {l.taxCode} *
                </label>
                <input
                  id="iss-tax"
                  className="input"
                  inputMode="numeric"
                  maxLength={14}
                  value={taxCode}
                  disabled={!props.canIssue}
                  aria-invalid={!!field('taxCode')}
                  onChange={(e) => setTaxCode(e.target.value)}
                />
                {field('taxCode') ? (
                  <span className="field__error">{l[`issue_${field('taxCode')!.code}`]}</span>
                ) : null}
              </div>
            ) : null}
            <div className="field">
              <label className="field__label" htmlFor="iss-addr">
                {l.address}
                {kind === 'business' ? ' *' : ''}
              </label>
              <input
                id="iss-addr"
                className="input"
                maxLength={300}
                value={address}
                disabled={!props.canIssue}
                placeholder={b0.address.masked ? (b0.address.value ?? '') : ''}
                aria-invalid={!!field('address')}
                onChange={(e) => setAddress(e.target.value)}
              />
              {b0.address.masked ? <span className="field__hint">{l.addressMasked}</span> : null}
              {field('address') ? (
                <span className="field__error">{l[`issue_${field('address')!.code}`]}</span>
              ) : null}
            </div>
            <div className="field">
              <label className="field__label" htmlFor="iss-mail">
                {l.email}
              </label>
              <input
                id="iss-mail"
                className="input"
                type="email"
                maxLength={200}
                value={email}
                disabled={!props.canIssue}
                placeholder={b0.email.masked ? (b0.email.value ?? '') : ''}
                aria-invalid={!!field('email')}
                onChange={(e) => setEmail(e.target.value)}
              />
              {field('email') ? (
                <span className="field__error">{l[`issue_${field('email')!.code}`]}</span>
              ) : null}
            </div>
          </div>
          <div>
            <Button
              variant="secondary"
              loading={checking}
              onClick={() => void recheck()}
              data-testid="issue-recheck"
            >
              {l.recheck}
            </Button>
          </div>
        </div>
      </section>

      <section className="card" aria-labelledby="iss-lines">
        <div className="card__header">
          <h2 className="card__title" id="iss-lines">
            {l.lines}
          </h2>
        </div>
        <div className="table-wrap">
          <div className="table-scroll">
            <table className="table">
              <caption className="sr-only">{l.lines}</caption>
              <thead>
                <tr>
                  <th scope="col">{l.colDesc}</th>
                  <th scope="col">{l.colRate}</th>
                  <th scope="col" className="num">
                    {l.colNet}
                  </th>
                </tr>
              </thead>
              <tbody>
                {chk.lines.map((x) => (
                  <tr key={x.no}>
                    <td>{x.description}</td>
                    <td>{formatBp(x.rateBp)}</td>
                    <td className="num">{formatVnd(x.netVnd)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={2}>
                    {l.net}
                  </th>
                  <td className="num">{formatVnd(chk.netVnd)}</td>
                </tr>
                <tr>
                  <th scope="row" colSpan={2}>
                    {l.tax}
                  </th>
                  <td className="num">{formatVnd(chk.taxVnd)}</td>
                </tr>
                <tr>
                  <th scope="row" colSpan={2}>
                    {l.total}
                  </th>
                  <td className="num" data-testid="issue-total">
                    <strong>{formatVnd(chk.totalVnd)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>

      <section className="card" aria-labelledby="iss-checks">
        <div className="card__header">
          <h2 className="card__title" id="iss-checks">
            {l.checks}
          </h2>
        </div>
        <div className="card__body stack-2" data-testid="issue-checks">
          <p className="text-secondary">{l.checksLead}</p>
          {chk.issues.length === 0 ? (
            <div className="alert alert--success" role="status">
              <div className="alert__body">{l.allOk}</div>
            </div>
          ) : (
            <ul className="stack-2" style={{ paddingLeft: 'var(--space-5)' }}>
              {chk.issues.map((i, n) => (
                <li key={`${i.code}-${n}`} data-testid={`issue-${i.code}`}>
                  {l[`issue_${i.code}`] ?? i.code}
                </li>
              ))}
            </ul>
          )}
          {chk.warnings.map((w) => (
            <div key={w.taxKey} className="alert alert--warning" role="note">
              <div className="alert__body">
                {fill(l.warnTax!, {
                  key: w.taxKey,
                  from: formatBp(w.quotedRateBp),
                  to: formatBp(w.currentRateBp),
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {error ? (
        <div className="alert alert--danger" role="alert" data-testid="issue-error">
          <div className="alert__body">{error}</div>
        </div>
      ) : null}
      <div>
        <Button
          variant="primary"
          disabled={blocked}
          loading={busy === 'issue'}
          onClick={() => {
            setAck(false);
            setConfirming(true);
          }}
          data-testid="issue-open"
        >
          {busy === 'issue' ? l.sending : l.submit}
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        title={l.confirmTitle!}
        confirmLabel={l.submit!}
        cancelLabel={c.cancel!}
        busy={busy === 'issue'}
        confirmDisabled={!ack}
        onConfirm={() => void issue()}
        onCancel={() => setConfirming(false)}
        testId="issue-confirm"
      >
        <p>
          {name} · <strong>{formatVnd(chk.totalVnd)}</strong>
        </p>
        <p className="text-secondary">{l.confirmText}</p>
        <label className="check">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            data-testid="issue-ack"
          />
          <span className="check__box" aria-hidden />
          <span>{l.confirmTick}</span>
        </label>
      </ConfirmDialog>
    </div>
  );
}
