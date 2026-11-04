import { json, readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { createDocument, listDocuments } from '@/modules/inv';

export const runtime = 'nodejs';

export const GET = authed(async ({ inv, session, query }) =>
  json(await listDocuments(inv, session.actor, query())),
);

/** FR-INV-021: creates a DRAFT stock document (GRN, GIN, RTN, ADJ); stock changes only when it is posted. */
export const POST = authed(async ({ req, inv, session, requestId, idempotencyKey }) => {
  const r = await createDocument(inv, session.actor, await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
