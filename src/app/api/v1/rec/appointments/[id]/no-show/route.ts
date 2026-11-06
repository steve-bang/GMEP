import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { markNoShow } from '@/modules/rec';

export const runtime = 'nodejs';

/** FR-REC-027: the customer did not come ("vắng"), from the appointment day on. Idempotency-Key required. */
export const POST = authed(async ({ req, rec, session, params, requestId, idempotencyKey }) => {
  const r = await markNoShow(rec, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
