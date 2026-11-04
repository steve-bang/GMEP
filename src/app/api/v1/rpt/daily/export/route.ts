import { readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { exportDailyCsv } from '@/modules/rpt';

export const runtime = 'nodejs';

/** FR-RPT-003: CSV of the daily report. Needs `report-daily:export`; the export is audited (NFR-EXP-01). */
export const POST = authed(async ({ req, rpt, session, requestId }) => {
  const { csv, filename } = await exportDailyCsv(rpt, session.actor, await readJson(req), {
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
