'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/ui/components/Button';
import { newKey, postJson } from '@/ui/components/ResourceForm';

/**
 * "Hiện" on a staff record (NFR-SEC-03, PDPL 2025). The masked text is what the server sent; Reveal asks the server
 * (access-logged, no-store). The 30 s auto-hide is a courtesy, not a security control.
 */
export function RevealEmployeeField(props: {
  employeeId: string;
  field: 'phone' | 'nationalId' | 'address' | 'birthDate';
  value: string;
  reveal: boolean;
  labels: { show: string; hide: string; failed: string };
}) {
  const [shown, setShown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  async function reveal() {
    setError(null);
    const r = await postJson(
      `/api/v1/hrm/employees/${encodeURIComponent(props.employeeId)}/reveal`,
      'POST',
      { field: props.field },
      newKey(),
    );
    if (!r.ok) return setError(r.problem?.detail ?? props.labels.failed);
    setShown((r.data as { value: string }).value);
    timer.current = setTimeout(() => setShown(null), 30_000);
  }

  return (
    <span className="stack-2">
      <span>
        <strong data-testid={`emp-${props.field}`}>{shown ?? props.value}</strong>{' '}
        {props.reveal ? (
          shown ? (
            <Button size="sm" variant="ghost" onClick={() => setShown(null)}>
              {props.labels.hide}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              data-testid={`reveal-${props.field}`}
              onClick={() => void reveal()}
            >
              {props.labels.show}
            </Button>
          )
        ) : null}
      </span>
      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
