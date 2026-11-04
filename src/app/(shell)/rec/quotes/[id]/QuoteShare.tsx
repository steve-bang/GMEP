'use client';

import { useState } from 'react';
import { Button } from '@/ui/components/Button';
import { Icon } from '@/ui/components/Icon';
import { newKey, postJson } from '@/ui/components/postJson';

/**
 * G2-QUO-04 (reduced to what exists): hand the sent version to the customer by link (copy) or on paper.
 * Zalo, SMS and email stay locked with a plain reason and no provider name until a channel is active
 * (designer F3-05). The raw token is shown once; only its hash is stored (FR-REC-008).
 */
export function QuoteShare(props: {
  quoteId: string;
  version: number;
  hasLink: boolean;
  printHref: string;
  labels: Record<string, string>;
}) {
  const l = props.labels;
  const [busy, setBusy] = useState(false);
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
          {(['zalo', 'sms', 'email'] as const).map((c) => (
            <div key={c} className="rec-channel rec-channel--off" aria-disabled="true">
              <strong>
                {l[c]} <span className="tag">{l.notActive}</span>
              </strong>
              <span className="text-secondary">{l.notActiveHint}</span>
            </div>
          ))}
        </div>
        {error ? (
          <span className="field__error" role="alert">
            {error}
          </span>
        ) : null}
      </div>
    </section>
  );
}
