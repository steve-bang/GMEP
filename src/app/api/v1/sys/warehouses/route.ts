import { json, readJson } from '@/platform/http/route';
import { authed, created } from '@/composition/api';
import { createWarehouse, listWarehouses, toWarehouseDto } from '@/modules/sys';

export const runtime = 'nodejs';

/** FR-SYS-005 list. Cursor pagination, whitelisted sort/filter, scope enforced in the repository (NFR-ISO-01). */
export const GET = authed(async ({ sys, session, query }) => {
  const params = query();
  if (params.q) await sys.limiter.hit('search', session.user.id); // search rate limit
  const page = await listWarehouses(sys, session.actor, params);
  return json({ items: page.items.map(toWarehouseDto), nextCursor: page.nextCursor });
});

/** FR-SYS-005 create. Requires Idempotency-Key; audit entry is written in the same transaction (FR-SYS-003). */
export const POST = authed(async ({ req, sys, session, requestId, idempotencyKey }) => {
  const r = await createWarehouse(sys, session.actor, await readJson(req), {
    idempotencyKey: idempotencyKey(),
    requestId,
  });
  return created(r.response.body, r.replayed, r.response.status);
});
