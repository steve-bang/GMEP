import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getOrderLabor } from '@/modules/hrm';

export const runtime = 'nodejs';

/** G3-HRM-07: labor of one order, with the finished items still waiting for QC. */
export const GET = authed(async ({ hrm, session, params }) =>
  json(await getOrderLabor(hrm, session.actor, params.id ?? '')),
);
