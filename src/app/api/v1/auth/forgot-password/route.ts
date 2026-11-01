import { json, readJson } from '@/platform/http/route';
import { api, clientAddress } from '@/composition/api';
import { forgotPassword } from '@/modules/sys';

export const runtime = 'nodejs';

/** Neutral response whether or not the account exists (no enumeration). 429 when limited. */
export const POST = api(async ({ req, sys, requestId }) => {
  await forgotPassword(sys, await readJson(req), { address: clientAddress(req), requestId });
  return json({ accepted: true }, { status: 202 });
});
