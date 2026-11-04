import { readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { exportReportCsv } from '@/modules/rpt';

export const runtime = 'nodejs';

/** CSV of a phase 1 report (monthly, reconcile, warehouse, technicians). Needs `report-daily:export`; audited. */
export const POST = authed(async ({ req, rpt, session, requestId }) => {
  const { csv, filename } = await exportReportCsv(rpt, session.actor, await readJson(req), {
    requestId,
  });
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
});
