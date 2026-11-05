import { notFound } from '@/platform/errors/errors';
import type { RecDeps } from '../ports/deps';
import { resolveLink } from './approval';
import { photoStoragePath } from './photos';
import { loadPublicPhotoSources } from './publicPhotos';

/**
 * FR-REC-034: one photo for the customer, authenticated only by the quote link token. Same resolution, throttle and
 * 404 as the page (unknown, malformed, replaced and revoked links are identical; an expired, superseded or refused
 * quote shows no content, so no photo either). Only a photo the page lists is served; anything else is a bare 404.
 * Each read is written to the audit log with the link as the actor (no personal data).
 */
export async function readPublicQuotePhoto(
  deps: RecDeps,
  token: string,
  photoId: string,
  ctx: { address: string; requestId: string },
) {
  const r = await resolveLink(deps, token, ctx.address);
  if (r.state !== 'open' && r.state !== 'approved') throw notFound();
  const sources = await loadPublicPhotoSources(deps, r.scope, r.q);
  const src = sources.find((s) => s.ref.id === photoId);
  if (!src) throw notFound();
  const file = await deps.files.get(
    photoStoragePath(src.parent, src.companyId, src.branchId, src.parentId, src.ref),
  );
  if (!file) throw notFound();
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
      after: { photoId, kind: src.kind },
      requestId: ctx.requestId,
    });
  });
  return file;
}
