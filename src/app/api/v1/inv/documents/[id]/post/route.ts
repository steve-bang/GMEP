import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { postDocument } from '@/modules/inv';

export const runtime = 'nodejs';

/** Posts a draft: number, balances and ledger in one transaction. Idempotency-Key required. */
export const POST = authed(async ({ req, inv, session, params, requestId, idempotencyKey }) => {
  const r = await postDocument(inv, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
