import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { collectPayment } from '@/modules/acc';

export const runtime = 'nodejs';

/** FR-ACC-001/002: collect a receipt (several methods, deposits applied) or take a deposit. */
export const POST = authed(async ({ req, acc, session, params, requestId, idempotencyKey }) => {
  const r = await collectPayment(acc, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
