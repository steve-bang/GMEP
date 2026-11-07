import { readCookie, SESSION_COOKIE } from '@/platform/http/cookies';
import { json } from '@/platform/http/route';
import { listTenantChoices } from '@/modules/sys';
import { api } from '@/composition/api';

export const runtime = 'nodejs';

/** FR-TEN-016, 017: the signed-in person's own active tenants for "Chọn công ty"; never anyone else's. */
export const GET = api(async ({ req, sys }) => {
  const tenants = await listTenantChoices(
    sys,
    readCookie(req.headers.get('cookie'), SESSION_COOKIE),
  );
  return json({ tenants });
});
