import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getApproval } from '@/modules/sys';

export const runtime = 'nodejs';

export const GET = authed(async ({ sys, session, params }) =>
  json(await getApproval(sys, session.actor, params.id ?? '')),
);
