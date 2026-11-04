import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { submitForQc } from '@/modules/rec';

export const runtime = 'nodejs';

/** FR-REC-016: all items done, so the order awaits the quality check. */
export const POST = authed(async ({ req, rec, session, params, requestId, idempotencyKey }) => {
  const r = await submitForQc(rec, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
