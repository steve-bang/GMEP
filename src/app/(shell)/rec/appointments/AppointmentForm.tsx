'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/ui/components/Button';
import { DateInput } from '@/ui/components/DateInput';
import { newKey, postJson, type Problem } from '@/ui/components/postJson';
import { isoToVi, viToIso } from '@/platform/format/date';
import { problemText } from './labels';

interface VehicleHit {
  id: string;
  plate: string;
  make: string;
  model: string;
  year: number;
  owner: { id: string; name: string } | null;
}

export interface AppointmentInitial {
  id: string;
  version: number;
  number: string;
  plate: string;
  vehicleLabel: string;
  customerName: string;
  date: string;
  time: string;
  serviceType: string | null;
  advisorId: string | null;
  note: string | null;
}

/** Half-hour slots of the working day; the design's select (G2-APT-02). A stored time outside the grid is kept. */
const SLOTS = Array.from({ length: 24 }, (_, i) => {
  const m = 7 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
});

/**
 * G2-APT-02 (FR-REC-019, 027): book or edit an appointment. The vehicle comes from CRM (plate prefix, or the customers
 * found by name/phone and their vehicles). Over capacity answers 409 `capacity_exceeded`: the advisor sees the warning
 * with the figures and confirms ("Vẫn đặt lịch"), which resends with `acknowledgeOverCapacity`. One Idempotency-Key per
 * distinct body, so a network retry is safe and a changed request is a new one.
 */
