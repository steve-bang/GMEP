import { randomUUID } from 'node:crypto';
import { TtlCache } from '@/platform/cache/ttlCache';
import { loadEnv, type Env } from '@/platform/config/env';
import {
  createOidcCronVerifier,
  disabledCronAuth,
  type CronAuthVerifier,
  type JwksSource,
} from '@/platform/auth/cronAuth';
import { googleJwksSource } from '@/infrastructure/auth/googleJwks';
import { NumberingService } from '@/platform/numbering/numbering';
import { PiiPolicy } from '@/platform/pii/pii';
import { DocAtomicStateStore, LoginThrottle, RateLimiter } from '@/platform/ratelimit/ratelimit';
import type { DocStore, StoreStats } from '@/platform/store/docStore';
import { systemClock, type Clock } from '@/platform/time/clock';
import type { UnitOfWork } from '@/platform/tx/unitOfWork';
import { accApprovalHandlers, type AccDeps } from '@/modules/acc';
import type { EinDeps } from '@/modules/ein';
import {
  buildCustomerImport,
  customerPiiSource,
  DEFAULT_CRM_CONFIG,
  type CrmDeps,
} from '@/modules/crm';
import {
  buildOpeningStockImport,
  buildPartImport,
  DEFAULT_INV_CONFIG,
  invWarehouseActivity,
  type InvDeps,
} from '@/modules/inv';
import {
  DEFAULT_REC_CONFIG,
  recCustomerRetention,
  recOrderAdvisors,
  type RecDeps,
} from '@/modules/rec';
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
import { accPaymentGate, buildAcc } from './accWiring';
import { buildEin, einInvoiceGate } from './einWiring';
import { buildRpt } from './rptWiring';
import type { RptDeps } from '@/modules/rpt';
import { FakeProvider } from '@/infrastructure/einvoice/fakeProvider';
import { PdfLibRenderer } from '@/infrastructure/pdf/pdfLibRenderer';
import type { PdfRenderer } from '@/platform/print/types';
import { MemoryFileStore } from '@/infrastructure/files/memoryFileStore';
import { FirebaseFileStore } from '@/infrastructure/files/firebaseFileStore';
import type { FileStore } from '@/platform/files/fileStore';
import { noStrongAuth } from '@/infrastructure/auth/noStrongAuth';
import { rootLogger } from '@/platform/logging/logger';
import { OutboxEmailGateway } from '@/infrastructure/email/outboxEmailGateway';
import { SmtpEmailGateway } from '@/infrastructure/email/smtpEmailGateway';
import {
  ChannelMessageGateway,
  EmailChannelAdapter,
  OutboxChannelAdapter,
} from '@/infrastructure/messaging/messageGateway';
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
import {
  DocConsentRepository,
  DocCustomerRepository,
  DocDataRequestRepository,
  DocOwnershipRepository,
  DocVehicleHistoryRepository,
  DocVehicleRepository,
} from '@/infrastructure/repos/crmRepos';
import {
  DocIssueReturnRepository,
  DocMovementRepository,
  DocPartRepository,
  DocReservationRepository,
  DocStockBalanceRepository,
  DocStockDocumentRepository,
} from '@/infrastructure/repos/invRepos';
import { DocApprovalRepository } from '@/infrastructure/repos/approvalRepos';
import { DocImportBatchRepository } from '@/infrastructure/repos/importRepos';
import {
  DocIntakeRepository,
  DocPartRequestRepository,
  DocQuoteLinkRepository,
  DocQuoteOtpRepository,
  DocQuoteDeliveryRepository,
  DocQuoteRepository,
  DocQuoteVersionRepository,
  DocRepairItemRepository,
  DocRepairOrderRepository,
} from '@/infrastructure/repos/recRepos';
import {
  combineRetention,
  noOrderAdvisors,
  stubBranchActivity,
  stubCustomerRetention,
} from '@/infrastructure/stubs';

