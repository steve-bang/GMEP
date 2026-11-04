import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { createSupplementaryQuote } from '@/modules/rec';

export const runtime = 'nodejs';

/** FR-REC-014: open a supplementary quote on the order. */
export const POST = authed(async ({ req, rec, session, params, requestId, idempotencyKey }) => {
  const r = await createSupplementaryQuote(
    rec,
    session.actor,
    params.id ?? '',
    await readJson(req),
    {
      idempotencyKey: idempotencyKey(),
      requestId,
    },
  );
  return created(r.response.body, r.replayed, r.response.status);
});
