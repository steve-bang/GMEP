import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { itemAction } from '@/modules/rec';

export const runtime = 'nodejs';

/** FR-REC-013: one tap, one time event written with the server clock. */
export const POST = authed(async ({ req, rec, session, params, requestId, idempotencyKey }) => {
  const r = await itemAction(rec, session.actor, params.id ?? '', 'finish', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
