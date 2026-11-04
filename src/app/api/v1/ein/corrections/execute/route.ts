import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { executeCorrection } from '@/modules/ein';

export const runtime = 'nodejs';

/** FR-EIN-007: run an APPROVED correction once (a cancel asks for the password again). */
export const POST = authed(async ({ req, ein, session, requestId, idempotencyKey }) => {
  const r = await executeCorrection(ein, session.actor, await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
