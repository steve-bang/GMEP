import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { listWarnings } from '@/modules/ein';

export const runtime = 'nodejs';

/** G4-EIN-05 / FR-EIN-009: orders handed over without a valid invoice and without an open request. */
export const GET = authed(async ({ ein, session }) => json(await listWarnings(ein, session.actor)));
