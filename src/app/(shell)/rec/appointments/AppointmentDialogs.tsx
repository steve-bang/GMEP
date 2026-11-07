'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AppointmentDto } from '@/modules/rec';
import { isoToVi, viToIso } from '@/platform/format/date';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { DateInput } from '@/ui/components/DateInput';
import { Icon } from '@/ui/components/Icon';
import { newKey, postJson, type Problem } from '@/ui/components/postJson';
import { atText, fill, minutesOf, SLOTS } from './appointmentText';
import { problemText } from './labels';

export interface Reason {
  code: string;
  name: string;
  party: 'customer' | 'garage' | 'other';
  noteRequired: boolean;
}

export interface AptPolicy {
  overdueGraceMinutes: number;
  staleDays: number;
  maxReschedules: number;
  lateRescheduleMinutes: number;
  noteMinLength: number;
}

type Labels = Record<string, string>;

/** one Idempotency-Key per distinct request, kept until the server answers (a retry is safe, a changed request is new) */
function useCall(apt: AppointmentDto) {
  const keys = useRef(new Map<string, string>());
  return async (path: string, method: string, body: Record<string, unknown>) => {
    const k = `${method}${path}:${JSON.stringify(body)}`;
    if (!keys.current.has(k)) keys.current.set(k, newKey());
    const r = await postJson(
      `/api/v1/rec/appointments/${encodeURIComponent(apt.id)}${path}`,
      method,
      body,
      keys.current.get(k)!,
    );
    if (r.status !== 0) keys.current.delete(k);
    return r;
  };
}

const NOTICE_ERRORS = ['message_no_consent', 'message_channel_unavailable', 'message_no_contact'];

/** FR-REC-045/046 3.7: notify the customer through the gateway (consented channel only) or record a phone call. */
function NotifyBlock(props: {
  l: Labels;
  id: string;
  channel: string | null;
  refused: boolean;
  send: boolean;
  phoned: boolean;
  onSend: (v: boolean) => void;
  onPhoned: (v: boolean) => void;
  disabled: boolean;
}) {
  const { l } = props;
  const locked = !props.channel || props.refused;
  return (
    <div className="stack" data-testid="apt-notify">
      <label className="check">
        <input
          type="checkbox"
          checked={props.send && !locked}
          disabled={locked || props.disabled}
          onChange={(e) => props.onSend(e.target.checked)}
          data-testid="apt-notify-send"
        />
        <span className="check__box">
          <Icon name="check" />
        </span>
        <span>
          {l.n_send} <span className="g2w-muted">{l.n_sendHint}</span>
        </span>
      </label>
      {locked ? (
        <p className="g2w-why" role="status">
          <Icon name="lock" size="sm" />
          <span>{props.refused ? l.n_refused : l.n_noChannel}</span>
        </p>
      ) : null}
      <label className="check">
        <input
          type="checkbox"
          checked={props.phoned}
          disabled={props.disabled || (props.send && !locked)}
          onChange={(e) => props.onPhoned(e.target.checked)}
          data-testid="apt-notify-phoned"
        />
        <span className="check__box">
          <Icon name="check" />
        </span>
        <span>{l.n_phoned}</span>
      </label>
    </div>
  );
}

const noticeBody = (send: boolean, phoned: boolean, channel: string | null) =>
  send && channel
    ? { notice: 'send', noticeChannel: channel }
    : phoned
      ? { notice: 'phoned' }
      : { notice: 'none' };

function Radio(props: {
  name: string;
  value: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  testId?: string;
}) {
  return (
    <label className="radio">
      <input
        type="radio"
        name={props.name}
        value={props.value}
        checked={props.checked}
        disabled={props.disabled}
        onChange={props.onChange}
        data-testid={props.testId}
      />
      <span className="radio__box" />
      <span>{props.label}</span>
    </label>
  );
}

const PARTY_ORDER = ['customer', 'garage', 'other'] as const;

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return children ? (
    <span className="field__error" id={id} role="alert">
      {children}
    </span>
  ) : (
    <span id={id} />
  );
}

// ---- cancel ------------------------------------------------------------------------------------------------------

