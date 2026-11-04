import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { holdForApprovalStandalone } from '@/modules/inv';

export const runtime = 'nodejs';

/**
 * I1 / BA-07 rows 2, 3, 6: the approval path (customer approval of order lines). Always holds with
 * allowPartial and stores the shortfall as unmet; the approval is never refused for lack of stock.
 */
export const POST = authed(async ({ req, inv, session, requestId, idempotencyKey }) => {
  const r = await holdForApprovalStandalone(inv, session.actor, await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
