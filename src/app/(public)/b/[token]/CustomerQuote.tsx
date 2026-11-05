'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatVnd } from '@/platform/format/vnd';
import { isoToVi } from '@/platform/format/date';
import { splitTaxByItems } from '@/platform/money/splitTax';
import { Button } from '@/ui/components/Button';
import { newKey, postJson } from '@/ui/components/postJson';
import { Icon } from '@/ui/components/Icon';
import { useOnline } from '@/ui/useOnline';

interface Line {
  kind: 'labor' | 'part';
  name: string;
  qty: number;
  qtyScale: number;
  unitVnd: number;
  amountVnd: number;
  taxRateBp: number;
}
interface Item {
  no: number;
  name: string;
  necessity: 'required' | 'optional';
  customerRequested: boolean;
  defaultSelected: boolean;
  lines: Line[];
}
interface Dto {
  n: number;
  number: string;
  validUntil: string | null;
  customerGivenName: string;
  items: Item[];
  policy: {
    allowDeclineRequired: boolean;
    reasons: { code: string; name: string; noteRequired: boolean }[];
  };
}

const fill = (s: string | undefined, v: Record<string, string | number>): string =>
  Object.entries(v).reduce((a, [k, x]) => a.replaceAll(`{${k}}`, String(x)), s ?? '');
const hoursOf = (min: number): string =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(min / 60);

/**
 * G2-QUO-06: the customer ticks the items they agree to (required ones pre-ticked, the optional one they
 * asked for too). Unticking a required item opens a safety warning with a reason; "Từ chối toàn bộ báo
 * giá" always means the whole quote. Item prices include tax and add up to the total (R1); the server
 * recomputes everything. Connection loss keeps the choices on screen (warn and keep drafts only).
 */
