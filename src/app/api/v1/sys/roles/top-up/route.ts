import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import * as mod from '@/modules/sys';

export const runtime = 'nodejs';

/** R30 / R21: adds the permissions introduced after a role was created (owner only, idempotent, audited). */
export const POST = authed(async ({ sys: d, session, requestId }) =>
  json(await mod.applyPermissionTopUps(d, session.actor, { requestId })),
);
