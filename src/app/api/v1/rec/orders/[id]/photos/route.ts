import { AppError } from '@/platform/errors/errors';
import { readFormLimited } from '@/platform/http/body';
import { authed, created } from '@/composition/api';
import { json } from '@/platform/http/route';
import { addPhoto, listPhotos } from '@/modules/rec';

export const runtime = 'nodejs';

/** FR-REC-014: photos of the order; `?proposalId=<id>` only those of one proposal, `none` those of no proposal. */
export const GET = authed(async ({ rec, session, params, query }) =>
  json({
    items: await listPhotos(rec, session.actor, 'order', params.id ?? '', {
      ...(query().proposalId ? { proposalId: query().proposalId! } : {}),
    }),
  }),
);

/**
 * FR-REC-003/014: add a photo (order). Multipart `file` (JPEG, PNG or WebP) [+ `caption`, `proposalId`]; bytes go to the
 * server-side FileStore, never to the browser's storage. Idempotency-Key required.
 */
export const POST = authed(
  async ({ req, rec, session, params, requestId, idempotencyKey }) => {
    const form = await readFormLimited(req, rec.rec.photoMaxBytes + 64 * 1024);
    const file = form?.get('file');
    if (!form || !(file instanceof File)) throw new AppError('photo_invalid', 422);
    const r = await addPhoto(
      rec,
      session.actor,
      'order',
      params.id ?? '',
      {
        bytes: Buffer.from(await file.arrayBuffer()),
        caption: form.get('caption'),
        proposalId: form.get('proposalId'),
      },
      { idempotencyKey: idempotencyKey(), requestId },
    );
    return created(r.response.body, r.replayed, r.response.status);
  },
  { multipart: true },
);
