import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { decideApproval } from '@/modules/sys';

export const runtime = 'nodejs';

/** FR-SYS-004: approve or reject (not one's own request). */
export const POST = authed(async ({ req, sys, session, params, requestId, idempotencyKey }) => {
  const r = await decideApproval(sys, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
