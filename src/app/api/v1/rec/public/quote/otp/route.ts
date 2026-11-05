import { json, readJson } from '@/platform/http/route';
import { api, clientAddress } from '@/composition/api';
import { requestQuoteOtp } from '@/modules/rec';

export const runtime = 'nodejs';

/**
 * QUO-04/05: the customer asks for the one-time code before approving. No login; the token travels in the body,
 * the code is sent to the contact on file only, and the request is limited per link and per address.
 */
export const POST = api(async ({ req, rec, requestId }) => {
  const body = (await readJson(req)) as { token?: unknown } & Record<string, unknown>;
  const { token, ...rest } = body;
  const r = await requestQuoteOtp(rec, typeof token === 'string' ? token : '', rest, {
    requestId,
    address: clientAddress(req),
  });
  return json(r, { status: 200 });
});
