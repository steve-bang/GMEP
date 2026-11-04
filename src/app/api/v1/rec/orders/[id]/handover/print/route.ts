import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { logHandoverPrint } from '@/modules/rec';

export const runtime = 'nodejs';

/** Logs a print of the handover record (a reprint needs a reason). */
export const POST = authed(async ({ req, rec, session, params, requestId, idempotencyKey }) => {
  const r = await logHandoverPrint(rec, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
