'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/ui/components/Button';
import { CustomerPicker, type CustomerPickerLabels } from '@/ui/components/CustomerPicker';
import { newKey, postJson } from '@/ui/components/postJson';
import { formatKm } from '../../format';

interface Veh {
  id: string;
  plate: string;
  make: string;
  model: string;
  year: number;
  lastKm: number | null;
  owner: { id: string; name: string } | null;
}
interface Other {
  vehicleId: string;
  plate: string;
  make: string;
  model: string;
  year: number;
  owner: { id: string; name: string; branches: string[]; related: boolean } | null;
}

/**
 * Step 1 of the intake wizard. A vehicle known in the working scope starts the draft directly; a
 * vehicle known only at another branch is found by the exact plate lookup and adopted ("Dùng hồ sơ
 * này", C2); an unknown plate opens the embedded "Xe mới" form (G2-CRM-05) with the owner chosen in
 * the CustomerPicker. Everything the server decides (scope, relation) is re-checked there.
 */
export function NewIntake(props: {
  labels: Record<string, string>;
  picker: CustomerPickerLabels;
  canLookup: boolean;
}) {
  const l = props.labels;
  const router = useRouter();
  const [plate, setPlate] = useState('');
  const [found, setFound] = useState<Veh[] | null>(null);
  const [others, setOthers] = useState<Other[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'find' | 'new'>('find');
  const keys = useRef(new Map<string, string>());
  const seq = useRef(0);

  const keyFor = (k: string) => {
    if (!keys.current.has(k)) keys.current.set(k, newKey());
    return keys.current.get(k)!;
  };

  async function search(text: string) {
    const mine = ++seq.current;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/crm/vehicles?limit=5&q=${encodeURIComponent(text)}`);
      const body = (await res.json().catch(() => null)) as { items?: Veh[] } | null;
      if (mine !== seq.current) return;
      if (!res.ok || !body?.items) {
        setError(l.failed ?? '');
        setFound(null);
        return;
      }
      setFound(body.items);
      setOthers([]);
      if (body.items.length === 0 && props.canLookup && text.replace(/\W/g, '').length >= 5) {
        const lk = await postJson('/api/v1/crm/lookup', 'POST', { plate: text }, newKey());
        if (mine !== seq.current) return;
        const vs = ((lk.data as { vehicles?: unknown[] } | null)?.vehicles ?? []) as {
          id: string;
          plate: string;
          make: string;
          model: string;
          year: number;
          related: boolean;
          owner: { id: string; name: string; branches: string[]; related: boolean } | null;
        }[];
        setOthers(
          vs
            .filter((v) => !v.related && v.owner)
            .map((v) => ({
              vehicleId: v.id,
              plate: v.plate,
              make: v.make,
              model: v.model,
              year: v.year,
              owner: v.owner,
            })),
        );
      }
    } finally {
      if (mine === seq.current) setBusy(false);
    }
  }

  useEffect(() => {
    const q = plate.trim();
    if (q.replace(/\W/g, '').length < 3) {
      seq.current += 1;
      return;
    }
    const timer = setTimeout(() => void search(q), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plate]);

  async function start(vehicleId: string) {
    setBusy(true);
    setError(null);
    const r = await postJson(
      '/api/v1/rec/intakes',
      'POST',
      { vehicleId },
      keyFor(`start:${vehicleId}`),
    );
    if (r.ok) {
      router.push(`/rec/intakes/${encodeURIComponent((r.data as { id: string }).id)}`);
      return;
    }
    setBusy(false);
    setError(r.problem?.detail ?? l.unexpected ?? '');
  }

  async function adopt(o: Other) {
    if (!o.owner) return;
    setBusy(true);
    setError(null);
    const r = await postJson(
      `/api/v1/crm/customers/${encodeURIComponent(o.owner.id)}/relate`,
      'POST',
      {},
      keyFor(`adopt:${o.owner.id}`),
    );
    if (!r.ok) {
      setBusy(false);
      setError(r.problem?.detail ?? l.unexpected ?? '');
      return;
    }
    await start(o.vehicleId);
  }

  async function createVehicle(form: FormData) {
    const customerId = String(form.get('customerId') ?? '');
    if (!customerId) {
      setError(l.requiredOwner ?? '');
      return;
    }
    setBusy(true);
    setError(null);
    const r = await postJson(
      '/api/v1/crm/vehicles',
      'POST',
      {
        customerId,
        plate: String(form.get('plate') ?? ''),
        make: String(form.get('make') ?? ''),
        model: String(form.get('model') ?? ''),
        year: Number(form.get('year')),
      },
      keyFor(`create:${String(form.get('plate'))}`),
    );
    if (!r.ok) {
      setBusy(false);
      setError(r.problem?.errors?.[0]?.message ?? r.problem?.detail ?? l.unexpected ?? '');
      return;
    }
    await start((r.data as { id: string }).id);
  }

  return (
    <div className="stack" data-testid="intake-start">
      <div className="field">
        <label className="field__label" htmlFor="plate-q">
          {l.plate}
          <span className="field__req" aria-hidden="true">
            *
          </span>
        </label>
        <input
          id="plate-q"
          className="input"
          autoComplete="off"
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          aria-describedby="plate-h"
          placeholder="51h12345"
        />
        <span className="field__hint" id="plate-h">
          {l.plateHint}
        </span>
      </div>
      {error ? (
        <div className="alert alert--danger" role="alert">
          <div className="alert__body">
            <span>{error}</span>
          </div>
        </div>
      ) : null}
      <div role="status" aria-live="polite" className="text-secondary">
        {busy ? l.searching : ''}
      </div>
      {mode === 'find' ? (
        <>
          {(found ?? []).map((v) => (
            <section key={v.id} className="card" data-testid="vehicle-found">
              <div className="card__body rec-found">
                <div>
                  <span className="plate-tag">{v.plate}</span>{' '}
                  <strong>
                    {v.make} {v.model} {v.year}
                  </strong>
                  <dl className="rec-meta">
                    <div>
                      <dt>{l.owner_}</dt>
                      <dd>{v.owner?.name ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>{l.lastKm}</dt>
                      <dd className="num">{v.lastKm === null ? '—' : formatKm(v.lastKm)}</dd>
                    </div>
                  </dl>
                </div>
                <Button
                  variant="primary"
                  onClick={() => void start(v.id)}
                  disabled={busy || !v.owner}
                  data-testid="intake-start-btn"
                >
                  {l.start}
                </Button>
              </div>
            </section>
          ))}
          {others.length > 0 ? (
            <section className="card" aria-label={l.lookupTitle}>
              <div className="card__header">
                <h2 className="card__title">{l.lookupTitle}</h2>
              </div>
              <div className="card__body stack">
                {others.map((o) => (
                  <div key={o.vehicleId} className="rec-found">
                    <div>
                      <span className="plate-tag">{o.plate}</span>{' '}
                      <strong>
                        {o.make} {o.model} {o.year}
                      </strong>
                      <p className="text-secondary">
                        {o.owner?.name} · {l.lookupBranches} {o.owner?.branches.join(', ')}
                      </p>
                    </div>
                    <Button variant="secondary" onClick={() => void adopt(o)} disabled={busy}>
                      {l.adopt}
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {found !== null && found.length === 0 && others.length === 0 && !busy ? (
            <p className="text-secondary">{l.noneFound}</p>
          ) : null}
          <div>
            <Button variant="ghost" onClick={() => setMode('new')} data-testid="intake-new-vehicle">
              {l.newVehicle}
            </Button>
          </div>
        </>
      ) : (
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            void createVehicle(new FormData(e.currentTarget));
          }}
          noValidate
        >
          <div className="card__body stack">
            <p className="text-secondary">{l.newVehicleLead}</p>
            <div className="form-grid">
              <div className="field">
                <label className="field__label" htmlFor="nv-owner">
                  {l.owner}
                </label>
                <CustomerPicker
                  name="customerId"
                  inputId="nv-owner"
                  labels={props.picker}
                  required
                  canLookup={props.canLookup}
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="nv-plate">
                  {l.plate}
                </label>
                <input id="nv-plate" name="plate" className="input" defaultValue={plate} required />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="nv-make">
                  {l.make}
                </label>
                <input id="nv-make" name="make" className="input" required />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="nv-model">
                  {l.model}
                </label>
                <input id="nv-model" name="model" className="input" required />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="nv-year">
                  {l.year}
                </label>
                <input
                  id="nv-year"
                  name="year"
                  className="input input--num"
                  inputMode="numeric"
                  required
                />
              </div>
            </div>
            <div className="rec-actions">
              <Button type="submit" variant="primary" loading={busy}>
                {l.createVehicle}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMode('find')}>
                {l.back}
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
