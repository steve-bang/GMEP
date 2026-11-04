import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { issueInvoice } from '@/modules/ein';

export const runtime = 'nodejs';

/** FR-EIN-001/013: issue an invoice from the order. A second call returns the same invoice (200, duplicate), never a second one. */
export const POST = authed(async ({ req, ein, session, params, requestId, idempotencyKey }) => {
  const r = await issueInvoice(ein, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.body, r.replayed, r.status);
});
