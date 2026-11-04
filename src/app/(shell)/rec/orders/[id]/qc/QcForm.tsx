'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/ui/components/Button';
import { useAction } from '@/ui/components/useAction';

type Labels = Record<string, string>;

/** G2-DLV-02 / FR-REC-016: tick every check; a failed one needs the fault written down and the items to send back to their technician. */
export function QcForm(props: {
  orderId: string;
  version: number;
  checks: { code: string; name: string }[];
  items: { id: string; label: string; technician: string }[];
  labels: Labels;
}) {
  const l = props.labels;
  const router = useRouter();
  const { run, busy, error } = useAction(l.unexpected!, l.offline);
  const [ok, setOk] = useState<Record<string, boolean>>(
    Object.fromEntries(props.checks.map((c) => [c.code, true])),
  );
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [ret, setRet] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const failed = props.checks.filter((c) => !ok[c.code]);
  const valid =
    props.checks.length > 0 &&
    failed.every((c) => (notes[c.code] ?? '').trim()) &&
    (failed.length === 0 ? ret.length === 0 : ret.length > 0);
  async function submit() {
    const r = await run(
      'qc',
      `/api/v1/rec/orders/${props.orderId}/qc`,
      {
        version: props.version,
        checks: props.checks.map((c) => ({
          code: c.code,
          ok: ok[c.code] ?? true,
          ...(!ok[c.code] ? { note: (notes[c.code] ?? '').trim() } : {}),
        })),
        returnItemIds: failed.length ? ret : [],
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      { refresh: false },
    );
    if (r) router.push(`/rec/orders/${props.orderId}`);
  }
  if (props.checks.length === 0)
    return (
      <div className="alert alert--warning" role="note">
        <div className="alert__body">{l.noChecklist}</div>
      </div>
    );
  return (
    <div className="stack" data-testid="qc-form">
      {props.checks.map((c) => (
        <div key={c.code} className={`rec-check${ok[c.code] ? '' : ' is-bad'}`}>
          <label className="check">
            <input
              type="checkbox"
              checked={ok[c.code] ?? true}
              onChange={(e) => setOk({ ...ok, [c.code]: e.target.checked })}
              data-testid={`qc-${c.code}`}
            />
            <span className="check__box" aria-hidden />
            <span>{c.name}</span>
          </label>
          {!ok[c.code] ? (
            <input
              className="input"
              aria-label={l.fault}
              placeholder={l.fault}
              maxLength={300}
              value={notes[c.code] ?? ''}
              onChange={(e) => setNotes({ ...notes, [c.code]: e.target.value })}
              data-testid={`qc-note-${c.code}`}
            />
          ) : null}
        </div>
      ))}
      {failed.length ? (
        <fieldset className="rec-fieldset">
          <legend>{l.returnItems}</legend>
          {props.items.map((i) => (
            <label key={i.id} className="check">
              <input
                type="checkbox"
                checked={ret.includes(i.id)}
                onChange={(e) =>
                  setRet(e.target.checked ? [...ret, i.id] : ret.filter((x) => x !== i.id))
                }
                data-testid={`qc-return-${i.id}`}
              />
              <span className="check__box" aria-hidden />
              <span>
                {i.label} {i.technician ? `· ${i.technician}` : ''}
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
      <div className="field">
        <label className="field__label" htmlFor="qc-note">
          {l.note}
        </label>
        <textarea
          id="qc-note"
          className="textarea"
          rows={2}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className="rec-actions">
        <Button
          variant="primary"
          loading={busy === 'qc'}
          disabled={!valid}
          onClick={() => void submit()}
          data-testid="qc-submit"
        >
          {failed.length ? l.fail : l.pass}
        </Button>
      </div>
      {error ? (
        <div className="alert alert--danger" role="alert">
          <div className="alert__body">{error}</div>
        </div>
      ) : null}
    </div>
  );
}
