import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import * as mod from '@/modules/sys';

export const runtime = 'nodejs';

/**
 * FR-SYS-016: which branches see a shared catalogue entry. Changing it is a `catalog-release` config proposal
 * (`POST /api/v1/sys/config/catalog-release`, effective-dated, approved by a second person).
 */
export const GET = authed(async ({ sys: d, session, query }) =>
  json(await mod.getCatalogRelease(d, session.actor, query())),
);
