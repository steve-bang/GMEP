import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { listImportKinds } from '@/modules/sys';

export const runtime = 'nodejs';

/** FR-SYS-007: kinds the actor may import, with the template columns. */
export const GET = authed(async ({ sys, session }) => json(listImportKinds(sys, session.actor)));
