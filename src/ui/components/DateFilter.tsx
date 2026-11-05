'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { isoToViDisplay, maskViDate, viToIsoDisplay } from '../dateMask';
import { DateInput } from './DateInput';

/** Date window filter that shows dd/MM/yyyy and navigates with ISO `yyyy-MM-dd` query values (GET, bookmarkable). */
export function DateFilter(props: {
  base: string;
  fields: { name: string; label: string; iso?: string }[];
  keep?: Record<string, string>;
  applyLabel: string;
  resetLabel: string;
  /** calendar button next to the date field (single-date filters); picking a date applies it at once */
  pickerLabel?: string;
  /** shortcut button that applies yesterday (Asia/Ho_Chi_Minh) */
  yesterdayLabel?: string;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [vals, setVals] = useState<Record<string, string>>(
    Object.fromEntries(props.fields.map((f) => [f.name, isoToViDisplay(f.iso)])),
  );
  function go(override?: Record<string, string>) {
    const q = new URLSearchParams(props.keep ?? {});
    for (const f of props.fields) {
      const iso = override?.[f.name] ?? viToIsoDisplay(vals[f.name] ?? '');
      if (iso) q.set(f.name, iso);
    }
    router.push(`${props.base}${q.size ? `?${q}` : ''}`);
  }
  const single = props.fields.length === 1 ? props.fields[0]! : null;
  const today = vnToday();
  function applyIso(iso: string) {
    if (!single) return;
    setVals((v) => ({ ...v, [single.name]: isoToViDisplay(iso) }));
    go({ [single.name]: iso });
  }
  return (
    <form
      className="filter-bar__row"
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
    >
      {props.fields.map((f) => (
        <div className="field" key={f.name}>
          <label className="field__label" htmlFor={`df-${f.name}`}>
            {f.label}
          </label>
          <div className="date-field">
            <DateInput
              id={`df-${f.name}`}
              value={vals[f.name] ?? ''}
              onChange={(e) => setVals((v) => ({ ...v, [f.name]: maskViDate(e.target.value) }))}
            />
            {single && props.pickerLabel ? (
              <>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm date-field__btn"
                  aria-label={props.pickerLabel}
                  title={props.pickerLabel}
                  onClick={() => {
                    const el = pickerRef.current;
                    if (!el) return;
                    el.value = viToIsoDisplay(vals[f.name] ?? '') ?? '';
                    if (typeof el.showPicker === 'function') el.showPicker();
                    else el.click();
                  }}
                >
                  <Icon name="calendar" />
                </button>
                <input
                  ref={pickerRef}
                  type="date"
                  className="date-field__native"
                  tabIndex={-1}
                  aria-hidden="true"
                  max={today}
                  onChange={(e) => {
                    if (e.target.value) applyIso(e.target.value);
                  }}
                />
              </>
            ) : null}
          </div>
        </div>
      ))}
      <Button type="submit" variant="primary">
        {props.applyLabel}
      </Button>
      {single && props.yesterdayLabel ? (
        <Button type="button" variant="secondary" onClick={() => applyIso(addDays(today, -1))}>
          {props.yesterdayLabel}
        </Button>
      ) : null}
      <Button type="button" variant="ghost" onClick={() => router.push(props.base)}>
        {props.resetLabel}
      </Button>
    </form>
  );
}

/** Today as yyyy-MM-dd in Vietnam time (the business day), whatever the browser time zone is. */
function vnToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
