'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { splitTaxByItems } from '@/platform/money/splitTax';
import { Button } from '@/ui/components/Button';
import { Icon } from '@/ui/components/Icon';
import { newKey, postJson } from '@/ui/components/postJson';
import { useOnline } from '@/ui/useOnline';
import { money } from '../../format';

export interface ApprovalItem {
  no: number;
  name: string;
  necessity: 'required' | 'optional';
  customerRequested: boolean;
  lines: { amountVnd: number; taxRateBp: number }[];
}
export interface ApprovalPolicyView {
  allowDeclineRequired: boolean;
  verbalApproval: boolean;
  reasons: { code: string; name: string; noteRequired: boolean }[];
}

/**
 * G2-QUO-05: staff records the approval the customer gave at the counter, in three steps (items, how the
 * customer confirmed, review). The server recomputes everything; the totals here use the same
 * largest-remainder split so what staff read back to the customer is what is stored (R1).
 */
export function CounterApproval(props: {
  quoteId: string;
  version: number;
  items: ApprovalItem[];
  policy: ApprovalPolicyView;
  verbalNoteMin: number;
  labels: Record<string, string>;
}) {
  const l = props.labels;
  const router = useRouter();
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [key] = useState(newKey);
  const [sel, setSel] = useState<Set<number>>(
    () =>
      new Set(
        props.items
          .filter((i) => i.necessity === 'required' || i.customerRequested)
          .map((i) => i.no),
      ),
  );
  const [why, setWhy] = useState<Record<number, { reasonCode: string; reasonNote: string }>>({});
  const [method, setMethod] = useState<'counter_signature' | 'counter_verbal'>('counter_signature');
  const [signer, setSigner] = useState('');
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  const [readBack, setReadBack] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approved = props.items.filter((i) => sel.has(i.no));
  const declined = props.items.filter((i) => !sel.has(i.no));
  const split = useMemo(() => splitTaxByItems(approved), [approved]);
  const declinedRequired = declined.filter((i) => i.necessity === 'required');
  const reasonOk = declinedRequired.every((i) => {
    const w = why[i.no];
    const r = props.policy.reasons.find((x) => x.code === w?.reasonCode);
    return !!r && (!r.noteRequired || !!w?.reasonNote.trim());
  });
  const step1Ok = approved.length > 0 && reasonOk;
  const step2Ok =
    method === 'counter_signature'
      ? signer.trim().length >= 2
      : note.trim().length >= props.verbalNoteMin && readBack;

  function toggle(it: ApprovalItem, on: boolean) {
    const next = new Set(sel);
    if (on) next.add(it.no);
    else next.delete(it.no);
    setSel(next);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const r = await postJson(
      `/api/v1/rec/quotes/${props.quoteId}/approve`,
      'POST',
      {
        version: props.version,
        method,
        selectedItemNos: [...sel],
        declines: declined.map((i) => ({
          itemNo: i.no,
          ...(why[i.no]?.reasonCode ? { reasonCode: why[i.no]!.reasonCode } : {}),
          ...(why[i.no]?.reasonNote.trim() ? { reasonNote: why[i.no]!.reasonNote.trim() } : {}),
        })),
        ...(method === 'counter_signature'
          ? { signerName: signer.trim(), ...(ref.trim() ? { evidenceRef: ref.trim() } : {}) }
          : { note: note.trim(), readBack }),
      },
      key,
    );
    setBusy(false);
    if (r.ok) {
      setOpen(false);
      router.refresh();
      return;
    }
    if (r.status === 0) setError(l.offline!);
    else if (r.problem?.code === 'version_conflict') setError(l.conflict!);
    else if (r.problem?.code === 'quote_expired') setError(l.expired!);
    else setError(r.problem?.errors?.[0]?.message ?? r.problem?.detail ?? l.unexpected!);
  }

  if (!open)
    return (
      <Button variant="primary" onClick={() => setOpen(true)} data-testid="counter-approve-open">
        {l.openButton}
      </Button>
    );
  return (
    <section className="card" aria-labelledby="ca-h" data-testid="counter-approval">
      <div className="card__header">
        <h2 className="card__title" id="ca-h">
          {l.title}
        </h2>
        <span className="tag" aria-live="polite">
          {step === 1 ? l.step1 : step === 2 ? l.step2 : l.step3}
        </span>
      </div>
      <div className="card__body stack">
        {!online ? (
          <div className="alert alert--warning" role="status">
            <div className="alert__body">{l.offline}</div>
          </div>
        ) : null}

        {step === 1 ? (
          <>
            <p className="text-secondary">{l.lead}</p>
            {props.items.map((it) => {
              const g = splitTaxByItems([it]).totalVnd;
              const lockedOn = it.necessity === 'required' && !props.policy.allowDeclineRequired;
              const off = !sel.has(it.no);
              return (
                <div key={it.no} className="rec-item">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={sel.has(it.no)}
                      disabled={lockedOn}
                      onChange={(e) => toggle(it, e.target.checked)}
                      data-testid={`ca-item-${it.no}`}
                    />
                    <span className="check__box">
                      <Icon name="check" />
                    </span>
                    <span>
                      <strong>
                        {it.no}. {it.name}
                      </strong>{' '}
                      <span className="tag">
                        {it.necessity === 'required' ? l.required : l.optional}
                      </span>
                      {it.customerRequested ? (
                        <span className="tag">{l.customerRequested}</span>
                      ) : null}
                    </span>
                    <span className="num rec-item__sum">{money(g)}</span>
                  </label>
                  {lockedOn ? <span className="text-secondary">{l.lockedRequired}</span> : null}
                  {off && it.necessity === 'required' ? (
                    <div className="alert alert--warning" role="note">
                      <div className="alert__body">
                        <span>{l.declineWarn}</span>
                        <div className="field">
                          <label className="field__label" htmlFor={`why-${it.no}`}>
                            {l.reason}
                          </label>
                          <select
                            id={`why-${it.no}`}
                            className="select"
                            value={why[it.no]?.reasonCode ?? ''}
                            onChange={(e) =>
                              setWhy({
                                ...why,
                                [it.no]: {
                                  reasonNote: why[it.no]?.reasonNote ?? '',
                                  reasonCode: e.target.value,
                                },
                              })
                            }
                          >
                            <option value="">{l.reasonPick}</option>
                            {props.policy.reasons.map((r) => (
                              <option key={r.code} value={r.code}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label className="field__label" htmlFor={`why-note-${it.no}`}>
                            {l.reasonNote}
                          </label>
                          <input
                            id={`why-note-${it.no}`}
                            className="input"
                            maxLength={300}
                            value={why[it.no]?.reasonNote ?? ''}
                            onChange={(e) =>
                              setWhy({
                                ...why,
                                [it.no]: {
                                  reasonCode: why[it.no]?.reasonCode ?? '',
                                  reasonNote: e.target.value,
                                },
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
            <dl className="rec-totals" data-testid="ca-totals">
              <div>
                <dt>{l.selected}</dt>
                <dd className="num">
                  {approved.length}/{props.items.length}
                </dd>
              </div>
              <div>
                <dt>{l.tax}</dt>
                <dd className="num">{money(split.taxVnd)}</dd>
              </div>
              <div className="rec-totals__grand">
                <dt>{l.total}</dt>
                <dd className="num" data-testid="ca-total">
                  {money(split.totalVnd)}
                </dd>
              </div>
            </dl>
            {approved.length === 0 ? <span className="text-secondary">{l.nothing}</span> : null}
          </>
        ) : null}

        {step === 2 ? (
          <fieldset className="rec-fieldset">
            <legend className="field__label">{l.method}</legend>
            <label className="radio">
              <input
                type="radio"
                name="method"
                checked={method === 'counter_signature'}
                onChange={() => setMethod('counter_signature')}
              />
              <span className="radio__box" />
              <span>
                <strong>{l.signature}</strong>
                <span className="text-secondary"> {l.signatureHint}</span>
              </span>
            </label>
            <label className="radio">
              <input
                type="radio"
                name="method"
                checked={method === 'counter_verbal'}
                disabled={!props.policy.verbalApproval}
                onChange={() => setMethod('counter_verbal')}
              />
              <span className="radio__box" />
              <span>
                <strong>{l.verbal}</strong>
                <span className="text-secondary">
                  {' '}
                  {props.policy.verbalApproval ? l.verbalHint : l.verbalOff}
                </span>
              </span>
            </label>
            <label className="radio">
              <input type="radio" name="method" disabled />
              <span className="radio__box" />
              <span>
                <strong>{l.otp}</strong>
                <span className="text-secondary"> {l.otpOff}</span>
              </span>
            </label>
            {method === 'counter_signature' ? (
              <>
                <div className="field">
                  <label className="field__label" htmlFor="ca-signer">
                    {l.signerName} *
                  </label>
                  <input
                    id="ca-signer"
                    className="input"
                    maxLength={120}
                    value={signer}
                    onChange={(e) => setSigner(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="ca-ref">
                    {l.evidenceRef}
                  </label>
                  <input
                    id="ca-ref"
                    className="input"
                    maxLength={60}
                    value={ref}
                    onChange={(e) => setRef(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="field">
                  <label className="field__label" htmlFor="ca-note">
                    {l.note} *
                  </label>
                  <textarea
                    id="ca-note"
                    className="textarea"
                    rows={3}
                    maxLength={500}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <span className="field__hint">
                    {(l.noteHint ?? '').replace('{min}', String(props.verbalNoteMin))}
                  </span>
                </div>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={readBack}
                    onChange={(e) => setReadBack(e.target.checked)}
                  />
                  <span className="check__box">
                    <Icon name="check" />
                  </span>
                  <span>{l.readBack}</span>
                </label>
              </>
            )}
          </fieldset>
        ) : null}

        {step === 3 ? (
          <div className="stack" data-testid="ca-review">
            <div>
              <strong>{l.reviewApproved}</strong>
              <ul>
                {approved.map((i) => (
                  <li key={i.no}>
                    {i.no}. {i.name} ·{' '}
                    <span className="num">
                      {money(split.items.find((x) => x.no === i.no)!.grossVnd)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            {declined.length > 0 ? (
              <div>
                <strong>{l.reviewDeclined}</strong>
                <ul>
                  {declined.map((i) => (
                    <li key={i.no}>
                      {i.no}. {i.name}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p>
              <strong>{l.total}: </strong>
              <span className="num">{money(split.totalVnd)}</span>
            </p>
          </div>
        ) : null}

        {error ? (
          <span className="field__error" role="alert">
            {error}
          </span>
        ) : null}
        <div className="rec-actions">
          {step > 1 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              {l.back}
            </Button>
          ) : null}
          {step < 3 ? (
            <Button
              variant="primary"
              disabled={step === 1 ? !step1Ok : !step2Ok}
              onClick={() => setStep(step + 1)}
            >
              {l.next}
            </Button>
          ) : (
            <Button
              variant="primary"
              loading={busy}
              disabled={!online}
              onClick={() => void submit()}
              data-testid="counter-approve-confirm"
            >
              {l.confirm}
            </Button>
          )}
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {l.cancel}
          </Button>
        </div>
      </div>
    </section>
  );
}
