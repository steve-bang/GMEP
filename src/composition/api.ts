import { timingSafeEqual } from 'node:crypto';
import { notFound, unauthenticated } from '@/platform/errors/errors';
import { apiRoute, json, type RouteContext } from '@/platform/http/route';
import { parseIdempotencyKey } from '@/platform/idempotency/idempotency';
import type { AccDeps } from '@/modules/acc';
import type { EinDeps } from '@/modules/ein';
import type { RptDeps } from '@/modules/rpt';
import type { CrmDeps } from '@/modules/crm';
import type { InvDeps } from '@/modules/inv';
import type { RecDeps } from '@/modules/rec';
import type { Session, SysDeps } from '@/modules/sys';
import { allowedOrigins, authenticate } from './auth';
import { getContainer } from './container';

/**
 * Route handler helpers (composition layer). Every write route is created through `api` or
 * `authed`, which apply the Origin/CSRF check, request id, logging and RFC 9457 mapping from
 * `apiRoute`; a test walks all route files to prove no unsafe method escapes this wrapper.
 */
export interface ApiCtx extends RouteContext {
  sys: SysDeps;
  crm: CrmDeps;
  inv: InvDeps;
  rec: RecDeps;
  acc: AccDeps;
  ein: EinDeps;
  rpt: RptDeps;
}
export interface AuthedCtx extends ApiCtx {
  session: Session;
  /** required Idempotency-Key (risky writes) */
  idempotencyKey(): string;
  query(): Record<string, string>;
}

export function api(handler: (c: ApiCtx) => Promise<Response>) {
  return apiRoute(
    (c) =>
      handler({
        ...c,
        sys: getContainer().sys,
        crm: getContainer().crm,
        inv: getContainer().inv,
        rec: getContainer().rec,
        acc: getContainer().acc,
        ein: getContainer().ein,
        rpt: getContainer().rpt,
      }),
    {
      allowedOrigins,
    },
  );
}

export function authed(
  handler: (c: AuthedCtx) => Promise<Response>,
  options: { multipart?: boolean } = {},
) {
  return apiRoute(
    async (c) => {
      const session = await authenticate(c.req);
      return handler({
        ...c,
        sys: getContainer().sys,
        crm: getContainer().crm,
        inv: getContainer().inv,
        rec: getContainer().rec,
        acc: getContainer().acc,
        ein: getContainer().ein,
        rpt: getContainer().rpt,
        session,
        idempotencyKey: () => parseIdempotencyKey(c.req.headers.get('idempotency-key'), true)!,
        query: () => Object.fromEntries(new URL(c.req.url).searchParams),
      });
    },
    { allowedOrigins, ...(options.multipart ? { multipart: true } : {}) },
  );
}

/**
 * Internal machine-to-machine route (Cloud Scheduler). No session and no Origin: the shared secret in `x-cron-secret`
 * (env CRON_SECRET, compared in constant time) is checked before anything else. Unset secret = the route does not exist.
 */
export function cron(handler: (c: ApiCtx) => Promise<Response>) {
  return apiRoute(
    async (c) => {
      const secret = getContainer().env.CRON_SECRET;
      if (!secret) throw notFound();
      const given = Buffer.from(c.req.headers.get('x-cron-secret') ?? '');
      const want = Buffer.from(secret);
      if (given.length !== want.length || !timingSafeEqual(given, want)) throw unauthenticated();
      return handler({
        ...c,
        sys: getContainer().sys,
        crm: getContainer().crm,
        inv: getContainer().inv,
        rec: getContainer().rec,
        acc: getContainer().acc,
        ein: getContainer().ein,
        rpt: getContainer().rpt,
      });
    },
    { skipOriginCheck: true },
  );
}

/**
 * Client network address for throttling. Behind Cloud Run the LAST `hops` entries of
 * X-Forwarded-For are appended by trusted proxies; earlier entries are client-controlled.
 */
export function clientAddress(req: Request): string {
  return clientAddressFromHeaders(req.headers);
}

export function clientAddressFromHeaders(headers: Pick<Headers, 'get'>): string {
  const hops = getContainer().env.TRUSTED_PROXY_HOPS;
  const xff = (headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (hops > 0 && xff.length >= hops) return xff[xff.length - hops]!;
  return xff[0] ?? 'unknown';
}

export const created = (body: unknown, replayed: boolean, status = 201) =>
  json(body, { status, headers: replayed ? { 'idempotent-replayed': 'true' } : {} });
