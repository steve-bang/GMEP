'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { formatVnd, parseVndInput } from '@/platform/format/vnd';
import { viToIso } from '@/platform/format/date';
import { Button } from '@/ui/components/Button';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { maskViDate } from '@/ui/dateMask';
import { DateInput } from '@/ui/components/DateInput';
import { useAction } from '@/ui/components/useAction';

type Labels = Record<string, string>;
type Method = 'cash' | 'transfer' | 'card' | 'qr';
interface Line {
  method: Method;
  amount: string;
  reference: string;
}
const fill = (s: string, v: Record<string, string | number>) =>
  Object.entries(v).reduce((acc, [k, x]) => acc.replace(`{${k}}`, String(x)), s);

/**
 * G4-ACC-01 / FR-ACC-001, 002 / R44: collect a receipt (several methods, held deposit applied) or a deposit, and ask for an
 * approved debt. The server decides everything; this form previews the arithmetic and sends the intent with ONE
 * Idempotency-Key per attempt, so a double click or a timeout never makes a second receipt.
 */
export function PayPanel(props: {
  orderId: string;
  outstandingVnd: number;
  depositHeldVnd: number;
  canCollect: boolean;
  canDeposit: boolean;
  canRequestDebt: boolean;
  collectReason: string | null;
  shiftOpen: boolean;
  methods: Method[];
  labels: Labels; // acc.order
  common: Labels; // acc.common
}) {
  const l = props.labels;
  const c = props.common;
  const { run, busy, error } = useAction(c.unexpected!, c.offline);
  const [mode, setMode] = useState<'receipt' | 'deposit'>('receipt');
  const [lines, setLines] = useState<Line[]>([{ method: 'cash', amount: '', reference: '' }]);
  const [applyDeposits, setApplyDeposits] = useState(true);
  const [tendered, setTendered] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [ack, setAck] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [debtOpen, setDebtOpen] = useState(false);
  const [dueVi, setDueVi] = useState('');
  const [reason, setReason] = useState('');
  const [debtDone, setDebtDone] = useState<string | null>(null);

  const total = useMemo(
    () => lines.reduce((s, x) => s + (parseVndInput(x.amount) ?? 0), 0),
    [lines],
  );
  const depositUse =
    mode === 'receipt' && applyDeposits ? Math.min(props.depositHeldVnd, props.outstandingVnd) : 0;
  const after = props.outstandingVnd - depositUse - total;
  const cashTotal = lines
    .filter((x) => x.method === 'cash')
    .reduce((s, x) => s + (parseVndInput(x.amount) ?? 0), 0);
  const tenderedNum = tendered.trim() === '' ? null : parseVndInput(tendered);
  const change = tenderedNum !== null && tenderedNum >= cashTotal ? tenderedNum - cashTotal : null;
  const bad = lines.some((x) => {
    const n = parseVndInput(x.amount);
    return x.amount.trim() !== '' && (n === null || n <= 0);
  });
  const needRef = lines.some(
    (x) => x.method !== 'cash' && x.amount.trim() !== '' && !x.reference.trim(),
  );
  const nothing = total + depositUse <= 0;
  const over = mode === 'receipt' ? after < 0 : total > props.outstandingVnd;
  const ready = !bad && !needRef && !nothing && !over && props.shiftOpen;

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  async function submit() {
    const r = await run<{ number: string }>(
      'collect',
      `/api/v1/acc/orders/${props.orderId}/payments`,
      {
        kind: mode,
        lines: lines
          .filter((x) => (parseVndInput(x.amount) ?? 0) > 0)
          .map((x) => ({
            method: x.method,
            amountVnd: parseVndInput(x.amount),
            ...(x.reference.trim() ? { reference: x.reference.trim() } : {}),
          })),
        applyDeposits: mode === 'receipt' ? applyDeposits : false,
        ...(tenderedNum !== null && cashTotal > 0 ? { cashTenderedVnd: tenderedNum } : {}),
      },
    );
    setConfirming(false);
    setAck(false);
    if (r) {
      setDone(fill(l.done!, { number: r.number }));
      setLines([{ method: 'cash', amount: '', reference: '' }]);
      setTendered('');
    }
  }
  const dueIso = viToIso(dueVi);
  async function sendDebt() {
    const r = await run<{ number: string }>(
      'debt',
      `/api/v1/acc/orders/${props.orderId}/debt-requests`,
      {
        amountVnd: props.outstandingVnd,
        dueDate: dueIso,
        reason: reason.trim(),
      },
    );
    if (r) {
      setDebtDone(fill(l.debtSent!, { number: r.number }));
      setDebtOpen(false);
    }
  }

  return (
    <div className="stack" data-testid="pay-panel">
      {done ? (
        <div className="alert alert--success" role="status" data-testid="pay-done">
          <div className="alert__body">{done}</div>
        </div>
      ) : null}
      {debtDone ? (
        <div className="alert alert--success" role="status" data-testid="debt-done">
          <div className="alert__body">
            {debtDone} <Link href="/approvals">{l.toApprovals}</Link>
          </div>
        </div>
      ) : null}
      {props.canCollect || props.canDeposit ? (
        <section className="card" aria-labelledby="pay-h">
          <div className="card__header">
            <h2 className="card__title" id="pay-h">
              {mode === 'receipt' ? l.collectTitle : l.depositTitle}
            </h2>
            <div className="rec-actions">
              <Button
                size="sm"
                variant={mode === 'receipt' ? 'primary' : 'secondary'}
                disabled={!props.canCollect}
                onClick={() => setMode('receipt')}
                data-testid="mode-receipt"
              >
                {l.collect}
              </Button>
              <Button
                size="sm"
                variant={mode === 'deposit' ? 'primary' : 'secondary'}
                disabled={!props.canDeposit}
                onClick={() => setMode('deposit')}
                data-testid="mode-deposit"
              >
                {l.depositBtn}
              </Button>
            </div>
          </div>
          <div className="card__body stack">
            <p className="text-secondary">{mode === 'receipt' ? l.collectLead : l.depositLead}</p>
            {props.collectReason && mode === 'receipt' ? (
              <div className="alert alert--warning" role="note">
                <div className="alert__body">{props.collectReason}</div>
              </div>
            ) : null}
            {!props.shiftOpen ? (
              <div className="alert alert--warning" role="note" data-testid="no-shift">
                <div className="alert__body">
                  <strong>{l.noShiftTitle}.</strong> {l.noShiftText}{' '}
                  <Link href="/acc/cashbook">{l.toCashbook}</Link>
                </div>
              </div>
            ) : null}
            {lines.map((x, i) => (
              <div className="acc-line" key={i} data-testid={`line-${i}`}>
                <div className="field">
                  <label className="field__label" htmlFor={`m-${i}`}>
                    {fill(l.line!, { n: i + 1 })}
                  </label>
                  <select
                    id={`m-${i}`}
                    className="select"
                    value={x.method}
                    onChange={(e) => setLine(i, { method: e.target.value as Method })}
                  >
                    {props.methods.map((m) => (
                      <option key={m} value={m}>
                        {c[`method_${m}`]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor={`a-${i}`}>
                    {c.amount}
                  </label>
                  <input
                    id={`a-${i}`}
                    className="input input--num"
                    inputMode="numeric"
                    autoComplete="off"
                    value={x.amount}
                    onChange={(e) => setLine(i, { amount: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor={`r-${i}`}>
                    {c.reference}
                    {x.method !== 'cash' ? <span className="field__req"> *</span> : null}
                  </label>
                  <input
                    id={`r-${i}`}
                    className="input"
                    maxLength={80}
                    autoComplete="off"
                    value={x.reference}
                    onChange={(e) => setLine(i, { reference: e.target.value })}
                  />
                </div>
                {lines.length > 1 ? (
                  <Button
                    variant="ghost"
                    onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                  >
                    {l.removeLine}
                  </Button>
                ) : (
                  <span />
                )}
              </div>
            ))}
            {lines.length < 6 ? (
              <div>
                <Button
                  variant="secondary"
                  icon="plus"
                  onClick={() =>
                    setLines((ls) => [...ls, { method: 'transfer', amount: '', reference: '' }])
                  }
                  data-testid="add-line"
                >
                  {l.addLine}
                </Button>
              </div>
            ) : null}
            {mode === 'receipt' && props.depositHeldVnd > 0 ? (
              <label className="check">
                <input
                  type="checkbox"
                  checked={applyDeposits}
                  onChange={(e) => setApplyDeposits(e.target.checked)}
                />
                <span className="check__box" aria-hidden />
                <span>{fill(l.applyDeposits!, { amount: formatVnd(props.depositHeldVnd) })}</span>
              </label>
            ) : null}
            {cashTotal > 0 ? (
              <div className="field">
                <label className="field__label" htmlFor="tendered">
                  {l.tendered}
                </label>
                <input
                  id="tendered"
                  className="input input--num"
                  inputMode="numeric"
                  autoComplete="off"
                  value={tendered}
                  onChange={(e) => setTendered(e.target.value)}
                />
                {change !== null ? (
                  <span className="field__hint" data-testid="change">
                    {fill(l.change!, { amount: formatVnd(change) })}
                  </span>
                ) : null}
              </div>
            ) : null}
            <dl className="acc-sum" data-testid="pay-sum">
              {depositUse > 0 ? (
                <>
                  <dt>{l.depositUsedLabel}</dt>
                  <dd>{formatVnd(depositUse)}</dd>
                </>
              ) : null}
              <dt>{l.thisTime}</dt>
              <dd data-testid="pay-total">{formatVnd(total + depositUse)}</dd>
              <dt>{l.afterOutstanding}</dt>
              <dd data-testid="pay-after">{formatVnd(Math.max(0, after))}</dd>
            </dl>
            {over ? (
              <div className="alert alert--danger" role="alert">
                <div className="alert__body">{l.overpay}</div>
              </div>
            ) : null}
            <div className="rec-actions">
              <Button
                variant="primary"
                disabled={!ready}
                onClick={() => setConfirming(true)}
                data-testid="pay-open-confirm"
              >
                {mode === 'receipt' ? l.collect : l.depositBtn}
              </Button>
            </div>
            {error ? (
              <div className="alert alert--danger" role="alert" data-testid="pay-error">
                <div className="alert__body">{error}</div>
              </div>
            ) : null}
            <div className="alert alert--info" role="note">
              <div className="alert__body">
                <strong>{l.guardTitle}.</strong> {l.guardText}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {props.canRequestDebt ? (
        <section className="card" aria-labelledby="debt-h">
          <div className="card__header">
            <h2 className="card__title" id="debt-h">
              {l.debtTitle}
            </h2>
            {!debtOpen ? (
              <Button variant="secondary" onClick={() => setDebtOpen(true)} data-testid="debt-open">
                {l.debtSend}
              </Button>
            ) : null}
          </div>
          {debtOpen ? (
            <div className="card__body stack">
              <p className="text-secondary">{l.debtLead}</p>
              <div className="field">
                <label className="field__label" htmlFor="debt-amount">
                  {l.debtAmount}
                </label>
                <input
                  id="debt-amount"
                  className="input input--num"
                  readOnly
                  value={formatVnd(props.outstandingVnd)}
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="debt-due">
                  {l.debtDue} *
                </label>
                <DateInput id="debt-due" onChange={(e) => setDueVi(maskViDate(e.target.value))} />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="debt-reason">
                  {l.debtReason} *
                </label>
                <textarea
                  id="debt-reason"
                  className="textarea"
                  rows={2}
                  maxLength={300}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <div className="rec-actions">
                <Button
                  variant="primary"
                  loading={busy === 'debt'}
                  disabled={!dueIso || reason.trim().length < 5}
                  onClick={() => void sendDebt()}
                  data-testid="debt-send"
                >
                  {l.debtSend}
                </Button>
                <Button variant="ghost" onClick={() => setDebtOpen(false)}>
                  {c.cancel}
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <ConfirmDialog
        open={confirming}
        title={mode === 'receipt' ? l.confirmTitle! : l.confirmDepositTitle!}
        confirmLabel={l.confirmGo!}
        cancelLabel={c.cancel!}
        busy={busy === 'collect'}
        confirmDisabled={!ack}
        onConfirm={() => void submit()}
        onCancel={() => {
          setConfirming(false);
          setAck(false);
        }}
        testId="pay-confirm"
      >
        <div className="stack">
          <p>
            {l.confirmTotal}: <strong>{formatVnd(total + depositUse)}</strong> ·{' '}
            {l.afterOutstanding}: <strong>{formatVnd(Math.max(0, after))}</strong>
          </p>
          <p className="text-secondary">{l.confirmText}</p>
          <label className="check">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              data-testid="pay-ack"
            />
            <span className="check__box" aria-hidden />
            <span>{l.confirmCheck}</span>
          </label>
        </div>
      </ConfirmDialog>
    </div>
  );
}
