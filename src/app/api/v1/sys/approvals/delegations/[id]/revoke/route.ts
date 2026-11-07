import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { revokeDelegation } from '@/modules/sys';

export const runtime = 'nodejs';

/** FR-SYS-033: take a delegation back; the right ends at once. */
export const POST = authed(async ({ req, sys, session, params, requestId, idempotencyKey }) => {
  const r = await revokeDelegation(sys, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
