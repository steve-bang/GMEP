import { api, clientAddress } from '@/composition/api';
import { readPublicQuotePhoto } from '@/modules/rec';

export const runtime = 'nodejs';

/**
 * FR-REC-034: a photo on the customer's quote page. The link token is the only credential and travels in the query
 * (`?t=`), not in the path, so request logs (which keep the path) never hold it. The bytes are served by the API; the
 * browser never talks to storage. Anything that is not a photo of the quote this link opens is a bare 404.
 */
export const GET = api(async ({ req, rec, params, requestId }) => {
  const token = new URL(req.url).searchParams.get('t') ?? '';
  const f = await readPublicQuotePhoto(rec, token, params.pid ?? '', {
    address: clientAddress(req),
    requestId,
  });
  return new Response(Buffer.from(f.bytes), {
    headers: {
      'content-type': f.contentType,
      'content-disposition': 'inline',
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, no-store',
      'referrer-policy': 'no-referrer',
    },
  });
});
