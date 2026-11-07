'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button } from '@/ui/components/Button';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { newKey, postJson } from '@/ui/components/postJson';
import { problemText } from './labels';

type Dialog = 'cancel' | 'no_show' | 'advisor' | null;

/**
 * G2-APT-01 card actions (FR-REC-027): "Đã đến" opens the pre-filled intake, "Hủy" needs a reason, "Vắng" from the
 * appointment day on, "Đổi cố vấn". Each intent keeps ONE Idempotency-Key until the server answers (a retry is safe).
 * Which buttons show comes from the server (`allowed` from the state machine and the actor's rights); it re-checks all.
 */
export function AppointmentActions(props: {
  labels: Record<string, string>;
  id: string;
  number: string;
  version: number;
  advisorId: string | null;
  advisors: { id: string; name: string }[];
  canUpdate: boolean;
  canArrive: boolean;
  /** the appointment day has started (no-show is allowed from then on) */
  due: boolean;
}) {
  const l = props.labels;
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reason, setReason] = useState('');
  const [advisor, setAdvisor] = useState(props.advisorId ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const keys = useRef(new Map<string, string>());

  async function call(
    intent: string,
    path: string,
    method: string,
    body: Record<string, unknown>,
    onOk: (data: unknown) => void,
  ) {
    const k = `${intent}:${JSON.stringify(body)}`;
    if (!keys.current.has(k)) keys.current.set(k, newKey());
    setBusy(intent);
    setError(null);
    const r = await postJson(
      `/api/v1/rec/appointments/${encodeURIComponent(props.id)}${path}`,
      method,
      body,
      keys.current.get(k)!,
    );
    setBusy(null);
    if (r.status === 0) {
      setError(l.f_unexpected ?? '');
      return;
    }
    keys.current.delete(k);
    if (r.ok) {
      onOk(r.data);
      return;
    }
    setError(problemText(l, r.problem, l.f_unexpected ?? ''));
    if (r.status === 409) router.refresh();
  }

  const close = () => {
    setDialog(null);
    setError(null);
  };
  const fill = (s: string | undefined) => (s ?? '').replace('{number}', props.number);

  return (
    <div className="rec-chips">
      {props.canArrive ? (
        <Button
          variant="primary"
          size="sm"
          loading={busy === 'arrive'}
          onClick={() =>
            void call('arrive', '/arrive', 'POST', { version: props.version }, (d) => {
              const intake = (d as { intake?: { id: string } | null }).intake;
              if (intake) router.push(`/rec/intakes/${encodeURIComponent(intake.id)}`);
              else router.refresh();
            })
          }
          aria-label={`${l.a_arrive} ${props.number}`}
          data-testid="apt-arrive"
        >
          {l.a_arrive}
        </Button>
      ) : null}
      {props.canUpdate ? (
        <>
          <Link
            className="btn btn--secondary btn--sm"
            href={`/rec/appointments/${encodeURIComponent(props.id)}/edit`}
            aria-label={`${l.a_edit} ${props.number}`}
            data-testid="apt-edit"
          >
            {l.a_edit}
          </Link>
          <Button
            size="sm"
            onClick={() => setDialog('advisor')}
            aria-label={`${l.a_advisor} ${props.number}`}
          >
            {l.a_advisor}
          </Button>
          {props.due ? (
            <Button
              size="sm"
              onClick={() => setDialog('no_show')}
              aria-label={`${l.a_noShow} ${props.number}`}
              data-testid="apt-no-show"
            >
              {l.a_noShow}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDialog('cancel')}
            aria-label={`${l.a_cancel} ${props.number}`}
            data-testid="apt-cancel"
          >
            {l.a_cancel}
          </Button>
        </>
      ) : null}
      {error && dialog === null ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : null}

      <ConfirmDialog
        open={dialog === 'cancel'}
        title={fill(l.a_cancelTitle)}
        confirmLabel={l.a_cancelConfirm!}
        cancelLabel={l.a_back!}
        tone="danger"
        busy={busy === 'cancel'}
        confirmDisabled={reason.trim().length < 3}
        testId="apt-cancel-dialog"
        onCancel={close}
        onConfirm={() =>
          void call(
            'cancel',
            '/cancel',
            'POST',
            { version: props.version, reason: reason.trim() },
            () => {
              close();
              setReason('');
              router.refresh();
            },
          )
        }
      >
        <div className="field">
          <label className="field__label" htmlFor={`apt-reason-${props.id}`}>
            {l.a_reason}
            <span className="field__req" aria-hidden="true">
              *
            </span>
          </label>
          <textarea
            id={`apt-reason-${props.id}`}
            className="textarea"
            value={reason}
            maxLength={300}
            onChange={(e) => setReason(e.target.value)}
            aria-describedby={`apt-reason-h-${props.id}`}
          />
          <span className="field__hint" id={`apt-reason-h-${props.id}`}>
            {l.a_reasonHint}
          </span>
          {error ? (
            <span className="field__error" role="alert">
              {error}
            </span>
          ) : null}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'no_show'}
        title={fill(l.a_noShowTitle)}
        confirmLabel={l.a_noShowConfirm!}
        cancelLabel={l.a_back!}
        busy={busy === 'no_show'}
        testId="apt-no-show-dialog"
        onCancel={close}
        onConfirm={() =>
          void call('no_show', '/no-show', 'POST', { version: props.version }, () => {
            close();
            router.refresh();
          })
        }
      >
        <p>{l.a_noShowText}</p>
        {error ? (
          <span className="field__error" role="alert">
            {error}
          </span>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'advisor'}
        title={fill(l.a_advisorTitle)}
        confirmLabel={l.a_advisorConfirm!}
        cancelLabel={l.a_back!}
        busy={busy === 'advisor'}
        testId="apt-advisor-dialog"
        onCancel={close}
        onConfirm={() =>
          void call(
            'advisor',
            '',
            'PATCH',
            { version: props.version, advisorId: advisor || null },
            () => {
              close();
              router.refresh();
            },
          )
        }
      >
        <div className="field">
          <label className="field__label" htmlFor={`apt-adv-${props.id}`}>
            {l.f_advisor}
          </label>
          <select
            id={`apt-adv-${props.id}`}
            className="select"
            value={advisor}
            onChange={(e) => setAdvisor(e.target.value)}
          >
            <option value="">{l.f_advisorAuto}</option>
            {props.advisors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {error ? (
            <span className="field__error" role="alert">
              {error}
            </span>
          ) : null}
        </div>
      </ConfirmDialog>
    </div>
  );
}
