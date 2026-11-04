import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { resumeOrder } from '@/modules/rec';

export const runtime = 'nodejs';

/** FR-REC-015: resume a paused order. */
export const POST = authed(async ({ req, rec, session, params, requestId, idempotencyKey }) => {
  const r = await resumeOrder(rec, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
