'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/ui/components/Button';
import { useAction } from '@/ui/components/useAction';

type Labels = Record<string, string>;

/** G2-DLV-03/04 / FR-REC-017: who takes the vehicle, how they confirmed, the odometer, belongings and old parts. */
export function HandoverForm(props: {
  orderId: string;
  version: number;
  lastKm: number | null;
  requireReceiver: boolean;
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
  const kmNum = km.trim() === '' ? undefined : Number(km.replace(/\D/g, ''));
  const below = kmNum !== undefined && props.lastKm !== null && kmNum < props.lastKm;
  const ready =
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
      },
      { refresh: false },
    );
    if (r) router.push(`/rec/orders/${props.orderId}/handover/print`);
  }
  return (
    <div className="stack" data-testid="handover-form">
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
