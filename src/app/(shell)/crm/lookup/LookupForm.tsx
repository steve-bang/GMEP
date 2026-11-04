'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Button } from '@/ui/components/Button';
import { newKey, postJson } from '@/ui/components/ResourceForm';

interface CustomerP {
  id: string;
  code: string;
  name: string;
  marketing: string[];
  branches: string[];
  vehicles: { id: string; plate: string; make: string; model: string; year: number }[];
  related: boolean;
}
interface VehicleP {
  id: string;
  plate: string;
  make: string;
  model: string;
  year: number;
  vinMasked: string | null;
  owner: CustomerP | null;
  related: boolean;
}
interface Result {
  vehicles: VehicleP[];
  customers: CustomerP[];
}

/** Exact lookup (POST so the phone never appears in a URL or a server access log). */
export function LookupForm(props: {
  canRelate: boolean;
  /** C9: QĐ looks up by plate only */
  canPhone: boolean;
  labels: Record<
    | 'plate'
    | 'phone'
    | 'search'
    | 'none'
    | 'owner'
    | 'branches'
    | 'vehicles'
    | 'marketing'
    | 'noMarketing'
    | 'open'
    | 'relate'
    | 'related'
    | 'failed'
    | 'history'
    | 'hint',
    string
  >;
}) {
  const l = props.labels;
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const plate = String(f.get('plate') ?? '').trim();
    const phone = String(f.get('phone') ?? '').trim();
    setBusy(true);
    setError(null);
    const r = await postJson('/api/v1/crm/lookup', 'POST', plate ? { plate } : { phone }, newKey());
    setBusy(false);
    if (!r.ok) {
      setResult(null);
      return setError(r.problem?.errors?.[0]?.message ?? r.problem?.detail ?? l.failed);
    }
    setResult(r.data as Result);
  }
  async function relate(id: string) {
    const r = await postJson(
      `/api/v1/crm/customers/${encodeURIComponent(id)}/relate`,
      'POST',
      {},
      newKey(),
    );
    if (r.ok) setDone((d) => ({ ...d, [id]: true }));
    else setError(r.problem?.detail ?? l.failed);
  }

  const card = (c: CustomerP) => (
    <div
      className="card stack-2"
      style={{ padding: 'var(--space-4)' }}
      key={c.id}
      data-testid="lookup-customer"
    >
      <strong>{c.name}</strong> <span className="text-secondary">{c.code}</span>
      <div>
        {l.branches}: {c.branches.join(', ') || '—'}
      </div>
      <div>
        {l.vehicles}:{' '}
        {c.vehicles.map((v) => `${v.plate} (${v.make} ${v.model} ${v.year})`).join(', ') || '—'}
      </div>
      <div>{c.marketing.length ? `${l.marketing}: ${c.marketing.join(', ')}` : l.noMarketing}</div>
      <div>
        {c.related || done[c.id] ? (
          <>
            <span className="badge badge--success">{l.related}</span>{' '}
            <Link
              className="btn btn--secondary btn--sm"
              href={`/crm/customers/${encodeURIComponent(c.id)}`}
            >
              {l.open}
            </Link>
          </>
        ) : props.canRelate ? (
          <Button
            size="sm"
            variant="primary"
            onClick={() => void relate(c.id)}
            data-testid="lookup-relate"
          >
            {l.relate}
          </Button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="stack">
      <form className="filter-bar" onSubmit={onSubmit} data-testid="lookup-form" noValidate>
        <div className="field">
          <label className="field__label" htmlFor="lk-plate">
            {l.plate}
          </label>
          <input className="input" id="lk-plate" name="plate" autoComplete="off" maxLength={20} />
        </div>
        {props.canPhone ? (
          <div className="field">
            <label className="field__label" htmlFor="lk-phone">
              {l.phone}
            </label>
            <input
              className="input"
              id="lk-phone"
              name="phone"
              autoComplete="off"
              maxLength={20}
              inputMode="tel"
            />
          </div>
        ) : null}
        <div className="filter-bar__actions">
          <Button type="submit" variant="primary" loading={busy}>
            {l.search}
          </Button>
        </div>
      </form>
      <p className="text-secondary">{l.hint}</p>
      {error ? (
        <div className="alert alert--danger" role="alert">
          <div className="alert__body">{error}</div>
        </div>
      ) : null}
      {result && result.vehicles.length === 0 && result.customers.length === 0 ? (
        <p data-testid="lookup-none">{l.none}</p>
      ) : null}
      {result?.vehicles.map((v) => (
        <div className="stack-2" key={v.id} data-testid="lookup-vehicle">
          <span className="plate-tag">{v.plate}</span>{' '}
          <span>
            {v.make} {v.model} {v.year}
          </span>
          {v.vinMasked ? <span className="text-secondary"> · {v.vinMasked}</span> : null}
          {v.owner ? card(v.owner) : null}
          {v.related ? (
            <Link href={`/crm/vehicles/${encodeURIComponent(v.id)}`}>{l.history}</Link>
          ) : null}
        </div>
      ))}
      {result?.customers.map(card)}
    </div>
  );
}
