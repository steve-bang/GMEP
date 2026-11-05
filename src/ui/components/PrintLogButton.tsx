'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button } from './Button';
import { newKey, postJson } from './postJson';

/**
 * Opens the browser print dialog for a print-first sheet and records the print (FR-REC-008: `POST <logUrl>` with an
 * Idempotency-Key, kept while the network fails so a retry never counts twice). Printing is never blocked by a failed
 * log: the user sees a warning and the paper still comes out. The page refreshes afterwards so the next print of the
 * same document carries the "BẢN IN LẠI" label.
 */
export function PrintLogButton({
  label,
  logUrl,
  failedLabel,
  testId,
  body,
}: {
  label: string;
  logUrl: string;
  body?: Record<string, unknown>;
  failedLabel: string;
  testId?: string;
}) {
  const router = useRouter();
  const [warn, setWarn] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = useRef<string | null>(null);

  async function onClick() {
    setBusy(true);
    key.current ??= newKey();
    const r = await postJson(logUrl, 'POST', body ?? {}, key.current);
    if (r.status !== 0) key.current = null;
    setWarn(!r.ok);
    setBusy(false);
    window.print();
    if (r.ok) router.refresh();
  }

  return (
    <>
      <Button
        variant="primary"
        icon="printer"
        onClick={onClick}
        disabled={busy}
        data-testid={testId}
      >
        {label}
      </Button>
      {warn ? (
        <span className="text-secondary" role="status" data-testid="print-log-warning">
          {failedLabel}
        </span>
      ) : null}
    </>
  );
}
