import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getLaborRules } from '@/modules/hrm';

export const runtime = 'nodejs';

/** G3-HRM-06: the labor rules in force on a date (read only; changes go through the effective-dated config API). */
export const GET = authed(async ({ hrm, session, query }) =>
  json(await getLaborRules(hrm, session.actor, query())),
);
