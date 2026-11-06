'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/ui/components/Button';
import { Icon } from '@/ui/components/Icon';
import { useOnline } from '@/ui/useOnline';
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
  customerShort: string;
  promisedDate: string | null;
  blockedReason: 'waiting_parts' | 'order_paused' | 'order_not_active' | null;
  qcReturn: { at: string; note: string | null; failedChecks: string[] } | null;
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

export interface LockedCard {
  proposalId: string;
  orderNumber: string;
  plate: string;
  vehicleLabel: string;
  customerShort: string;
  title: string;
  stage: 'open' | 'quoted';
}

type Filter = 'all' | 'doing' | 'todo' | 'paused';
const groupOf = (status: string): Filter | 'done' =>
  status === 'in_progress'
    ? 'doing'
    : status === 'paused'
      ? 'paused'
      : status === 'done'
        ? 'done'
        : 'todo';

/** R41: five stable codes; `other` needs a note */
const PAUSE_REASONS = [
  'waiting_parts',
  'waiting_customer',
  'awaiting_supplement_approval',
  'break',
  'other',
] as const;

/** G2-TEC-01/02/03/04: big buttons for the technician. Start and finish are ONE tap (FR-REC-013: at most 2 taps); pause adds the reason tap. */
export function WorkCards({
  cards,
  locked,
  labels: l,
}: {
  cards: WorkCard[];
  locked: LockedCard[];
  labels: Labels;
}) {
  const online = useOnline();
  const [filter, setFilter] = useState<Filter>('all');
  const count = (f: Filter) =>
    f === 'all'
      ? cards.filter((c) => c.status !== 'done').length + locked.length
      : cards.filter((c) => groupOf(c.status) === f).length + (f === 'todo' ? locked.length : 0);
  const shown = (g: Filter | 'done') => filter === 'all' || filter === g;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const [t0] = useState(() => Date.now());
  const filters: Filter[] = ['all', 'doing', 'todo', 'paused'];
  const cap = {
    all: l.filterAll,
    doing: l.filterDoing,
    todo: l.filterTodo,
    paused: l.filterPaused,
  };
  const visible = cards.filter((c) => shown(groupOf(c.status)));
  const visibleLocked = shown('todo') ? locked : [];
  return (
    <div className="stack">
      {!online ? (
        <div className="alert alert--warning" role="status" data-testid="work-offline">
          <Icon name="wifi-off" />
          <div className="alert__body">
            <span className="alert__title">{l.offlineTitle}</span>
            <span>{l.offlineText}</span>
          </div>
        </div>
      ) : null}
      <div className="rec-work__filter" role="group" aria-label={l.filterLabel}>
        <div className="segmented">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              className="segmented__item"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              data-testid={`work-filter-${f}`}
            >
              {cap[f]!.replace('{n}', String(count(f)))}
            </button>
          ))}
        </div>
      </div>
      {visible.length + visibleLocked.length === 0 ? (
        <p className="text-secondary" data-testid="work-filter-empty">
          {l.filterEmpty}
        </p>
      ) : (
        <div className="rec-work" data-testid="work-cards">
          {visible.map((c) => (
            <Card key={c.id} c={c} l={l} online={online} extraMs={c.running ? now - t0 : 0} />
          ))}
          {visibleLocked.map((p) => (
            <LockedProposal key={p.proposalId} p={p} l={l} />
          ))}
        </div>
      )}
    </div>
  );
}

/** RULE-005/006: work the customer has not approved is shown, never startable, with the reason in words. */
function LockedProposal({ p, l }: { p: LockedCard; l: Labels }) {
  const why = p.stage === 'quoted' ? l.lockedWhyQuoted : l.lockedWhyOpen;
  const id = `lw-${p.proposalId}`;
  return (
    <article
      className="g1-job g1-job--blocked"
      data-testid="work-locked"
      aria-labelledby={`${id}-t`}
    >
      <div className="g1-job__top">
        <div>
          <div className="g1-job__plate">
            {p.plate} <span className="t-body-md text-secondary">{p.vehicleLabel}</span>
          </div>
          <h2 className="g1-job__title" id={`${id}-t`}>
            {p.title}
          </h2>
        </div>
        <div className="rec-work__stack">
          <span className="badge badge--neutral badge--lg">{l.status_not_started}</span>
          <span className="tag tag--warning">
            {p.stage === 'quoted' ? l.lockedQuoted : l.lockedOpen}
          </span>
        </div>
      </div>
      <div className="g1-job__meta">
        <span className="code">{p.orderNumber}</span>
        {p.customerShort ? <span>{l.customer!.replace('{name}', p.customerShort)}</span> : null}
      </div>
      <div className="g1-job__actions">
        <Button variant="secondary" disabled aria-describedby={id}>
          {l.start}
        </Button>
      </div>
      <p className="g1-job__why" id={id}>
        <Icon name="lock" size="sm" />
        {why}
      </p>
    </article>
  );
}

