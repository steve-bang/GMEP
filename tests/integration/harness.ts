import { loadEnv } from '@/platform/config/env';
import { fixedClock } from '@/platform/time/clock';
import { createContainer, setContainerForTests, type Container } from '@/composition/container';
import { seedFirestoreEmulator, seedMemory } from '@/infrastructure/seed/seed';
import { DEMO_PASSWORD, demoUsers } from '@/infrastructure/seed/demo';
import { getDb } from '@/infrastructure/firestore/client';

export type Backend = 'memory' | 'firestore';
export const hasEmulator = Boolean(
  process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST,
);
/** Memory always; Firestore only when the Emulator Suite is running (pnpm test:integration). */
export const backends: Backend[] = hasEmulator ? ['memory', 'firestore'] : ['memory'];

const ORIGIN = 'http://localhost:3100';

type Handler = (
  req: Request,
  ctx?: { params: Promise<Record<string, string>> },
) => Promise<Response>;

/**
 * Every route file under src/app/api is imported and matched by its path, so a new route is
 * reachable from tests without editing this file (and the CSRF coverage test walks the same list).
 */
const modules = import.meta.glob('/src/app/api/**/route.ts', { eager: true }) as Record<
  string,
  Record<string, unknown>
>;

interface RouteEntry {
  file: string;
  re: RegExp;
  names: string[];
  mod: Record<string, unknown>;
}
const table: RouteEntry[] = Object.entries(modules).map(([file, mod]) => {
  const names: string[] = [];
  const pattern = file
    .replace('/src/app', '')
    .replace(/\/route\.ts$/, '')
    .split('/')
    .map((seg) => {
      const m = /^\[(\w+)\]$/.exec(seg);
      if (m) {
        names.push(m[1]!);
        return '([^/]+)';
      }
      return seg.replace(/[.*+?^${}()|\\]/g, '\\$&');
    })
    .join('/');
  return { file, re: new RegExp(`^${pattern}$`), names, mod };
});

/** Static segments win over dynamic ones: sort so `/warehouses/export` matches before `/warehouses/[id]`. */
table.sort((a, b) => a.file.split('[').length - b.file.split('[').length);

export const allRouteFiles = (): { file: string; methods: string[] }[] =>
  table.map((t) => ({
    file: t.file,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].filter(
      (m) => typeof t.mod[m] === 'function',
    ),
  }));

function route(method: string, path: string): { handler: Handler; params: Record<string, string> } {
  const url = new URL(path, ORIGIN).pathname;
  for (const t of table) {
    const m = t.re.exec(url);
    const h = m ? (t.mod[method.toUpperCase()] as Handler | undefined) : undefined;
    if (m && h) {
      const params: Record<string, string> = {};
      t.names.forEach((n, i) => (params[n] = decodeURIComponent(m[i + 1]!)));
      return { handler: h, params };
    }
  }
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

export interface Harness {
  backend: Backend;
  container: Container;
  clock: ReturnType<typeof fixedClock>;
  /** login and remember the cookie; returns the raw cookie header value */
  login(userKey: string, password?: string): Promise<string>;
  /** login + choose a working branch (scope picker) */
  loginAt(userKey: string, branchId: string | 'all'): Promise<string>;
  call(method: string, path: string, opts?: CallOpts): Promise<ApiResult>;
  /** dev email outbox (no mail is ever sent), oldest first */
  outbox(): Promise<{ to: string; template: string; vars: Record<string, string> }[]>;
  /** latest raw token from the outbox link sent to `email` for `template` */
  latestToken(email: string, template: string): Promise<string>;
}

export interface HarnessOptions {
  /** override env values, e.g. AUTH_CACHE_TTL_SECONDS */
  env?: Record<string, string>;
  seed?: boolean;
}

export async function createHarness(
  backend: Backend,
  options: HarnessOptions = {},
): Promise<Harness> {
  const clock = fixedClock(new Date().toISOString());
  const env = loadEnv({
    ...process.env,
    GMEP_ENV: 'local',
    GMEP_DATA_BACKEND: backend,
    NODE_ENV: 'test',
    AUTH_CACHE_TTL_SECONDS: '0', // tests that need the cache set it explicitly
    ...(options.env ?? {}),
  } as Record<string, string | undefined>);
  const container = createContainer({ env, clock });
  if (options.seed !== false) {
    if (backend === 'memory') seedMemory(container.memory!);
    else {
      await clearEmulators();
      await seedFirestoreEmulator(env);
    }
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
        headers: { 'x-forwarded-for': `10.0.${userKey.length}.${hash(userKey)}` },
      });
      if (res.status !== 200)
        throw new Error(`login failed for ${userKey}: ${res.status} ${res.text}`);
      const cookie = parseSessionCookie(res.headers);
      cookies.set(userKey, cookie);
      return cookie;
    },
    async loginAt(userKey, branchId) {
      const cookie = await harness.login(userKey);
      const r = await harness.call('PUT', '/api/v1/sys/scope', { cookie, body: { branchId } });
      if (r.status !== 200) throw new Error(`scope pick failed: ${r.status} ${r.text}`);
      return cookie;
    },
    async outbox() {
      const rows =
        backend === 'memory'
          ? [...container.memory!.db.col('emailOutbox').values()]
          : (await getDb(env).collection('emailOutbox').get()).docs.map((d) => d.data());
      return (
        rows as {
          to: string;
          template: string;
          vars: Record<string, string>;
          createdAt: Date | { toDate(): Date };
        }[]
      )
        .map((r) => ({
          ...r,
          at: r.createdAt instanceof Date ? r.createdAt.getTime() : r.createdAt.toDate().getTime(),
        }))
        .sort((a, b) => a.at - b.at)
        .map(({ to, template, vars }) => ({ to, template, vars }));
    },
    async latestToken(email, template) {
      const mails = (await harness.outbox()).filter(
        (m) => m.to === email && m.template === template,
      );
      const link = mails.at(-1)?.vars.link;
      if (!link) throw new Error(`no ${template} mail for ${email}`);
      return new URL(link).searchParams.get('token')!;
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
      const send = async () =>
        handler(
          new Request(new URL(path, ORIGIN), {
            method,
            headers,
            ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
          }),
          { params: Promise.resolve(params) },
        );
      let res = await send();
      // a cached demo-user cookie may have been revoked by an earlier test: log in again once
      if (res.status === 401 && opts.as && !opts.cookie && !path.includes('/auth/login')) {
        cookies.delete(opts.as);
        headers.cookie = await harness.login(opts.as);
        res = await send();
      }
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

const hash = (s: string) => [...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 250, 7);

/** The session cookie out of a (possibly multi-cookie) Set-Cookie header. */
export function parseSessionCookie(headers: Headers): string {
  const all = headers.getSetCookie();
  const c = all.find((x) => x.startsWith('__Host-gmep_session='));
  if (!c) throw new Error('no session set-cookie header');
  return c.split(';')[0]!;
}

/** Back-compat helper: first cookie of a header string. */
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
  path = '/api/v1/sys/warehouses',
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
    const res = await h.call('GET', `${path}?${qs}`, { as });
    if (res.status !== 200) throw new Error(`list failed ${res.status}: ${res.text}`);
    items.push(...res.json.items);
    cursor = res.json.nextCursor;
    pages++;
    if (pages > 200) throw new Error('pagination did not terminate');
  } while (cursor);
  return { items, pages };
}
