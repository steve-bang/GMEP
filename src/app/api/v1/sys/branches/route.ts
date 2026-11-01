import { json, readJson } from '@/platform/http/route';
import { created, authed } from '@/composition/api';
import * as mod from '@/modules/sys';

export const runtime = 'nodejs';

export const GET = authed(async ({ sys: d, session }) =>
  json({ items: await mod.listBranches(d, session.actor) }),
);

export const POST = authed(async ({ req, sys: d, session, requestId, idempotencyKey }) => {
  const r = await mod.createBranch(d, session.actor, await readJson(req), {
    requestId,
    idempotencyKey: idempotencyKey(),
  });
  return created(r.response.body, r.replayed, r.response.status);
});
