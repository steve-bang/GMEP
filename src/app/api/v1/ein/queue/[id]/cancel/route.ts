import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { cancelRequest } from '@/modules/ein';

export const runtime = 'nodejs';

/** G4-EIN-06: cancel a request after one last question to the provider; refused when the provider already holds the invoice. */
export const POST = authed(async ({ req, ein, session, params, requestId, idempotencyKey }) => {
  const r = await cancelRequest(ein, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
