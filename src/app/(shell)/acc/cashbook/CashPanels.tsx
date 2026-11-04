'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatVnd, parseVndInput } from '@/platform/format/vnd';
import { Button } from '@/ui/components/Button';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { useAction } from '@/ui/components/useAction';

type Labels = Record<string, string>;
const fill = (s: string, v: Record<string, string | number>) =>
  Object.entries(v).reduce((acc, [k, x]) => acc.replace(`{${k}}`, String(x)), s);

/** FR-ACC-004: the cashier takes over the drawer; the opening balance is the book balance. */
export function OpenShiftButton(props: { labels: Labels; common: Labels }) {
  const { run, busy, error } = useAction(props.common.unexpected!, props.common.offline);
  return (
    <div className="stack-2">
      <Button
        variant="primary"
        loading={busy === 'open'}
        onClick={() => void run('open', '/api/v1/acc/shifts', {})}
        data-testid="open-shift"
      >
        {props.labels.openShift}
      </Button>
      {error ? (
        <div className="alert alert--danger" role="alert">
          <div className="alert__body">{error}</div>
        </div>
      ) : null}
    </div>
  );
}

interface Category {
  code: string;
  name: string;
  depositRefund: boolean;
}

/**
 * G4-ACC-04 / RULE-011: the voucher form. Within the limit it is paid at once; over the limit the server answers with an
 * approval request (nothing leaves the drawer) and the approved proposal is paid later from the list below.
 */
export function ExpensePanel(props: {
  categories: Category[];
  approved: { id: string; number: string; payee: string; valueVnd: number }[];
  enabled: boolean;
  labels: Labels; // acc.cashbook
  common: Labels;
}) {
  const l = props.labels;
  const c = props.common;
  const { run, busy, error } = useAction(c.unexpected!, c.offline);
  const [cat, setCat] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'transfer'>('cash');
  const [reference, setReference] = useState('');
  const [payee, setPayee] = useState('');
  const [desc, setDesc] = useState('');
  const [source, setSource] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const n = parseVndInput(amount);
  const ready =
    props.enabled &&
    cat !== '' &&
    n !== null &&
    n > 0 &&
    payee.trim().length >= 2 &&
    desc.trim().length >= 5 &&
    (method === 'cash' || reference.trim() !== '');
  async function submit() {
    const r = await run<{ status: string; number: string; level?: number }>(
      'expense',
      '/api/v1/acc/expenses',
      {
        categoryCode: cat,
        amountVnd: n,
        method,
        ...(method === 'transfer' ? { reference: reference.trim() } : {}),
        payee: payee.trim(),
        description: desc.trim(),
        ...(source.trim() ? { sourceRef: source.trim() } : {}),
      },
    );
    setConfirming(false);
    if (r) {
      setMsg(
        r.status === 'paid'
          ? fill(l.paid!, { number: r.number })
          : fill(l.proposed!, { number: r.number, level: r.level ?? 1 }),
      );
      setAmount('');
      setPayee('');
      setDesc('');
      setSource('');
    }
  }
  return (
    <div className="stack" data-testid="expense-panel">
      {props.approved.length ? (
        <section className="card" aria-labelledby="exp-ap-h">
          <div className="card__header">
            <h2 className="card__title" id="exp-ap-h">
              {l.approvedTitle}
            </h2>
          </div>
          <ul className="card__body stack-2">
            {props.approved.map((a) => (
              <li key={a.id} className="rec-actions">
                <span>
                  <span className="code">{a.number}</span> · {a.payee} · {formatVnd(a.valueVnd)}
                </span>
                <Button
                  variant="primary"
                  disabled={!props.enabled}
                  loading={busy === `pay-${a.id}`}
                  onClick={() =>
                    void run(`pay-${a.id}`, '/api/v1/acc/expenses/pay', { approvalId: a.id })
                  }
                  data-testid="pay-approved"
                >
                  {l.approvedPay}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="card" aria-labelledby="exp-h">
        <div className="card__header">
          <h2 className="card__title" id="exp-h">
            {l.expenseTitle}
          </h2>
        </div>
        <div className="card__body stack">
          <p className="text-secondary">{l.expenseLead}</p>
          {!props.enabled ? (
            <div className="alert alert--warning" role="note">
              <div className="alert__body">{l.noExpenseNow}</div>
            </div>
          ) : null}
          {msg ? (
            <div className="alert alert--success" role="status" data-testid="exp-msg">
              <div className="alert__body">
                {msg} <Link href="/approvals">{c.pending}</Link>
              </div>
            </div>
          ) : null}
          <div className="acc-grid-2">
            <div className="field">
              <label className="field__label" htmlFor="exp-cat">
                {l.category}
              </label>
              <select
                id="exp-cat"
                className="select"
                value={cat}
                onChange={(e) => setCat(e.target.value)}
              >
                <option value="">{l.pick}</option>
                {props.categories
                  .filter((x) => !x.depositRefund)
                  .map((x) => (
                    <option key={x.code} value={x.code}>
                      {x.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="exp-amount">
                {c.amount} *
              </label>
              <input
                id="exp-amount"
                className="input input--num"
                inputMode="numeric"
                autoComplete="off"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="exp-method">
                {c.method}
              </label>
              <select
                id="exp-method"
                className="select"
                value={method}
                onChange={(e) => setMethod(e.target.value as 'cash' | 'transfer')}
              >
                <option value="cash">{c.method_cash}</option>
                <option value="transfer">{c.method_transfer}</option>
              </select>
            </div>
            {method === 'transfer' ? (
              <div className="field">
                <label className="field__label" htmlFor="exp-ref">
                  {c.reference} *
                </label>
                <input
                  id="exp-ref"
                  className="input"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
            ) : null}
            <div className="field">
              <label className="field__label" htmlFor="exp-payee">
                {l.payee}
              </label>
              <input
                id="exp-payee"
                className="input"
                maxLength={120}
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="exp-desc">
                {l.desc}
              </label>
              <input
                id="exp-desc"
                className="input"
                maxLength={300}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="exp-src">
                {l.source}
              </label>
              <input
                id="exp-src"
                className="input"
                maxLength={80}
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
              <span className="field__hint">{l.sourceHint}</span>
            </div>
          </div>
          <div>
            <Button
              variant="primary"
              disabled={!ready}
              onClick={() => setConfirming(true)}
              data-testid="exp-open"
            >
              {l.pay}
            </Button>
          </div>
          {error ? (
            <div className="alert alert--danger" role="alert" data-testid="exp-error">
              <div className="alert__body">{error}</div>
            </div>
          ) : null}
        </div>
      </section>
      <ConfirmDialog
        open={confirming}
        title={l.expenseTitle!}
        confirmLabel={l.pay!}
        cancelLabel={c.cancel!}
        busy={busy === 'expense'}
        onConfirm={() => void submit()}
        onCancel={() => setConfirming(false)}
        testId="exp-confirm"
      >
        <p>
          {payee.trim()} · <strong>{n !== null ? formatVnd(n) : ''}</strong> ·{' '}
          {c[`method_${method}`]}
        </p>
        <p className="text-secondary">{l.overLimit}</p>
      </ConfirmDialog>
    </div>
  );
}
