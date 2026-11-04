import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { pauseOrder } from '@/modules/rec';

export const runtime = 'nodejs';

/** FR-REC-015: pause the order with a reason. */
export const POST = authed(async ({ req, rec, session, params, requestId, idempotencyKey }) => {
  const r = await pauseOrder(rec, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
