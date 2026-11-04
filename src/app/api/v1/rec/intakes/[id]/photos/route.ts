import { AppError } from '@/platform/errors/errors';
import { authed, created } from '@/composition/api';
import { addPhoto } from '@/modules/rec';

export const runtime = 'nodejs';

/**
 * FR-REC-003/014: add a photo (intake). Multipart `file` (JPEG, PNG or WebP) [+ `caption`, `proposalId`]; bytes go to the
 * server-side FileStore, never to the browser's storage. Idempotency-Key required.
 */
export const POST = authed(
  async ({ req, rec, session, params, requestId, idempotencyKey }) => {
    const declared = Number(req.headers.get('content-length') ?? 0);
    if (declared > rec.rec.photoMaxBytes + 64 * 1024) throw new AppError('photo_invalid', 422);
    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    if (!form || !(file instanceof File)) throw new AppError('photo_invalid', 422);
    const r = await addPhoto(
      rec,
      session.actor,
      'intake',
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
