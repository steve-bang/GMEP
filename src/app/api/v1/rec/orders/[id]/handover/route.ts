import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { handoverVehicle } from '@/modules/rec';

export const runtime = 'nodejs';

/** FR-REC-017: hand the vehicle over and complete the order. */
export const POST = authed(async ({ req, rec, session, params, requestId, idempotencyKey }) => {
  const r = await handoverVehicle(rec, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
