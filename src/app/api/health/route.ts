import { apiRoute, json } from '@/platform/http/route';
import { getContainer } from '@/composition/container';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Liveness by default; `?ready=1` also checks the data store (one cheap read). */
export const GET = apiRoute(async ({ req, requestId }) => {
  const url = new URL(req.url);
  const body: Record<string, unknown> = {
    status: 'ok',
    service: 'gmep',
    time: new Date().toISOString(),
    requestId,
  };
  if (url.searchParams.get('ready') === '1') {
    const c = getContainer();
    await c.sys.sessions.find('health-probe'); // read of a missing doc: proves connectivity without data
    body.backend = c.backend;
    body.ready = true;
  }
  return json(body);
});
