import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { listDuplicateCandidates } from '@/modules/crm';

export const runtime = 'nodejs';

/** FR-CRM-003: other active records in the scope with the same phone number (merge suggestions). */
export const GET = authed(async ({ crm, session, params }) =>
  json(await listDuplicateCandidates(crm, session.actor, params.id ?? '')),
);
