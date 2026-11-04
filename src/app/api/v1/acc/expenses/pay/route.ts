import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { payApprovedExpense } from '@/modules/acc';

export const runtime = 'nodejs';

/** RULE-011: pay an approved expense proposal (once). */
export const POST = authed(async ({ req, acc, session, requestId, idempotencyKey }) => {
  const r = await payApprovedExpense(acc, session.actor, await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
