import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { withdrawApproval } from '@/modules/sys';

export const runtime = 'nodejs';

/** The requester takes a pending request back. */
export const POST = authed(async ({ req, sys, session, params, requestId, idempotencyKey }) => {
  const r = await withdrawApproval(sys, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
