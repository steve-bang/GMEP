import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getConnection } from '@/modules/ein';

export const runtime = 'nodejs';

/** G4-EIN-07: is an issuing unit configured and its provider usable (no buyer data here). */
export const GET = authed(async ({ ein, session }) =>
  json(await getConnection(ein, session.actor)),
);
