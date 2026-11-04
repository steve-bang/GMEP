import { readJson, json } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { closeDay, getDayStatus } from '@/modules/acc';

export const runtime = 'nodejs';

/** FR-ACC-004: state of the day close (open orders, blockers, warnings). */
export const GET = authed(async ({ acc, session, query }) =>
  json(await getDayStatus(acc, session.actor, query().date)),
);

/** FR-ACC-004: lock the business date. */
export const POST = authed(async ({ req, acc, session, requestId, idempotencyKey }) => {
  const r = await closeDay(acc, session.actor, await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
