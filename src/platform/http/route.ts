import { randomUUID } from 'node:crypto';
import { AppError } from '../errors/errors';
import { requestLogger, type Logger } from '../logging/logger';
import { problemResponse } from './problem';

export interface RouteContext {
  req: Request;
  requestId: string;
  log: Logger;
  /** Next.js dynamic segments (already awaited). */
  params: Record<string, string>;
}

type NextCtx = { params?: Promise<Record<string, string>> | Record<string, string> };

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function json(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...init.headers,
    },
  });
}

/**
 * CSRF defence (ADR §6.3): SameSite=Lax cookie + Origin check on every state-changing request +
 * JSON-only bodies. `allowedOrigins` always includes the request's own origin.
 */
export function assertSafeOrigin(
  req: Request,
  allowedOrigins: string[],
  opts: { multipart?: boolean } = {},
): void {
  if (!UNSAFE.has(req.method)) return;
  const origin = req.headers.get('origin');
  const own = new URL(req.url).origin;
  if (!origin || (origin !== own && !allowedOrigins.includes(origin)))
    throw new AppError('bad_origin', 403);
  const ct = req.headers.get('content-type') ?? '';
  const hasBody = req.headers.get('content-length') !== '0' && req.headers.has('content-type');
  const okType =
    ct.toLowerCase().startsWith('application/json') ||
    (opts.multipart === true && ct.toLowerCase().startsWith('multipart/form-data'));
  if (hasBody && !okType) throw new AppError('unsupported_media_type', 415);
}

export interface RouteOptions {
  allowedOrigins?: () => string[];
  /** file upload routes (FR-SYS-007): also accept multipart/form-data; the Origin check still applies */
  multipart?: boolean;
  /**
   * Machine-to-machine route (Cloud Scheduler sends no Origin). ONLY for `cron()` in composition/api.ts, which replaces the
   * Origin check by a shared-secret check before any work.
   */
  skipOriginCheck?: boolean;
}

/**
 * Wraps a Route Handler: request id (propagated in `x-request-id`), structured logging,
 * Origin/CSRF check, RFC 9457 error mapping. Business logic stays out of this layer.
 */
export function apiRoute(
  handler: (ctx: RouteContext) => Promise<Response>,
  options: RouteOptions = {},
): (req: Request, nextCtx?: NextCtx) => Promise<Response> {
  return async (req, nextCtx) => {
    const requestId = sanitizeRequestId(req.headers.get('x-request-id')) ?? randomUUID();
    const log = requestLogger(requestId, { method: req.method, path: new URL(req.url).pathname });
    const started = Date.now();
    try {
      if (!options.skipOriginCheck)
        assertSafeOrigin(req, options.allowedOrigins?.() ?? [], {
          multipart: options.multipart === true,
        });
      const params = nextCtx?.params ? await nextCtx.params : {};
      const res = await handler({ req, requestId, log, params });
      res.headers.set('x-request-id', requestId);
      log.info({ status: res.status, ms: Date.now() - started }, 'request');
      return res;
    } catch (err) {
      if (err instanceof AppError && err.status < 500) {
        log.info(
          { status: err.status, code: err.code, ms: Date.now() - started },
          'request rejected',
        );
      } else {
        log.error({ err, ms: Date.now() - started }, 'request failed');
      }
      return problemResponse(err, requestId);
    }
  };
}

function sanitizeRequestId(v: string | null): string | null {
  return v && /^[A-Za-z0-9._-]{8,64}$/.test(v) ? v : null;
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new AppError('validation_failed', 422, [{ field: '', message: 'Invalid JSON' }]);
  }
}
