import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { adjustLabor } from '@/modules/hrm';

export const runtime = 'nodejs';

/** FR-HRM-020: manual adjustment line; above the configured threshold it opens an owner approval (202). */
export const POST = authed(async ({ req, hrm, session, requestId, idempotencyKey }) => {
  const r = await adjustLabor(hrm, session.actor, await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
