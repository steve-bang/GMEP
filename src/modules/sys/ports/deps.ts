import type { AuditLog } from '@/platform/audit/audit';
import type { TtlCache } from '@/platform/cache/ttlCache';
import type { Clock } from '@/platform/time/clock';
import type { IdempotencyStore } from '@/platform/idempotency/idempotency';
import type { NumberingService } from '@/platform/numbering/numbering';
import type { PiiAccessLog, PiiPolicy } from '@/platform/pii/pii';
import type { LoginThrottle, RateLimiter } from '@/platform/ratelimit/ratelimit';
import type { UnitOfWork } from '@/platform/tx/unitOfWork';
import type { Actor } from '@/platform/rbac/rbac';
import type { BRANCH_STATE_RULES } from '../domain/branchState';
import type { ConfigVersion } from '../domain/config';
import type { PasswordPolicy } from '../domain/passwordPolicy';
import type { SessionPolicy } from '../domain/sessionPolicy';
import type { SessionRecord, User } from '../domain/entities';
import type {
  AuthTokenRepository,
  BranchActivityPort,
  PiiSource,
  BranchRepository,
  TenantRepository,
  ConfigRepository,
  EmailGateway,
  MessageGateway,
  IdentityProvider,
  NotificationRepository,
  PriceListRepository,
  RoleAssignmentRepository,
  RoleRepository,
  ApprovalHandler,
  ImportBatchRepository,
  ImportKindHandler,
  ApprovalRepository,
  ServiceRepository,
  SessionRepository,
  StrongAuthPort,
  UserRepository,
  WarehouseActivityPort,
  WarehouseRepository,
} from './ports';

/** Configuration that is policy, not business rule: every value has a documented default. */
export interface SysConfig {
  sessionPolicy: SessionPolicy;
  idempotencyTtlMs: number;
  passwordPolicy: PasswordPolicy;
  /** FR-SYS-001 / ADR §6.3: reset link 30 min, invitation 72 h */
  resetTokenTtlMs: number;
  inviteTokenTtlMs: number;
  /** H1: how long a verified session / actor may be served from memory (max staleness of revocation) */
  authCacheTtlMs: number;
  /** effective-config read cache (resolveAt) */
  configCacheTtlMs: number;
  /** minimum interval between persisted lastSeenAt writes */
  sessionTouchIntervalMs: number;
  /** base URL used in email links */
  appBaseUrl: string;
  branchStateRules: typeof BRANCH_STATE_RULES;
  /** BA §9: synchronous export limits [Đề xuất BA - chờ xác nhận: Chủ dự án] */
  exportMaxRows: number;
  /** FR-SYS-007 import limits [Cần xác nhận: Khách]: file size and data rows per file */
  importMaxBytes: number;
  importMaxRows: number;
  /** R99: a validated batch never committed is discarded (staged rows deleted) after this many days; default 7 */
  importAbandonedDays: number;
  /** a batch stuck in `committing` longer than this many minutes (instance stopped) may be resumed or undone; default 15 */
  importStaleCommitMinutes: number;
  /** notifications: hidden in the bell after / deleted after (BA §8.1) */
  notificationBellDays: number;
  notificationRetentionDays: number;
  /** version of the usage policy the invitee consents to; content supplied by the client */
  consentPolicyVersion: string;
}

export interface CachedSession {
  session: SessionRecord;
  user: User;
  actor: Actor;
  idleMs: number;
  /** last persisted touch, to throttle writes */
  touchedAt: number;
}

export interface SysCaches {
  auth: TtlCache<CachedSession>;
  config: TtlCache<ConfigVersion[]>;
}

/** Everything the SYS use cases need, injected by the composition root. */
export interface SysDeps {
  uow: UnitOfWork;
  clock: Clock;
  newId: () => string;
  audit: AuditLog;
  idempotency: IdempotencyStore;
  numbering: NumberingService;
  users: UserRepository;
  roles: RoleRepository;
  assignments: RoleAssignmentRepository;
  tenants: TenantRepository;
  branches: BranchRepository;
  warehouses: WarehouseRepository;
  warehouseActivity: WarehouseActivityPort;
  branchActivity: BranchActivityPort;
  piiSources: Record<string, PiiSource>;
  sessions: SessionRepository;
  tokens: AuthTokenRepository;
  configs: ConfigRepository;
  notifications: NotificationRepository;
  approvals: ApprovalRepository;
  /** FR-SYS-004: effects of a decision, per approval kind (filled by the composition root) */
  approvalHandlers: Map<string, ApprovalHandler>;
  /** FR-SYS-007: batches and, per kind, what CRM/INV do on commit and undo (filled by the composition root) */
  imports: ImportBatchRepository;
  importHandlers: Map<string, ImportKindHandler>;
  services: ServiceRepository;
  priceLists: PriceListRepository;
  identity: IdentityProvider;
  strongAuth: StrongAuthPort;
  email: EmailGateway;
  /** A4: customer messages over sms, zalo or email; availability derives from configuration */
  messages: MessageGateway;
  throttle: LoginThrottle;
  limiter: RateLimiter;
  pii: PiiPolicy;
  piiLog: PiiAccessLog;
  caches: SysCaches;
  config: SysConfig;
}