export function CustomerQuote({
  token,
  dto,
  labels: l,
}: {
  token: string;
  dto: Dto;
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const online = useOnline();
  const [sel, setSel] = useState<Set<number>>(
    () => new Set(dto.items.filter((i) => i.defaultSelected).map((i) => i.no)),
  );
  const [why, setWhy] = useState<Record<number, { reasonCode: string; reasonNote: string }>>({});
  const [ask, setAsk] = useState<number | null>(null);
  const [draft, setDraft] = useState({ reasonCode: '', reasonNote: '' });
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | 'otp' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // QUO-04/05: the one-time code step, shown when the server asks for a code on this selection
  const [otp, setOtp] = useState<{ destination: string; resendAfter: number } | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [tick, setTick] = useState(() => Date.now());
  const [notice, setNotice] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!otp) return;
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [otp]);
  useEffect(() => {
    if (otp) codeRef.current?.focus();
  }, [otp]);
  // one Idempotency-Key per distinct choice: a retry or a double tap of the same choice replays, never repeats
  const keys = useRef<{ sig: string; key: string }>({ sig: '', key: newKey() });

  const chosen = dto.items.filter((i) => sel.has(i.no));
  const split = useMemo(() => splitTaxByItems(chosen), [chosen]);
  const gross = (it: Item): number =>
    split.items.find((x) => x.no === it.no)?.grossVnd ?? splitTaxByItems([it]).totalVnd;

  function onToggle(it: Item, on: boolean) {
    setError(null);
    if (on) {
      const n = new Set(sel);
      n.add(it.no);
      setSel(n);
      return;
    }
    if (it.necessity === 'required') {
      setDraft(why[it.no] ?? { reasonCode: '', reasonNote: '' });
      setAsk(it.no);
      return;
    }
    const n = new Set(sel);
    n.delete(it.no);
    setSel(n);
  }
  function dropRequired() {
    if (ask === null) return;
    setWhy({ ...why, [ask]: draft });
    const n = new Set(sel);
    n.delete(ask);
    setSel(n);
    setAsk(null);
  }
  const reasonOk = (() => {
    const r = dto.policy.reasons.find((x) => x.code === draft.reasonCode);
    return !!r && (!r.noteRequired || draft.reasonNote.trim().length > 0);
  })();

  function problemText(code: string | undefined, status: number): string {
    if (status === 0) return l.offline!;
    if (code === 'quote_expired') return l.errExpired!;
    if (code === 'quote_superseded') return l.errSuperseded!;
    if (code === 'quote_already_decided') return l.errDecided!;
    if (code === 'otp_invalid') return l.otpErrInvalid!;
    if (code === 'otp_expired') return l.otpErrExpired!;
    if (code === 'otp_locked') return l.otpErrLocked!;
    if (code === 'otp_unavailable') return l.otpErrUnavailable!;
    if (code === 'otp_delivery_failed') return l.otpErrFailed!;
    if (code === 'required_item_locked') return l.errLocked!;
    if (status === 429) return l.errLimited!;
    return l.errUnexpected!;
  }

  /** the customer's current choice; one Idempotency-Key per distinct choice (and code), so a retry replays */
  function selection() {
    const declines = dto.items
      .filter((i) => !sel.has(i.no))
      .map((i) => ({
        itemNo: i.no,
        ...(why[i.no]?.reasonCode ? { reasonCode: why[i.no]!.reasonCode } : {}),
        ...(why[i.no]?.reasonNote.trim() ? { reasonNote: why[i.no]!.reasonNote.trim() } : {}),
      }));
    return { selectedItemNos: [...sel].sort((a, b) => a - b), declines };
  }

  /** asks the server to send the one-time code to the contact on file (never a number typed here) */
  async function requestCode(resend = false) {
    setBusy('otp');
    setError(null);
    setNotice(null);
    const r = await postJson(
      '/api/v1/rec/public/quote/otp',
      'POST',
      { token, ...selection() },
      newKey(),
    );
    setBusy(null);
    if (!r.ok) {
      setError(problemText(r.problem?.code, r.status));
      if (r.problem?.code === 'otp_locked') setOtp(null);
      return;
    }
    const d = r.data as { required: boolean; destination?: string; resendAfter?: string };
    if (!d.required) return void approve();
    setOtp({
      destination: d.destination ?? '',
      resendAfter: d.resendAfter ? Date.parse(d.resendAfter) : Date.now(),
    });
    setTick(Date.now());
    if (resend) setNotice(l.otpSentAgain!);
  }

  async function approve(withCode?: string) {
    setBusy('approve');
    setError(null);
    const body = {
      token,
      ...selection(),
      ...(withCode ? { otp: withCode } : {}),
    };
    const sig = JSON.stringify(body);
    if (keys.current.sig !== sig) keys.current = { sig, key: newKey() };
    const r = await postJson('/api/v1/rec/public/quote/approve', 'POST', body, keys.current.key);
    setBusy(null);
    if (r.ok) return router.refresh();
    // QUO-04/05: this choice needs a code: ask for it, then show the code step
    if (r.problem?.code === 'otp_required') return void requestCode();
    setError(problemText(r.problem?.code, r.status));
    if (r.problem?.code === 'otp_locked') setOtp(null);
    // R38: a link that expired meanwhile answers like an unknown one (404): reload to show the read-only page
    if (
      r.status === 404 ||
      r.problem?.code === 'quote_expired' ||
      r.problem?.code === 'quote_superseded' ||
      r.problem?.code === 'quote_already_decided'
    )
      router.refresh();
  }
  async function reject() {
    setBusy('reject');
    setError(null);
    const body = { token, ...(rejectReason.trim() ? { reason: rejectReason.trim() } : {}) };
    const r = await postJson(
      '/api/v1/rec/public/quote/reject',
      'POST',
      body,
      keys.current.key + '-r',
    );
    setBusy(null);
    if (r.ok || r.status === 404) return router.refresh();
    setError(problemText(r.problem?.code, r.status));
  }

  const askItem = dto.items.find((i) => i.no === ask);
  return (
    <>
      <p>{fill(l.hello, { name: dto.customerGivenName })}</p>
      <p className="text-secondary">{l.lead}</p>
      {dto.validUntil ? (
        <p className="text-secondary">{fill(l.validUntil, { date: isoToVi(dto.validUntil) })}</p>
      ) : null}
      {!online ? (
        <div className="alert alert--warning" role="status">
          <div className="alert__body">{l.offline}</div>
        </div>
      ) : null}
      <h2>{l.items}</h2>
      <p className="text-secondary">{l.itemsLead}</p>
      {!dto.policy.allowDeclineRequired ? <p className="text-secondary">{l.locked}</p> : null}
      {dto.items.map((it) => {
        const on = sel.has(it.no);
        const locked = it.necessity === 'required' && !dto.policy.allowDeclineRequired;
        return (
          <section
            key={it.no}
            className={`pub-item${on ? '' : ' pub-item--off'}`}
            data-testid="pub-item"
          >
            <div className="pub-item__row">
              <label className="check">
                <input
                  type="checkbox"
                  checked={on}
                  disabled={locked}
                  onChange={(e) => onToggle(it, e.target.checked)}
                  data-testid={`pub-check-${it.no}`}
                />
                <span className="check__box">
                  <Icon name="check" />
                </span>
                <span>
                  <strong>{it.name}</strong>{' '}
                  <span className="tag">
                    {it.necessity === 'required' ? l.required : l.optional}
                  </span>
                  {it.customerRequested ? <span className="tag">{l.requested}</span> : null}
                </span>
              </label>
              <span className="pub-item__price num">{formatVnd(gross(it))}</span>
            </div>
            {!on && why[it.no] ? (
              <p className="text-secondary">
                {dto.policy.reasons.find((r) => r.code === why[it.no]!.reasonCode)?.name}
              </p>
            ) : null}
            <details>
              <summary>{l.details}</summary>
              <ul className="pub-lines">
                {it.lines.map((x, i) => (
                  <li key={i}>
                    <span>
                      {x.kind === 'labor'
                        ? `${l.labor} ${x.name} (${fill(l.hours, { h: hoursOf(x.qty) })})`
                        : `${x.name}${x.qty !== x.qtyScale ? ` × ${x.qty / x.qtyScale}` : ''}`}
                    </span>
                    <span className="num">{formatVnd(x.amountVnd)}</span>
                  </li>
                ))}
                <li>
                  <span>{l.tax}</span>
                  <span className="num">
                    {formatVnd(
                      (split.items.find((s) => s.no === it.no) ?? splitTaxByItems([it]).items[0]!)
                        .taxVnd,
                    )}
                  </span>
                </li>
              </ul>
            </details>
          </section>
        );
      })}

      {askItem ? (
        <section
          className="pub-sheet"
          role="alertdialog"
          aria-labelledby="warn-h"
          data-testid="pub-warn"
        >
          <h2 id="warn-h">{l.warnTitle}</h2>
          <p>
            <strong>{askItem.name}</strong>. {l.warnText}
          </p>
          <div className="field">
            <label className="field__label" htmlFor="warn-reason">
              {l.warnReason}
            </label>
            <select
              id="warn-reason"
              className="select"
              value={draft.reasonCode}
              onChange={(e) => setDraft({ ...draft, reasonCode: e.target.value })}
            >
              <option value="">{l.warnReasonPick}</option>
              {dto.policy.reasons.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="warn-note">
              {l.warnNote}
            </label>
            <input
              id="warn-note"
              className="input"
              maxLength={300}
              value={draft.reasonNote}
              onChange={(e) => setDraft({ ...draft, reasonNote: e.target.value })}
            />
          </div>
          <div className="rec-actions">
            <Button variant="primary" onClick={() => setAsk(null)}>
              {l.warnKeep}
            </Button>
            <Button
              variant="secondary"
              disabled={!reasonOk}
              onClick={dropRequired}
              data-testid="pub-warn-drop"
            >
              {l.warnDrop}
            </Button>
          </div>
        </section>
      ) : null}

      {rejecting ? (
        <section
          className="pub-sheet"
          role="alertdialog"
          aria-labelledby="rej-h"
          data-testid="pub-reject"
        >
          <h2 id="rej-h">{l.rejectTitle}</h2>
          <p>{l.rejectText}</p>
          <div className="field">
            <label className="field__label" htmlFor="rej-reason">
              {l.rejectReason}
            </label>
            <input
              id="rej-reason"
              className="input"
              maxLength={300}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <div className="rec-actions">
            <Button
              variant="danger"
              loading={busy === 'reject'}
              onClick={() => void reject()}
              data-testid="pub-reject-confirm"
            >
              {l.rejectConfirm}
            </Button>
            <Button variant="ghost" onClick={() => setRejecting(false)}>
              {l.rejectKeep}
            </Button>
          </div>
        </section>
      ) : null}

      {otp ? (
        <section className="pub-sheet" role="group" aria-labelledby="otp-h" data-testid="pub-otp">
          <h2 id="otp-h">{l.otpTitle}</h2>
          <p>{fill(l.otpText, { dest: otp.destination })}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (/^\d{6}$/.test(otpCode)) void approve(otpCode);
            }}
          >
            <div className="field">
              <label className="field__label" htmlFor="otp-code">
                {l.otpLabel}
              </label>
              <input
                id="otp-code"
                ref={codeRef}
                className="input"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                aria-describedby={error ? 'otp-error' : undefined}
                aria-invalid={error ? true : undefined}
                data-testid="pub-otp-code"
              />
              {error ? (
                <span className="field__error" role="alert" id="otp-error">
                  {error}
                </span>
              ) : null}
              {notice ? (
                <span className="text-secondary" role="status">
                  {notice}
                </span>
              ) : null}
            </div>
            <div className="rec-actions">
              <Button
                variant="primary"
                type="submit"
                loading={busy === 'approve'}
                disabled={otpCode.length !== 6 || !online}
                data-testid="pub-otp-confirm"
              >
                {l.otpConfirm}
              </Button>
              <Button
                variant="secondary"
                type="button"
                loading={busy === 'otp'}
                disabled={tick < otp.resendAfter || !online}
                onClick={() => {
                  setOtpCode('');
                  void requestCode(true);
                }}
                data-testid="pub-otp-resend"
              >
                {tick < otp.resendAfter
                  ? fill(l.otpResendIn, { s: Math.ceil((otp.resendAfter - tick) / 1000) })
                  : l.otpResend}
              </Button>
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  setOtp(null);
                  setOtpCode('');
                  setError(null);
                }}
              >
                {l.otpCancel}
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="pub-total" aria-live="polite">
        <div>{fill(l.chosen, { n: chosen.length, total: dto.items.length })}</div>
        <div className="pub-total__sum">
          <span>{l.total}</span>
          <span className="num" data-testid="pub-total">
            {formatVnd(split.totalVnd)}
          </span>
        </div>
        <div className="text-secondary">
          {l.taxIn}: <span className="num">{formatVnd(split.taxVnd)}</span>. {l.totalNote}
        </div>
        {error && !otp ? (
          <span className="field__error" role="alert">
            {error}
          </span>
        ) : null}
        {chosen.length === 0 ? <span className="text-secondary">{l.none}</span> : null}
        <Button
          variant="primary"
          size="lg"
          block
          loading={busy === 'approve'}
          disabled={chosen.length === 0 || !online || ask !== null || otp !== null}
          onClick={() => void approve()}
          data-testid="pub-approve"
        >
          {l.approve}
        </Button>
        {error && error === l.offline ? (
          <Button variant="secondary" block onClick={() => void approve()}>
            {l.retry}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          block
          onClick={() => setRejecting(true)}
          data-testid="pub-reject-open"
        >
          {l.reject}
        </Button>
      </section>
    </>
  );
}
