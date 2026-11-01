import { readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { exportAuditCsv } from '@/modules/sys';

export const runtime = 'nodejs';

/** Audit export: reason required, max rows enforced, the export is itself audited (BA §9). */
export const POST = authed(async ({ req, sys, session, requestId }) => {
  const csv = await exportAuditCsv(sys, session.actor, await readJson(req), requestId);
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="audit-log.csv"',
      'cache-control': 'no-store',
    },
  });
});
