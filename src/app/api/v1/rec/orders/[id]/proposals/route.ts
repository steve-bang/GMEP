import { readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { createProposal } from '@/modules/rec';

export const runtime = 'nodejs';

/** FR-REC-014: technician proposes work outside the quote. */
export const POST = authed(async ({ req, rec, session, params, requestId, idempotencyKey }) => {
  const r = await createProposal(rec, session.actor, params.id ?? '', await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
