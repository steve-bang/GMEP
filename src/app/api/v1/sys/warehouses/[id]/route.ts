import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getWarehouse, toWarehouseDto, updateWarehouse } from '@/modules/sys';

export const runtime = 'nodejs';

/** Out-of-scope id -> 404, identical to a missing one (NFR-ISO-01). */
export const GET = authed(async ({ sys, session, params }) =>
  json(toWarehouseDto(await getWarehouse(sys, session.actor, params.id ?? ''))),
);

/** Name/note edit with optimistic locking (`version`). */
export const PATCH = authed(async ({ req, sys, session, params, requestId }) =>
  json(
    await updateWarehouse(sys, session.actor, params.id ?? '', await readJson(req), { requestId }),
  ),
);
