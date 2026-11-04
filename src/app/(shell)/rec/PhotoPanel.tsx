'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button } from '@/ui/components/Button';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { newKey } from '@/ui/components/postJson';

type Labels = Record<string, string>;

export interface PhotoItem {
  id: string;
  caption: string | null;
  takenAt: string;
  hidden?: { at: string; by: string; reason: string } | null;
}

/**
 * FR-REC-003/014: photos of an intake or a repair order. Upload is multipart to the API (bytes never go to browser-side
 * storage); thumbnails are read back through the Scope-checked API route, nothing is public. The server checks type
 * (magic bytes), size and count; the messages here only relay its answer.
 */
export function PhotoPanel(props: {
  parent: 'intakes' | 'orders';
  parentId: string;
  photos: PhotoItem[];
  canAdd: boolean;
  /** R104: holders of `rec-photo:update` may hide a photo and see hidden ones marked */
  canHide?: boolean;
  labels: Labels; // rec.photos
}) {
  const l = props.labels;
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const keyRef = useRef<string | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hiding, setHiding] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const hideKey = useRef<string | null>(null);
  const base = `/api/v1/rec/${props.parent}/${encodeURIComponent(props.parentId)}/photos`;

  async function upload() {
    const file = input.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    keyRef.current ??= newKey();
    const form = new FormData();
    form.set('file', file);
    if (caption.trim()) form.set('caption', caption.trim());
    try {
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'idempotency-key': keyRef.current },
        body: form,
      });
      if (res.ok) {
        keyRef.current = null;
        setCaption('');
        if (input.current) input.current.value = '';
        router.refresh();
      } else {
        keyRef.current = null;
        const p = (await res.json().catch(() => null)) as { detail?: string } | null;
        setError(res.status === 422 ? l.invalid! : (p?.detail ?? l.unexpected!));
      }
    } catch {
      setError(l.offline!); // same key kept: a retry is safe
    }
    setBusy(false);
  }

  async function hide() {
    if (!hiding) return;
    setBusy(true);
    setError(null);
    hideKey.current ??= newKey();
    try {
      const res = await fetch(`${base}/${encodeURIComponent(hiding)}/hide`, {
        method: 'POST',
        headers: { 'idempotency-key': hideKey.current, 'content-type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (res.ok) {
        hideKey.current = null;
        setHiding(null);
        setReason('');
        router.refresh();
      } else {
        hideKey.current = null;
        setError(l.hideFailed!);
      }
    } catch {
      setError(l.offline!);
    }
    setBusy(false);
  }

  return (
    <section className="card" aria-labelledby={`photos-${props.parent}-h`} data-testid="photos">
      <div className="card__header">
        <h2 className="card__title" id={`photos-${props.parent}-h`}>
          {l.title}
        </h2>
      </div>
      <div className="card__body stack">
        {props.photos.length === 0 ? (
          <p className="text-secondary" data-testid="photos-empty">
            {l.empty}
          </p>
        ) : (
          <ul className="photo-grid" data-testid="photo-list">
            {props.photos.map((p) => (
              <li key={p.id}>
                <a href={`${base}/${encodeURIComponent(p.id)}`} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- served by the Scope-checked API, not optimisable */}
                  <img
                    src={`${base}/${encodeURIComponent(p.id)}`}
                    alt={p.caption ?? l.alt!}
                    loading="lazy"
                  />
                </a>
                {p.caption ? <span className="text-secondary">{p.caption}</span> : null}
                {p.hidden ? (
                  <span className="badge badge--neutral" data-testid="photo-hidden">
                    {l.hiddenBadge}: {p.hidden.reason}
                  </span>
                ) : props.canHide ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setHiding(p.id);
                      setReason('');
                    }}
                    data-testid="photo-hide"
                  >
                    {l.hide}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {props.canAdd ? (
          <div className="stack">
            <div className="field">
              <label className="field__label" htmlFor={`photo-file-${props.parent}`}>
                {l.file}
              </label>
              <input
                id={`photo-file-${props.parent}`}
                ref={input}
                className="input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                data-testid="photo-file"
              />
              <span className="field__hint">{l.hint}</span>
            </div>
            <div className="field">
              <label className="field__label" htmlFor={`photo-cap-${props.parent}`}>
                {l.caption}
              </label>
              <input
                id={`photo-cap-${props.parent}`}
                className="input"
                maxLength={200}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </div>
            <div>
              <Button
                variant="secondary"
                loading={busy}
                onClick={() => void upload()}
                data-testid="photo-upload"
              >
                {l.upload}
              </Button>
            </div>
          </div>
        ) : null}
        {error ? (
          <div className="alert alert--danger" role="alert" data-testid="photo-error">
            <div className="alert__body">{error}</div>
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        open={hiding !== null}
        title={l.hideTitle!}
        confirmLabel={l.hideConfirm!}
        cancelLabel={l.hideCancel!}
        tone="danger"
        busy={busy}
        confirmDisabled={reason.trim().length < 5}
        onConfirm={() => void hide()}
        onCancel={() => setHiding(null)}
        testId="photo-hide-dialog"
      >
        <div className="field">
          <label className="field__label" htmlFor={`photo-hide-reason-${props.parent}`}>
            {l.hideReason}
          </label>
          <input
            id={`photo-hide-reason-${props.parent}`}
            className="input"
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            data-testid="photo-hide-reason"
          />
        </div>
      </ConfirmDialog>
    </section>
  );
}
