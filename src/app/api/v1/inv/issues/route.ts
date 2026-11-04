import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { issueForOrder } from '@/modules/inv';

export const runtime = 'nodejs';

/** FR-INV-006/007: issue parts for a repair order (source document = the order, receiver recorded). */
export const POST = authed(async ({ req, inv, session, requestId, idempotencyKey }) => {
  const r = await issueForOrder(inv, session.actor, await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
