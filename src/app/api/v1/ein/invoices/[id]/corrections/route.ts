import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { requestCorrection } from '@/modules/ein';

export const runtime = 'nodejs';

/** FR-EIN-007: propose an adjustment, replacement or cancel; it waits for the chief accountant's approval (202). */
export const POST = authed(async ({ req, ein, session, params, requestId, idempotencyKey }) => {
  const r = await requestCorrection(ein, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
