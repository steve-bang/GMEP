import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { listLaborLines } from '@/modules/hrm';

export const runtime = 'nodejs';

/** G3-HRM-07: labor lines of a branch in a date window (a technician only sees their own). */
export const GET = authed(async ({ hrm, session, query }) =>
  json(await listLaborLines(hrm, session.actor, query())),
);
