import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { createExpense } from '@/modules/acc';

export const runtime = 'nodejs';

/** FR-ACC-003 / RULE-011: pay a voucher within the limit, or send it for approval. */
export const POST = authed(async ({ req, acc, session, requestId, idempotencyKey }) => {
  const r = await createExpense(acc, session.actor, await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
