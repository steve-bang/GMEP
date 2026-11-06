import { json, readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { createAppointment, listAppointments } from '@/modules/rec';

export const runtime = 'nodejs';

/** FR-REC-019, 027: the calendar of one branch (`from`, `days` up to a week, optional `branchId` inside the scope). */
export const GET = authed(async ({ rec, session, query }) =>
  json(await listAppointments(rec, session.actor, query())),
);

/** FR-REC-019, 027: book an appointment at the working branch. Idempotency-Key required. */
export const POST = authed(async ({ req, rec, session, requestId, idempotencyKey }) => {
  const r = await createAppointment(rec, session.actor, await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
    sessionId: session.sessionId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
