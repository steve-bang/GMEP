import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { requestDebt } from '@/modules/acc';

export const runtime = 'nodejs';

/** FR-ACC-006 / R44: ask a manager to approve a debt so the vehicle can leave. */
export const POST = authed(async ({ req, acc, session, params, requestId, idempotencyKey }) => {
  const r = await requestDebt(acc, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
