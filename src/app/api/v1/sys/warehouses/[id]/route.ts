import { apiRoute, json } from '@/platform/http/route';
import { getWarehouse, toWarehouseDto } from '@/modules/sys';
import { allowedOrigins, authenticate } from '@/composition/auth';
import { getContainer } from '@/composition/container';

export const runtime = 'nodejs';

/** Out-of-scope id -> 404, identical to a missing one (NFR-ISO-01). */
export const GET = apiRoute(
  async ({ req, params }) => {
    const { actor } = await authenticate(req);
    const w = await getWarehouse(getContainer().sys, actor, params.id ?? '');
    return json(toWarehouseDto(w));
  },
  { allowedOrigins },
);
