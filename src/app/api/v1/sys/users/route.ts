import { json, readJson } from '@/platform/http/route';
import { created, authed } from '@/composition/api';
import * as mod from '@/modules/sys';

export const runtime = 'nodejs';

export const GET = authed(async ({ sys: d, session, query }) =>
  json(await mod.listUsers(d, session.actor, query())),
);

/** Creates the user as `invited` and sends the invitation (72 h single-use link). */
export const POST = authed(async ({ req, sys: d, session, requestId, idempotencyKey }) => {
  const r = await mod.inviteUser(d, session.actor, await readJson(req), {
    requestId,
    idempotencyKey: idempotencyKey(),
  });
  return created(r.response.body, r.replayed, r.response.status);
});
