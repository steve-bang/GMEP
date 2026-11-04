import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { setStockLevels } from '@/modules/inv';

export const runtime = 'nodejs';

/** Reorder level and target of a part in a warehouse. Not a stock movement. */
export const PUT = authed(async ({ req, inv, session, requestId, idempotencyKey }) => {
  const r = await setStockLevels(inv, session.actor, await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
