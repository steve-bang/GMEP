import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { requestReversal } from '@/modules/acc';

export const runtime = 'nodejs';

/** RULE-010: ask for a reversal entry (needs a manager's approval). */
export const POST = authed(async ({ req, acc, session, params, requestId, idempotencyKey }) => {
  const r = await requestReversal(acc, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
