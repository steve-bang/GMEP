import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { runQc } from '@/modules/rec';

export const runtime = 'nodejs';

/** FR-REC-016: record the quality check; a failure returns items to their technician. */
export const POST = authed(async ({ req, rec, session, params, requestId, idempotencyKey }) => {
  const r = await runQc(rec, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
