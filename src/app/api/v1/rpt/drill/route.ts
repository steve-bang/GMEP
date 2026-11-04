import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getDrill } from '@/modules/rpt';

export const runtime = 'nodejs';

/** FR-RPT-011: the source documents behind one figure (needs the view permission of their module). */
export const GET = authed(async ({ rpt, session, query }) =>
  json(await getDrill(rpt, session.actor, query())),
);
