import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { requestDayReopen } from '@/modules/acc';

export const runtime = 'nodejs';

/** FR-ACC-005: ask the owner to reopen today's closed day (202 + approval request). */
export const POST = authed(async ({ req, acc, session, requestId, idempotencyKey }) => {
  const r = await requestDayReopen(acc, session.actor, await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
