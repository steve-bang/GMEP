import { json, readJson } from '@/platform/http/route';
import { created, authed } from '@/composition/api';
import * as mod from '@/modules/sys';

export const runtime = 'nodejs';

export const GET = authed(async ({ sys: d, session, query }) =>
  json(await mod.listUsers(d, session.actor, query())),
);

/**
 * Creates the user as `invited` and sends the invitation (72 h single-use link); with `loginKind: 'employee_code'`
 * (P2-C) creates a staff member without email, active with the manager's temporary password.
 */
export const POST = authed(async ({ req, sys: d, session, requestId, idempotencyKey }) => {
  const body = await readJson(req);
  const create =
    (body as { loginKind?: unknown } | null)?.loginKind === 'employee_code'
      ? mod.createWorkerUser
      : mod.inviteUser;
  const r = await create(d, session.actor, body, {
    requestId,
    idempotencyKey: idempotencyKey(),
  });
  return created(r.response.body, r.replayed, r.response.status);
});
