/**
 * Platform roles (FR-TEN-011): platform staff belong to no tenant and are separate from the 10 tenant roles.
 * The matrix is DATA ([Cần xác nhận: Chủ dự án, Q24]); nothing here grants access to a tenant's business data:
 * `tenant-data:view` is held by no platform role (only a consented support session in MT-1, RULE-022).
 */

export const PLATFORM_ROLES = ['CNT', 'QTN', 'HTN', 'VHB'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export type PlatformPermission =
  | 'tenant:view'
  | 'tenant:provision'
  | 'tenant:transition'
  | 'tenant:transition-approve'
  | 'tenant:terms-record'
  /** owner decision 07/11/2026: reissue the six-digit tenant code when it leaked (reason required, platform audit) */
  | 'tenant:code-reissue'
  | 'platform-config:manage'
  | 'plan:manage'
  | 'billing:manage'
  | 'platform-audit:view'
  | 'support-session:open'
  /** reserved: no role holds it */
  | 'tenant-data:view';

export const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRole, readonly PlatformPermission[]> = {
  // Chủ nền tảng: owner, approves the sensitive steps
  CNT: [
    'tenant:view',
    'tenant:provision',
    'tenant:transition',
    'tenant:transition-approve',
    'tenant:terms-record',
    'tenant:code-reissue',
    'platform-config:manage',
    'plan:manage',
    'platform-audit:view',
  ],
  // Quản trị nền tảng: does the work, proposes state changes, cannot approve them
  QTN: [
    'tenant:view',
    'tenant:provision',
    'tenant:transition',
    'tenant:terms-record',
    'tenant:code-reissue',
    'platform-config:manage',
    'plan:manage',
    'platform-audit:view',
  ],
  // Hỗ trợ nền tảng: profile only; support sessions come with MT-1
  HTN: ['tenant:view', 'platform-audit:view', 'support-session:open'],
  // Vận hành billing: commercial data only (MT-3)
  VHB: ['tenant:view', 'billing:manage'],
};

export type PlatformIdentityStatus = 'active' | 'disabled';

/** Identity of platform staff: its own zone, never an `identities` / tenant `users` record (FR-TEN-011). */
export interface PlatformIdentity {
  /** identity-provider uid */
  id: string;
  /** normalised, unique across platform AND tenant zones (one `userKeys` slot) */
  email: string;
  displayName: string;
  role: PlatformRole;
  status: PlatformIdentityStatus;
  createdAt: Date;
  createdBy: string;
}

export interface PlatformActor {
  kind: 'platform';
  platformUserId: string;
  role: PlatformRole;
  displayName: string;
}

/** The system itself (provisioning job, cron). Never a human, never holds platform permissions. */
export interface SystemActor {
  kind: 'system';
  /** short label stored as actor id, e.g. `system:provisioning` */
  id: string;
}

export const platformHas = (a: PlatformActor, p: PlatformPermission): boolean =>
  PLATFORM_ROLE_PERMISSIONS[a.role].includes(p);

/** Platform audit entry (FR-TEN-013): immutable, separate from tenant audit, no personal data of tenant customers. */
export interface PlatformAuditEntry {
  id: string;
  at: Date;
  actorId: string;
  actorRole: PlatformRole | 'system';
  action: string;
  tenantId: string | null;
  reason?: string;
  /** second person of a two-person step (RULE-027) */
  approverId?: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  requestId: string;
}
