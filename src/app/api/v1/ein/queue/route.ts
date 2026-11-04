import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { listQueue } from '@/modules/ein';

export const runtime = 'nodejs';

/** G4-EIN-06 / FR-EIN-010: open issue requests of the working branch (errors, timeouts, waiting for the provider). */
export const GET = authed(async ({ ein, session }) => json(await listQueue(ein, session.actor)));
