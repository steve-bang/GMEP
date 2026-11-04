'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatBp } from '@/platform/format/percent';
import { formatVnd } from '@/platform/format/vnd';
import { Button } from '@/ui/components/Button';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { useAction } from '@/ui/components/useAction';

type Labels = Record<string, string>;
const REASONS = ['buyer_info', 'amounts', 'tax_rate', 'duplicate', 'other'] as const;
const fill = (s: string, v: Record<string, string | number>) =>
  Object.entries(v).reduce((acc, [k, x]) => acc.replace(`{${k}}`, String(x)), s);

/**
 * G4-EIN-04: pick adjust / replace / cancel, give the reason and the changes, then send it for approval behind a guard
 * (type the number of the original invoice). Nothing is sent to the provider until the request is approved.
 */
export function CorrectionForm(props: {
  invoice: {
    id: string;
    number: string;
    totalVnd: number;
    buyerName: string;
    buyerTaxCode: string | null;
    rates: number[];
  };
  allowed: boolean;
  labels: Labels; // ein.correct
  common: Labels;
}) {
  const l = props.labels;
  const c = props.common;
  const router = useRouter();
  const { run, busy, error } = useAction(c.unexpected!, c.offline);
  const [purpose, setPurpose] = useState<'adjust' | 'replace' | 'cancel'>('adjust');
  const [reasonCode, setReasonCode] = useState<(typeof REASONS)[number]>('amounts');
  const [reason, setReason] = useState('');
  const [deltas, setDeltas] = useState([{ rateIndex: 0, description: '', amount: '' }]);
  const [name, setName] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [address, setAddress] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [guard, setGuard] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const parsed = deltas.map((d) => ({
    rateIndex: d.rateIndex,
    description: d.description.trim(),
    netVnd: Number(d.amount.replace(/[.\s]/g, '').replace(',', '.')),
  }));
  const deltasOk =
    parsed.length > 0 &&
    parsed.every((d) => d.description.length >= 2 && Number.isInteger(d.netVnd)) &&
    parsed.some((d) => d.netVnd !== 0);
  const buyer = {
    ...(name.trim() ? { name: name.trim() } : {}),
    ...(taxCode.trim() ? { taxCode: taxCode.trim(), kind: 'business' as const } : {}),
    ...(address.trim() ? { address: address.trim() } : {}),
  };
  const ready =
    props.allowed &&
    reason.trim().length >= 5 &&
    (purpose === 'cancel' ||
      (purpose === 'adjust' && deltasOk) ||
      (purpose === 'replace' && Object.keys(buyer).length > 0));
  async function submit() {
    const body = {
      purpose,
      reasonCode,
      reason: reason.trim(),
      ...(purpose === 'adjust' ? { deltas: parsed } : {}),
      ...(purpose === 'replace' ? { buyer } : {}),
    };
    const r = await run<{ number: string }>(
      'correct',
      `/api/v1/ein/invoices/${props.invoice.id}/corrections`,
      body,
      { refresh: false },
    );
    setConfirming(false);
    if (r) {
      setDone(fill(l.done!, { number: r.number }));
      router.push(`/ein/invoices/${encodeURIComponent(props.invoice.id)}`);
    }
  }
  return (
    <div className="stack">
      <section className="card" aria-labelledby="cor-orig">
        <div className="card__header">
          <h2 className="card__title" id="cor-orig">
            {l.original}
          </h2>
        </div>
        <dl className="detail-list">
          <div>
            <dt>{c.docType_original}</dt>
            <dd className="code">{props.invoice.number}</dd>
          </div>
          <div>
            <dt>{l.currentBuyer}</dt>
            <dd>
              {props.invoice.buyerName}
              {props.invoice.buyerTaxCode ? ` · MST ${props.invoice.buyerTaxCode}` : ''}
            </dd>
          </div>
          <div>
            <dt>{c.money}</dt>
            <dd>{formatVnd(props.invoice.totalVnd)}</dd>
          </div>
        </dl>
      </section>
      <section className="card" aria-labelledby="cor-form">
        <div className="card__header">
          <h2 className="card__title" id="cor-form">
            {l.purpose}
          </h2>
        </div>
        <div className="card__body stack">
          <p className="text-secondary">{l.caseNote}</p>
          <div className="rec-chips" role="radiogroup" aria-label={l.purpose}>
            {(['adjust', 'replace', 'cancel'] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={purpose === p}
                className={`chip${purpose === p ? ' is-selected' : ''}`}
                onClick={() => setPurpose(p)}
                data-testid={`purpose-${p}`}
              >
                {c[`purpose_${p}`]}
              </button>
            ))}
          </div>
          <p className="text-secondary">{l[`${purpose}Help`]}</p>
          <div className="acc-grid-2">
            <div className="field">
              <label className="field__label" htmlFor="cor-code">
                {l.reasonCode}
              </label>
              <select
                id="cor-code"
                className="select"
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value as (typeof REASONS)[number])}
              >
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {l[`reason_${r}`]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="cor-reason">
                {l.reason} *
              </label>
              <input
                id="cor-reason"
                className="input"
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                data-testid="cor-reason"
              />
              <span className="field__hint">{l.reasonHint}</span>
            </div>
          </div>
          {purpose === 'adjust' ? (
            <div className="stack-2" data-testid="cor-deltas">
              {deltas.map((d, i) => (
                <div className="acc-line" key={i}>
                  <div className="field">
                    <label className="field__label" htmlFor={`cor-rate-${i}`}>
                      {l.rate}
                    </label>
                    <select
                      id={`cor-rate-${i}`}
                      className="select"
                      value={d.rateIndex}
                      onChange={(e) =>
                        setDeltas(
                          deltas.map((x, k) =>
                            k === i ? { ...x, rateIndex: Number(e.target.value) } : x,
                          ),
                        )
                      }
                    >
                      {props.invoice.rates.map((bp, k) => (
                        <option key={bp} value={k}>
                          {formatBp(bp)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor={`cor-amt-${i}`}>
                      {l.delta}
                    </label>
                    <input
                      id={`cor-amt-${i}`}
                      className="input input--num"
                      inputMode="numeric"
                      value={d.amount}
                      onChange={(e) =>
                        setDeltas(
                          deltas.map((x, k) => (k === i ? { ...x, amount: e.target.value } : x)),
                        )
                      }
                      data-testid={`cor-amount-${i}`}
                    />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor={`cor-desc-${i}`}>
                      {l.deltaDesc}
                    </label>
                    <input
                      id={`cor-desc-${i}`}
                      className="input"
                      maxLength={200}
                      value={d.description}
                      onChange={(e) =>
                        setDeltas(
                          deltas.map((x, k) =>
                            k === i ? { ...x, description: e.target.value } : x,
                          ),
                        )
                      }
                      data-testid={`cor-desc-${i}`}
                    />
                  </div>
                  {deltas.length > 1 ? (
                    <Button
                      variant="ghost"
                      onClick={() => setDeltas(deltas.filter((_, k) => k !== i))}
                    >
                      {l.removeLine}
                    </Button>
                  ) : null}
                </div>
              ))}
              {deltas.length < 6 ? (
                <div>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setDeltas([...deltas, { rateIndex: 0, description: '', amount: '' }])
                    }
                  >
                    {l.addLine}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
          {purpose === 'replace' ? (
            <div className="acc-grid-2" data-testid="cor-buyer">
              <div className="field">
                <label className="field__label" htmlFor="cor-name">
                  {l.newName}
                </label>
                <input
                  id="cor-name"
                  className="input"
                  maxLength={200}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="cor-tax">
                  {l.newTaxCode}
                </label>
                <input
                  id="cor-tax"
                  className="input"
                  maxLength={14}
                  value={taxCode}
                  onChange={(e) => setTaxCode(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="cor-addr">
                  {l.newAddress}
                </label>
                <input
                  id="cor-addr"
                  className="input"
                  maxLength={300}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  data-testid="cor-address"
                />
              </div>
            </div>
          ) : null}
          {done ? (
            <div className="alert alert--success" role="status">
              <div className="alert__body">{done}</div>
            </div>
          ) : null}
          {error ? (
            <div className="alert alert--danger" role="alert" data-testid="cor-error">
              <div className="alert__body">{error}</div>
            </div>
          ) : null}
          <div>
            <Button
              variant="primary"
              disabled={!ready}
              onClick={() => {
                setGuard('');
                setConfirming(true);
              }}
              data-testid="cor-open"
            >
              {l.submit}
            </Button>
          </div>
        </div>
      </section>
      <ConfirmDialog
        open={confirming}
        title={`${l.submit}: ${c[`purpose_${purpose}`]}`}
        confirmLabel={l.submit!}
        cancelLabel={c.cancel!}
        busy={busy === 'correct'}
        confirmDisabled={guard.trim() !== props.invoice.number}
        onConfirm={() => void submit()}
        onCancel={() => setConfirming(false)}
        testId="cor-confirm"
      >
        <p className="text-secondary">{reason}</p>
        <div className="field">
          <label className="field__label" htmlFor="cor-guard">
            {l.guard} ({props.invoice.number}) *
          </label>
          <input
            id="cor-guard"
            className="input"
            value={guard}
            onChange={(e) => setGuard(e.target.value)}
            data-testid="cor-guard"
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
