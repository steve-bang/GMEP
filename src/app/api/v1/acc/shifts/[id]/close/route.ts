import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { closeShift } from '@/modules/acc';

export const runtime = 'nodejs';

/** FR-ACC-004: count the drawer and close the shift. */
export const POST = authed(async ({ req, acc, session, params, requestId, idempotencyKey }) => {
  const r = await closeShift(acc, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