/** G2-APT-01 "Hủy lịch" (FR-REC-045): a catalogue reason, a note for "Khác", a hint towards Dời lịch, notice to the customer. */
export function CancelDialog(props: {
  l: Labels;
  apt: AppointmentDto;
  reasons: Reason[];
  policy: AptPolicy;
  channel: string | null;
  onClose: () => void;
  onDone: (flash: string) => void;
  onSwitch: () => void;
}) {
  const { l, apt } = props;
  const call = useCall(apt);
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const [send, setSend] = useState(false);
  const [phoned, setPhoned] = useState(false);
  const [refused, setRefused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reason = props.reasons.find((r) => r.code === code);
  const need = !!reason && (reason.noteRequired || reason.code === 'other');
  const min = props.policy.noteMinLength;
  const len = note.trim().length;
  const noteBad = need && len < min;
  const why = !reason ? fill(l.c_whyReason, {}) : noteBad ? fill(l.c_whyNote, { min }) : '';

  async function submit() {
    setBusy(true);
    setError(null);
    const r = await call('/cancel', 'POST', {
      version: apt.version,
      reasonCode: code,
      ...(note.trim() ? { note: note.trim() } : {}),
      ...noticeBody(send, phoned, props.channel),
    });
    setBusy(false);
    if (r.ok) return props.onDone(fill(l.flashCancelled, { number: apt.number }));
    const p: Problem | null = r.problem;
    if (r.status === 0) return setError(l.f_unexpected ?? '');
    if (p?.code && NOTICE_ERRORS.includes(p.code)) {
      setRefused(true);
      setSend(false);
    }
    setError(problemText(l, p, l.f_unexpected ?? ''));
  }

  return (
    <ConfirmDialog
      open
      size="md"
      title={fill(l.c_title, { number: apt.number })}
      confirmLabel={l.c_confirm!}
      cancelLabel={l.c_keep!}
      tone="danger"
      busy={busy}
      confirmDisabled={!!why}
      testId="apt-cancel-dialog"
      onCancel={props.onClose}
      onConfirm={() => void submit()}
    >
      <div className="stack">
        <p className="g2w-muted">
          {apt.plate} · {atText(apt.date, apt.time)} · {apt.number}
        </p>
        {error ? (
          <div className="alert alert--danger" role="alert">
            <div className="alert__body">{error}</div>
          </div>
        ) : null}
        <div className="field">
          <div className="field__label" id="ca-rl">
            {l.c_reason}
            <span className="field__req" aria-hidden="true">
              *
            </span>
          </div>
          <div
            className="g2w-reasons"
            role="radiogroup"
            aria-labelledby="ca-rl"
            aria-required="true"
          >
            {PARTY_ORDER.flatMap((party) => {
              const list = props.reasons.filter((r) => r.party === party);
              if (list.length === 0) return [];
              return [
                <div className="g2w-reasons__grp" key={`g-${party}`}>
                  {l[`grp_${party}`]}
                </div>,
                ...list.map((r) => (
                  <Radio
                    key={r.code}
                    name="ca-reason"
                    value={r.code}
                    label={r.name}
                    checked={code === r.code}
                    onChange={() => setCode(r.code)}
                    testId={`apt-reason-${r.code}`}
                  />
                )),
              ];
            })}
          </div>
        </div>
        {code === 'customer_busy' ? (
          <div className="alert alert--info" role="note">
            <Icon name="info" />
            <div className="alert__body">
              <span className="alert__title">{l.c_hintTitle}</span>
              <span>{l.c_hintText}</span>
            </div>
            <div className="alert__actions">
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={props.onSwitch}
                data-testid="apt-switch-resched"
              >
                {l.c_hintGo}
              </button>
            </div>
          </div>
        ) : null}
        <div className="field">
          <label className="field__label" htmlFor="ca-note">
            {l.c_note}
            {need ? (
              <span className="field__req" aria-hidden="true">
                *
              </span>
            ) : null}
          </label>
          <textarea
            id="ca-note"
            className={`textarea${noteBad && len > 0 ? ' is-error' : ''}`}
            style={{ minHeight: 64 }}
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-invalid={noteBad && len > 0 ? true : undefined}
            aria-describedby="ca-note-h ca-note-e"
            data-testid="apt-cancel-note"
          />
          <span className="field__hint" id="ca-note-h">
            {need ? fill(l.c_noteReq, { min }) : l.c_noteOpt} {l.noteNoPii} ({note.length}/300)
          </span>
          <FieldError id="ca-note-e">
            {noteBad && len > 0 ? fill(l.noteErr, { min, n: len }) : ''}
          </FieldError>
        </div>
        <NotifyBlock
          l={l}
          id="ca"
          channel={props.channel}
          refused={refused}
          send={send}
          phoned={phoned}
          onSend={setSend}
          onPhoned={setPhoned}
          disabled={busy}
        />
        <ul className="impact-list">
          <li>{fill(l.c_impact, { date: isoToVi(apt.date) })}</li>
        </ul>
        {why ? (
          <p className="g2w-why" role="status" data-testid="apt-cancel-why">
            <Icon name="lock" size="sm" />
            <span>{why}</span>
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}

// ---- reschedule --------------------------------------------------------------------------------------------------

interface DayCap {
  booked: number;
  capacity: number;
}

/**
 * G2-APT-01 "Dời lịch" (FR-REC-046): new date and time, capacity of the new day (read from the calendar API), a mandatory
 * reason and requester, warnings for a late move and for the reschedule limit (QL/CH override with a note), notice to
 * the customer. A 409 version keeps what was typed; the list refreshes behind the dialog.
 */
export function RescheduleDialog(props: {
  l: Labels;
  apt: AppointmentDto;
  reasons: Reason[];
  policy: AptPolicy;
  channel: string | null;
  canOverride: boolean;
  now: { date: string; time: string };
  onClose: () => void;
  onDone: (flash: string) => void;
  onReload: () => void;
}) {
  const { l, apt, policy } = props;
  const call = useCall(apt);
  const tomorrow = new Date(`${props.now.date}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const startDate = apt.date > props.now.date ? apt.date : tomorrow.toISOString().slice(0, 10);
  const [dateText, setDateText] = useState(isoToVi(startDate));
  const [time, setTime] = useState(SLOTS.includes(apt.time) ? apt.time : '09:00');
  const [code, setCode] = useState('');
  const [party, setParty] = useState<'customer' | 'workshop' | ''>('');
  const [partyTouched, setPartyTouched] = useState(false);
  const [note, setNote] = useState('');
  const [ovr, setOvr] = useState(false);
  const [capOk, setCapOk] = useState(false);
  const [send, setSend] = useState(false);
  const [phoned, setPhoned] = useState(false);
  const [refused, setRefused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [cap, setCap] = useState<DayCap | null>(null);
  const seq = useRef(0);
  const iso = viToIso(dateText);
  const dateErr = iso ? '' : fill(l.dateInvalid, {});
  const sameDay = iso === apt.date;
  const nowMin = minutesOf(props.now.date, props.now.time);
  const newMin = iso ? minutesOf(iso, time) : 0;
  const grace = policy.overdueGraceMinutes;
  // a new time must be ahead of now; an overdue appointment only has to leave the overdue set (as the server decides)
  const pastErr =
    iso && (apt.overdue ? nowMin - newMin > grace : newMin <= nowMin)
      ? fill(l.r_pastErr, { now: `${props.now.time} ${isoToVi(props.now.date)}` })
      : '';
  const same = iso === apt.date && time === apt.time;
  const minsTo = minutesOf(apt.date, apt.time) - nowMin;
  const late = minsTo >= 0 && minsTo <= policy.lateRescheduleMinutes;
  const atLimit = apt.rescheduleCount >= policy.maxReschedules;
  const blocked = atLimit && !props.canOverride;
  const needOvr = atLimit && props.canOverride;
  const reason = props.reasons.find((r) => r.code === code);
  const needNote =
    (!!reason && (reason.noteRequired || reason.code === 'other')) || (needOvr && ovr);
  const min = policy.noteMinLength;
  const len = note.trim().length;
  const noteBad = needNote && len < min;
  const full = !!cap && !sameDay && cap.capacity > 0 && cap.booked >= cap.capacity;

  useEffect(() => {
    if (!iso || iso === apt.date) {
      seq.current += 1;
      return;
    }
    const mine = ++seq.current;
    void (async () => {
      try {
        const res = await fetch(`/api/v1/rec/appointments?from=${iso}&days=1`);
        const body = (await res.json().catch(() => null)) as {
          days?: DayCap[];
        } | null;
        if (mine === seq.current) setCap(body?.days?.[0] ?? null);
      } catch {
        if (mine === seq.current) setCap(null);
      }
    })();
  }, [iso, apt.date]);

  const suggested = reason && reason.party !== 'other' ? reason.party : null;
  const effParty = partyTouched
    ? party
    : suggested
      ? suggested === 'garage'
        ? 'workshop'
        : 'customer'
      : party;

  const why = blocked
    ? l.r_whyBlocked
    : dateErr
      ? dateErr
      : same
        ? l.r_whySame
        : pastErr
          ? pastErr
          : full && !capOk
            ? l.r_whyCap
            : !reason
              ? l.r_whyReason
              : !effParty
                ? l.r_whyParty
                : needOvr && !ovr
                  ? l.r_whyOvr
                  : noteBad
                    ? fill(l.r_whyNote, { min })
                    : '';

  async function submit() {
    if (!iso || !effParty) return;
    setBusy(true);
    setError(null);
    setConflict(false);
    const r = await call('/reschedule', 'POST', {
      version: apt.version,
      date: iso,
      time,
      reasonCode: code,
      requestedBy: effParty,
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(full && capOk ? { acknowledgeOverCapacity: true } : {}),
      ...(needOvr && ovr ? { overrideLimit: true } : {}),
      ...noticeBody(send, phoned, props.channel),
    });
    setBusy(false);
    if (r.ok) {
      const n = (r.data as { rescheduleCount?: number } | null)?.rescheduleCount ?? 1;
      return props.onDone(fill(l.r_doneText, { number: apt.number, at: atText(iso, time), n }));
    }
    if (r.status === 0) return setError(l.f_unexpected ?? '');
    const p: Problem | null = r.problem;
    if (r.status === 409 && p?.code === 'version_conflict') {
      setConflict(true);
      props.onReload();
      return;
    }
    if (r.status === 409 && p?.code === 'capacity_exceeded') {
      // the day filled up between the check and the save: ask for the confirmation now
      setCap((c) => c ?? { booked: 1, capacity: 1 });
      setCapOk(false);
      setError(p.errors?.[0]?.message ?? null);
      return;
    }
    if (p?.code && NOTICE_ERRORS.includes(p.code)) {
      setRefused(true);
      setSend(false);
    }
    setError(problemText(l, p, l.f_unexpected ?? ''));
  }

  return (
    <ConfirmDialog
      open
      size="md"
      title={fill(l.r_title, { number: apt.number })}
      confirmLabel={l.r_confirm!}
      cancelLabel={l.r_close!}
      busy={busy}
      confirmDisabled={!!why}
      testId="apt-resched-dialog"
      onCancel={props.onClose}
      onConfirm={() => void submit()}
    >
      <div className="stack">
        <p className="g2w-muted">
          {apt.plate} · {apt.customerName} · {apt.number}
        </p>
        {conflict ? (
          <div className="alert alert--warning" role="alert" data-testid="apt-conflict">
            <Icon name="alert-triangle" />
            <div className="alert__body">
              <span className="alert__title">{l.r_conflictTitle}</span>
              <span>{l.r_conflictText}</span>
            </div>
          </div>
        ) : null}
        {error ? (
          <div className="alert alert--danger" role="alert">
            <div className="alert__body">{error}</div>
          </div>
        ) : null}
        <div className="g2w-delta" role="group" aria-label={l.r_deltaLabel}>
          <div>
            <span className="g2w-delta__lbl">{l.r_now}</span>
            <strong>{atText(apt.date, apt.time)}</strong>
          </div>
          <Icon name="arrow-right" />
          <div>
            <span className="g2w-delta__lbl">{l.r_new}</span>
            <strong data-testid="apt-resched-to">{iso ? atText(iso, time) : '–'}</strong>
          </div>
        </div>
        <div className="g2w-two">
          <div className="field">
            <label className="field__label" htmlFor="rs-date">
              {l.r_date}
              <span className="field__req" aria-hidden="true">
                *
              </span>
            </label>
            <DateInput
              id="rs-date"
              defaultValue={dateText}
              onChange={(e) => setDateText(e.target.value)}
              aria-describedby="rs-date-e"
              aria-invalid={dateErr ? true : undefined}
            />
            <FieldError id="rs-date-e">{dateErr}</FieldError>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="rs-time">
              {l.r_time}
              <span className="field__req" aria-hidden="true">
                *
              </span>
            </label>
            <select
              id="rs-time"
              className="select"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              aria-describedby="rs-time-h rs-time-e"
              aria-invalid={pastErr ? true : undefined}
            >
              {(SLOTS.includes(time) ? SLOTS : [...SLOTS, time].sort()).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <span className="field__hint" id="rs-time-h">
              {l.r_timeHint}
            </span>
            <FieldError id="rs-time-e">{pastErr}</FieldError>
          </div>
        </div>
        {iso && sameDay ? (
          <p className="g2w-muted" role="status">
            {fill(l.r_sameDay, { date: isoToVi(iso) })}
          </p>
        ) : null}
        {iso && !sameDay && cap && !full ? (
          <p className="g2w-muted" role="status" data-testid="apt-resched-cap">
            {cap.capacity > 0
              ? fill(l.r_capInfo, {
                  date: isoToVi(iso),
                  booked: cap.booked,
                  cap: cap.capacity,
                  free: cap.capacity - cap.booked,
                  old: isoToVi(apt.date),
                })
              : fill(l.r_capNoCap, {
                  date: isoToVi(iso),
                  booked: cap.booked,
                  old: isoToVi(apt.date),
                })}
          </p>
        ) : null}
        {iso && full && cap ? (
          <div className="stack" data-testid="apt-resched-over">
            <div className="alert alert--warning" role="alert">
              <Icon name="alert-triangle" />
              <div className="alert__body">
                <span className="alert__title">
                  {fill(l.r_capWarnTitle, {
                    date: isoToVi(iso),
                    booked: cap.booked,
                    cap: cap.capacity,
                  })}
                </span>
                <span>{l.r_capWarnText}</span>
              </div>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={capOk}
                onChange={(e) => setCapOk(e.target.checked)}
                data-testid="apt-resched-over-ok"
              />
              <span className="check__box">
                <Icon name="check" />
              </span>
              <span>{l.r_capConfirm}</span>
            </label>
          </div>
        ) : null}
        {late ? (
          <div className="alert alert--info" role="note" data-testid="apt-resched-late">
            <Icon name="clock" />
            <div className="alert__body">
              <span className="alert__title">{l.r_lateTitle}</span>
              <span>
                {fill(l.r_lateText, { min: minsTo, window: policy.lateRescheduleMinutes })}
              </span>
            </div>
          </div>
        ) : null}
        {blocked ? (
          <div className="alert alert--danger" role="alert" data-testid="apt-resched-blocked">
            <Icon name="lock" />
            <div className="alert__body">
              <span className="alert__title">{l.r_limitTitle}</span>
              <span>
                {fill(l.r_limitBlock, { n: apt.rescheduleCount, max: policy.maxReschedules })}
              </span>
            </div>
          </div>
        ) : null}
        {needOvr ? (
          <div className="stack" data-testid="apt-resched-limit">
            <div className="alert alert--warning" role="alert">
              <Icon name="alert-triangle" />
              <div className="alert__body">
                <span className="alert__title">{l.r_limitOvrTitle}</span>
                <span>
                  {fill(l.r_limitOvr, { n: apt.rescheduleCount, max: policy.maxReschedules })}
                </span>
              </div>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={ovr}
                onChange={(e) => setOvr(e.target.checked)}
                data-testid="apt-resched-override"
              />
              <span className="check__box">
                <Icon name="check" />
              </span>
              <span>{l.r_limitOvrCheck}</span>
            </label>
          </div>
        ) : null}
        <div className="field">
          <div className="field__label" id="rs-rl">
            {l.r_reason}
            <span className="field__req" aria-hidden="true">
              *
            </span>
          </div>
          <div
            className="g2w-reasons"
            role="radiogroup"
            aria-labelledby="rs-rl"
            aria-required="true"
          >
            {props.reasons.map((r) => (
              <Radio
                key={r.code}
                name="rs-reason"
                value={r.code}
                label={r.name}
                checked={code === r.code}
                onChange={() => setCode(r.code)}
                testId={`apt-rs-reason-${r.code}`}
              />
            ))}
          </div>
        </div>
        <div className="field">
          <div className="field__label" id="rs-pl">
            {l.r_party}
            <span className="field__req" aria-hidden="true">
              *
            </span>
          </div>
          <div className="g2w-party" role="radiogroup" aria-labelledby="rs-pl" aria-required="true">
            <Radio
              name="rs-pt"
              value="customer"
              label={l.partyCustomer!}
              checked={effParty === 'customer'}
              onChange={() => {
                setParty('customer');
                setPartyTouched(true);
              }}
              testId="apt-party-customer"
            />
            <Radio
              name="rs-pt"
              value="workshop"
              label={l.partyWorkshop!}
              checked={effParty === 'workshop'}
              onChange={() => {
                setParty('workshop');
                setPartyTouched(true);
              }}
              testId="apt-party-workshop"
            />
          </div>
          {suggested && !partyTouched ? <span className="field__hint">{l.r_partyHint}</span> : null}
        </div>
        <div className="field">
          <label className="field__label" htmlFor="rs-note">
            {l.c_note}
            {needNote ? (
              <span className="field__req" aria-hidden="true">
                *
              </span>
            ) : null}
          </label>
          <textarea
            id="rs-note"
            className={`textarea${noteBad && len > 0 ? ' is-error' : ''}`}
            style={{ minHeight: 64 }}
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-invalid={noteBad && len > 0 ? true : undefined}
            aria-describedby="rs-note-h rs-note-e"
            data-testid="apt-resched-note"
          />
          <span className="field__hint" id="rs-note-h">
            {needNote
              ? fill(reason && reason.code === 'other' ? l.r_noteReqOther : l.r_noteReqOvr, { min })
              : l.c_noteOpt}{' '}
            {l.noteNoPii} ({note.length}/300)
          </span>
          <FieldError id="rs-note-e">
            {noteBad && len > 0 ? fill(l.noteErr, { min, n: len }) : ''}
          </FieldError>
        </div>
        <NotifyBlock
          l={l}
          id="rs"
          channel={props.channel}
          refused={refused}
          send={send}
          phoned={phoned}
          onSend={setSend}
          onPhoned={setPhoned}
          disabled={busy}
        />
        {why ? (
          <p className="g2w-why" role="status" data-testid="apt-resched-why">
            <Icon name="lock" size="sm" />
            <span>{why}</span>
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}

// ---- no-show and advisor -----------------------------------------------------------------------------------------

/** "Đánh dấu vắng" (FR-REC-027): a final state, confirmed with its consequences spelled out. */
export function AbsentDialog(props: {
  l: Labels;
  apt: AppointmentDto;
  onClose: () => void;
  onDone: (flash: string) => void;
}) {
  const { l, apt } = props;
  const call = useCall(apt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <ConfirmDialog
      open
      title={fill(l.ab_title, { number: apt.number })}
      confirmLabel={l.ab_confirm!}
      cancelLabel={l.ab_keep!}
      tone="danger"
      busy={busy}
      testId="apt-no-show-dialog"
      onCancel={props.onClose}
      onConfirm={() =>
        void (async () => {
          setBusy(true);
          setError(null);
          const r = await call('/no-show', 'POST', { version: apt.version });
          setBusy(false);
          if (r.ok) return props.onDone(fill(l.flashNoShow, { number: apt.number }));
          setError(problemText(l, r.problem, l.f_unexpected ?? ''));
        })()
      }
    >
      <ul className="impact-list">
        <li>{l.ab_i1}</li>
        <li>{l.ab_i2}</li>
      </ul>
      <p className="g2w-muted">{l.ab_hint}</p>
      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : null}
    </ConfirmDialog>
  );
}

/** "Đổi cố vấn" (FR-REC-027): the advisor can be changed without a reason. */
export function AdvisorDialog(props: {
  l: Labels;
  apt: AppointmentDto;
  advisors: { id: string; name: string }[];
  onClose: () => void;
  onDone: (flash: string) => void;
}) {
  const { l, apt } = props;
  const call = useCall(apt);
  const [advisor, setAdvisor] = useState(apt.advisorId ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <ConfirmDialog
      open
      title={fill(l.a_advisorTitle, { number: apt.number })}
      confirmLabel={l.a_advisorConfirm!}
      cancelLabel={l.a_back!}
      busy={busy}
      testId="apt-advisor-dialog"
      onCancel={props.onClose}
      onConfirm={() =>
        void (async () => {
          setBusy(true);
          setError(null);
          const r = await call('', 'PATCH', { version: apt.version, advisorId: advisor || null });
          setBusy(false);
          if (r.ok) return props.onDone(fill(l.flashAdvisor, { number: apt.number }));
          setError(problemText(l, r.problem, l.f_unexpected ?? ''));
        })()
      }
    >
      <div className="field">
        <label className="field__label" htmlFor="apt-adv">
          {l.f_advisor}
        </label>
        <select
          id="apt-adv"
          className="select"
          value={advisor}
          onChange={(e) => setAdvisor(e.target.value)}
          data-testid="apt-advisor-select"
        >
          <option value="">{l.f_advisorAuto}</option>
          {props.advisors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {error ? (
          <span className="field__error" role="alert">
            {error}
          </span>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
