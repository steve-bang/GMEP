import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { requestRefund } from '@/modules/acc';

export const runtime = 'nodejs';

/** FR-ACC-016: ask to refund money received for an order; opens an approval request (202), nothing moves yet. */
export const POST = authed(async ({ req, acc, session, requestId, idempotencyKey }) => {
  const r = await requestRefund(acc, session.actor, await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
