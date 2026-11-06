import { timingSafeEqual } from 'node:crypto';
import { AppError, notFound, unauthenticated } from '@/platform/errors/errors';
import { mayBeOtherBranch } from '@/platform/rbac/rbac';
import { apiRoute, json, type RouteContext } from '@/platform/http/route';
import { parseIdempotencyKey } from '@/platform/idempotency/idempotency';
import type { AccDeps } from '@/modules/acc';
import type { EinDeps } from '@/modules/ein';
import type { RptDeps } from '@/modules/rpt';
import type { CrmDeps } from '@/modules/crm';
import type { InvDeps } from '@/modules/inv';
import type { RecDeps } from '@/modules/rec';
import { assertTenantWritable, type Session, type SysDeps } from '@/modules/sys';
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
      // analysis 5.1: a suspended or terminating tenant is read-only. Choosing a tenant and signing out stay possible
      // (those routes use `api`, not `authed`); the working-branch picker only changes session state.
      if (
        !['GET', 'HEAD'].includes(c.req.method) &&
        new URL(c.req.url).pathname !== '/api/v1/sys/scope'
      )
        assertTenantWritable(session.tenantStatus);
      try {
        return await handler({
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
      } catch (e) {
        // BA §25 F-1(3): a write is fenced to the working branch (resolveScope), so a record of another branch is
        // "not found" to it; tell the company-wide user why instead of a bare 404
        if (
          e instanceof AppError &&
          e.code === 'not_found' &&
          !['GET', 'HEAD'].includes(c.req.method) &&
          mayBeOtherBranch(session.actor)
        )
          throw new AppError('switch_branch_required', 409);
        throw e;
      }
    },
    { allowedOrigins, ...(options.multipart ? { multipart: true } : {}) },
  );
}

/**
 * Internal machine-to-machine route (Cloud Scheduler). No session and no Origin: the shared secret in `x-cron-secret`
 * (env CRON_SECRET, compared in constant time) or a Cloud Scheduler OIDC bearer token (env CRON_OIDC_AUDIENCE and
 * CRON_OIDC_SERVICE_ACCOUNT, verified through the CronAuthVerifier port) is checked before anything else.
 * Neither configured = the route does not exist (404).
 */
export function cron(handler: (c: ApiCtx) => Promise<Response>) {
  return apiRoute(
    async (c) => {
      const { env, cronAuth } = getContainer();
      const secret = env.CRON_SECRET;
      const oidc = Boolean(env.CRON_OIDC_AUDIENCE && env.CRON_OIDC_SERVICE_ACCOUNT);
      if (!secret && !oidc) throw notFound();
      // either credential is enough: the shared secret (kept for compatibility) or a Cloud Scheduler OIDC token
      let ok = false;
      if (secret) {
        const given = Buffer.from(c.req.headers.get('x-cron-secret') ?? '');
        const want = Buffer.from(secret);
        ok = given.length === want.length && timingSafeEqual(given, want);
      }
      if (!ok && oidc) {
        const m = /^Bearer\s+(\S+)$/i.exec(c.req.headers.get('authorization') ?? '');
        ok = m ? await cronAuth.verify(m[1]!) : false;
      }
      if (!ok) throw unauthenticated();
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
