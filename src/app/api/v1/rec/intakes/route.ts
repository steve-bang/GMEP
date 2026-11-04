import { json, readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { createIntake, listIntakes } from '@/modules/rec';

export const runtime = 'nodejs';

export const GET = authed(async ({ rec, session, query }) =>
  json(await listIntakes(rec, session.actor, query())),
);

/** FR-REC-001: opens an intake draft for a vehicle (step 1 of the wizard). Idempotency-Key required. */
export const POST = authed(async ({ req, rec, session, requestId, idempotencyKey }) => {
  const r = await createIntake(rec, session.actor, await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
    sessionId: session.sessionId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
