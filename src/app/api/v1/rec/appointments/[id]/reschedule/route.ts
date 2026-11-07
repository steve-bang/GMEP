import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { rescheduleAppointment } from '@/modules/rec';

export const runtime = 'nodejs';

/** FR-REC-046: move a pending appointment (reason, requester, history). Idempotency-Key required. */
export const POST = authed(async ({ req, rec, session, params, requestId, idempotencyKey }) => {
  const r = await rescheduleAppointment(rec, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
