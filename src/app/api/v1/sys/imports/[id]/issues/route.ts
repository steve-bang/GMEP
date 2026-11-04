import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { getImportIssues } from '@/modules/sys';

export const runtime = 'nodejs';

/** FR-SYS-007: paged row errors of a batch (`?cursor&limit&list=issues|warnings`). */
export const GET = authed(async ({ sys, session, params, query }) =>
  json(await getImportIssues(sys, session.actor, params.id ?? '', query())),
);
