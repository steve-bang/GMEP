import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { hidePhoto } from '@/modules/rec';

export const runtime = 'nodejs';

/** R104: hide (never delete) a wrongly uploaded intake photo; reason required, audited. Branch manager and owner only. */
export const POST = authed(async ({ req, rec, session, params, requestId, idempotencyKey }) => {
  const r = await hidePhoto(
    rec,
    session.actor,
    'intake',
    params.id ?? '',
    params.pid ?? '',
    await readJson(req),
    { idempotencyKey: idempotencyKey(), requestId },
  );
  return created(r.response.body, r.replayed, r.response.status);
});
