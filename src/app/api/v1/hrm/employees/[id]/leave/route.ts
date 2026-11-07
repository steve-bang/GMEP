import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { leaveEmployee } from '@/modules/hrm';

export const runtime = 'nodejs';

/** G3-HRM-02: record the leaving date; labor and history stay (the account is only suggested for locking). */
export const POST = authed(async ({ req, hrm, session, params, requestId, idempotencyKey }) => {
  const r = await leaveEmployee(hrm, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
