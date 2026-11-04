import { authed } from '@/composition/api';
import { readPhoto } from '@/modules/rec';

export const runtime = 'nodejs';

/** Scope-checked read of one order photo; served by the API (no public or signed URL). */
export const GET = authed(async ({ rec, session, params }) => {
  const f = await readPhoto(rec, session.actor, 'order', params.id ?? '', params.pid ?? '');
  return new Response(Buffer.from(f.bytes), {
    headers: {
      'content-type': f.contentType,
      'content-disposition': 'inline',
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, no-store',
    },
  });
});
