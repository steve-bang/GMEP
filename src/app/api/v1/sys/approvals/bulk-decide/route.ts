import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { bulkDecideApprovals } from '@/modules/sys';

export const runtime = 'nodejs';

/** FR-SYS-034: decide several requests of the same kind (only kinds configured for it). */
export const POST = authed(async ({ req, sys, session, requestId, idempotencyKey }) => {
  const r = await bulkDecideApprovals(sys, session.actor, await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r, false, 200);
});
