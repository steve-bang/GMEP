'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/ui/components/Button';
import { useAction } from '@/ui/components/useAction';
import { formatDuration, qtyText } from '../orderUi';

type Labels = Record<string, string>;

export interface WorkCard {
  id: string;
  version: number;
  no: number;
  name: string;
  status: string;
  pauseReason: string | null;
  waitingParts: boolean;
  orderId: string;
  orderVersion: number;
  orderNumber: string;
  plate: string;
  vehicleLabel: string;
  approvedMinutes: number;
  workedNowMs: number;
  running: boolean;
  allowedEvents: string[];
  canUndo: boolean;
  partLines: {
    lineKey: string;
    name: string;
    code: string;
    qty: number;
    qtyScale: number;
    requested: number;
    issued: number;
  }[];
}

/** R41: five stable codes; `other` needs a note */
const PAUSE_REASONS = [
  'waiting_parts',
  'waiting_customer',
  'awaiting_supplement_approval',
  'break',
  'other',
] as const;

/** G2-TEC-01/02/03/04: big buttons for the technician. Start and finish are ONE tap (FR-REC-013: at most 2 taps); pause adds the reason tap. */
export function WorkCards({ cards, labels: l }: { cards: WorkCard[]; labels: Labels }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const [t0] = useState(() => Date.now());
  return (
    <div className="rec-work" data-testid="work-cards">
      {cards.map((c) => (
        <Card key={c.id} c={c} l={l} extraMs={c.running ? now - t0 : 0} />
      ))}
    </div>
  );
}

