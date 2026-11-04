import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { openShift } from '@/modules/acc';

export const runtime = 'nodejs';

/** FR-ACC-004: open the cash shift of the counter. */
export const POST = authed(async ({ req, acc, session, requestId, idempotencyKey }) => {
  const r = await openShift(acc, session.actor, await readJson(req).catch(() => ({})), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
