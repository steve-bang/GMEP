import { authed } from '@/composition/api';
import { importTemplate } from '@/modules/sys';

export const runtime = 'nodejs';

/** FR-SYS-007: CSV template of a kind (UTF-8 with BOM). */
export const GET = authed(async ({ sys, session, query }) => {
  const kind = query().kind ?? '';
  return new Response(importTemplate(sys, session.actor, kind), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="mau-nhap-${kind.replace(/[^a-z-]/g, '')}.csv"`,
      'cache-control': 'no-store',
    },
  });
});
