'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from './Button';
import { isoToViDisplay, maskViDate, viToIsoDisplay } from '../dateMask';
import { DateInput } from './DateInput';

/** Date window filter that shows dd/MM/yyyy and navigates with ISO `yyyy-MM-dd` query values (GET, bookmarkable). */
export function DateFilter(props: {
  base: string;
  fields: { name: string; label: string; iso?: string }[];
  keep?: Record<string, string>;
  applyLabel: string;
  resetLabel: string;
}) {
  const router = useRouter();
  const [vals, setVals] = useState<Record<string, string>>(
    Object.fromEntries(props.fields.map((f) => [f.name, isoToViDisplay(f.iso)])),
  );
  function go() {
    const q = new URLSearchParams(props.keep ?? {});
    for (const f of props.fields) {
      const iso = viToIsoDisplay(vals[f.name] ?? '');
      if (iso) q.set(f.name, iso);
    }
    router.push(`${props.base}${q.size ? `?${q}` : ''}`);
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
          <DateInput
            id={`df-${f.name}`}
            defaultValue={isoToViDisplay(f.iso)}
            onChange={(e) => setVals((v) => ({ ...v, [f.name]: maskViDate(e.target.value) }))}
          />
        </div>
      ))}
      <Button type="submit" variant="primary">
        {props.applyLabel}
      </Button>
      <Button type="button" variant="ghost" onClick={() => router.push(props.base)}>
        {props.resetLabel}
      </Button>
    </form>
  );
}
