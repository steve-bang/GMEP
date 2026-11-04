import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { reverseDocument } from '@/modules/inv';

export const runtime = 'nodejs';

/** RULE-010: reversal document for a posted one; needs a reason and `stock-doc:approve`. */
export const POST = authed(async ({ req, inv, session, params, requestId, idempotencyKey }) => {
  const r = await reverseDocument(inv, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
