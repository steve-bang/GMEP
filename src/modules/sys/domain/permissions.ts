import type { Action } from '@/platform/rbac/rbac';

/**
 * Role catalogue and default permission matrix (FR-SYS-013, ba-answers-for-dev §2).
 * This is SEED DATA for the `roles` collection: roles and their permissions are data, changed
 * through the role administration API, never read from this file at runtime.
 * Tags: values marked [Đề xuất BA - chờ xác nhận] / [Cần xác nhận] in the BA document are
 * defaults only. "Hiện" (reveal) of personal data is NOT a permission: see PiiPolicy.
 */
export const ROLE_CODES = ['CH', 'QV', 'QL', 'CV', 'QD', 'TH', 'TK', 'TN', 'KT', 'AD'] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

/** Management roles whose assignment needs the owner (CH) to approve (BA §2.3 `user` approve). */
export const OWNER_APPROVED_ROLES: readonly string[] = ['CH', 'QV', 'QL', 'KT', 'AD'];

/** Roles a branch manager (QL) may assign inside their own branch (BA §2.3, ba-answers-01 Câu 1). */
export const BRANCH_ASSIGNABLE_ROLES: readonly string[] = ['CV', 'QD', 'TH', 'TK', 'TN'];

type Grant = Partial<Record<string, string[]>>;

const g = (resource: string, ...actions: Action[]): [string, Action[]] => [resource, actions];
const flatten = (entries: [string, Action[]][]): string[] =>
  entries.flatMap(([r, as]) => as.map((a) => `${r}:${a}`));

const CH = flatten([
  g('user', 'view', 'create', 'update', 'archive', 'approve', 'reject', 'manage', 'export'),
  g('role', 'view', 'create', 'update', 'approve', 'reject'),
  g('security-policy', 'view', 'update', 'approve', 'reject'),
  g('device', 'view', 'create', 'archive'),
  g('worker-pin', 'manage'),
  g('org', 'view', 'create', 'update', 'archive', 'approve', 'reject'),
  g('branch-config', 'view', 'update', 'approve', 'reject'),
  g('warehouse', 'view', 'create', 'update', 'archive', 'approve', 'reject', 'export'),
  g('service-catalog', 'view', 'create', 'update', 'approve', 'reject'),
  g('price-list', 'view', 'create', 'update', 'approve', 'reject'),
  g('discount-limit', 'view', 'update', 'approve', 'reject'),
  g('discount-program', 'view', 'create', 'update'),
  g('tax-rate', 'view', 'create', 'update', 'approve', 'reject'),
  g('doc-template', 'view', 'create', 'update', 'approve', 'reject'),
  g('numbering-series', 'view', 'update', 'approve', 'reject'),
  g('pii-policy', 'view', 'update', 'approve', 'reject'),
  g('retention-policy', 'view', 'update', 'approve', 'reject'),
  g('audit-log', 'view', 'export'),
  g('access-log', 'view', 'export'),
  g('login-history', 'view', 'export'),
]);

const matrix: Grant = {
  CH,
  QV: flatten([
    g('org', 'view'),
    g('branch-config', 'view'),
    g('warehouse', 'view'),
    g('service-catalog', 'view'),
    g('price-list', 'view'),
    g('discount-limit', 'view', 'update'),
    g('discount-program', 'view', 'create', 'update'),
    g('tax-rate', 'view'),
    g('doc-template', 'view'),
  ]),
  QL: flatten([
    g('user', 'view', 'create', 'update', 'archive', 'manage'),
    g('device', 'view', 'create', 'archive'),
    g('worker-pin', 'manage'),
    g('org', 'view'),
    g('branch-config', 'view', 'update'),
    g('warehouse', 'view', 'update', 'export'),
    g('service-catalog', 'view', 'create', 'update'),
    g('price-list', 'view'),
    g('discount-limit', 'view'),
    g('discount-program', 'view', 'create', 'update'),
    g('tax-rate', 'view'),
    g('doc-template', 'view'),
    g('audit-log', 'view'),
    g('login-history', 'view'),
  ]),
  CV: flatten([
    g('service-catalog', 'view'),
    g('price-list', 'view'),
    g('discount-limit', 'view'),
    g('tax-rate', 'view'),
    g('doc-template', 'view'),
  ]),
  QD: flatten([g('device', 'view'), g('worker-pin', 'manage'), g('service-catalog', 'view')]),
  TH: [],
  TK: flatten([g('warehouse', 'view'), g('price-list', 'view')]),
  TN: flatten([g('doc-template', 'view')]),
  KT: flatten([
    g('warehouse', 'view'),
    g('service-catalog', 'view'),
    g('price-list', 'view'),
    g('discount-limit', 'view'),
    g('tax-rate', 'view', 'create', 'update'),
    g('doc-template', 'view', 'approve', 'reject'),
    g('numbering-series', 'view'),
    g('retention-policy', 'view'),
    g('audit-log', 'view'),
  ]),
  // AD has no approve/reject and no customer data (BA §2.4)
  AD: flatten([
    g('user', 'view', 'create', 'update', 'archive', 'manage'),
    g('role', 'view', 'create', 'update'),
    g('security-policy', 'view', 'update'),
    g('device', 'view', 'create', 'archive'),
    g('org', 'view', 'create', 'update'),
    g('branch-config', 'view', 'update'),
    g('warehouse', 'view', 'create', 'update'),
    g('service-catalog', 'view', 'create', 'update'),
    g('tax-rate', 'view'),
    g('doc-template', 'view', 'create', 'update'),
    g('numbering-series', 'view', 'update'),
    g('pii-policy', 'view', 'update'),
    g('retention-policy', 'view', 'update'),
    g('audit-log', 'view', 'export'),
    g('access-log', 'view'),
    g('login-history', 'view', 'export'),
  ]),
};

export const ROLE_NAMES: Record<RoleCode, string> = {
  CH: 'Chủ garage',
  QV: 'Quản lý vùng',
  QL: 'Quản lý chi nhánh',
  CV: 'Cố vấn dịch vụ',
  QD: 'Quản đốc',
  TH: 'Thợ',
  TK: 'Thủ kho',
  TN: 'Thu ngân',
  KT: 'Kế toán',
  AD: 'Quản trị hệ thống',
};

/** CH and QV may view consolidated data (BA §4); everyone else works in one branch at a time. */
const CONSOLIDATING: readonly string[] = ['CH', 'QV'];

export interface RoleSeed {
  code: RoleCode;
  name: string;
  permissions: string[];
  canConsolidate: boolean;
}

export function defaultRoleSeeds(): RoleSeed[] {
  return ROLE_CODES.map((code) => ({
    code,
    name: ROLE_NAMES[code],
    permissions: [...(matrix[code] ?? [])].sort(),
    canConsolidate: CONSOLIDATING.includes(code),
  }));
}

/** Every resource:action the platform knows; role administration rejects anything else. */
export function knownPermissions(): Set<string> {
  return new Set(defaultRoleSeeds().flatMap((r) => r.permissions));
}
