'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatVnd } from '@/platform/format/vnd';
import { Button } from '@/ui/components/Button';
import { useAction } from '@/ui/components/useAction';

type Labels = Record<string, string>;

/** G2-DLV-03/04 / FR-REC-017: who takes the vehicle, how they confirmed, the odometer, belongings and old parts. */
export function HandoverForm(props: {
  orderId: string;
  version: number;
  lastKm: number | null;
  requireReceiver: boolean;
  /** R44: null = ACC could not be read */
  pay: {
    receivableVnd: number;
    receivedVnd: number;
    outstandingVnd: number;
    debt: { amountVnd: number; dueDate: string } | null;
    pendingNumber: string | null;
    canRequestDebt: boolean;
  } | null;
  canException: boolean;
  labels: Labels;
}) {
  const l = props.labels;
  const router = useRouter();
  const { run, busy, error } = useAction(l.unexpected!, l.offline);
  const [name, setName] = useState('');
  const [confirmation, setConfirmation] = useState<'screen' | 'paper'>('screen');
  const [paperRef, setPaperRef] = useState('');
  const [km, setKm] = useState('');
  const [reason, setReason] = useState('');
  const [belongings, setBelongings] = useState(false);
  const [oldParts, setOldParts] = useState(false);
  const [note, setNote] = useState('');
  const [exception, setException] = useState('');
  const kmNum = km.trim() === '' ? undefined : Number(km.replace(/\D/g, ''));
  const below = kmNum !== undefined && props.lastKm !== null && kmNum < props.lastKm;
  const pay = props.pay;
  const covered =
    pay !== null && (pay.outstandingVnd === 0 || (pay.debt?.amountVnd ?? 0) >= pay.outstandingVnd);
  const useException = pay === null && props.canException && exception.trim().length >= 5;
  const ready =
    (covered || useException) &&
    (!props.requireReceiver || name.trim().length >= 2) &&
    (confirmation === 'screen' || !props.requireReceiver || paperRef.trim().length > 0) &&
    (!below || reason !== '');
  async function submit() {
    const r = await run(
      'handover',
      `/api/v1/rec/orders/${props.orderId}/handover`,
      {
        version: props.version,
        receiverName: name.trim(),
        confirmation,
        ...(confirmation === 'paper' && paperRef.trim() ? { paperRef: paperRef.trim() } : {}),
        ...(kmNum !== undefined ? { km: kmNum } : {}),
        ...(below ? { kmReason: reason } : {}),
        belongingsReturned: belongings,
        oldPartsReturned: oldParts,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(useException ? { paymentExceptionReason: exception.trim() } : {}),
      },
      { refresh: false },
    );
    if (r) router.push(`/rec/orders/${props.orderId}/handover/print`);
  }
  return (
    <div className="stack" data-testid="handover-form">
      <section className="stack-2" aria-labelledby="hv-pay-h" data-testid="hv-pay">
        <h3 id="hv-pay-h">{l.payTitle}</h3>
        {pay === null ? (
          <>
            <div className="alert alert--danger" role="alert">
              <div className="alert__body">{l.payUnavailable}</div>
            </div>
            {props.canException ? (
              <div className="field">
                <label className="field__label" htmlFor="hv-exc">
                  {l.exceptionReason}
                </label>
                <input
                  id="hv-exc"
                  className="input"
                  maxLength={300}
                  value={exception}
                  onChange={(e) => setException(e.target.value)}
                />
                <span className="field__hint">{l.exceptionHint}</span>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <dl className="acc-sum">
              <dt>{l.payReceivable}</dt>
              <dd>{formatVnd(pay.receivableVnd)}</dd>
              <dt>{l.payReceived}</dt>
              <dd>{formatVnd(pay.receivedVnd)}</dd>
              <dt>{l.payOutstanding}</dt>
              <dd data-testid="hv-outstanding">{formatVnd(pay.outstandingVnd)}</dd>
            </dl>
            {pay.outstandingVnd === 0 ? (
              <div className="alert alert--success" role="note">
                <div className="alert__body">{l.payOk}</div>
              </div>
            ) : covered && pay.debt ? (
              <div className="alert alert--info" role="note" data-testid="hv-debt-ok">
                <div className="alert__body">
                  {(l.payDebtOk ?? '')
                    .replace('{amount}', formatVnd(pay.debt.amountVnd))
                    .replace('{due}', pay.debt.dueDate.split('-').reverse().join('/'))}
                </div>
              </div>
            ) : (
              <div className="alert alert--warning" role="alert" data-testid="hv-blocked">
                <div className="alert__body">
                  {(l.payBlocked ?? '').replace('{amount}', formatVnd(pay.outstandingVnd))}
                  {pay.pendingNumber ? (
                    <> {(l.payPendingDebt ?? '').replace('{number}', pay.pendingNumber)}</>
                  ) : null}
                </div>
              </div>
            )}
            {pay.outstandingVnd > 0 ? (
              <div className="rec-actions">
                <Link className="btn btn--secondary" href={`/acc/orders/${props.orderId}`}>
                  {l.payCollect}
                </Link>
                {pay.canRequestDebt ? (
                  <Link className="btn btn--ghost" href={`/acc/orders/${props.orderId}`}>
                    {l.payRequestDebt}
                  </Link>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </section>
      <div className="field">
        <label className="field__label" htmlFor="hv-name">
          {l.receiver}
          {props.requireReceiver ? <span className="field__req"> *</span> : null}
        </label>
        <input
          id="hv-name"
          className="input"
          maxLength={120}
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <span className="field__hint">{l.receiverHint}</span>
      </div>
      <fieldset className="rec-fieldset">
        <legend>{l.confirmation}</legend>
        <label className="radio">
          <input
            type="radio"
            name="conf"
            checked={confirmation === 'screen'}
            onChange={() => setConfirmation('screen')}
          />
          <span className="radio__box" aria-hidden />
          <span>{l.confirm_screen}</span>
        </label>
        <label className="radio">
          <input
            type="radio"
            name="conf"
            checked={confirmation === 'paper'}
            onChange={() => setConfirmation('paper')}
            data-testid="hv-paper"
          />
          <span className="radio__box" aria-hidden />
          <span>{l.confirm_paper}</span>
        </label>
        {confirmation === 'paper' ? (
          <input
            className="input"
            aria-label={l.paperRef}
            placeholder={l.paperRef}
            maxLength={60}
            value={paperRef}
            onChange={(e) => setPaperRef(e.target.value)}
          />
        ) : null}
      </fieldset>
      <div className="field">
        <label className="field__label" htmlFor="hv-km">
          {l.km}
        </label>
        <input
          id="hv-km"
          className="input input--num"
          inputMode="numeric"
          value={km}
          onChange={(e) => setKm(e.target.value)}
        />
        {props.lastKm !== null ? (
          <span className="field__hint">
            {(l.lastKm ?? '').replace('{km}', String(props.lastKm))}
          </span>
        ) : null}
      </div>
      {below ? (
        <div className="field">
          <label className="field__label" htmlFor="hv-reason">
            {l.kmReason}
          </label>
          <select
            id="hv-reason"
            className="select"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            <option value="">{l.pick}</option>
            <option value="typo">{l.reason_typo}</option>
            <option value="odometer_replaced">{l.reason_odometer_replaced}</option>
            <option value="other">{l.reason_other}</option>
          </select>
        </div>
      ) : null}
      <label className="check">
        <input
          type="checkbox"
          checked={belongings}
          onChange={(e) => setBelongings(e.target.checked)}
        />
        <span className="check__box" aria-hidden />
        <span>{l.belongings}</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={oldParts} onChange={(e) => setOldParts(e.target.checked)} />
        <span className="check__box" aria-hidden />
        <span>{l.oldParts}</span>
      </label>
      <div className="field">
        <label className="field__label" htmlFor="hv-note">
          {l.note}
        </label>
        <textarea
          id="hv-note"
          className="textarea"
          rows={2}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className="rec-actions">
        <Button
          variant="primary"
          loading={busy === 'handover'}
          disabled={!ready}
          onClick={() => void submit()}
          data-testid="hv-submit"
        >
          {l.submit}
        </Button>
      </div>
      {error ? (
        <div className="alert alert--danger" role="alert">
          <div className="alert__body">{error}</div>
        </div>
      ) : null}
    </div>
  );
}
