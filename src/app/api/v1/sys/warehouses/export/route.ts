import { apiRoute } from '@/platform/http/route';
import { exportWarehousesCsv } from '@/modules/sys';
import { allowedOrigins, authenticate } from '@/composition/auth';
import { getContainer } from '@/composition/container';

export const runtime = 'nodejs';

/** NFR-EXP-01: needs warehouse:export; rows limited to the actor's scope; the export is audited. */
export const GET = apiRoute(
  async ({ req, requestId }) => {
    const { actor } = await authenticate(req);
    const csv = await exportWarehousesCsv(getContainer().sys, actor, requestId);
    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="warehouses.csv"',
        'cache-control': 'no-store',
      },
    });
  },
  { allowedOrigins },
);
