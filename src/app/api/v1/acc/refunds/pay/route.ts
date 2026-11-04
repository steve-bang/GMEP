import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { payApprovedRefund } from '@/modules/acc';

export const runtime = 'nodejs';

/** FR-ACC-016, RULE-011: pay an approved customer refund (once). */
export const POST = authed(async ({ req, acc, session, requestId, idempotencyKey }) => {
  const r = await payApprovedRefund(acc, session.actor, await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
