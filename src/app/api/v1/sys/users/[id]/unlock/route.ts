import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import * as mod from '@/modules/sys';

export const runtime = 'nodejs';

export const POST = authed(async ({ sys: d, session, params, requestId }) => {
  await mod.unlockUser(d, session.actor, params.id ?? '', { requestId });
  return json({});
});
