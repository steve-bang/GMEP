import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { openWarranty } from '@/modules/rec';

export const runtime = 'nodejs';

/** FR-REC-018, 036: open warranty work as an intake linked to the origin order. Idempotency-Key required. */
export const POST = authed(async ({ req, rec, session, requestId, idempotencyKey }) => {
  const r = await openWarranty(rec, session.actor, await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
    sessionId: session.sessionId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
