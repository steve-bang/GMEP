'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/ui/components/Button';
import { useAction } from '@/ui/components/useAction';

type Labels = Record<string, string>;

/** FR-REC-012: choose the technician of an item; a change after one was set needs a reason (kept in the item history). */
export function AssignSelect(props: {
  itemId: string;
  version: number;
  current: string | null;
  options: { id: string; name: string; active: number }[];
  disabled: boolean;
  labels: Labels;
}) {
  const l = props.labels;
  const { run, busy, error } = useAction(l.unexpected!);
  const [pick, setPick] = useState(props.current ?? '');
  const [reason, setReason] = useState('');
  const changing = props.current !== null && pick !== props.current;
  return (
    <div className="stack" data-testid="assign">
      <div className="rec-actions">
        <label className="visually-hidden" htmlFor={`as-${props.itemId}`}>
          {l.technician}
        </label>
        <select
          id={`as-${props.itemId}`}
          className="select"
          value={pick}
          disabled={props.disabled}
          onChange={(e) => setPick(e.target.value)}
        >
          <option value="">{l.unassigned}</option>
          {props.options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.active})
            </option>
          ))}
        </select>
        <Button
          variant="secondary"
          size="sm"
          loading={busy === 'assign'}
          disabled={
            props.disabled || pick === (props.current ?? '') || (changing && !reason.trim())
          }
          onClick={() =>
            void run('assign', `/api/v1/rec/items/${props.itemId}/assign`, {
              version: props.version,
              technicianId: pick || null,
              ...(reason.trim() ? { reason: reason.trim() } : {}),
            })
          }
        >
          {l.assign}
        </Button>
      </div>
      {changing ? (
        <input
          className="input"
          aria-label={l.reason}
          placeholder={l.reasonPlaceholder}
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      ) : null}
      {error ? (
        <div className="alert alert--danger" role="alert">
          <div className="alert__body">{error}</div>
        </div>
      ) : null}
    </div>
  );
}

/** Order-level actions: pause/resume, send to QC, re-check parts, cancel with a reason, supplementary quote. */
export function OrderActions(props: {
  orderId: string;
  version: number;
  allowed: Record<string, boolean>;
  hasIssuedParts: boolean;
  labels: Labels;
}) {
  const l = props.labels;
  const router = useRouter();
  const { run, busy, error, setError } = useAction(l.unexpected!);
  const [ask, setAsk] = useState<null | 'pause' | 'cancel'>(null);
  const [reason, setReason] = useState('');
  const a = props.allowed;
  const base = `/api/v1/rec/orders/${props.orderId}`;
  const v = { version: props.version };
  async function supplement() {
    const r = await run<{ id: string }>('supplement', `${base}/supplement`, v, { refresh: false });
    if (r?.id) router.push(`/rec/quotes/${r.id}`);
  }
  return (
    <div className="stack" data-testid="order-actions">
      <div className="rec-actions">
        {a.submitQc ? (
          <Button
            variant="primary"
            loading={busy === 'qc'}
            onClick={() => void run('qc', `${base}/submit-qc`, v)}
            data-testid="order-submit-qc"
          >
            {l.submitQc}
          </Button>
        ) : null}
        {a.runQc ? (
          <a className="btn btn--primary" href={`${base.replace('/api/v1', '')}/qc`}>
            {l.runQc}
          </a>
        ) : null}
        {a.handover ? (
          <a className="btn btn--primary" href={`${base.replace('/api/v1', '')}/handover`}>
            {l.handover}
          </a>
        ) : null}
        {a.resume ? (
          <Button
            loading={busy === 'resume'}
            onClick={() => void run('resume', `${base}/resume`, v)}
          >
            {l.resume}
          </Button>
        ) : null}
        {a.pause ? (
          <Button variant="secondary" onClick={() => setAsk('pause')} data-testid="order-pause">
            {l.pause}
          </Button>
        ) : null}
        {a.recheckParts ? (
          <Button
            variant="secondary"
            loading={busy === 'recheck'}
            onClick={() => void run('recheck', `${base}/recheck-parts`, {})}
            data-testid="order-recheck"
          >
            {l.recheck}
          </Button>
        ) : null}
        {a.supplement ? (
          <Button
            variant="secondary"
            loading={busy === 'supplement'}
            onClick={() => void supplement()}
            data-testid="order-supplement"
          >
            {l.supplement}
          </Button>
        ) : null}
        {a.cancel ? (
          <Button variant="danger" onClick={() => setAsk('cancel')} data-testid="order-cancel">
            {l.cancel}
          </Button>
        ) : null}
      </div>
      {ask ? (
        <div className="stack" role="group" aria-label={ask === 'pause' ? l.pause : l.cancel}>
          {ask === 'cancel' && props.hasIssuedParts ? (
            <div className="alert alert--warning" role="note">
              <div className="alert__body">{l.cancelIssued}</div>
            </div>
          ) : null}
          <div className="field">
            <label className="field__label" htmlFor="order-reason">
              {l.reason}
            </label>
            <textarea
              id="order-reason"
              className="textarea"
              rows={2}
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="rec-actions">
            <Button
              variant={ask === 'cancel' ? 'danger' : 'primary'}
              loading={busy === ask}
              disabled={reason.trim().length < (ask === 'cancel' ? 5 : 3)}
              onClick={async () => {
                const ok = await run(ask, `${base}/${ask}`, { ...v, reason: reason.trim() });
                if (ok) {
                  setAsk(null);
                  setReason('');
                }
              }}
              data-testid="order-reason-confirm"
            >
              {l.confirm}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setAsk(null);
                setError(null);
              }}
            >
              {l.keep}
            </Button>
          </div>
        </div>
      ) : null}
      {error ? (
        <div className="alert alert--danger" role="alert" data-testid="order-error">
          <div className="alert__body">{error}</div>
        </div>
      ) : null}
    </div>
  );
}

/** FR-REC-014: the advisor turns a technician's proposal into a supplementary quote, or dismisses it with a reason. */
export function ProposalRow(props: {
  orderId: string;
  version: number;
  proposalId: string;
  canUpdate: boolean;
  labels: Labels;
}) {
  const l = props.labels;
  const router = useRouter();
  const { run, busy, error } = useAction(l.unexpected!);
  async function quote() {
    const r = await run<{ id: string }>(
      `q-${props.proposalId}`,
      `/api/v1/rec/orders/${props.orderId}/supplement`,
      { version: props.version, proposalId: props.proposalId },
      { refresh: false },
    );
    if (r?.id) router.push(`/rec/quotes/${r.id}`);
  }
  if (!props.canUpdate) return null;
  return (
    <div className="rec-actions">
      <Button
        size="sm"
        variant="secondary"
        loading={busy === `q-${props.proposalId}`}
        onClick={() => void quote()}
        data-testid="proposal-quote"
      >
        {l.makeQuote}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        loading={busy === 'dismiss'}
        onClick={() =>
          void run(
            'dismiss',
            `/api/v1/rec/orders/${props.orderId}/proposals/${props.proposalId}/dismiss`,
            { version: props.version, reason: l.dismissReason },
          )
        }
      >
        {l.dismiss}
      </Button>
      {error ? <span className="field__error">{error}</span> : null}
    </div>
  );
}
