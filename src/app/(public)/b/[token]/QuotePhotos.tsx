'use client';

import { useRef, useState } from 'react';

interface Photo {
  id: string;
  caption: string | null;
  kind: 'intake' | 'proposal';
}

/**
 * FR-REC-034: photos on the customer's quote page, information only (they never touch the approval). Thumbnails load
 * lazily from the token-authenticated API route; a tap opens the larger view in a native modal `<dialog>` (Escape and
 * the close button dismiss it, focus is trapped by the browser). Alt text is the caption, else a generic label.
 */
export function QuotePhotos({
  token,
  photos,
  labels: l,
}: {
  token: string;
  photos: Photo[];
  labels: Record<string, string>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<Photo | null>(null);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const markFailed = (id: string) => setFailed((f) => new Set(f).add(id));
  if (photos.length === 0) return null;
  const src = (p: Photo) =>
    `/api/v1/rec/public/quote/photos/${encodeURIComponent(p.id)}?t=${encodeURIComponent(token)}`;
  const alt = (p: Photo, i: number) =>
    p.caption ??
    ((p.kind === 'proposal' ? l.photoProposal : l.photoVehicle) ?? '').replace(
      '{n}',
      String(i + 1),
    );
  return (
    <section className="pub-photos" aria-labelledby="pub-photos-h" data-testid="pub-photos">
      <h2 id="pub-photos-h">{l.photos}</h2>
      <p className="text-secondary">{l.photosLead}</p>
      <ul className="pub-photos__grid">
        {photos.map((p, i) => (
          <li key={p.id}>
            <button
              type="button"
              className="pub-photos__thumb"
              aria-label={`${l.photoOpen}: ${alt(p, i)}`}
              onClick={() => {
                setOpen(p);
                dialog.current?.showModal();
              }}
              data-testid="pub-photo"
            >
              {failed.has(p.id) ? (
                <span
                  role="img"
                  aria-label={l.photoFailed}
                  className="text-secondary"
                  data-testid="pub-photo-failed"
                >
                  {l.photoFailed}
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- bytes come from our API, no Next image loader
                <img
                  src={src(p)}
                  alt={alt(p, i)}
                  loading="lazy"
                  decoding="async"
                  onError={() => markFailed(p.id)}
                />
              )}
            </button>
            {p.caption ? <span className="pub-photos__cap">{p.caption}</span> : null}
          </li>
        ))}
      </ul>
      <dialog
        ref={dialog}
        className="pub-photos__dialog"
        aria-label={l.photos}
        onClose={() => setOpen(null)}
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
      >
        {open ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
            <img
              src={src(open)}
              alt={alt(open, photos.indexOf(open))}
              onError={() => dialog.current?.close()}
            />
            <button
              type="button"
              className="btn btn--secondary btn--block"
              onClick={() => dialog.current?.close()}
            >
              {l.photoClose}
            </button>
          </>
        ) : null}
      </dialog>
    </section>
  );
}
