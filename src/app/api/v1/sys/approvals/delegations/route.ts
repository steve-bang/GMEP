import { json, readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { createDelegation, listDelegations } from '@/modules/sys';

export const runtime = 'nodejs';

/** FR-SYS-033: delegations (owner sees all; a delegate or delegator sees their own). */
export const GET = authed(async ({ sys, session }) =>
  json({ items: await listDelegations(sys, session.actor) }),
);

/** FR-SYS-033: lend an approval right for a period, kinds and branches (owner only). */
export const POST = authed(async ({ req, sys, session, requestId, idempotencyKey }) => {
  const r = await createDelegation(sys, session.actor, await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
