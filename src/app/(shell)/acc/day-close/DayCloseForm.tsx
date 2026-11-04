'use client';

import { useState } from 'react';
import { isoToVi } from '@/platform/format/date';
import { Button } from '@/ui/components/Button';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { useAction } from '@/ui/components/useAction';

type Labels = Record<string, string>;
const fill = (s: string, v: Record<string, string | number>) =>
  Object.entries(v).reduce((acc, [k, x]) => acc.replace(`{${k}}`, String(x)), s);

/** G4-ACC-09 / FR-ACC-004: lock the business date; the server re-checks every blocker. */
export function DayCloseForm(props: {
  date: string;
  allowed: boolean;
  labels: Labels;
  common: Labels;
}) {
  const l = props.labels;
  const { run, busy, error } = useAction(props.common.unexpected!, props.common.offline);
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  async function go() {
    const r = await run('day', '/api/v1/acc/day-close', {
      date: props.date,
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    setOpen(false);
    if (r) setDone(true);
  }
  return (
    <div className="stack" data-testid="day-close-form">
      {done ? (
        <div className="alert alert--success" role="status" data-testid="day-done">
          <div className="alert__body">{fill(l.done!, { date: isoToVi(props.date) })}</div>
        </div>
      ) : null}
      <div className="field">
        <label className="field__label" htmlFor="day-note">
          {l.note}
        </label>
        <input
          id="day-note"
          className="input"
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div>
        <Button
          variant="primary"
          disabled={!props.allowed}
          onClick={() => setOpen(true)}
          data-testid="day-open"
        >
          {l.close}
        </Button>
      </div>
      {error ? (
        <div className="alert alert--danger" role="alert" data-testid="day-error">
          <div className="alert__body">{error}</div>
        </div>
      ) : null}
      <ConfirmDialog
        open={open}
        title={fill(l.confirmTitle!, { date: isoToVi(props.date) })}
        confirmLabel={l.close!}
        cancelLabel={props.common.cancel!}
        busy={busy === 'day'}
        onConfirm={() => void go()}
        onCancel={() => setOpen(false)}
        testId="day-confirm"
      >
        <p className="text-secondary">{l.confirmText}</p>
      </ConfirmDialog>
    </div>
  );
}
