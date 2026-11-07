import { json, readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { createEmployee, listEmployees } from '@/modules/hrm';

export const runtime = 'nodejs';

/** FR-HRM-001, G3-HRM-01: the staff of the scope; personal data already cut by role (Phụ lục D). */
export const GET = authed(async ({ hrm, session }) =>
  json(await listEmployees(hrm, session.actor)),
);

/** FR-HRM-001: a new staff record in the working branch. */
export const POST = authed(async ({ req, hrm, session, requestId, idempotencyKey }) => {
  const r = await createEmployee(hrm, session.actor, await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
