import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { undoItemAction } from '@/modules/rec';

export const runtime = 'nodejs';

/** FR-REC-013: undo the latest press of the caller within the window. */
export const POST = authed(async ({ req, rec, session, params, requestId, idempotencyKey }) => {
  const r = await undoItemAction(rec, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
