import { json, readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { createQuote, listQuotes } from '@/modules/rec';

export const runtime = 'nodejs';

export const GET = authed(async ({ rec, session, query }) =>
  json(await listQuotes(rec, session.actor, query())),
);

/** FR-REC-004: starts a quote (v1, draft) from a completed intake. Idempotency-Key required. */
export const POST = authed(async ({ req, rec, session, requestId, idempotencyKey }) => {
  const r = await createQuote(rec, session.actor, await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