function Card({
  c,
  l,
  extraMs,
  online,
}: {
  c: WorkCard;
  l: Labels;
  extraMs: number;
  online: boolean;
}) {
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
    <article
      className={`g1-job rec-work__card${c.running ? ' g1-job--active' : ''}${c.blockedReason ? ' g1-job--blocked' : ''}`}
      data-testid="work-card"
      data-status={c.status}
      aria-labelledby={`wt-${c.id}`}
    >
      <div className="g1-job__body stack">
        <div className="g1-job__top">
          <div>
            <div className="g1-job__plate">
              <span className="plate">{c.plate}</span>{' '}
              <span className="t-body-md text-secondary">{c.vehicleLabel}</span>
            </div>
            <h2 className="g1-job__title" id={`wt-${c.id}`}>
              {c.no}. {c.name}
            </h2>
          </div>
          <div className="rec-work__stack">
            <span
              className={`badge badge--lg ${
                c.status === 'in_progress'
                  ? 'badge--info'
                  : c.status === 'paused'
                    ? 'badge--warning'
                    : c.status === 'returned'
                      ? 'badge--danger'
                      : c.status === 'done'
                        ? 'badge--success'
                        : 'badge--neutral'
              }`}
            >
              {l[`status_${c.status}`]}
            </span>
            {c.waitingParts ? <span className="tag tag--warning">{l.waitingParts}</span> : null}
            {c.status === 'paused' && c.pauseReason && c.pauseReason !== 'waiting_parts' ? (
              <span className="tag tag--warning">{l[`reason_${c.pauseReason}`] ?? ''}</span>
            ) : null}
          </div>
        </div>
        <div className="g1-job__meta">
          <span className="code">{c.orderNumber}</span>
          {c.customerShort ? <span>{l.customer!.replace('{name}', c.customerShort)}</span> : null}
          <span className="num" data-testid="work-timer">
            {formatDuration(c.workedNowMs + extraMs)} / {formatDuration(c.approvedMinutes * 60_000)}
          </span>
          {c.promisedDate ? <span>{l.promised!.replace('{date}', c.promisedDate)}</span> : null}
        </div>
        {c.qcReturn ? (
          <div className="alert alert--danger" data-testid="work-qc-return">
            <Icon name="alert-triangle" />
            <div className="alert__body">
              <span className="alert__title">{l.qcTitle}</span>
              <span>{c.qcReturn.note ?? l.qcNoNote}</span>
              {c.qcReturn.failedChecks.length ? (
                <span>{l.qcFailed!.replace('{list}', c.qcReturn.failedChecks.join('; '))}</span>
              ) : null}
            </div>
          </div>
        ) : null}
        {c.status === 'done' ? <p className="g1-note">{l.doneNote}</p> : null}
        <div className="rec-work__actions">
          {c.allowedEvents.includes('start') ? (
            <Button
              variant="primary"
              size="xl"
              block
              loading={busy === 'start'}
              disabled={!online}
              onClick={() => void act('start')}
              data-testid="work-start"
            >
              {c.status === 'paused' ? l.resume : c.status === 'returned' ? l.redo : l.start}
            </Button>
          ) : null}
          {c.allowedEvents.includes('finish') ? (
            <Button
              variant="primary"
              size="xl"
              block
              loading={busy === 'finish'}
              disabled={!online}
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
              disabled={!online}
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
              disabled={!online}
              onClick={() => void run('undo', `/api/v1/rec/items/${c.id}/undo`, body)}
              data-testid="work-undo"
            >
              {l.undo}
            </Button>
          ) : null}
        </div>
        {c.blockedReason ? (
          <>
            <div className="rec-work__actions">
              <Button
                variant="secondary"
                size="xl"
                block
                disabled
                aria-describedby={`bw-${c.id}`}
                data-testid="work-start-locked"
              >
                {c.status === 'paused' ? l.resume : l.start}
              </Button>
            </div>
            <p className="g1-job__why" id={`bw-${c.id}`} data-testid="work-blocked-why">
              <Icon name="lock" size="sm" />
              {l[`why_${c.blockedReason}`]}
            </p>
          </>
        ) : null}
        {!online && (c.allowedEvents.length > 0 || c.canUndo) ? (
          <p className="g1-lockwhy" data-testid="work-offline-lock">
            <Icon name="lock" size="sm" />
            {l.offlineLock}
          </p>
        ) : null}
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
