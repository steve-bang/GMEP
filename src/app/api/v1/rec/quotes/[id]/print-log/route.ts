import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { recordQuotePrint } from '@/modules/rec';

export const runtime = 'nodejs';

/** "Ghi nhận đã in" (FR-REC-008): audit `quote.printed` with the count, `sentVia = print` when unset. Idempotent. */
export const POST = authed(async ({ req, rec, session, params, requestId, idempotencyKey }) => {
  const r = await recordQuotePrint(rec, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
