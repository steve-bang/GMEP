import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { cancelOrder } from '@/modules/rec';

export const runtime = 'nodejs';

/** FR-REC-021: cancel with a reason (parts issued: manager, after returns). */
export const POST = authed(async ({ req, rec, session, params, requestId, idempotencyKey }) => {
  const r = await cancelOrder(rec, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
