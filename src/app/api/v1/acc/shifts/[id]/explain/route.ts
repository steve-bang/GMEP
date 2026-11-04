import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { resubmitVariance } from '@/modules/acc';

export const runtime = 'nodejs';

/** FR-ACC-004: explain a rejected count difference again. */
export const POST = authed(async ({ req, acc, session, params, requestId, idempotencyKey }) => {
  const r = await resubmitVariance(acc, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
