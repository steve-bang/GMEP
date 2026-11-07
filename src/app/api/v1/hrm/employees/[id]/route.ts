import { json, readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { getEmployee, updateEmployee } from '@/modules/hrm';

export const runtime = 'nodejs';

/** G3-HRM-02: opening a record that shows personal data is written to the access log. */
export const GET = authed(async ({ hrm, session, params, requestId }) =>
  json(await getEmployee(hrm, session.actor, params.id ?? '', { requestId }), {
    headers: { 'cache-control': 'no-store' },
  }),
);

export const PATCH = authed(async ({ req, hrm, session, params, requestId, idempotencyKey }) => {
  const r = await updateEmployee(hrm, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
