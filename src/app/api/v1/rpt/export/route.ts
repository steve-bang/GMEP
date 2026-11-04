import { readJson } from '@/platform/http/route';
import { XLSX_CONTENT_TYPE } from '@/platform/files/xlsxWriter';
import { authed } from '@/composition/api';
import { exportReport } from '@/modules/rpt';

export const runtime = 'nodejs';

/**
 * CSV or .xlsx (`format`) of a phase 1 report (monthly, reconcile, warehouse, technicians). Needs `report-daily:export`;
 * audited; same scope and redaction as the screen.
 */
export const POST = authed(async ({ req, rpt, session, requestId }) => {
  const r = await exportReport(rpt, session.actor, await readJson(req), { requestId });
  const headers = {
    'content-disposition': `attachment; filename="${r.filename}"`,
    'cache-control': 'no-store',
  };
  if (r.xlsx)
    return new Response(new Uint8Array(r.xlsx), {
      headers: { ...headers, 'content-type': XLSX_CONTENT_TYPE },
    });
  return new Response(r.csv, {
    headers: { ...headers, 'content-type': 'text/csv; charset=utf-8' },
  });
});
