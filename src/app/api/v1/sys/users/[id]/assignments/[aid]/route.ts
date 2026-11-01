import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import * as mod from '@/modules/sys';

export const runtime = 'nodejs';

export const DELETE = authed(async ({ sys: d, session, params, requestId }) => {
  await mod.removeAssignment(d, session.actor, params.id ?? '', params.aid ?? '', { requestId });
  return json({});
});
