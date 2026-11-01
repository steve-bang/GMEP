import { randomUUID } from 'node:crypto';
import { TtlCache } from '@/platform/cache/ttlCache';
import { loadEnv, type Env } from '@/platform/config/env';
import { NumberingService } from '@/platform/numbering/numbering';
import { PiiPolicy } from '@/platform/pii/pii';
import { DocAtomicStateStore, LoginThrottle, RateLimiter } from '@/platform/ratelimit/ratelimit';
import type { DocStore, StoreStats } from '@/platform/store/docStore';
import { systemClock, type Clock } from '@/platform/time/clock';
import type { UnitOfWork } from '@/platform/tx/unitOfWork';
import {
  BRANCH_STATE_RULES,
  DEFAULT_PASSWORD_POLICY,
  DEFAULT_SESSION_POLICY,
  userPiiSource,
  type CachedSession,
  type ConfigVersion,
  type IdentityProvider,
  type SysConfig,
  type SysDeps,
} from '@/modules/sys';
import { noStrongAuth } from '@/infrastructure/auth/noStrongAuth';
import { OutboxEmailGateway } from '@/infrastructure/email/outboxEmailGateway';
import { getDb } from '@/infrastructure/firestore/client';
import { FirebaseIdentityProvider } from '@/infrastructure/identity/firebaseIdentity';
import { MemoryDb, MemoryDocStore, MemoryUnitOfWork } from '@/infrastructure/store/memoryDocStore';
import { FirestoreDocStore, FirestoreUnitOfWork } from '@/infrastructure/store/firestoreDocStore';
import { MemoryIdentityProvider } from '@/infrastructure/memory/memoryIdentity';
import {
  DocAuditLog,
  DocAuthTokenRepository,
  DocBranchRepository,
  DocCompanyRepository,
  DocConfigRepository,
  DocIdempotencyStore,
  DocNotificationRepository,
  DocPiiAccessLog,
  DocPriceListRepository,
  DocRoleAssignmentRepository,
  DocRoleRepository,
  DocServiceRepository,
  DocSessionRepository,
  DocUserRepository,
  DocWarehouseRepository,
} from '@/infrastructure/repos/repos';
import { stubBranchActivity, stubWarehouseActivity } from '@/infrastructure/stubs';

export interface Container {
  env: Env;
  backend: 'firestore' | 'memory';
  sys: SysDeps;
  store: DocStore & { stats: StoreStats };
  identity: IdentityProvider & {
    calls: { signIn: number; createCookie: number; verify: number; revoke: number };
  };
  /** present only for the in-memory backend (tests) */
  memory?: { db: MemoryDb; identity: MemoryIdentityProvider };
}

export function sysConfigFromEnv(env: Env): SysConfig {
  return {
    sessionPolicy: {
      default: {
        idleMs: env.SESSION_IDLE_MINUTES * 60_000,
        absoluteMs: env.SESSION_TTL_HOURS * 3_600_000,
      },
      // per-role idle overrides are the BA defaults (15 min for CH, KT, AD) unless the general idle is shorter
      idleByRole: Object.fromEntries(
        Object.entries(DEFAULT_SESSION_POLICY.idleByRole).map(([r, ms]) => [
          r,
          Math.min(ms, env.SESSION_IDLE_MINUTES * 60_000),
        ]),
      ),
    },
    idempotencyTtlMs: env.IDEMPOTENCY_TTL_HOURS * 3_600_000,
    passwordPolicy: DEFAULT_PASSWORD_POLICY,
    resetTokenTtlMs: 30 * 60_000,
    inviteTokenTtlMs: 72 * 3_600_000,
    authCacheTtlMs: env.AUTH_CACHE_TTL_SECONDS * 1000,
    configCacheTtlMs: env.CONFIG_CACHE_TTL_SECONDS * 1000,
    sessionTouchIntervalMs: 60_000,
    appBaseUrl: (env.APP_BASE_URL ?? env.APP_ORIGIN ?? 'http://localhost:3000').replace(/\/$/, ''),
    branchStateRules: BRANCH_STATE_RULES,
    exportMaxRows: 5000,
    notificationBellDays: 30,
    notificationRetentionDays: 365,
    consentPolicyVersion: 'chưa có [do doanh nghiệp cung cấp]',
  };
}

/** Wires every port to the document-store based repositories. Backend independent. */
function buildSys(
  env: Env,
  clock: Clock,
  store: DocStore,
  uow: UnitOfWork,
  identity: IdentityProvider,
): SysDeps {
  const config = sysConfigFromEnv(env);
  const now = () => clock.now();
  const state = new DocAtomicStateStore(store, uow);
  const deps: SysDeps = {
    uow,
    clock,
    newId: randomUUID,
    audit: new DocAuditLog(store),
    idempotency: new DocIdempotencyStore(store),
    numbering: new NumberingService(store),
    users: new DocUserRepository(store),
    roles: new DocRoleRepository(store),
    assignments: new DocRoleAssignmentRepository(store),
    companies: new DocCompanyRepository(store),
    branches: new DocBranchRepository(store),
    warehouses: new DocWarehouseRepository(store),
    warehouseActivity: stubWarehouseActivity,
    branchActivity: stubBranchActivity,
    sessions: new DocSessionRepository(store),
    tokens: new DocAuthTokenRepository(store),
    configs: new DocConfigRepository(store),
    notifications: new DocNotificationRepository(store),
    services: new DocServiceRepository(store),
    priceLists: new DocPriceListRepository(store),
    identity,
    strongAuth: noStrongAuth,
    email: new OutboxEmailGateway(store, now),
    throttle: new LoginThrottle(state, now),
    limiter: new RateLimiter(state, now),
    pii: new PiiPolicy(),
    piiLog: new DocPiiAccessLog(store),
    piiSources: { user: userPiiSource },
    caches: {
      auth: new TtlCache<CachedSession>(config.authCacheTtlMs),
      config: new TtlCache<ConfigVersion[]>(config.configCacheTtlMs),
    },
    config,
  };
  return deps;
}

export interface ContainerOptions {
  env?: Env;
  clock?: Clock;
}

/** Composition root: the only place that wires ports to adapters. */
export function createContainer(opts: ContainerOptions = {}): Container {
  const env = opts.env ?? loadEnv();
  const clock = opts.clock ?? systemClock;

  if (env.GMEP_DATA_BACKEND === 'memory') {
    const db = new MemoryDb();
    const identity = new MemoryIdentityProvider();
    const store = new MemoryDocStore(db);
    return {
      env,
      backend: 'memory',
      memory: { db, identity },
      store,
      identity,
      sys: buildSys(env, clock, store, new MemoryUnitOfWork(db), identity),
    };
  }

  const db = getDb(env);
  const store = new FirestoreDocStore(db);
  const identity = new FirebaseIdentityProvider(env);
  return {
    env,
    backend: 'firestore',
    store,
    identity,
    sys: buildSys(env, clock, store, new FirestoreUnitOfWork(db), identity),
  };
}

const g = globalThis as unknown as { __gmepContainer?: Container };

/** Process-wide container (survives Next.js hot reload via globalThis). */
export function getContainer(): Container {
  return (g.__gmepContainer ??= createContainer());
}

/** Tests only: install a container built by the test. */
export function setContainerForTests(c: Container | undefined): void {
  g.__gmepContainer = c;
}
