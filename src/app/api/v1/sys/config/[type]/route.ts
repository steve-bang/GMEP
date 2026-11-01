import { json, readJson } from '@/platform/http/route';
import { created, authed } from '@/composition/api';
import * as mod from '@/modules/sys';

export const runtime = 'nodejs';

/** Effective-dated config versions of one type (FR-SYS-004). */
export const GET = authed(async ({ sys: d, session, params, query }) =>
  json(await mod.listConfigVersions(d, session.actor, params.type ?? '', query())),
);

/** Proposes a PENDING version with a future effective date. */
export const POST = authed(async ({ req, sys: d, session, params, requestId, idempotencyKey }) => {
  const r = await mod.proposeConfig(d, session.actor, params.type ?? '', await readJson(req), {
    requestId,
    idempotencyKey: idempotencyKey(),
  });
  return created(r.response.body, r.replayed, r.response.status);
});
