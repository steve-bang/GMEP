'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import {
  buildConfigPayload,
  type FieldErrorKind,
  type FormFieldSpec,
} from '@/platform/config/formValues';
import type { PayloadShape } from '@/platform/config/payloadShape';
import { viToIso } from '@/platform/format/date';
import { Button } from '@/ui/components/Button';
import { DateInput } from '@/ui/components/DateInput';
import { Icon } from '@/ui/components/Icon';
import { newKey, postJson, type FormLabels } from '@/ui/components/ResourceForm';

export interface F extends FormFieldSpec {
  options?: { value: string; label: string }[];
  /** unit and example (and, for an optional box, the system default), already translated by the page */
  hint?: string;
}

/** FR-SYS-004: proposes a PENDING version. Payload shape per type is validated by the server schema. */
export function ProposeConfigForm(props: {
  type: string;
  fields: F[];
  /** from the type's descriptor: how the typed values become the API payload */
  payloadShape?: PayloadShape;
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
    timeInvalid: string;
    listInvalid: string;
    pickInvalid: string;
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
    const raw: Record<string, string | string[]> = {};
    for (const x of props.fields)
      raw[x.name] = x.kind === 'multi' ? f.getAll(x.name).map(String) : v(x.name);
    const built = buildConfigPayload(props.fields, raw, props.payloadShape);
    const message: Record<FieldErrorKind, string> = {
      percent: props.text.percentInvalid,
      number: props.text.numberInvalid,
      time: props.text.timeInvalid,
      list: props.text.listInvalid,
      pick: props.text.pickInvalid,
    };
    for (const [n, k] of Object.entries(built.errors)) errs[n] = message[k];
    if (Object.keys(errs).length) {
      setFe(errs);
      return;
    }
    const payload = built.payload;
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
    for (const x of r.problem?.errors ?? []) {
      const path = x.field.replace(/^payload\./, '');
      map[path] ??= x.message;
      map[path.split('.')[0]!] ??= x.message; // an array element error shows on its field
    }
    setFe(map);
    setError(r.problem?.detail ?? props.labels.unexpected);
  }
  const field = (
    name: string,
    label: string,
    el: React.ReactNode,
    hint?: string,
    optional?: boolean,
    group?: boolean,
  ) => (
    <div
      className="field"
      key={name}
      {...(group ? { role: 'group', 'aria-labelledby': `${uid}-${name}-lbl` } : {})}
    >
      <label
        className="field__label"
        id={`${uid}-${name}-lbl`}
        htmlFor={group ? undefined : `${uid}-${name}`}
      >
        {label}
        {optional ? null : (
          <span className="field__req" aria-hidden="true">
            *
          </span>
        )}
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
            x.kind === 'multi' ? (
              <div className="g1-checks">
                {x.options?.map((o) => (
                  <label className="check" key={o.value}>
                    <input
                      type="checkbox"
                      name={x.name}
                      value={o.value}
                      aria-describedby={describedBy(x.name)}
                    />
                    <span className="check__box" aria-hidden="true">
                      <Icon name="check" size="sm" />
                    </span>
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            ) : x.kind === 'select' || x.kind === 'bool' ? (
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
                  x.kind === 'text'
                    ? undefined
                    : x.kind === 'percent'
                      ? 'decimal'
                      : x.kind === 'time' || x.kind === 'intList'
                        ? 'text'
                        : 'numeric'
                }
                autoComplete="off"
                aria-required={x.optional ? undefined : 'true'}
                aria-invalid={fe[x.name] ? true : undefined}
                aria-describedby={describedBy(x.name)}
              />
            ),
            x.hint ?? (x.kind === 'percent' ? props.text.percentHint : undefined),
            x.optional,
            x.kind === 'multi',
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
