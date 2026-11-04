import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { createPartRequest } from '@/modules/rec';

export const runtime = 'nodejs';

/** Part request on an approved part line. */
export const POST = authed(async ({ req, rec, session, params, requestId, idempotencyKey }) => {
  const r = await createPartRequest(rec, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
