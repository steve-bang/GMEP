'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { viToIso } from '@/platform/format/date';
import { parsePercentToBp } from '@/platform/format/percent';
import { parseVndInput } from '@/platform/format/vnd';
import { Button } from '@/ui/components/Button';
import { DateInput } from '@/ui/components/DateInput';
import { newKey, postJson, type FormLabels } from '@/ui/components/ResourceForm';

export interface F {
  name: string;
  kind: 'text' | 'vnd' | 'int' | 'percent' | 'select';
  options?: { value: string; label: string }[];
}

/** FR-SYS-004: proposes a PENDING version. Payload shape per type is validated by the server schema. */
export function ProposeConfigForm(props: {
  type: string;
  fields: F[];
  /** when set the scope key is picked from a list (company / branch / service) instead of typed */
  scopeOptions?: { value: string; label: string }[];
  labels: FormLabels;
  text: {
    scopeKey: string;
    effectiveFrom: string;
    reason: string;
    scopeHint: string;
    dateHint: string;
    dateInvalid: string;
    percentInvalid: string;
    numberInvalid: string;
    percentHint: string;
    pick: string;
    fields: Record<string, string>;
  };
}) {
  const router = useRouter();
  const uid = useId();
  const [key] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fe, setFe] = useState<Record<string, string>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (n: string) => String(f.get(n) ?? '').trim();
    const errs: Record<string, string> = {};
    const effectiveFrom = viToIso(v('effectiveFrom'));
    if (!effectiveFrom) errs.effectiveFrom = props.text.dateInvalid;
    let payload: Record<string, unknown> = {};
    for (const x of props.fields) {
      const raw = v(x.name);
      if (x.kind === 'percent') {
        const bp = parsePercentToBp(raw);
        if (bp === null) errs[x.name] = props.text.percentInvalid;
        payload[x.name] = bp;
      } else if (x.kind === 'vnd' || x.kind === 'int') {
        const n =
          x.kind === 'vnd' ? parseVndInput(raw) : /^\d{1,9}$/.test(raw) ? Number(raw) : null;
        if (n === null || n < 0) errs[x.name] = props.text.numberInvalid;
        payload[x.name] = n;
      } else payload[x.name] = raw;
    }
    if (Object.keys(errs).length) {
      setFe(errs);
      return;
    }
    if (props.type === 'discount-limit')
      payload = { maxDiscountBpByRole: { [String(payload.role)]: payload.maxBp } };
    if (props.type === 'numbering-series') payload = { ...payload, reversalSameSeries: true };
    setBusy(true);
    setError(null);
    setFe({});
    const r = await postJson(
      `/api/v1/sys/config/${props.type}`,
      'POST',
      { scopeKey: v('scopeKey'), effectiveFrom, reason: v('reason'), payload },
      key,
    );
    setBusy(false);
    if (r.ok) return router.refresh();
    const map: Record<string, string> = {};
    for (const x of r.problem?.errors ?? []) map[x.field.replace(/^payload\./, '')] ??= x.message;
    setFe(map);
    setError(r.problem?.detail ?? props.labels.unexpected);
  }
  const field = (name: string, label: string, el: React.ReactNode, hint?: string) => (
    <div className="field" key={name}>
      <label className="field__label" htmlFor={`${uid}-${name}`}>
        {label}
        <span className="field__req" aria-hidden="true">
          *
        </span>
      </label>
      {el}
      {hint && !fe[name] ? (
        <span className="field__hint" id={`${uid}-${name}-hint`}>
          {hint}
        </span>
      ) : null}
      {fe[name] ? (
        <span className="field__error" id={`${uid}-${name}-err`}>
          {fe[name]}
        </span>
      ) : null}
    </div>
  );
  const describedBy = (n: string) => (fe[n] ? `${uid}-${n}-err` : `${uid}-${n}-hint`);
  return (
    <form className="g1-form" onSubmit={onSubmit} noValidate data-testid="config-form">
      {error ? (
        <div className="alert alert--danger" role="alert">
          <div className="alert__body">{error}</div>
        </div>
      ) : null}
      <fieldset className="g1-fs" disabled={busy}>
        {field(
          'scopeKey',
          props.text.scopeKey,
          props.scopeOptions ? (
            <select className="select" id={`${uid}-scopeKey`} name="scopeKey" aria-required="true">
              {props.scopeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="input"
              id={`${uid}-scopeKey`}
              name="scopeKey"
              autoComplete="off"
              aria-required="true"
              aria-describedby={describedBy('scopeKey')}
            />
          ),
          props.text.scopeHint,
        )}
        {field(
          'effectiveFrom',
          props.text.effectiveFrom,
          <DateInput
            id={`${uid}-effectiveFrom`}
            name="effectiveFrom"
            aria-required="true"
            aria-invalid={fe.effectiveFrom ? true : undefined}
            aria-describedby={describedBy('effectiveFrom')}
          />,
          props.text.dateHint,
        )}
        {props.fields.map((x) =>
          field(
            x.name,
            props.text.fields[x.name] ?? x.name,
            x.kind === 'select' ? (
              <select className="select" id={`${uid}-${x.name}`} name={x.name}>
                {x.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input"
                id={`${uid}-${x.name}`}
                name={x.name}
                inputMode={
                  x.kind === 'text' ? undefined : x.kind === 'percent' ? 'decimal' : 'numeric'
                }
                autoComplete="off"
                aria-required="true"
                aria-invalid={fe[x.name] ? true : undefined}
                aria-describedby={describedBy(x.name)}
              />
            ),
            x.kind === 'percent' ? props.text.percentHint : undefined,
          ),
        )}
        {field(
          'reason',
          props.text.reason,
          <input
            className="input"
            id={`${uid}-reason`}
            name="reason"
            autoComplete="off"
            aria-required="true"
            maxLength={300}
          />,
        )}
      </fieldset>
      <Button type="submit" variant="primary" loading={busy}>
        {props.labels.submit}
      </Button>
    </form>
  );
}
