import { readJson } from '@/platform/http/route';
import { created, authed } from '@/composition/api';
import * as mod from '@/modules/sys';

export const runtime = 'nodejs';

/** Deactivate / reactivate (BA §3). Idempotency-Key required. */
export const POST = authed(async ({ req, sys: d, session, params, requestId, idempotencyKey }) => {
  const r = await mod.setWarehouseStatus(d, session.actor, params.id ?? '', await readJson(req), {
    requestId,
    idempotencyKey: idempotencyKey(),
  });
  return created(r.response.body, r.replayed, r.response.status);
});
