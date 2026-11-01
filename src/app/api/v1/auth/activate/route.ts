import { json, readJson } from '@/platform/http/route';
import { api, clientAddress } from '@/composition/api';
import { activateAccount } from '@/modules/sys';

export const runtime = 'nodejs';

export const POST = api(async ({ req, sys, requestId }) => {
  await activateAccount(sys, await readJson(req), { address: clientAddress(req), requestId });
  return json({ done: true });
});
