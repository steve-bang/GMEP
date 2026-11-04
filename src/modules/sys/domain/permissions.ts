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

/**
 * CRM (slice 1.3, FR-CRM-001..017) default grants [Đề xuất BA - chờ xác nhận: Khách]. AD has no
 * customer data (BA §2.4); TH and TK get none until REC/INV define their narrower views.
 * `customer-lookup` = exact cross-branch lookup by plate, vehicle fields only (P2; QĐ has only this);
 * `customer-lookup-customer` = phone lookup and the customer projection (P1; CH, QV, QL, CV, TN, not QĐ, C9); `customer-pii:export` = full personal
 * columns in an export (CH, KT only, with reason and password, BA §9).
 */
const CRM_CH = flatten([
  g('customer', 'view', 'create', 'update', 'export'),
  g('customer-pii', 'export'),
  g('vehicle', 'view', 'create', 'update'),
  g('vehicle-history', 'view'),
  g('consent', 'view', 'create', 'update'),
  g('data-request', 'view', 'create', 'update', 'approve'),
  g('customer-lookup', 'view'),
  g('customer-lookup-customer', 'view'),
]);

/**
 * INV (slice 1.4, FR-INV-001..027) default grants [Đề xuất BA - chờ xác nhận: Khách], from FRD §2:
 * "Danh mục phụ tùng và bảng giá" (TK = S, CH = D, others X) and "Nhập, xuất, kiểm kê kho"
 * (TK = S, QL = D, CH/QV/KT = X, CV/TN/TH/QD/AD = -). CV reads availability only (BA-04 Câu 6):
 * `stock-availability` returns the available quantity, never on-hand, reserved or cost.
 * `stock-cost:view` follows COST_VISIBLE_ROLES. `stock-doc:approve` = post an abnormal document
 * (adjustment, receipt without purchase order, large variance) and reverse a posted one; the poster
 * must be a different person from the creator.
 */
const INV_VIEW: string[] = flatten([
  g('part', 'view'),
  g('stock', 'view'),
  g('stock-doc', 'view'),
  g('stock-availability', 'view'),
  g('part-catalog', 'view'),
]);

const CH = [
  ...flatten([
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
    g('cost-method', 'view', 'update', 'approve', 'reject'),
    g('inventory-policy', 'view', 'update', 'approve', 'reject'),
    g('stock-cost', 'view'),
    g('stock-reservation', 'view'),
    g('part-catalog', 'update', 'approve', 'reject'),
  ]),
  ...CRM_CH,
  ...INV_VIEW,
];

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
    // CRM: aggregated review of the customer base, no editing (BA §9 export rights)
    g('customer', 'view', 'export'),
    g('vehicle', 'view'),
    g('vehicle-history', 'view'),
    g('consent', 'view'),
    g('data-request', 'view'),
    g('customer-lookup', 'view'),
    g('customer-lookup-customer', 'view'),
    g('stock-cost', 'view'),
    g('stock-reservation', 'view'),
    g('inventory-policy', 'view'),
  ]).concat(INV_VIEW),
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
    g('customer', 'view', 'create', 'update', 'export'),
    g('vehicle', 'view', 'create', 'update'),
    g('vehicle-history', 'view'),
    g('consent', 'view', 'create', 'update'),
    g('data-request', 'view', 'create', 'update'),
    g('customer-lookup', 'view'),
    g('customer-lookup-customer', 'view'),
    g('stock-cost', 'view'),
    g('stock-level', 'update'),
    g('stock-reservation', 'view', 'create', 'update'),
    g('stock-doc', 'approve'),
    g('inventory-policy', 'view'),
  ]).concat(INV_VIEW),
  CV: flatten([
    g('service-catalog', 'view'),
    g('price-list', 'view'),
    g('discount-limit', 'view'),
    g('tax-rate', 'view'),
    g('doc-template', 'view'),
    g('customer', 'view', 'create', 'update'),
    g('vehicle', 'view', 'create', 'update'),
    g('vehicle-history', 'view'),
    g('consent', 'view', 'create', 'update'),
    g('data-request', 'view', 'create'),
    g('customer-lookup', 'view'),
    g('customer-lookup-customer', 'view'),
    // read-only catalogue + availability; reservations are made by REC on the advisor's behalf
    g('part', 'view'),
    g('stock-availability', 'view'),
    g('stock-reservation', 'create', 'update'),
  ]),
  QD: flatten([
    g('device', 'view'),
    g('worker-pin', 'manage'),
    g('service-catalog', 'view'),
    g('customer', 'view'),
    g('vehicle', 'view'),
    g('vehicle-history', 'view'),
    g('customer-lookup', 'view'),
  ]),
  TH: [],
  TK: flatten([
    g('warehouse', 'view'),
    g('price-list', 'view'),
    g('part', 'create', 'update', 'archive'),
    g('part-catalog', 'update'),
    g('stock-level', 'update'),
    g('stock-doc', 'create', 'update'),
    g('stock-reservation', 'view', 'create', 'update'),
  ]).concat(INV_VIEW),
  TN: flatten([
    g('doc-template', 'view'),
    g('customer', 'view'),
    g('vehicle', 'view'),
    g('customer-lookup', 'view'),
    g('customer-lookup-customer', 'view'),
  ]),
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
    g('customer', 'view', 'export'),
    g('customer-pii', 'export'),
    g('vehicle', 'view'),
    g('vehicle-history', 'view'),
    g('consent', 'view'),
    g('stock-cost', 'view'),
    g('cost-method', 'view', 'update'),
    g('inventory-policy', 'view'),
  ]).concat(INV_VIEW),
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
