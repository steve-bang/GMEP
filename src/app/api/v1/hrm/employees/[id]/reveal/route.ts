import { json, readJson } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { revealEmployeeField } from '@/modules/hrm';

export const runtime = 'nodejs';

/** "Hiện" on a staff record: the only place a full personal value leaves the server. Logged, never cached. */
export const POST = authed(async ({ req, hrm, session, params, requestId }) =>
  json(
    await revealEmployeeField(hrm, session.actor, params.id ?? '', await readJson(req), {
      requestId,
    }),
    { headers: { 'cache-control': 'no-store' } },
  ),
);
