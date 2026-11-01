import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import * as mod from '@/modules/sys';

export const runtime = 'nodejs';

export const GET = authed(async ({ sys: d, session }) =>
  json({ items: await mod.listRoles(d, session.actor) }),
);
