import { describe, expect, it } from 'vitest';
import { ZodError, z } from 'zod';
import { AppError } from '../errors/errors';
import { clearSessionCookie, readCookie, serializeSessionCookie, SESSION_COOKIE } from './cookies';
import { problemFromError, PROBLEM_CONTENT_TYPE, problemResponse } from './problem';
import { apiRoute, assertSafeOrigin } from './route';

describe('RFC 9457 problem details', () => {
  it('maps AppError to a stable code with Vietnamese title/detail and a traceId', () => {
    const p = problemFromError(new AppError('forbidden', 403), 'trace-1');
    expect(p).toMatchObject({
      type: 'urn:gmep:problem:forbidden',
      status: 403,
      code: 'forbidden',
      traceId: 'trace-1',
    });
    expect(p.title).toBe('Không có quyền');
    expect(p.detail).toContain('Tài khoản');
  });
  it('maps zod errors to 422 with per-field errors', () => {
    const r = z.object({ name: z.string().min(2) }).safeParse({ name: 'a' });
    const p = problemFromError(r.error as ZodError, 't');
    expect(p.status).toBe(422);
    expect(p.errors?.[0]?.field).toBe('name');
  });
  it('hides internal error details behind a generic 500', async () => {
    const res = problemResponse(new Error('secret db password leaked'), 't');
    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toBe(PROBLEM_CONTENT_TYPE);
    const text = await res.text();
    expect(text).not.toContain('secret');
  });
});

describe('Origin / CSRF check (ADR §6.3)', () => {
  const req = (method: string, headers: Record<string, string>) =>
    new Request('https://app.test/api/v1/x', { method, headers });
  it('lets safe methods through', () => {
    expect(() => assertSafeOrigin(req('GET', {}), [])).not.toThrow();
  });
  it('requires a matching Origin on writes', () => {
    expect(() => assertSafeOrigin(req('POST', {}), [])).toThrowError(
      expect.objectContaining({ code: 'bad_origin' }),
    );
    expect(() =>
      assertSafeOrigin(
        req('POST', { origin: 'https://evil.test', 'content-type': 'application/json' }),
        [],
      ),
    ).toThrow();
    expect(() =>
      assertSafeOrigin(
        req('POST', { origin: 'https://app.test', 'content-type': 'application/json' }),
        [],
      ),
    ).not.toThrow();
    expect(() =>
      assertSafeOrigin(
        req('POST', { origin: 'https://other.test', 'content-type': 'application/json' }),
        ['https://other.test'],
      ),
    ).not.toThrow();
  });
  it('accepts only JSON bodies', () => {
    expect(() =>
      assertSafeOrigin(
        req('POST', { origin: 'https://app.test', 'content-type': 'text/plain' }),
        [],
      ),
    ).toThrowError(expect.objectContaining({ status: 415 }));
  });
});

describe('apiRoute wrapper', () => {
  it('propagates x-request-id and returns problem+json on failure', async () => {
    const handler = apiRoute(async () => {
      throw new AppError('not_found', 404);
    });
    const res = await handler(
      new Request('https://app.test/api/x', { headers: { 'x-request-id': 'req-12345678' } }),
    );
    expect(res.status).toBe(404);
    expect(res.headers.get('x-request-id')).toBe('req-12345678');
    expect((await res.json()).traceId).toBe('req-12345678');
  });
  it('generates a request id when the incoming one is malformed', async () => {
    const handler = apiRoute(async () => new Response('{}'));
    const res = await handler(
      new Request('https://app.test/api/x', { headers: { 'x-request-id': 'bad id with spaces' } }),
    );
    expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('session cookie attributes (ADR §6.3)', () => {
  it('is __Host- prefixed, HttpOnly, Secure, SameSite=Lax, Path=/ and has no Domain', () => {
    const c = serializeSessionCookie('abc', 3600);
    expect(c.startsWith(`${SESSION_COOKIE}=abc;`)).toBe(true);
    expect(SESSION_COOKIE.startsWith('__Host-')).toBe(true);
    for (const attr of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=3600'])
      expect(c).toContain(attr);
    expect(c).not.toMatch(/Domain=/i);
  });
  it('clears with Max-Age=0 and parses cookie headers', () => {
    expect(clearSessionCookie()).toContain('Max-Age=0');
    expect(readCookie('a=1; __Host-gmep_session=xyz; b=2', SESSION_COOKIE)).toBe('xyz');
    expect(readCookie(null, SESSION_COOKIE)).toBeNull();
  });
});
