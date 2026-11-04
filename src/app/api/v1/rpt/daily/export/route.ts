import { readJson } from '@/platform/http/route';
import { XLSX_CONTENT_TYPE } from '@/platform/files/xlsxWriter';
import { authed } from '@/composition/api';
import { exportDaily } from '@/modules/rpt';

export const runtime = 'nodejs';

/** FR-RPT-003/009: CSV or .xlsx (`format`) of the daily report. Needs `report-daily:export`; the export is audited (NFR-EXP-01). */
export const POST = authed(async ({ req, rpt, session, requestId }) => {
  const r = await exportDaily(rpt, session.actor, await readJson(req), { requestId });
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
