import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { releaseStock } from '@/modules/inv';

export const runtime = 'nodejs';

/** FR-INV-020: release holds when a quote is rejected or an order is cancelled. */
export const POST = authed(async ({ req, inv, session, requestId, idempotencyKey }) => {
  const r = await releaseStock(inv, session.actor, await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
