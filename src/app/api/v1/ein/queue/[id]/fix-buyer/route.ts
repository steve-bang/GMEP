import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { fixBuyer } from '@/modules/ein';

export const runtime = 'nodejs';

/** G4-EIN-06: correct the buyer of a data-error request; the rules are checked again, then it is sent. */
export const POST = authed(async ({ req, ein, session, params, requestId, idempotencyKey }) => {
  const r = await fixBuyer(ein, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
