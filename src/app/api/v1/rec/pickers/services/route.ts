import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { pickServices } from '@/modules/rec';

export const runtime = 'nodejs';

/** FR-REC-005: services with the standard hours and hourly rate in force today. */
export const GET = authed(async ({ rec, session, query }) =>
  json({ items: await pickServices(rec, session.actor, query()) }),
);
