'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatVnd, parseVndInput } from '@/platform/format/vnd';
import { Button } from '@/ui/components/Button';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { useAction } from '@/ui/components/useAction';

type Labels = Record<string, string>;
const fill = (s: string, v: Record<string, string | number>) =>
  Object.entries(v).reduce((acc, [k, x]) => acc.replace(`{${k}}`, String(x)), s);
const CAUSES = ['change_short', 'wrong_amount', 'expense_unrecorded', 'unknown'] as const;

/**
 * G4-ACC-08 / FR-ACC-004: count first, then see the difference. The book balance is shown only AFTER a count is typed,
 * so the cashier does not count towards the book. The server recomputes the variance against the book at the moment of closing.
 */
export function CloseShiftForm(props: {
  shiftId: string;
  version: number;
  bookVnd: number;
  openOrders: { id: string; number: string; plate: string; outstandingVnd: number }[];
  labels: Labels; // acc.shiftClose
  common: Labels;
}) {
  const l = props.labels;
  const c = props.common;
  const router = useRouter();
  const { run, busy, error } = useAction(c.unexpected!, c.offline);
  const [counted, setCounted] = useState('');
  const [cause, setCause] = useState('');
  const [why, setWhy] = useState('');
  const [ack, setAck] = useState(props.openOrders.length === 0);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const n = parseVndInput(counted);
  const variance = n === null ? null : n - props.bookVnd;
  const needWhy = variance !== null && variance !== 0;
  const ready =
    n !== null && n >= 0 && ack && (!needWhy || (cause !== '' && why.trim().length >= 5));
  async function submit() {
    const r = await run<{ varianceVnd: number; varianceStatus: string }>(
      'close',
      `/api/v1/acc/shifts/${props.shiftId}/close`,
      {
        version: props.version,
        countedVnd: n,
        openOrdersAcknowledged: ack,
        ...(needWhy ? { causeCode: cause, explanation: why.trim() } : {}),
      },
      { refresh: false },
    );
    setConfirming(false);
    if (r) {
      setDone(
        fill(l.done!, {
          amount: formatVnd(r.varianceVnd),
          status: l[`status_${r.varianceStatus}`] ?? r.varianceStatus,
        }),
      );
      window.setTimeout(() => router.push('/acc/cashbook'), 1500);
    }
  }
  if (done)
    return (
      <div className="alert alert--success" role="status" data-testid="close-done">
        <div className="alert__body">{done}</div>
      </div>
    );
  return (
    <div className="stack" data-testid="close-shift-form">
      <section className="card">
        <div className="card__header">
          <h2 className="card__title">{l.step1}</h2>
        </div>
        <div className="card__body stack">
          <p>{l.openOrders}</p>
          {props.openOrders.length === 0 ? (
            <p className="text-secondary">{l.noOpenOrders}</p>
          ) : (
            <ul className="stack-2" data-testid="open-orders">
              {props.openOrders.map((o) => (
                <li key={o.id} className="num">
                  <span className="code">{o.number}</span> ·{' '}
                  <span className="plate">{o.plate}</span> · {formatVnd(o.outstandingVnd)}
                </li>
              ))}
            </ul>
          )}
          {props.openOrders.length ? (
            <label className="check">
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
                data-testid="close-ack"
              />
              <span className="check__box" aria-hidden />
              <span>{l.ack}</span>
            </label>
          ) : null}
        </div>
      </section>
      <section className="card">
        <div className="card__header">
          <h2 className="card__title">{l.step2}</h2>
        </div>
        <div className="card__body stack">
          <p className="text-secondary">{l.lead}</p>
          <div className="field">
            <label className="field__label" htmlFor="counted">
              {l.counted} *
            </label>
            <input
              id="counted"
              className="input input--num"
              inputMode="numeric"
              autoComplete="off"
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
              data-testid="counted"
            />
          </div>
          {variance !== null ? (
            <dl className="acc-sum" data-testid="variance-box">
              <dt>{l.book}</dt>
              <dd>{formatVnd(props.bookVnd)}</dd>
              <dt>{l.variance}</dt>
              <dd data-testid="variance">{formatVnd(variance)}</dd>
            </dl>
          ) : null}
        </div>
      </section>
      {variance !== null ? (
        <section className="card">
          <div className="card__header">
            <h2 className="card__title">{l.step3}</h2>
          </div>
          <div className="card__body stack">
            {needWhy ? (
              <>
                <div className="alert alert--warning" role="note">
                  <div className="alert__body">
                    {fill(l.differs!, { amount: formatVnd(variance) })}
                  </div>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="cause">
                    {l.cause}
                  </label>
                  <select
                    id="cause"
                    className="select"
                    value={cause}
                    onChange={(e) => setCause(e.target.value)}
                    data-testid="cause"
                  >
                    <option value="">{l.pick}</option>
                    {CAUSES.map((k) => (
                      <option key={k} value={k}>
                        {l[`cause_${k}`]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="why">
                    {l.explanation}
                  </label>
                  <textarea
                    id="why"
                    className="textarea"
                    rows={2}
                    maxLength={300}
                    value={why}
                    onChange={(e) => setWhy(e.target.value)}
                    data-testid="why"
                  />
                </div>
              </>
            ) : (
              <p className="text-secondary">{l.matches}</p>
            )}
          </div>
        </section>
      ) : null}
      <div className="rec-actions">
        <Button
          variant="primary"
          disabled={!ready}
          onClick={() => setConfirming(true)}
          data-testid="close-open-confirm"
        >
          {l.close}
        </Button>
      </div>
      {error ? (
        <div className="alert alert--danger" role="alert" data-testid="close-error">
          <div className="alert__body">{error}</div>
        </div>
      ) : null}
      <ConfirmDialog
        open={confirming}
        title={l.confirmTitle!}
        confirmLabel={l.close!}
        cancelLabel={c.cancel!}
        busy={busy === 'close'}
        onConfirm={() => void submit()}
        onCancel={() => setConfirming(false)}
        testId="close-confirm"
      >
        <p className="text-secondary">{l.confirmText}</p>
      </ConfirmDialog>
    </div>
  );
}

/** After a rejection the cashier explains again; a new request goes to the manager. */
export function ExplainAgainForm(props: { shiftId: string; labels: Labels; common: Labels }) {
  const l = props.labels;
  const { run, busy, error } = useAction(props.common.unexpected!, props.common.offline);
  const [cause, setCause] = useState('');
  const [why, setWhy] = useState('');
  return (
    <section className="card" data-testid="explain-again">
      <div className="card__header">
        <h2 className="card__title">{l.explainAgain}</h2>
      </div>
      <div className="card__body stack">
        <select
          className="select"
          aria-label={l.cause}
          value={cause}
          onChange={(e) => setCause(e.target.value)}
        >
          <option value="">{l.pick}</option>
          {CAUSES.map((k) => (
            <option key={k} value={k}>
              {l[`cause_${k}`]}
            </option>
          ))}
        </select>
        <textarea
          className="textarea"
          rows={2}
          aria-label={l.explanation}
          maxLength={300}
          value={why}
          onChange={(e) => setWhy(e.target.value)}
        />
        <div>
          <Button
            variant="primary"
            loading={busy === 'explain'}
            disabled={cause === '' || why.trim().length < 5}
            onClick={() =>
              void run('explain', `/api/v1/acc/shifts/${props.shiftId}/explain`, {
                causeCode: cause,
                explanation: why.trim(),
              })
            }
          >
            {l.explainSend}
          </Button>
        </div>
        {error ? (
          <div className="alert alert--danger" role="alert">
            <div className="alert__body">{error}</div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