export interface Container {
  env: Env;
  backend: 'firestore' | 'memory';
  sys: SysDeps;
  crm: CrmDeps;
  inv: InvDeps;
  rec: RecDeps;
  acc: AccDeps;
  ein: EinDeps;
  rpt: RptDeps;
  /** the only e-invoice adapter built; tests and the local demo script its failures */
  fakeProvider: FakeProvider;
  /** server-side PDF of the print models (quote, receipt); pure JS, no headless browser */
  pdf: PdfRenderer;
  store: DocStore & { stats: StoreStats };
  identity: IdentityProvider & {
    calls: { signIn: number; createCookie: number; verify: number; revoke: number };
  };
  /** verifies Cloud Scheduler OIDC bearer tokens for the internal cron route; always false when OIDC is not configured */
  cronAuth: CronAuthVerifier;
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
    importMaxBytes: 5 * 1024 * 1024,
    importMaxRows: 2000,
    importAbandonedDays: 7,
    importStaleCommitMinutes: 15,
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
  inv: { get: () => InvDeps },
): SysDeps {
  const config = sysConfigFromEnv(env);
  const now = () => clock.now();
  // the dev outbox stores live single-use links in plain text: never in prod (loadEnv also demands SMTP there)
  if (env.GMEP_ENV === 'prod' && !env.EMAIL_SMTP_URL)
    throw new Error('GMEP_ENV=prod needs EMAIL_SMTP_URL and EMAIL_FROM.');
  const email =
    env.EMAIL_SMTP_URL && env.EMAIL_FROM
      ? SmtpEmailGateway.fromConfig({ url: env.EMAIL_SMTP_URL, from: env.EMAIL_FROM })
      : new OutboxEmailGateway(store, now);
  if (env.GMEP_ENV === 'staging' && env.MESSAGE_DEV_CHANNELS)
    rootLogger.warn(
      { channels: env.MESSAGE_DEV_CHANNELS },
      'MESSAGE_DEV_CHANNELS is set on staging: sms/zalo messages are only written to the dev outbox and reach nobody',
    );
  // A4: email always has an adapter; sms and zalo only when a (dev) adapter is configured, so the UI never offers a dead channel
  const messages = new ChannelMessageGateway({
    email: new EmailChannelAdapter(email, !(env.EMAIL_SMTP_URL && env.EMAIL_FROM)),
    ...Object.fromEntries(
      (env.MESSAGE_DEV_CHANNELS?.split(',') ?? []).map((c) => [
        c,
        new OutboxChannelAdapter(c as 'sms' | 'zalo', store, now),
      ]),
    ),
  });
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
    // INV owns the facts a warehouse is deactivated on (late-bound: SYS is built first)
    warehouseActivity: invWarehouseActivity(() => inv.get()),
    branchActivity: stubBranchActivity,
    sessions: new DocSessionRepository(store),
    tokens: new DocAuthTokenRepository(store),
    configs: new DocConfigRepository(store),
    notifications: new DocNotificationRepository(store),
    approvals: new DocApprovalRepository(store),
    approvalHandlers: new Map(),
    imports: new DocImportBatchRepository(store),
    importHandlers: new Map(),
    services: new DocServiceRepository(store),
    priceLists: new DocPriceListRepository(store),
    identity,
    strongAuth: noStrongAuth,
    email,
    messages,
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

/** CRM use cases share the SYS transaction, audit, numbering and PII services (slice 1.3). */
function buildCrm(sys: SysDeps, store: DocStore): CrmDeps {
  const crm: CrmDeps = {
    sys,
    customers: new DocCustomerRepository(store),
    vehicles: new DocVehicleRepository(store),
    ownerships: new DocOwnershipRepository(store),
    consents: new DocConsentRepository(store),
    requests: new DocDataRequestRepository(store),
    history: new DocVehicleHistoryRepository(store),
    retention: stubCustomerRetention,
    crm: { ...DEFAULT_CRM_CONFIG, consentPolicyVersion: sys.config.consentPolicyVersion },
  };
  sys.piiSources.customer = customerPiiSource(() => crm);
  return crm;
}

/** INV use cases share the SYS transaction, audit, numbering and config services (slice 1.4). */
function buildInv(sys: SysDeps, store: DocStore, env: Env, invoices: InvDeps['invoices']): InvDeps {
  return {
    sys,
    parts: new DocPartRepository(store),
    balances: new DocStockBalanceRepository(store),
    movements: new DocMovementRepository(store),
    documents: new DocStockDocumentRepository(store),
    reservations: new DocReservationRepository(store),
    returns: new DocIssueReturnRepository(store),
    // a copy per container: tests flip flags without touching the shared default
    inv: { ...DEFAULT_INV_CONFIG, allowTransferOrderSource: env.GMEP_ENV === 'local' },
    // I15: replaced by REC's order lookup in `buildRec`; nobody is returned until REC is wired
    advisors: noOrderAdvisors,
    invoices,
  };
}

/** REC use cases read CRM and INV through their public surfaces only (slice 1.5). */
function buildRec(
  sys: SysDeps,
  crm: CrmDeps,
  inv: InvDeps,
  store: DocStore,
  getAcc: () => AccDeps,
  invoices: RecDeps['invoices'],
  files: FileStore,
): RecDeps {
  const rec: RecDeps = {
    sys,
    crm,
    inv,
    intakes: new DocIntakeRepository(store),
    quotes: new DocQuoteRepository(store),
    versions: new DocQuoteVersionRepository(store),
    links: new DocQuoteLinkRepository(store),
    otps: new DocQuoteOtpRepository(store),
    deliveries: new DocQuoteDeliveryRepository(store),
    orders: new DocRepairOrderRepository(store),
    items: new DocRepairItemRepository(store),
    partRequests: new DocPartRequestRepository(store),
    payments: accPaymentGate(getAcc),
    invoices,
    files,
    rec: { ...DEFAULT_REC_CONFIG, approval: { ...DEFAULT_REC_CONFIG.approval } },
  };
  // C17: REC joins the data-retention gate of CRM; the stub still stands for modules not built yet
  inv.advisors = recOrderAdvisors(() => rec);
  crm.retention = combineRetention(
    recCustomerRetention(() => rec),
    stubCustomerRetention,
  );
  return rec;
}

export interface ContainerOptions {
  env?: Env;
  clock?: Clock;
  /** tests: signing keys of the fake OIDC issuer (default: Google's published keys) */
  cronKeys?: JwksSource;
}

/** Composition root: the only place that wires ports to adapters. */
export function createContainer(opts: ContainerOptions = {}): Container {
  const env = opts.env ?? loadEnv();
  const clock = opts.clock ?? systemClock;
  const late: {
    inv?: InvDeps;
    acc?: AccDeps;
    rec?: RecDeps;
    crm?: CrmDeps;
    ein?: EinDeps;
  } = {};
  const cronAuth: CronAuthVerifier =
    env.CRON_OIDC_AUDIENCE && env.CRON_OIDC_SERVICE_ACCOUNT
      ? createOidcCronVerifier({
          audience: env.CRON_OIDC_AUDIENCE,
          serviceAccount: env.CRON_OIDC_SERVICE_ACCOUNT,
          keys: opts.cronKeys ?? googleJwksSource(),
          clock,
        })
      : disabledCronAuth;
  const fakeProvider = new FakeProvider(() => clock.now());

  const assemble = (
    store: DocStore,
    uow: UnitOfWork,
    identity: IdentityProvider,
    files: FileStore,
  ): {
    sys: SysDeps;
    crm: CrmDeps;
    inv: InvDeps;
    rec: RecDeps;
    acc: AccDeps;
    ein: EinDeps;
    rpt: RptDeps;
    fakeProvider: FakeProvider;
  } => {
    const sys = buildSys(env, clock, store, uow, identity, { get: () => late.inv! });
    // R75: EIN is built last; the gate reads it lazily
    const invoiceGate = einInvoiceGate(() => late.ein!);
    const inv = (late.inv = buildInv(sys, store, env, invoiceGate));
    const crm = (late.crm = buildCrm(sys, store));
    const rec = (late.rec = buildRec(sys, crm, inv, store, () => late.acc!, invoiceGate, files));
    const acc = (late.acc = buildAcc(sys, store, () => late.rec!, invoiceGate));
    // FR-SYS-007: the module that owns a kind of imported data registers what commit and undo do
    for (const h of [
      buildCustomerImport(() => late.crm!),
      buildPartImport(() => late.inv!),
      buildOpeningStockImport(() => late.inv!),
    ])
      sys.importHandlers.set(h.kind, h);
    // FR-SYS-004: the module that owns an approval kind registers what a decision does (same transaction)
    for (const [kind, h] of Object.entries(accApprovalHandlers(() => late.acc!)))
      sys.approvalHandlers.set(kind, h);
    const ein = (late.ein = buildEin(
      sys,
      store,
      () => late.rec!,
      () => late.crm!,
      files,
      fakeProvider,
    ));
    const rpt = buildRpt(
      sys,
      store,
      () => late.rec!,
      () => late.acc!,
      () => late.ein!,
      () => late.inv!,
    );
    return { sys, crm, inv, rec, acc, ein, rpt, fakeProvider };
  };

  if (env.GMEP_DATA_BACKEND === 'memory') {
    const db = new MemoryDb();
    const identity = new MemoryIdentityProvider();
    // emergency switch for the Firestore read-before-write rule (on by default)
    const store = new MemoryDocStore(db, {
      enforceReadsBeforeWrites: process.env.GMEP_MEMORY_TX_ORDER_GUARD !== 'off',
    });
    return {
      env,
      cronAuth,
      pdf: new PdfLibRenderer(() => clock.now()),
      backend: 'memory',
      memory: { db, identity },
      store,
      identity,
      ...assemble(store, new MemoryUnitOfWork(db), identity, new MemoryFileStore()),
    };
  }

  const db = getDb(env);
  const store = new FirestoreDocStore(db);
  const identity = new FirebaseIdentityProvider(env);
  return {
    env,
    cronAuth,
    pdf: new PdfLibRenderer(() => clock.now()),
    backend: 'firestore',
    store,
    identity,
    ...assemble(store, new FirestoreUnitOfWork(db), identity, new FirebaseFileStore(env)),
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
