import { readJson } from '@/platform/http/route';
import { created, authed } from '@/composition/api';
import * as mod from '@/modules/sys';

export const runtime = 'nodejs';

/** FR-SYS-011 branch state change (owner action). */
export const POST = authed(async ({ req, sys: d, session, params, requestId, idempotencyKey }) => {
  const r = await mod.setBranchStatus(d, session.actor, params.id ?? '', await readJson(req), {
    requestId,
    idempotencyKey: idempotencyKey(),
  });
  return created(r.response.body, r.replayed, r.response.status);
});
