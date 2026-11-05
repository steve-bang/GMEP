import { notFound } from '@/platform/errors/errors';
import type { RecDeps } from '../ports/deps';
import { resolvePhotoLink } from './approval';
import { photoStoragePath } from './photos';
import { loadPublicPhotoSources } from './publicPhotos';

const PHOTO_AUDIT_WINDOW_MINUTES = 10;

/**
 * FR-REC-034: one photo for the customer, authenticated only by the quote link token. Same resolution, throttle and
 * 404 as the page (unknown, malformed, replaced and revoked links are identical; an expired, superseded or refused
 * quote shows no content, so no photo either). Only a photo the page lists is served; anything else is a bare 404.
 * Throttled on the separate photo buckets (a page of 30 photos must not exhaust the page allowance). Reads are
 * audited once per link per 10 minutes (actor = the link, no personal data), not once per image.
 */
export async function readPublicQuotePhoto(
  deps: RecDeps,
  token: string,
  photoId: string,
  ctx: { address: string; requestId: string },
) {
  const r = await resolvePhotoLink(deps, token, ctx.address);
  if (r.state !== 'open' && r.state !== 'approved') throw notFound();
  const sources = await loadPublicPhotoSources(deps, r.scope, r.q);
  const src = sources.find((s) => s.ref.id === photoId);
  if (!src) throw notFound();
  const file = await deps.files.get(
    photoStoragePath(src.parent, src.companyId, src.branchId, src.parentId, src.ref),
  );
  if (!file) throw notFound();
  const first = await deps.sys.limiter.tryOnce(
    'quote-photo-view',
    r.link.id,
    PHOTO_AUDIT_WINDOW_MINUTES * 60_000,
  );
  if (!first) return file;
  await deps.sys.uow.run(async (tx) => {
    deps.sys.audit.record(tx, {
      id: deps.sys.newId(),
      at: deps.sys.clock.now(),
      companyId: r.q.companyId,
      branchId: r.q.branchId,
      actorId: `customer-link:${r.link.id.slice(0, 16)}`,
      actorRoles: ['customer-link'],
      actorType: 'customer-link',
      entityType: 'quote',
      entityId: r.q.id,
      action: 'quote.photo-view',
      before: null,
      after: { photoId, kind: src.kind, windowMinutes: PHOTO_AUDIT_WINDOW_MINUTES },
      requestId: ctx.requestId,
    });
  });
  return file;
}
