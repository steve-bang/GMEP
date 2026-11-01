import { authed } from '@/composition/api';
import { exportWarehousesCsv } from '@/modules/sys';

export const runtime = 'nodejs';

/** NFR-EXP-01: needs warehouse:export; rows limited to the actor's scope; the export is audited. */
export const GET = authed(async ({ sys, session, requestId }) => {
  const csv = await exportWarehousesCsv(sys, session.actor, requestId);
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="warehouses.csv"',
      'cache-control': 'no-store',
    },
  });
});
