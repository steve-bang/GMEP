import type { AuditLog } from '@/platform/audit/audit';
import type { Clock } from '@/platform/time/clock';
import type { IdempotencyStore } from '@/platform/idempotency/idempotency';
import type { UnitOfWork } from '@/platform/tx/unitOfWork';
import type {
  BranchRepository,
  IdentityProvider,
  RoleAssignmentRepository,
  RoleRepository,
  SessionRepository,
  StrongAuthPort,
  UserRepository,
  WarehouseRepository,
} from './ports';

export interface SysConfig {
  sessionTtlMs: number;
  sessionIdleMs: number;
  idempotencyTtlMs: number;
}

/** Everything the SYS use cases need, injected by the composition root. */
export interface SysDeps {
  uow: UnitOfWork;
  clock: Clock;
  newId: () => string;
  audit: AuditLog;
  idempotency: IdempotencyStore;
  users: UserRepository;
  roles: RoleRepository;
  assignments: RoleAssignmentRepository;
  branches: BranchRepository;
  warehouses: WarehouseRepository;
  sessions: SessionRepository;
  identity: IdentityProvider;
  strongAuth: StrongAuthPort;
  config: SysConfig;
}
