'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/ui/components/Button';
import { newKey, postJson, type FormLabels } from '@/ui/components/ResourceForm';

interface F {
  name: string;
  kind: 'text' | 'int' | 'select';
  options?: string[];
}

/** FR-SYS-004: proposes a PENDING version. Payload shape per type is validated by the server schema. */
export function ProposeConfigForm(props: {
  type: string;
  today: string;
  fields: F[];
  labels: FormLabels;
  text: {
    scopeKey: string;
    effectiveFrom: string;
    reason: string;
    scopeHint: string;
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
    let payload: Record<string, unknown> = {};
    for (const x of props.fields)
      payload[x.name] = x.kind === 'int' ? Number(v(x.name)) : v(x.name);
    if (props.type === 'discount-limit')
      payload = { maxDiscountBpByRole: { [String(payload.role)]: payload.maxBp } };
    if (props.type === 'numbering-series') payload = { ...payload, reversalSameSeries: true };
    setBusy(true);
    setError(null);
    setFe({});
    const r = await postJson(
      `/api/v1/sys/config/${props.type}`,
      'POST',
      { scopeKey: v('scopeKey'), effectiveFrom: v('effectiveFrom'), reason: v('reason'), payload },
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
      </label>
      {el}
      {hint && !fe[name] ? <span className="field__hint">{hint}</span> : null}
      {fe[name] ? <span className="field__error">{fe[name]}</span> : null}
    </div>
  );
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
          <input
            className="input"
            id={`${uid}-scopeKey`}
            name="scopeKey"
            autoComplete="off"
            aria-required="true"
          />,
          props.text.scopeHint,
        )}
        {field(
          'effectiveFrom',
          props.text.effectiveFrom,
          <input
            className="input"
            id={`${uid}-effectiveFrom`}
            name="effectiveFrom"
            type="date"
            min={props.today}
            aria-required="true"
          />,
        )}
        {props.fields.map((x) =>
          field(
            x.name,
            props.text.fields[x.name] ?? x.name,
            x.kind === 'select' ? (
              <select className="select" id={`${uid}-${x.name}`} name={x.name}>
                {x.options?.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input"
                id={`${uid}-${x.name}`}
                name={x.name}
                inputMode={x.kind === 'int' ? 'numeric' : undefined}
                autoComplete="off"
                aria-required="true"
              />
            ),
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