export function AppointmentForm(props: {
  labels: Record<string, string>;
  services: { code: string; name: string }[];
  advisors: { id: string; name: string }[];
  initial?: AppointmentInitial;
  defaultDate: string;
}) {
  const l = props.labels;
  const router = useRouter();
  const edit = props.initial;
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<VehicleHit[] | null>(null);
  const [noVehicleOf, setNoVehicleOf] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<VehicleHit | null>(null);
  const [service, setService] = useState(edit?.serviceType ?? '');
  const [advisor, setAdvisor] = useState(edit?.advisorId ?? '');
  const [time, setTime] = useState(edit?.time ?? '');
  const [note, setNote] = useState(edit?.note ?? '');
  const dateEl = () => document.getElementById('apt-date') as HTMLInputElement | null;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const keys = useRef(new Map<string, string>());
  const seq = useRef(0);

  useEffect(() => {
    if (edit) return;
    const q = query.trim();
    if (q.replace(/\s/g, '').length < 3) {
      seq.current += 1;
      return;
    }
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const out = new Map<string, VehicleHit>();
        const res = await fetch(`/api/v1/crm/vehicles?limit=8&q=${encodeURIComponent(q)}`);
        const body = (await res.json().catch(() => null)) as { items?: VehicleHit[] } | null;
        for (const v of body?.items ?? []) out.set(v.id, v);
        const empty: string[] = [];
        // a plate has letters AND digits; a phone only digits, a name only letters: those also search customers
        if (!(/[a-z]/i.test(q) && /\d/.test(q))) {
          const cr = await fetch(`/api/v1/crm/customers?limit=5&q=${encodeURIComponent(q)}`);
          const cb = (await cr.json().catch(() => null)) as {
            items?: { id: string; name: string; status: string }[];
          } | null;
          for (const c of (cb?.items ?? []).filter((x) => x.status === 'active')) {
            const vr = await fetch(`/api/v1/crm/customers/${encodeURIComponent(c.id)}/vehicles`);
            const vb = (await vr.json().catch(() => null)) as
              VehicleHit[] | { items?: VehicleHit[] } | null;
            const list = Array.isArray(vb) ? vb : (vb?.items ?? []);
            if (list.length === 0) empty.push(c.name);
            for (const v of list)
              out.set(v.id, { ...v, owner: v.owner ?? { id: c.id, name: c.name } });
          }
        }
        if (mine !== seq.current) return;
        setHits([...out.values()]);
        setNoVehicleOf(empty);
      } catch {
        if (mine === seq.current) setBanner(l.f_failed ?? '');
      } finally {
        if (mine === seq.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const keyFor = (body: unknown) => {
    const k = JSON.stringify(body);
    if (!keys.current.has(k)) keys.current.set(k, newKey());
    return keys.current.get(k)!;
  };

  async function submit(acknowledge: boolean) {
    const e: Record<string, string> = {};
    // FR-REC-046: an existing appointment is moved only by the reschedule action; the edit screen has no date or time
    const date = edit ? edit.date : viToIso(dateEl()?.value);
    if (!edit && !picked) e.vehicle = l.f_reqVehicle ?? '';
    if (!edit && !date) e.date = l.f_reqDate ?? '';
    if (!edit && !time) e.time = l.f_reqTime ?? '';
    setErrors(e);
    setBanner(null);
    if (Object.keys(e).length) return;
    const common = {
      date,
      time,
      ...(acknowledge ? { acknowledgeOverCapacity: true } : {}),
    };
    const body = edit
      ? {
          version: edit.version,
          serviceType: service || null,
          advisorId: advisor || null,
          note: note.trim() || null,
        }
      : {
          vehicleId: picked!.id,
          ...common,
          ...(service ? { serviceType: service } : {}),
          ...(advisor ? { advisorId: advisor } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        };
    setBusy(true);
    const r = await postJson(
      edit ? `/api/v1/rec/appointments/${encodeURIComponent(edit.id)}` : '/api/v1/rec/appointments',
      edit ? 'PATCH' : 'POST',
      body,
      keyFor(body),
    );
    setBusy(false);
    if (r.ok) {
      router.push(`/rec/appointments?from=${date}`);
      router.refresh();
      return;
    }
    if (r.status === 0) {
      setBanner(l.f_unexpected ?? '');
      return;
    }
    const p: Problem | null = r.problem;
    if (r.status === 409 && p?.code === 'capacity_exceeded') {
      setOver(p.errors?.[0]?.message ?? l.f_overTitle ?? '');
      return;
    }
    setOver(null);
    if (r.status === 422 && p?.errors?.length) {
      setErrors(Object.fromEntries(p.errors.map((x) => [x.field, x.message])));
      return;
    }
    setBanner(problemText(l, p, l.f_unexpected ?? ''));
  }

  // results of a shorter (cleared) query are not shown
  const shown = query.trim().replace(/\s/g, '').length >= 3 ? hits : null;
  const err = (k: string) => errors[k];
  return (
    <form
      className="card"
      noValidate
      data-testid="appointment-form"
      onSubmit={(ev) => {
        ev.preventDefault();
        void submit(false);
      }}
    >
      <div className="card__body stack">
        {banner ? (
          <div className="alert alert--danger" role="alert" data-testid="apt-error">
            <div className="alert__body">{banner}</div>
          </div>
        ) : null}
        {over ? (
          <div className="alert alert--warning" role="alert" data-testid="apt-over">
            <div className="alert__body stack">
              <span className="alert__title">{l.f_overTitle}</span>
              <span>{over}</span>
              <span className="rec-actions">
                <Button
                  variant="primary"
                  loading={busy}
                  onClick={() => void submit(true)}
                  data-testid="apt-over-confirm"
                >
                  {l.f_overConfirm}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setOver(null);
                    dateEl()?.focus();
                  }}
                >
                  {l.f_overOther}
                </Button>
              </span>
            </div>
          </div>
        ) : null}

        {edit ? (
          <div className="field">
            <span className="field__label">{l.f_vehicleFixed}</span>
            <p data-testid="apt-vehicle">
              <span className="plate-tag">{edit.plate}</span> <strong>{edit.vehicleLabel}</strong> ·{' '}
              {edit.customerName} · <span className="code">{edit.number}</span>
            </p>
          </div>
        ) : (
          <div className="field">
            <label className="field__label" htmlFor="apt-q">
              {l.f_vehicle}
              <span className="field__req" aria-hidden="true">
                *
              </span>
            </label>
            {picked ? (
              <div className="rec-found" data-testid="apt-picked">
                <div>
                  <span className="plate-tag">{picked.plate}</span>{' '}
                  <strong>
                    {picked.make} {picked.model} {picked.year}
                  </strong>
                  <p className="text-secondary">
                    {l.f_owner}: {picked.owner?.name}
                  </p>
                </div>
                <Button variant="ghost" onClick={() => setPicked(null)}>
                  {l.f_change}
                </Button>
              </div>
            ) : (
              <>
                <input
                  id="apt-q"
                  className="input"
                  autoComplete="off"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-describedby="apt-q-h apt-q-e"
                  aria-invalid={err('vehicle') ? true : undefined}
                  placeholder="51h12345"
                />
                <span className="field__hint" id="apt-q-h">
                  {l.f_vehicleHint}
                </span>
                <div role="status" aria-live="polite" className="text-secondary">
                  {searching ? l.f_searching : ''}
                </div>
                {(shown ?? []).map((v) => (
                  <div key={v.id} className="rec-found" data-testid="apt-hit">
                    <div>
                      <span className="plate-tag">{v.plate}</span>{' '}
                      <strong>
                        {v.make} {v.model} {v.year}
                      </strong>
                      <p className="text-secondary">
                        {l.f_owner}: {v.owner?.name ?? '—'}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      disabled={!v.owner}
                      onClick={() => {
                        setPicked(v);
                        setErrors((x) => ({ ...x, vehicle: '' }));
                      }}
                      aria-label={`${l.f_pick}: ${v.plate}`}
                    >
                      {l.f_pick}
                    </Button>
                  </div>
                ))}
                {noVehicleOf.map((n) => (
                  <p key={n} className="text-secondary">
                    {(l.f_customerNoVehicle ?? '').replace('{name}', n)}
                  </p>
                ))}
                {shown !== null && shown.length === 0 && !searching ? (
                  <div className="stack">
                    <p className="text-secondary">{l.f_none}</p>
                    <p className="text-secondary">{l.f_noneHelp}</p>
                    <span className="rec-actions">
                      <Link className="btn btn--secondary" href="/crm/customers/new">
                        {l.f_addCustomer}
                      </Link>
                      <Link className="btn btn--secondary" href="/crm/vehicles/new">
                        {l.f_addVehicle}
                      </Link>
                    </span>
                  </div>
                ) : null}
              </>
            )}
            <span className="field__error" id="apt-q-e" role={err('vehicle') ? 'alert' : undefined}>
              {err('vehicle') ?? err('vehicleId')}
            </span>
          </div>
        )}

        <div className="form-grid">
          {edit ? (
            <div className="field" data-testid="apt-moved-hint">
              <span className="field__label">{l.kv_at}</span>
              <p>
                {(l.editMove ?? '').replace('{at}', `${isoToVi(edit.date)} ${edit.time}`)}{' '}
                <Link
                  href={`/rec/appointments?from=${edit.date}&resched=${encodeURIComponent(edit.id)}`}
                  data-testid="apt-go-resched"
                >
                  {l.editGoResched}
                </Link>
              </p>
            </div>
          ) : (
            <>
              <div className="field">
                <label className="field__label" htmlFor="apt-date">
                  {l.f_date}
                  <span className="field__req" aria-hidden="true">
                    *
                  </span>
                </label>
                <DateInput
                  id="apt-date"
                  defaultValue={isoToVi(props.defaultDate)}
                  aria-describedby="apt-date-e"
                  aria-invalid={err('date') ? true : undefined}
                />
                <span
                  className="field__error"
                  id="apt-date-e"
                  role={err('date') ? 'alert' : undefined}
                >
                  {err('date')}
                </span>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="apt-time">
                  {l.f_time}
                  <span className="field__req" aria-hidden="true">
                    *
                  </span>
                </label>
                <select
                  id="apt-time"
                  className="select"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  aria-describedby="apt-time-e"
                  aria-invalid={err('time') ? true : undefined}
                >
                  <option value="" />
                  {(time && !SLOTS.includes(time) ? [...SLOTS, time].sort() : SLOTS).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <span
                  className="field__error"
                  id="apt-time-e"
                  role={err('time') ? 'alert' : undefined}
                >
                  {err('time')}
                </span>
              </div>
            </>
          )}
          <div className="field">
            <label className="field__label" htmlFor="apt-service">
              {l.f_service}
            </label>
            <select
              id="apt-service"
              className="select"
              value={service}
              onChange={(e) => setService(e.target.value)}
            >
              <option value="">{l.f_serviceNone}</option>
              {props.services.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
            <span className="field__error">{err('serviceType')}</span>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="apt-advisor">
              {l.f_advisor}
            </label>
            <select
              id="apt-advisor"
              className="select"
              value={advisor}
              onChange={(e) => setAdvisor(e.target.value)}
            >
              <option value="">{l.f_advisorAuto}</option>
              {props.advisors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <span className="field__error">{err('advisorId')}</span>
          </div>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="apt-note">
            {l.f_note}
          </label>
          <textarea
            id="apt-note"
            className="textarea"
            style={{ minHeight: 64 }}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={l.f_notePlaceholder}
          />
        </div>
      </div>
      <div className="card__footer rec-actions">
        <Link className="btn btn--secondary" href="/rec/appointments">
          {l.f_cancel}
        </Link>
        <Button type="submit" variant="primary" loading={busy} data-testid="apt-save">
          {l.f_save}
        </Button>
      </div>
    </form>
  );
}
