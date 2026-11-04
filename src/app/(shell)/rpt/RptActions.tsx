'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/ui/components/Button';
import { newKey, postJson } from '@/ui/components/postJson';

/** Run-due / rebuild buttons (FR-RPT-003 job). Both are safe to repeat: the server writes only what changed. */
export function RunButtons(props: {
  date: string;
  branchId: string;
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  async function run(kind: 'run-due' | 'rebuild') {
    setBusy(kind);
    setMsg(null);
    const body =
      kind === 'rebuild'
        ? { date: props.date, branchId: props.branchId }
        : { branchId: props.branchId };
    const r = await postJson(`/api/v1/rpt/jobs/${kind}`, 'POST', body, newKey());
    setBusy(null);
    if (!r.ok) {
      setMsg({ tone: 'danger', text: r.problem?.detail ?? props.labels.failed! });
      return;
    }
    const days = (r.data as { branches: { days: { result: string }[] }[] }).branches.flatMap(
      (b) => b.days,
    );
    const changed = days.filter((d) => d.result === 'created' || d.result === 'updated').length;
    setMsg({
      tone: 'success',
      text: changed
        ? props.labels.ranChanged!.replace('{n}', String(changed))
        : props.labels.ranNone!,
    });
    router.refresh();
  }
  return (
    <div className="stack" data-testid="rpt-run">
      <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <Button
          type="button"
          variant="secondary"
          loading={busy === 'run-due'}
          onClick={() => run('run-due')}
          data-testid="run-due"
        >
          {props.labels.run}
        </Button>
        <Button
          type="button"
          variant="secondary"
          loading={busy === 'rebuild'}
          onClick={() => run('rebuild')}
          data-testid="rebuild"
        >
          {props.labels.rebuild}
        </Button>
      </div>
      {msg ? (
        <div className={`alert alert--${msg.tone}`} role="status" data-testid="run-msg">
          <div className="alert__body">{msg.text}</div>
        </div>
      ) : null}
    </div>
  );
}

/** CSV download of the daily report (audited on the server). */
export function ExportButton(props: {
  date: string;
  branchId: string;
  labels: Record<string, string>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/rpt/daily/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ date: props.date, branchId: props.branchId }),
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { detail?: string } | null;
        setError(p?.detail ?? props.labels.failed!);
        return;
      }
      const name =
        /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ??
        'bao-cao.csv';
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(props.labels.failed!);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <Button
        type="button"
        variant="secondary"
        loading={busy}
        onClick={go}
        data-testid="export-csv"
      >
        {props.labels.export}
      </Button>
      {error ? (
        <div className="alert alert--danger" role="alert">
          <div className="alert__body">{error}</div>
        </div>
      ) : null}
    </div>
  );
}
