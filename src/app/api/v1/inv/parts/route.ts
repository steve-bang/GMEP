import { json, readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { createPart, listParts } from '@/modules/inv';

export const runtime = 'nodejs';

/** FR-INV-001: catalogue list and search (code, name, barcode, vehicle line). */
export const GET = authed(async ({ inv, sys, session, query }) => {
  const params = query();
  if (params.q) await sys.limiter.hit('search', session.user.id);
  return json(await listParts(inv, session.actor, params));
});

/** FR-INV-001/002: create; the code is unique across the chain (409 `part_code_exists`). */
export const POST = authed(async ({ req, inv, session, requestId, idempotencyKey }) => {
  const r = await createPart(inv, session.actor, await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
