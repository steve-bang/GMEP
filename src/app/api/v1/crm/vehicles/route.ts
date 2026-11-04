import { json, readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { createVehicle, listVehicles } from '@/modules/crm';

export const runtime = 'nodejs';

export const GET = authed(async ({ crm, sys, session, query }) => {
  const params = query();
  if (params.q) await sys.limiter.hit('search', session.user.id);
  return json(await listVehicles(crm, session.actor, params));
});

/** FR-CRM-002 + FR-CRM-014: create with the first ownership; plate unique in the company (409 `plate_exists`). */
export const POST = authed(async ({ req, crm, session, requestId, idempotencyKey }) => {
  const r = await createVehicle(crm, session.actor, await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
