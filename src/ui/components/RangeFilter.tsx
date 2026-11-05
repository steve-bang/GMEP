'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type RefObject } from 'react';
import { Button } from './Button';
import { DateInput } from './DateInput';
import { DatePickerButton } from './DatePickerButton';
import { isoToViDisplay, maskViDate, viToIsoDisplay } from '../dateMask';
import {
  activePreset,
  presetRange,
  pushEnd,
  PRESETS,
  validateRange,
  type PresetId,
  type RangeError,
} from '../dateRange';

export interface RangeFilterLabels {
  group: string;
  presets: Record<PresetId, string>;
  custom: string;
  from: string;
  to: string;
  apply: string;
  pickFrom: string;
  pickTo: string;
  /** with `{max}` and `{n}` */
  errors: Record<RangeError, string>;
}

const fill = (s: string, v: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''));

/**
 * Date range filter (FR-RPT-001): quick presets that apply at once (Hôm nay, Hôm qua, 7 ngày qua, 30 ngày qua) and a custom
 * Từ ngày / Đến ngày pair that applies on the button or Enter. The URL carries `from` and `to` (bookmarkable); today is the
 * clean URL. The fields show dd/MM/yyyy, refuse days after today and ranges over `maxDays`, and say why next to the field.
 */
export function RangeFilter(props: {
  base: string;
  from: string;
  to: string;
  /** today in the business time zone, from the server (the preset buttons and the "no future" rule use it) */
  today: string;
  maxDays: number;
  keep?: Record<string, string>;
  labels: RangeFilterLabels;
}) {
  const router = useRouter();
  const active = activePreset(props.from, props.to, props.today);
  const [open, setOpen] = useState(active === null);
  const [fromVal, setFromVal] = useState(isoToViDisplay(props.from));
  const [toVal, setToVal] = useState(isoToViDisplay(props.to));
  const [err, setErr] = useState<{ field: 'from' | 'to'; text: string } | null>(null);
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);

  function go(from: string, to: string) {
    const q = new URLSearchParams(props.keep ?? {});
    // today is the default: the clean URL
    if (!(from === props.today && to === props.today)) {
      q.set('from', from);
      q.set('to', to);
    }
    router.push(`${props.base}${q.size ? `?${q}` : ''}`);
  }

  function setFrom(v: string) {
    setErr(null);
    setFromVal(v);
    const f = viToIsoDisplay(v);
    const t = viToIsoDisplay(toVal);
    // "Từ" after "Đến" pushes "Đến" along instead of leaving an impossible range
    if (f && t && f > t) setToVal(isoToViDisplay(pushEnd(f, t)));
  }
  function setTo(v: string) {
    setErr(null);
    setToVal(v);
  }

  function apply() {
    const r = validateRange(fromVal, toVal, props.today, props.maxDays);
    if (r.ok) {
      setErr(null);
      go(r.from, r.to);
      return;
    }
    setErr({
      field: r.field,
      text: fill(props.labels.errors[r.error], { max: props.maxDays, n: r.days ?? 0 }),
    });
    (r.field === 'from' ? fromRef : toRef).current?.focus();
  }

  const fromIso = viToIsoDisplay(fromVal) ?? '';
  const toIso = viToIsoDisplay(toVal) ?? '';
  const field = (
    which: 'from' | 'to',
    label: string,
    pickLabel: string,
    value: string,
    set: (v: string) => void,
    ref: RefObject<HTMLInputElement | null>,
  ) => {
    const bad = err?.field === which;
    return (
      <div className="field range-filter__field">
        <label className="field__label" htmlFor={`rf-${which}`}>
          {label}
        </label>
        <div className="date-field">
          <DateInput
            id={`rf-${which}`}
            ref={ref}
            value={value}
            aria-invalid={bad || undefined}
            aria-describedby={bad ? 'rf-err' : undefined}
            onChange={(e) => set(maskViDate(e.target.value))}
          />
          <DatePickerButton
            label={pickLabel}
            valueIso={which === 'from' ? fromIso : toIso}
            max={props.today}
            {...(which === 'to' && fromIso ? { min: fromIso } : {})}
            onPick={(iso) => (which === 'from' ? setFrom : setTo)(isoToViDisplay(iso))}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="range-filter" data-testid="range-filter">
      <div className="range-filter__presets" role="group" aria-label={props.labels.group}>
        {PRESETS.map((id) => {
          const on = active === id;
          return (
            <button
              key={id}
              type="button"
              className={`btn btn--sm ${on ? 'btn--primary' : 'btn--secondary'}`}
              aria-pressed={on}
              onClick={() => {
                const r = presetRange(id, props.today);
                go(r.from, r.to);
              }}
            >
              {props.labels.presets[id]}
            </button>
          );
        })}
        <button
          type="button"
          className={`btn btn--sm ${active === null ? 'btn--primary' : 'btn--secondary'}`}
          aria-pressed={active === null}
          aria-expanded={open}
          aria-controls="rf-custom"
          onClick={() => setOpen((o) => !o)}
        >
          {props.labels.custom}
        </button>
      </div>
      {open ? (
        <form
          id="rf-custom"
          className="range-filter__custom"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          {field('from', props.labels.from, props.labels.pickFrom, fromVal, setFrom, fromRef)}
          {field('to', props.labels.to, props.labels.pickTo, toVal, setTo, toRef)}
          <Button type="submit" variant="primary">
            {props.labels.apply}
          </Button>
          {err ? (
            <p className="field__error range-filter__error" id="rf-err" role="alert">
              {err.text}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
