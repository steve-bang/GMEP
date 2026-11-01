import { json, readJson } from '@/platform/http/route';
import { created, authed } from '@/composition/api';
import * as mod from '@/modules/sys';

export const runtime = 'nodejs';

export const GET = authed(async ({ sys: d, session, query }) => {
  await d.limiter.hit('search', session.user.id);
  return json(await mod.listPriceLists(d, session.actor, query()));
});

export const POST = authed(async ({ req, sys: d, session, requestId, idempotencyKey }) => {
  const r = await mod.createPriceList(d, session.actor, await readJson(req), {
    requestId,
    idempotencyKey: idempotencyKey(),
  });
  return created(r.response.body, r.replayed, r.response.status);
});
