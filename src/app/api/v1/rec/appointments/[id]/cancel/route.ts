import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { cancelAppointment } from '@/modules/rec';

export const runtime = 'nodejs';

/** FR-REC-027: cancel a pending appointment with a reason. Idempotency-Key required. */
export const POST = authed(async ({ req, rec, session, params, requestId, idempotencyKey }) => {
  const r = await cancelAppointment(rec, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
