import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { undoImport } from '@/modules/sys';

export const runtime = 'nodejs';

/** FR-SYS-007: takes back exactly what the batch created (stock by reversal documents, RULE-010). */
export const POST = authed(async ({ req, sys, session, params, requestId, idempotencyKey }) => {
  idempotencyKey();
  return json(
    await undoImport(sys, session.actor, params.id ?? '', await readJson(req), { requestId }),
  );
});
