import { parseIdempotencyKey } from '@/platform/idempotency/idempotency';
import { apiRoute, json, readJson } from '@/platform/http/route';
import { createWarehouse, listWarehouses, toWarehouseDto } from '@/modules/sys';
import { allowedOrigins, authenticate } from '@/composition/auth';
import { getContainer } from '@/composition/container';

export const runtime = 'nodejs';

/** FR-SYS-005 list. Cursor pagination, whitelisted sort/filter, scope enforced in the repository (NFR-ISO-01). */
export const GET = apiRoute(
  async ({ req }) => {
    const { actor } = await authenticate(req);
    const params = Object.fromEntries(new URL(req.url).searchParams);
    const page = await listWarehouses(getContainer().sys, actor, params);
    return json({ items: page.items.map(toWarehouseDto), nextCursor: page.nextCursor });
  },
  { allowedOrigins },
);

/** FR-SYS-005 create. Requires Idempotency-Key; audit entry is written in the same transaction (FR-SYS-003). */
export const POST = apiRoute(
  async ({ req, requestId }) => {
    const { actor } = await authenticate(req);
    const key = parseIdempotencyKey(req.headers.get('idempotency-key'), true)!;
    const result = await createWarehouse(getContainer().sys, actor, await readJson(req), {
      idempotencyKey: key,
      requestId,
    });
    return json(result.response.body, {
      status: result.response.status,
      headers: result.replayed ? { 'idempotent-replayed': 'true' } : {},
    });
  },
  { allowedOrigins },
);
