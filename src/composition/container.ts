import { randomUUID } from 'node:crypto';
import { loadEnv, type Env } from '@/platform/config/env';
import { systemClock, type Clock } from '@/platform/time/clock';
import type { SysDeps } from '@/modules/sys';
import { noStrongAuth } from '@/infrastructure/auth/noStrongAuth';
import { getDb } from '@/infrastructure/firestore/client';
import {
  FirestoreAuditLog,
  FirestoreBranchRepository,
  FirestoreIdempotencyStore,
  FirestoreRoleAssignmentRepository,
  FirestoreRoleRepository,
  FirestoreSessionRepository,
  FirestoreUnitOfWork,
  FirestoreUserRepository,
  FirestoreWarehouseRepository,
} from '@/infrastructure/firestore/repositories';
import { FirebaseIdentityProvider } from '@/infrastructure/identity/firebaseIdentity';
import {
  MemoryAuditLog,
  MemoryBranchRepository,
  MemoryDb,
  MemoryIdempotencyStore,
  MemoryIdentityProvider,
  MemoryRoleAssignmentRepository,
  MemoryRoleRepository,
  MemorySessionRepository,
  MemoryUnitOfWork,
  MemoryUserRepository,
  MemoryWarehouseRepository,
} from '@/infrastructure/memory/memory';

export interface Container {
  env: Env;
  backend: 'firestore' | 'memory';
  sys: SysDeps;
  /** present only for the in-memory backend (tests) */
  memory?: { db: MemoryDb; identity: MemoryIdentityProvider };
}

/** Composition root: the only place that wires ports to adapters. */
export function createContainer(opts: { env?: Env; clock?: Clock } = {}): Container {
  const env = opts.env ?? loadEnv();
  const clock = opts.clock ?? systemClock;
  const config = {
    sessionTtlMs: env.SESSION_TTL_HOURS * 3_600_000,
    sessionIdleMs: env.SESSION_IDLE_MINUTES * 60_000,
    idempotencyTtlMs: env.IDEMPOTENCY_TTL_HOURS * 3_600_000,
  };

  if (env.GMEP_DATA_BACKEND === 'memory') {
    const db = new MemoryDb();
    const identity = new MemoryIdentityProvider();
    return {
      env,
      backend: 'memory',
      memory: { db, identity },
      sys: {
        uow: new MemoryUnitOfWork(db),
        clock,
        newId: randomUUID,
        audit: new MemoryAuditLog(db),
        idempotency: new MemoryIdempotencyStore(db),
        users: new MemoryUserRepository(db),
        roles: new MemoryRoleRepository(db),
        assignments: new MemoryRoleAssignmentRepository(db),
        branches: new MemoryBranchRepository(db),
        warehouses: new MemoryWarehouseRepository(db),
        sessions: new MemorySessionRepository(db),
        identity,
        strongAuth: noStrongAuth,
        config,
      },
    };
  }

  const db = getDb(env);
  return {
    env,
    backend: 'firestore',
    sys: {
      uow: new FirestoreUnitOfWork(db),
      clock,
      newId: randomUUID,
      audit: new FirestoreAuditLog(db),
      idempotency: new FirestoreIdempotencyStore(db),
      users: new FirestoreUserRepository(db),
      roles: new FirestoreRoleRepository(db),
      assignments: new FirestoreRoleAssignmentRepository(db),
      branches: new FirestoreBranchRepository(db),
      warehouses: new FirestoreWarehouseRepository(db),
      sessions: new FirestoreSessionRepository(db),
      identity: new FirebaseIdentityProvider(env),
      strongAuth: noStrongAuth,
      config,
    },
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
