'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/ui/components/Button';
import { newKey, postJson } from '@/ui/components/postJson';

/** Logs the print (a reprint needs a reason, plan §2.11) and then opens the print dialog; the sheet itself is print-first HTML. */
export function PrintHandover(props: {
  orderId: string;
  format: 'a5' | 'thermal';
  reprint: boolean;
  labels: Record<string, string>;
}) {
  const l = props.labels;
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(newKey);
  async function go() {
    setBusy(true);
    setError(null);
    const r = await postJson(
      `/api/v1/rec/orders/${props.orderId}/handover/print`,
      'POST',
      { format: props.format, ...(reason.trim() ? { reason: reason.trim() } : {}) },
      key,
    );
    setBusy(false);
    if (!r.ok)
      return setError(r.problem?.errors?.[0]?.message ?? r.problem?.detail ?? l.unexpected!);
    router.refresh();
    window.print();
  }
  return (
    <div className="stack no-print">
      {props.reprint ? (
        <div className="field">
          <label className="field__label" htmlFor="hv-print-reason">
            {l.reprintReason}
          </label>
          <input
            id="hv-print-reason"
            className="input"
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      ) : null}
      <Button
        variant="primary"
        icon="printer"
        loading={busy}
        disabled={props.reprint && reason.trim().length < 3}
        onClick={() => void go()}
        data-testid="hv-print"
      >
        {l.print}
      </Button>
      {error ? (
        <div className="alert alert--danger" role="alert">
          <div className="alert__body">{error}</div>
        </div>
      ) : null}
    </div>
  );
}
