import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getImport } from '@/modules/sys';

export const runtime = 'nodejs';

export const GET = authed(async ({ sys, session, params }) =>
  json(await getImport(sys, session.actor, params.id ?? '')),
);
