import { loadEnv } from '@/platform/config/env';
import { fixedClock } from '@/platform/time/clock';
import { createContainer, setContainerForTests, type Container } from '@/composition/container';
import { seedFirestoreEmulator, seedMemory } from '@/infrastructure/seed/seed';
import { DEMO_PASSWORD, demoUsers } from '@/infrastructure/seed/demo';
import * as health from '@/app/api/health/route';
import * as login from '@/app/api/v1/auth/login/route';
import * as logout from '@/app/api/v1/auth/logout/route';
import * as me from '@/app/api/v1/auth/me/route';
import * as warehouses from '@/app/api/v1/sys/warehouses/route';
import * as warehouseById from '@/app/api/v1/sys/warehouses/[id]/route';
import * as warehouseExport from '@/app/api/v1/sys/warehouses/export/route';

export type Backend = 'memory' | 'firestore';
export const hasEmulator = Boolean(
  process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST,
);
/** Memory always; Firestore only when the Emulator Suite is running (pnpm test:integration). */
export const backends: Backend[] = hasEmulator ? ['memory', 'firestore'] : ['memory'];

const ORIGIN = 'http://localhost:3100';

export interface Harness {
  backend: Backend;
  container: Container;
  clock: ReturnType<typeof fixedClock>;
  /** login and remember the cookie; returns the raw cookie header value */
  login(userKey: string, password?: string): Promise<string>;
  call(method: string, path: string, opts?: CallOpts): Promise<ApiResult>;
}

export interface CallOpts {
  as?: string; // demo user key, e.g. 'u_ql_q7'
  cookie?: string;
  body?: unknown;
  headers?: Record<string, string>;
  key?: string; // Idempotency-Key
  origin?: string | null;
}

export interface ApiResult {
  status: number;
  headers: Headers;
  json: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  text: string;
}

type Handler = (
  req: Request,
  ctx?: { params: Promise<Record<string, string>> },
) => Promise<Response>;

function route(method: string, path: string): { handler: Handler; params: Record<string, string> } {
  const url = new URL(path, ORIGIN).pathname;
  const m = method.toUpperCase();
  const pick = (mod: Record<string, unknown>) => mod[m] as Handler | undefined;
  const table: [RegExp, Record<string, unknown>][] = [
    [/^\/api\/health$/, health],
    [/^\/api\/v1\/auth\/login$/, login],
    [/^\/api\/v1\/auth\/logout$/, logout],
    [/^\/api\/v1\/auth\/me$/, me],
    [/^\/api\/v1\/sys\/warehouses$/, warehouses],
    [/^\/api\/v1\/sys\/warehouses\/export$/, warehouseExport],
  ];
  for (const [re, mod] of table) {
    const h = re.test(url) ? pick(mod) : undefined;
    if (h) return { handler: h, params: {} };
  }
  const byId = /^\/api\/v1\/sys\/warehouses\/([^/]+)$/.exec(url);
  if (byId && pick(warehouseById))
    return { handler: pick(warehouseById)!, params: { id: decodeURIComponent(byId[1]!) } };
  throw new Error(`no route for ${method} ${url}`);
}

async function clearEmulators(): Promise<void> {
  const project = 'demo-gmep';
  await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${project}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${project}/accounts`,
    { method: 'DELETE' },
  );
}

export async function createHarness(backend: Backend): Promise<Harness> {
  const clock = fixedClock(new Date().toISOString());
  const env = loadEnv({
    ...process.env,
    GMEP_ENV: 'local',
    GMEP_DATA_BACKEND: backend,
    NODE_ENV: 'test',
  } as Record<string, string | undefined>);
  const container = createContainer({ env, clock });
  if (backend === 'memory') seedMemory(container.memory!);
  else {
    await clearEmulators();
    await seedFirestoreEmulator(env);
  }
  setContainerForTests(container);

  const cookies = new Map<string, string>();
  const harness: Harness = {
    backend,
    container,
    clock,
    async login(userKey, password = DEMO_PASSWORD) {
      const user = demoUsers.find((u) => u.id === userKey)!;
      const res = await harness.call('POST', '/api/v1/auth/login', {
        body: { identifier: user.email, password },
      });
      if (res.status !== 200)
        throw new Error(`login failed for ${userKey}: ${res.status} ${res.text}`);
      const cookie = parseSetCookie(res.headers.get('set-cookie'));
      cookies.set(userKey, cookie);
      return cookie;
    },
    async call(method, path, opts = {}) {
      let cookie = opts.cookie;
      if (!cookie && opts.as) cookie = cookies.get(opts.as) ?? (await harness.login(opts.as));
      const unsafe = !['GET', 'HEAD'].includes(method.toUpperCase());
      const headers: Record<string, string> = { ...(opts.headers ?? {}) };
      if (cookie) headers.cookie = cookie;
      if (opts.key) headers['idempotency-key'] = opts.key;
      if (unsafe) {
        if (opts.origin !== null) headers.origin = opts.origin ?? ORIGIN;
        headers['content-type'] ??= 'application/json';
      }
      const { handler, params } = route(method, path);
      const req = new Request(new URL(path, ORIGIN), {
        method,
        headers,
        ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
      });
      const res = await handler(req, { params: Promise.resolve(params) });
      const text = await res.text();
      let json: unknown = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* csv etc. */
      }
      return { status: res.status, headers: res.headers, json, text };
    },
  };
  return harness;
}

/** Extract `name=value` from a Set-Cookie header so it can be replayed in a Cookie header. */
export function parseSetCookie(header: string | null): string {
  if (!header) throw new Error('no set-cookie header');
  return header.split(';')[0]!;
}

/** Walk all pages of a cursor-paginated list and return every item. */
export async function listAll(
  h: Harness,
  as: string,
  query: Record<string, string> = {},
  limit = 25,
) {
  const items: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  let cursor: string | null = null;
  let pages = 0;
  do {
    const qs = new URLSearchParams({
      ...query,
      limit: String(limit),
      ...(cursor ? { cursor } : {}),
    });
    const res = await h.call('GET', `/api/v1/sys/warehouses?${qs}`, { as });
    if (res.status !== 200) throw new Error(`list failed ${res.status}: ${res.text}`);
    items.push(...res.json.items);
    cursor = res.json.nextCursor;
    pages++;
    if (pages > 50) throw new Error('pagination did not terminate');
  } while (cursor);
  return { items, pages };
}
