'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { newKey, postJson } from './ResourceForm';

export interface RevealLabels {
  show: string;
  hide: string;
  reason: string;
  note: string;
  invoiceCheck: string;
  debt: string;
  other: string;
  failed: string;
}

/**
 * "Hiện" for any entity/field (NFR-SEC-03). The masked value is what the server sent; Reveal asks
 * the server (access-logged, no-store). Auto-hide after 30 s is a courtesy, NOT a security control.
 */
export function RevealField(props: {
  entityType: string;
  entityId: string;
  field: 'phone' | 'email' | 'address';
  /** server-presented value: masked text, or the full text for roles that see it */
  value: string;
  reveal: 'none' | 'plain' | 'reason';
  labels: RevealLabels;
  testId?: string;
}) {
  const [shown, setShown] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  async function reveal(reasonCode?: string, reasonText?: string) {
    setError(null);
    const r = await postJson(
      '/api/v1/sys/pii/reveal',
      'POST',
      {
        entityType: props.entityType,
        entityId: props.entityId,
        field: props.field,
        ...(reasonCode ? { reasonCode, reasonText } : {}),
      },
      newKey(),
    );
    if (!r.ok) return setError(r.problem?.detail ?? props.labels.failed);
    setShown((r.data as { value: string }).value);
    setAsking(false);
    timer.current = setTimeout(() => setShown(null), 30_000);
  }

  const idBase = `${props.entityId}-${props.field}`;
  return (
    <span className="stack-2">
      <span>
        <strong data-testid={props.testId ?? `${props.field}-value`}>{shown ?? props.value}</strong>{' '}
        {props.reveal !== 'none' ? (
          shown ? (
            <Button size="sm" variant="ghost" onClick={() => setShown(null)}>
              {props.labels.hide}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              data-testid={`reveal-${props.field}`}
              onClick={() => (props.reveal === 'reason' ? setAsking(true) : void reveal())}
            >
              {props.labels.show}
            </Button>
          )
        ) : null}
      </span>
      {asking ? (
        <form
          className="filter-bar"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void reveal(String(f.get('reasonCode')), String(f.get('reasonText')));
          }}
        >
          <div className="field">
            <label className="field__label" htmlFor={`${idBase}-code`}>
              {props.labels.reason}
            </label>
            <select className="select" id={`${idBase}-code`} name="reasonCode">
              <option value="invoice_check">{props.labels.invoiceCheck}</option>
              <option value="debt_collection">{props.labels.debt}</option>
              <option value="other">{props.labels.other}</option>
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor={`${idBase}-text`}>
              {props.labels.note}
            </label>
            <input
              className="input"
              id={`${idBase}-text`}
              name="reasonText"
              minLength={5}
              required
            />
          </div>
          <Button type="submit" variant="primary">
            {props.labels.show}
          </Button>
        </form>
      ) : null}
      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
