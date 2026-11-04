import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { executeReversal } from '@/modules/acc';

export const runtime = 'nodejs';

/** RULE-010: post the reversal entry once the request is approved. */
export const POST = authed(async ({ req, acc, session, params, requestId, idempotencyKey }) => {
  const r = await executeReversal(acc, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
