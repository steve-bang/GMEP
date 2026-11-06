import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { arriveAppointment } from '@/modules/rec';

export const runtime = 'nodejs';

/** FR-REC-027 "Đã đến": opens the pre-filled intake once (a repeat returns the same intake). Idempotency-Key required. */
export const POST = authed(async ({ req, rec, session, params, requestId, idempotencyKey }) => {
  const r = await arriveAppointment(rec, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
    sessionId: session.sessionId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
