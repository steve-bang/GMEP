import { readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { exportCustomersCsv } from '@/modules/crm';

export const runtime = 'nodejs';

/**
 * FR-CRM-017 / NFR-EXP-01: POST (the password for full personal columns must not travel in a URL).
 * Needs customer:export; rows limited by scope and by the export cap; every export is audited.
 */
export const POST = authed(async ({ req, crm, session, requestId }) => {
  const csv = await exportCustomersCsv(crm, session.actor, await readJson(req).catch(() => ({})), {
    requestId,
    sessionId: session.sessionId,
  });
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="customers.csv"',
      'cache-control': 'no-store',
    },
  });
});
