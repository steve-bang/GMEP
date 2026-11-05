'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/ui/components/Button';
import { Icon } from '@/ui/components/Icon';
import { newKey, postJson } from '@/ui/components/postJson';

/**
 * G2-QUO-04 (reduced to what exists): hand the sent version to the customer by link (copy) or on paper.
 * Zalo, SMS and email are buttons when the server reports the channel as available (an adapter is configured) and
 * stay locked with a plain reason, no provider name, otherwise (designer F3-05). "Gửi" sends a fresh link to the
 * contact on file; the server checks the customer's consent. The raw token is shown once; only its hash is stored (FR-REC-008).
 */
type Channel = 'zalo' | 'sms' | 'email';
export function QuoteShare(props: {
  quoteId: string;
  version: number;
  hasLink: boolean;
  printHref: string;
  /** channels with a configured adapter (server-derived) */
  channels: Channel[];
  labels: Record<string, string>;
}) {
  const l = props.labels;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState<Channel | null>(null);
  const [sentNote, setSentNote] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function make() {
    setBusy(true);
    setError(null);
    const r = await postJson(
      `/api/v1/rec/quotes/${props.quoteId}/link`,
      'POST',
      { version: props.version },
      newKey(),
    );
    setBusy(false);
    if (!r.ok) {
      setError(r.problem?.detail ?? l.unexpected!);
      return;
    }
    const d = r.data as { path: string };
    setUrl(`${window.location.origin}${d.path}`);
    setCopied(false);
  }
  async function send(channel: Channel) {
    setSending(channel);
    setError(null);
    setSentNote(null);
    const r = await postJson(
      `/api/v1/rec/quotes/${props.quoteId}/send-link`,
      'POST',
      { version: props.version, channel },
      newKey(),
    );
    setSending(null);
    if (!r.ok) {
      setError(r.problem?.detail ?? l.unexpected!);
      return;
    }
    const d = r.data as {
      status: 'sent' | 'pending' | 'dead';
      recipient: string;
      simulated?: boolean;
    };
    setSentNote(
      (d.status === 'sent'
        ? d.simulated
          ? l.sendSimulated!
          : l.sendOk!
        : d.status === 'pending'
          ? l.sendQueued!
          : l.sendDead!
      ).replace('{to}', d.recipient),
    );
    router.refresh();
  }
  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      /* the field is selectable: the user can copy by hand */
    }
  }
  return (
    <section className="card" aria-labelledby="share-h" data-testid="quote-share">
      <div className="card__header">
        <h2 className="card__title" id="share-h">
          {l.title}
        </h2>
      </div>
      <div className="card__body stack">
        <p className="text-secondary">{l.lead}</p>
        <div className="rec-channels">
          <div className="rec-channel">
            <strong>{l.link}</strong>
            <span className="text-secondary">{l.linkHint}</span>
            {url ? (
              <div className="rec-linkrow">
                <label className="field__label" htmlFor="quote-link">
                  {l.linkLabel}
                </label>
                <input
                  id="quote-link"
                  className="input"
                  readOnly
                  value={url}
                  onFocus={(e) => e.currentTarget.select()}
                  data-testid="quote-link-url"
                />
                <Button variant="secondary" icon="check" onClick={() => void copy()}>
                  {copied ? l.copied! : l.copy!}
                </Button>
              </div>
            ) : props.hasLink ? (
              <span className="text-secondary">{l.hasLink}</span>
            ) : null}
            <Button
              variant="primary"
              loading={busy}
              onClick={() => void make()}
              data-testid="quote-link-make"
            >
              {props.hasLink || url ? l.linkRemake! : l.linkMake!}
            </Button>
          </div>
          <div className="rec-channel">
            <strong>{l.print}</strong>
            <span className="text-secondary">{l.printHint}</span>
            <a className="btn btn--secondary" href={props.printHref} data-testid="quote-print-link">
              <Icon name="printer" />
              <span>{l.printOpen}</span>
            </a>
          </div>
          {(['zalo', 'sms', 'email'] as const).map((c) =>
            props.channels.includes(c) ? (
              <div key={c} className="rec-channel" data-testid={`quote-send-${c}-box`}>
                <strong>{l[c]}</strong>
                <span className="text-secondary">{l.sendHint}</span>
                <Button
                  variant="secondary"
                  loading={sending === c}
                  disabled={sending !== null}
                  onClick={() => void send(c)}
                  data-testid={`quote-send-${c}`}
                >
                  {l.sendVia!.replace('{channel}', l[c]!)}
                </Button>
              </div>
            ) : (
              <div key={c} className="rec-channel rec-channel--off" aria-disabled="true">
                <strong>
                  {l[c]} <span className="tag">{l.notActive}</span>
                </strong>
                <span className="text-secondary">{l.notActiveHint}</span>
              </div>
            ),
          )}
        </div>
        {sentNote ? (
          <span className="text-secondary" role="status" data-testid="quote-send-result">
            {sentNote}
          </span>
        ) : null}
        {error ? (
          <span className="field__error" role="alert">
            {error}
          </span>
        ) : null}
      </div>
    </section>
  );
}
