import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { reopenDay } from '@/modules/acc';

export const runtime = 'nodejs';

/** FR-ACC-005: reopen today's day once the owner approved (the approval is consumed once). */
export const POST = authed(async ({ req, acc, session, requestId, idempotencyKey }) => {
  const r = await reopenDay(acc, session.actor, await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
