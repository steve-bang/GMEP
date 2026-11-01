'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/ui/components/Button';
import { newKey, postJson } from '@/ui/components/ResourceForm';

/**
 * "Hiện" (NFR-SEC-03): the masked value is what the server sent. Reveal asks the server (access-
 * logged, no-store); the value auto-hides after 30 s. Auto-hide is a UI courtesy, NOT a security
 * control (the value already reached the browser, BA §7.2).
 */
export function RevealPhone(props: {
  userId: string;
  masked: string;
  reveal: 'none' | 'plain' | 'reason';
  labels: {
    show: string;
    hide: string;
    reason: string;
    note: string;
    invoiceCheck: string;
    debt: string;
    other: string;
    failed: string;
    phone: string;
  };
}) {
  const [value, setValue] = useState<string | null>(null);
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
        entityType: 'user',
        entityId: props.userId,
        field: 'phone',
        ...(reasonCode ? { reasonCode, reasonText } : {}),
      },
      newKey(),
    );
    if (!r.ok) return setError(r.problem?.detail ?? props.labels.failed);
    setValue((r.data as { value: string }).value);
    setAsking(false);
    timer.current = setTimeout(() => setValue(null), 30_000);
  }

  return (
    <div className="stack">
      <p>
        <span className="text-secondary">{props.labels.phone}: </span>
        <strong data-testid="phone-value">{value ?? props.masked}</strong>{' '}
        {props.reveal !== 'none' ? (
          value ? (
            <Button size="sm" variant="ghost" onClick={() => setValue(null)}>
              {props.labels.hide}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              data-testid="reveal"
              onClick={() => (props.reveal === 'reason' ? setAsking(true) : void reveal())}
            >
              {props.labels.show}
            </Button>
          )
        ) : null}
      </p>
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
            <label className="field__label" htmlFor="r-code">
              {props.labels.reason}
            </label>
            <select className="select" id="r-code" name="reasonCode">
              <option value="invoice_check">{props.labels.invoiceCheck}</option>
              <option value="debt_collection">{props.labels.debt}</option>
              <option value="other">{props.labels.other}</option>
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="r-text">
              {props.labels.note}
            </label>
            <input className="input" id="r-text" name="reasonText" minLength={5} required />
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
    </div>
  );
}