function Card({ c, l, extraMs }: { c: WorkCard; l: Labels; extraMs: number }) {
  const { run, busy, error } = useAction(l.unexpected!, l.offline);
  const [picking, setPicking] = useState(false);
  const [otherNote, setOtherNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [parts, setParts] = useState(false);
  const [propose, setPropose] = useState(false);
  const [sel, setSel] = useState(c.partLines[0]?.lineKey ?? '');
  const [qty, setQty] = useState(1);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const body = { version: c.version };
  const act = (ev: string, extra: object = {}) =>
    run(ev, `/api/v1/rec/items/${c.id}/${ev}`, { ...body, ...extra });
  const line = c.partLines.find((x) => x.lineKey === sel);
  const left = line ? line.qty - line.requested : 0;
  return (
    <article className="card rec-work__card" data-testid="work-card" data-status={c.status}>
      <div className="card__body stack">
        <div className="rec-work__head">
          <span className="plate">{c.plate}</span>
          <span className="code">{c.orderNumber}</span>
          <span className="text-secondary">{c.vehicleLabel}</span>
        </div>
        <h2 className="rec-work__title">
          {c.no}. {c.name}
        </h2>
        <div className="rec-work__meta">
          <span className="badge">{l[`status_${c.status}`]}</span>
          {c.waitingParts ? <span className="tag tag--warning">{l.waitingParts}</span> : null}
          <span className="num" data-testid="work-timer">
            {formatDuration(c.workedNowMs + extraMs)} / {formatDuration(c.approvedMinutes * 60_000)}
          </span>
        </div>
        <div className="rec-work__actions">
          {c.allowedEvents.includes('start') ? (
            <Button
              variant="primary"
              size="xl"
              block
              loading={busy === 'start'}
              onClick={() => void act('start')}
              data-testid="work-start"
            >
              {c.status === 'paused' ? l.resume : l.start}
            </Button>
          ) : null}
          {c.allowedEvents.includes('finish') ? (
            <Button
              variant="primary"
              size="xl"
              block
              loading={busy === 'finish'}
              onClick={() => void act('finish')}
              data-testid="work-finish"
            >
              {l.finish}
            </Button>
          ) : null}
          {c.allowedEvents.includes('pause') ? (
            <Button
              variant="secondary"
              size="xl"
              block
              onClick={() => setPicking((x) => !x)}
              data-testid="work-pause"
            >
              {l.pause}
            </Button>
          ) : null}
          {c.canUndo ? (
            <Button
              variant="ghost"
              size="lg"
              block
              loading={busy === 'undo'}
              onClick={() => void run('undo', `/api/v1/rec/items/${c.id}/undo`, body)}
              data-testid="work-undo"
            >
              {l.undo}
            </Button>
          ) : null}
        </div>
        {picking ? (
          <div className="rec-work__reasons" role="group" aria-label={l.pauseReason}>
            {PAUSE_REASONS.map((r) => (
              <Button
                key={r}
                variant="secondary"
                size="lg"
                loading={busy === 'pause'}
                onClick={async () => {
                  if (r === 'other') {
                    setOtherNote(true);
                    return;
                  }
                  if (await act('pause', { reason: r })) setPicking(false);
                }}
                data-testid={`pause-${r}`}
              >
                {l[`reason_${r}`]}
              </Button>
            ))}
          </div>
        ) : null}
        {picking && otherNote ? (
          <div className="stack" data-testid="pause-other-form">
            <div className="field">
              <label className="field__label" htmlFor={`on-${c.id}`}>
                {l.otherNote} *
              </label>
              <input
                id={`on-${c.id}`}
                className="input"
                maxLength={300}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
              <span className="field__hint">{l.otherNoteHint}</span>
            </div>
            <Button
              variant="primary"
              size="lg"
              loading={busy === 'pause'}
              disabled={noteText.trim().length < 3}
              onClick={async () => {
                if (await act('pause', { reason: 'other', note: noteText.trim() })) {
                  setPicking(false);
                  setOtherNote(false);
                  setNoteText('');
                }
              }}
              data-testid="pause-other-go"
            >
              {l.pauseConfirm}
            </Button>
          </div>
        ) : null}
        <div className="rec-actions">
          {c.partLines.length ? (
            <Button
              variant="ghost"
              size="lg"
              onClick={() => setParts((x) => !x)}
              data-testid="work-parts"
            >
              {l.parts}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="lg"
            onClick={() => setPropose((x) => !x)}
            data-testid="work-propose"
          >
            {l.propose}
          </Button>
        </div>
        {parts ? (
          <div className="stack" data-testid="work-parts-form">
            <div className="field">
              <label className="field__label" htmlFor={`pl-${c.id}`}>
                {l.partLine}
              </label>
              <select
                id={`pl-${c.id}`}
                className="select"
                value={sel}
                onChange={(e) => setSel(e.target.value)}
              >
                {c.partLines.map((p) => (
                  <option key={p.lineKey} value={p.lineKey}>
                    {p.name} ({p.code}) · {l.approved} {qtyText(p.qty, p.qtyScale)} · {l.requested}{' '}
                    {qtyText(p.requested, p.qtyScale)} · {l.issued} {qtyText(p.issued, p.qtyScale)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor={`pq-${c.id}`}>
                {l.qty}
              </label>
              <input
                id={`pq-${c.id}`}
                className="input input--num"
                type="number"
                min={1}
                max={Math.max(1, left)}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <Button
              variant="primary"
              size="lg"
              disabled={!line || left < 1}
              loading={busy === 'request'}
              onClick={async () => {
                if (
                  await run('request', `/api/v1/rec/orders/${c.orderId}/part-requests`, {
                    itemId: c.id,
                    lineKey: sel,
                    qty,
                  })
                )
                  setParts(false);
              }}
              data-testid="work-parts-send"
            >
              {l.sendRequest}
            </Button>
          </div>
        ) : null}
        {propose ? (
          <div className="stack" data-testid="work-propose-form">
            <div className="field">
              <label className="field__label" htmlFor={`pt-${c.id}`}>
                {l.proposeTitle}
              </label>
              <input
                id={`pt-${c.id}`}
                className="input"
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor={`pn-${c.id}`}>
                {l.proposeNote}
              </label>
              <textarea
                id={`pn-${c.id}`}
                className="textarea"
                rows={2}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <span className="field__hint">{l.noPhotos}</span>
            </div>
            <Button
              variant="primary"
              size="lg"
              disabled={title.trim().length < 3}
              loading={busy === 'propose'}
              onClick={async () => {
                if (
                  await run('propose', `/api/v1/rec/orders/${c.orderId}/proposals`, {
                    version: c.orderVersion,
                    title: title.trim(),
                    ...(note.trim() ? { note: note.trim() } : {}),
                  })
                ) {
                  setPropose(false);
                  setTitle('');
                  setNote('');
                }
              }}
              data-testid="work-propose-send"
            >
              {l.sendProposal}
            </Button>
          </div>
        ) : null}
        {error ? (
          <div className="alert alert--danger" role="alert" data-testid="work-error">
            <div className="alert__body">{error}</div>
          </div>
        ) : null}
      </div>
    </article>
  );
}
