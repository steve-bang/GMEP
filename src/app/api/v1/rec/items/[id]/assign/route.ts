import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { assignTechnician } from '@/modules/rec';

export const runtime = 'nodejs';

/** FR-REC-012: assign or change the technician of an item. */
export const POST = authed(async ({ req, rec, session, params, requestId, idempotencyKey }) => {
  const r = await assignTechnician(rec, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
