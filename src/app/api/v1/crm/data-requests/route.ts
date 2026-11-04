import { json, readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { createDataRequest, listDataRequests } from '@/modules/crm';

export const runtime = 'nodejs';

export const GET = authed(async ({ crm, session, query }) =>
  json(await listDataRequests(crm, session.actor, query())),
);

export const POST = authed(async ({ req, crm, session, requestId, idempotencyKey }) => {
  const r = await createDataRequest(crm, session.actor, await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
