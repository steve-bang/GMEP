import { readJson } from '@/platform/http/route';
import { created, authed } from '@/composition/api';
import * as mod from '@/modules/sys';

export const runtime = 'nodejs';

/** Approve or reject a pending version (separation of duties enforced in the use case). */
export const POST = authed(async ({ req, sys: d, session, params, requestId, idempotencyKey }) => {
  const r = await mod.decideConfig(
    d,
    session.actor,
    params.type ?? '',
    params.id ?? '',
    await readJson(req),
    { requestId, idempotencyKey: idempotencyKey() },
  );
  return created(r.response.body, r.replayed, r.response.status);
});
