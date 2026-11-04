'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from './Button';
import { newKey, postJson } from './postJson';

/**
 * Customer search box shared by "change owner", "create vehicle" and data requests (C13, FR-CRM-014).
 * It replaces the old "first 100 customers" select: it searches the working scope by name, phone
 * (from 4 digits) or code, shows "N+" when the list was cut, and for a FULL phone number also asks
 * the exact cross-branch lookup so a customer known only at another branch can be adopted
 * ("Dùng hồ sơ này") and then chosen. Only ids travel in the hidden input; the server re-checks scope.
 */
export interface CustomerPickerLabels {
  placeholder: string;
  hint: string;
  searching: string;
  none: string;
  /** "{count}" is replaced */
  capped: string;
  clear: string;
  selected: string;
  otherBranch: string;
  adopt: string;
  failed: string;
}

interface Found {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
}
interface OtherBranch {
  id: string;
  code: string;
  name: string;
  branches: string[];
}

const MIN_CHARS = 2;
const FULL_PHONE = /^0\d{9,10}$/;

export function CustomerPicker(props: {
  name: string;
  /** id of the visible search input so the form label points at it */
  inputId?: string;
  labels: CustomerPickerLabels;
  required?: boolean;
  excludeId?: string;
  /** may the actor ask the cross-branch lookup + adopt (customer-lookup-customer + customer:update) */
  canLookup?: boolean;
  invalid?: boolean;
  describedBy?: string;
  onChange?: (id: string) => void;
}) {
  const uid = useId();
  const l = props.labels;
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<Found | null>(null);
  const [results, setResults] = useState<Found[]>([]);
  const [others, setOthers] = useState<OtherBranch[]>([]);
  const [capped, setCapped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const q = text.trim();
    const digits = q.replace(/\D/g, '');
    const phoneLike = /^[\d\s.+-]+$/.test(q);
    // a number needs 4 digits before the server will search it (C12)
    if (q.length < MIN_CHARS || (phoneLike && digits.length < 4)) {
      seq.current += 1;
      return;
    }
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/crm/customers?limit=10&q=${encodeURIComponent(q)}`);
        const body = (await res.json().catch(() => null)) as {
          items?: {
            id: string;
            code: string;
            name: string;
            status: string;
            phone?: { value?: string | null };
          }[];
          capped?: boolean;
        } | null;
        if (mine !== seq.current) return;
        if (!res.ok || !body?.items) {
          setError(l.failed);
          setResults([]);
          return;
        }
        const mineRows = body.items
          .filter((c) => c.status === 'active' && c.id !== props.excludeId)
          .map((c) => ({ id: c.id, code: c.code, name: c.name, phone: c.phone?.value ?? null }));
        setResults(mineRows);
        setCapped(!!body.capped);
        setSearched(true);
        // exact full phone: also look at the other branches (P1), POST so the number stays out of URLs
        const normalized = digits.startsWith('84') ? `0${digits.slice(2)}` : digits;
        if (props.canLookup && phoneLike && FULL_PHONE.test(normalized)) {
          const lk = await postJson('/api/v1/crm/lookup', 'POST', { phone: q }, newKey());
          if (mine !== seq.current) return;
          const customers = ((
            lk.data as { customers?: (OtherBranch & { related: boolean })[] } | null
          )?.customers ?? []) as (OtherBranch & { related: boolean })[];
          const known = new Set(mineRows.map((c) => c.id));
          setOthers(
            customers
              .filter((c) => !c.related && !known.has(c.id) && c.id !== props.excludeId)
              .map((c) => ({ id: c.id, code: c.code, name: c.name, branches: c.branches })),
          );
        } else setOthers([]);
      } finally {
        if (mine === seq.current) setBusy(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [text, props.canLookup, props.excludeId, l.failed]);

  const choose = (c: Found | null) => {
    setPicked(c);
    props.onChange?.(c?.id ?? '');
    if (c) {
      setResults([]);
      setOthers([]);
      setText('');
    }
  };

  async function adopt(c: OtherBranch) {
    const r = await postJson(
      `/api/v1/crm/customers/${encodeURIComponent(c.id)}/relate`,
      'POST',
      {},
      newKey(),
    );
    if (!r.ok) return setError(r.problem?.detail ?? l.failed);
    choose({ id: c.id, code: c.code, name: c.name });
  }

  const listId = `${uid}-list`;
  const showNone =
    searched && !busy && results.length === 0 && others.length === 0 && !!text.trim();
  return (
    <div className="stack-2" data-testid="customer-picker">
      <input type="hidden" name={props.name} value={picked?.id ?? ''} />
      {picked ? (
        <p data-testid="customer-picked">
          <span className="text-secondary">{l.selected}: </span>
          <strong>{picked.name}</strong> <span className="text-secondary">{picked.code}</span>{' '}
          <Button type="button" size="sm" variant="ghost" onClick={() => choose(null)}>
            {l.clear}
          </Button>
        </p>
      ) : (
        <>
          <input
            className="input"
            type="search"
            id={props.inputId ?? `${uid}-q`}
            autoComplete="off"
            maxLength={100}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSearched(false);
            }}
            placeholder={l.placeholder}
            aria-required={props.required || undefined}
            aria-invalid={props.invalid || undefined}
            aria-describedby={props.describedBy}
            aria-controls={listId}
            data-testid="customer-picker-input"
          />
          <span className="field__hint">{l.hint}</span>
          <div id={listId} aria-live="polite">
            {busy ? <span className="text-secondary">{l.searching}</span> : null}
            {error ? (
              <span className="field__error" role="alert">
                {error}
              </span>
            ) : null}
            {showNone ? <span data-testid="customer-picker-none">{l.none}</span> : null}
            {results.length ? (
              <ul className="stack-2" role="listbox" aria-label={l.placeholder}>
                {results.map((c) => (
                  <li key={c.id} role="option" aria-selected={false}>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => choose(c)}
                      data-testid="customer-picker-option"
                    >
                      {c.name} · {c.code}
                      {c.phone ? ` · ${c.phone}` : ''}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            {capped ? (
              <span className="text-secondary" data-testid="customer-picker-capped">
                {l.capped.replace('{count}', String(results.length))}
              </span>
            ) : null}
            {others.map((c) => (
              <div key={c.id} className="stack-2" data-testid="customer-picker-other">
                <span>
                  {c.name} · {c.code}{' '}
                  <span className="text-secondary">
                    {l.otherBranch}: {c.branches.join(', ') || '—'}
                  </span>
                </span>{' '}
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={() => void adopt(c)}
                  data-testid="customer-picker-adopt"
                >
                  {l.adopt}
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
