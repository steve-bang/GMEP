import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { relateToWorkingBranch } from '@/modules/crm';

export const runtime = 'nodejs';

/** Relation with the working branch after an exact lookup found the customer elsewhere (BA §10.1.5). */
export const POST = authed(async ({ req, crm, session, params, requestId, idempotencyKey }) => {
  const r = await relateToWorkingBranch(
    crm,
    session.actor,
    params.id ?? '',
    await readJson(req).catch(() => ({})),
    { idempotencyKey: idempotencyKey(), requestId },
  );
  return json(r.response.body, { status: r.response.status });
});
