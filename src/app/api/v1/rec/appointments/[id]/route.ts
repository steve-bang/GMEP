import { json, readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { getAppointment, updateAppointment } from '@/modules/rec';

export const runtime = 'nodejs';

export const GET = authed(async ({ rec, session, params }) =>
  json(await getAppointment(rec, session.actor, params.id ?? '')),
);

/** FR-REC-027: move, change the advisor, the service or the note (optimistic `version`). Idempotency-Key required. */
export const PATCH = authed(async ({ req, rec, session, params, requestId, idempotencyKey }) => {
  const r = await updateAppointment(rec, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
