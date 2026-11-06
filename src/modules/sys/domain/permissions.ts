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
 * `customer-lookup-customer` = phone lookup and the customer projection (P1; CH, QL, CV, TN; not QV (C21) and not QĐ (C9));
 * `vehicle-history-cross` = reading the vehicle history of a vehicle OUTSIDE the actor's scope (P3; CH, CV, QL, QĐ only, C20),
 * separate from `vehicle-history:view` (history inside the actor's scope: also QV, KT); `customer-pii:export` = full personal
 * columns in an export (CH, KT only, with reason and password, BA §9).
 */
const CRM_CH = flatten([
  g('customer', 'view', 'create', 'update', 'export'),
  g('customer-pii', 'export'),
  g('vehicle', 'view', 'create', 'update'),
  g('vehicle-history', 'view'),
  g('vehicle-history-cross', 'view'),
  g('consent', 'view', 'create', 'update'),
  g('consent-evidence', 'view', 'update', 'approve', 'reject'),
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

/**
 * REC (slice 1.5, FR-REC-001..007) default grants [Đề xuất BA - chờ xác nhận: Khách], from FRD §2
 * "Báo giá và lệnh sửa chữa" (QL = D, CV = S, others X) and the G2-QUO-01 role column: CV and QL
 * write (the design shows "Lập báo giá" for both), CH, QV, QĐ, TK, TN and KT read quotes. `intake`
 * (hồ sơ tiếp nhận) follows the same pattern for CV and QL; CH, QV, QĐ and TN read. `quote:approve`
 * records the customer's approval at the counter (CV and QL; slice 1.5 approval, QUO-05). TH sees only their own work
 * (Xn) so gets neither resource here.
 */
const REC_S = flatten([
  g('intake', 'view', 'create', 'update'),
  // `quote:approve` = record the customer's approval at the counter (FR-REC-009, 026; QUO-05 lists CV)
  g('quote', 'view', 'create', 'update', 'approve'),
]);
const REC_VIEW_QUOTE = flatten([g('quote', 'view')]);
const REC_VIEW_ALL = flatten([g('intake', 'view'), g('quote', 'view')]);

/**
 * REC slice 1.6 (repair order and execution) default grants [Đề xuất dev - chờ xác nhận: BA/Khách], from FRD §2
 * "Báo giá và lệnh sửa chữa" and the G2-REC / G2-TEC / G2-DLV role columns.
 *  - `repair-order`: view; create = "Tạo lệnh" fallback (R37); update = pause/resume, assign via items, send to QC, handover prep;
 *    archive = cancel an order (FR-REC-021); approve = cancel an order whose parts were issued (manager).
 *  - `repair-item`: view; update = start/pause/finish/undo (a role without `manage` only touches items assigned to it, FR-REC-013);
 *    manage = assign and change the technician (FR-REC-012), see every item.
 *  - `part-request`: create = ask for parts on an approved line; update = issue or refuse (storekeeper, manager).
 *  - `work-proposal`: create = technician's proposal for work outside the quote (FR-REC-014); update = turn into a supplementary quote or dismiss.
 *  - `qc-record`: create = run the quality check (FR-REC-016). `vehicle-handover`: create = hand the vehicle over (FR-REC-017).
 * TH sees only their own work (Xn).
 */
/** R104: hiding a wrongly uploaded intake/order photo (with a reason, audited; the file is kept): branch manager and owner only */
const PHOTO_HIDE = flatten([g('rec-photo', 'update')]);
const ORD_VIEW = flatten([
  g('repair-order', 'view'),
  g('repair-item', 'view'),
  g('part-request', 'view'),
  g('work-proposal', 'view'),
  g('qc-record', 'view'),
  g('vehicle-handover', 'view'),
]);
const ORD_QL = flatten([
  g('rec-photo', 'update'),
  g('repair-order', 'view', 'create', 'update', 'archive', 'approve'),
  g('repair-item', 'view', 'update', 'manage'),
  g('part-request', 'view', 'create', 'update'),
  g('work-proposal', 'view', 'create', 'update'),
  g('qc-record', 'view', 'create'),
  g('vehicle-handover', 'view', 'create'),
]);
const ORD_CV = flatten([
  g('repair-order', 'view', 'create', 'update', 'archive'),
  g('repair-item', 'view', 'manage'),
  g('part-request', 'view', 'create'),
  g('work-proposal', 'view', 'create', 'update'),
  g('qc-record', 'view'),
  g('vehicle-handover', 'view', 'create'),
]);
const ORD_QD = flatten([
  g('repair-order', 'view', 'update'),
  g('repair-item', 'view', 'update', 'manage'),
  g('part-request', 'view', 'create'),
  g('work-proposal', 'view', 'create', 'update'),
  g('qc-record', 'view', 'create'),
  g('vehicle-handover', 'view'),
]);
const ORD_TH = flatten([
  g('repair-item', 'view', 'update'),
  g('part-request', 'view', 'create'),
  g('work-proposal', 'view', 'create'),
]);
const ORD_TK = flatten([
  g('repair-order', 'view'),
  g('repair-item', 'view'),
  g('part-request', 'view', 'update'),
]);
const ORD_TN = flatten([g('repair-order', 'view'), g('vehicle-handover', 'view')]);

/**
 * ACC slice 1.7 (receipts, deposits, cashbook, shifts, day close, debt) and SYS-004 approvals, default grants
 * [Đề xuất dev - chờ xác nhận: BA/Khách] from FRD §2 "Thu tiền và sổ quỹ" (TN = S, QL = D, CH/QV/CV/KT = X).
 *  - `payment`: view; create = collect a receipt or a deposit; archive = ask to reverse a posted payment (RULE-010); export.
 *  - `cash-expense`: view; create = a cash payment voucher or the request for one over the limit (RULE-011).
 *  - `cash-shift`: view; create = open; update = close (count the drawer). `cash-day`: view; update = close the day.
 *  - `cashbook`: view the cash book. `order-balance`: view what an order owes (advisors need it at handover).
 *  - `debt`: view; create = ask for an approved debt at handover (FR-ACC-006, R44).
 *  - `approval`: view the queue; `approval-l1` / `approval-l2`: decide a request of that level (not one's own).
 *  - `acc-policy`, `approval-limit`: effective-dated configuration. `quote-verbal-over-limit:approve`: R48.
 */
const ACC_VIEW_ALL = flatten([
  g('payment', 'view'),
  g('cash-expense', 'view'),
  g('cash-shift', 'view'),
  g('cash-day', 'view'),
  g('cashbook', 'view'),
  g('order-balance', 'view'),
  g('debt', 'view'),
  g('approval', 'view'),
]);
const ACC_TN = flatten([
  g('payment', 'view', 'create', 'archive'),
  g('cash-expense', 'view', 'create'),
  g('cash-shift', 'view', 'create', 'update'),
  g('cash-day', 'view'),
  g('cashbook', 'view'),
  g('order-balance', 'view'),
  g('debt', 'view'),
  g('approval', 'view'),
]);
const ACC_QL = flatten([
  g('payment', 'view', 'create', 'archive'),
  g('cash-expense', 'view', 'create'),
  g('cash-shift', 'view', 'create', 'update'),
  g('cash-day', 'view', 'update'),
  g('cashbook', 'view'),
  g('order-balance', 'view'),
  g('debt', 'view', 'create'),
  g('approval', 'view'),
  g('approval-l1', 'approve', 'reject'),
  g('acc-policy', 'view'),
  g('approval-limit', 'view'),
  g('quote-verbal-over-limit', 'approve'),
]);
const ACC_CV = flatten([
  g('payment', 'view'),
  g('order-balance', 'view'),
  g('debt', 'view', 'create'),
  g('approval', 'view'),
]);
const ACC_CH = [
  ...ACC_VIEW_ALL,
  ...flatten([
    // FR-SYS-033: only the owner edits delegations; everyone with the queue may read their own (see use case)
    g('approval-delegation', 'view', 'update'),
    g('cash-day', 'update'),
    g('approval-l1', 'approve', 'reject'),
    g('approval-l2', 'approve', 'reject'),
    g('acc-policy', 'view', 'update', 'approve', 'reject'),
    g('approval-limit', 'view', 'update', 'approve', 'reject'),
    g('quote-verbal-over-limit', 'approve'),
  ]),
];
const ACC_KT = [
  ...ACC_VIEW_ALL,
  ...flatten([
    g('payment', 'export'),
    g('acc-policy', 'view', 'update'),
    g('approval-limit', 'view'),
  ]),
];

/**
 * EIN slice 1.8 (e-invoice) default grants [Đề xuất dev - chờ xác nhận: BA/Khách], from the G4-EIN role columns
 * (TN, KT = S; CH, QV, QL = X; AD only the technical connection) and FR-EIN-007 (the "chief accountant" is a right of KT,
 * not a role: `invoice:approve`). By default only CH holds it; the owner gives it to the chief accountant through role
 * administration (open question R70).
 *  - `invoice`: view lists and details and files; create = issue from an order; approve = decide an adjust / replace / cancel.
 *  - `invoice-queue`: view the error queue (not AD, who would see buyer data); update = retry, fix the buyer, cancel a request, sync.
 *  - `invoice-correction:create`: propose adjust / replace / cancel and run the approved one. `invoice-report:create`: the cashier tells KT.
 *  - `invoice-technical:view`: the idempotency key and attempts. `einvoice-config`: issuer and policy (effective-dated config).
 */
const EIN_VIEW = flatten([g('invoice', 'view'), g('invoice-queue', 'view')]);
const EIN_TN = flatten([g('invoice', 'view', 'create'), g('invoice-report', 'create')]);
const EIN_KT = flatten([
  g('invoice', 'view', 'create'),
  g('invoice-queue', 'view', 'update'),
  g('invoice-correction', 'create'),
  g('invoice-report', 'create'),
  g('invoice-technical', 'view'),
  g('einvoice-config', 'view', 'update'),
]);
const EIN_CH = [
  ...EIN_VIEW,
  ...flatten([
    g('invoice', 'approve'),
    g('invoice-technical', 'view'),
    g('einvoice-config', 'view', 'update', 'approve', 'reject'),
  ]),
];
const EIN_AD = flatten([g('einvoice-config', 'view', 'update'), g('invoice-technical', 'view')]);

/**
 * RPT (slice 1.9, FR-RPT-001/003/004/011/012/013/014) default grants [Đề xuất dev - chờ xác nhận: BA/Khách]. The report
 * never widens data access: `report-dashboard` opens the page, but every figure and every alert is removed on the
 * server unless the actor also holds the view permission of the module it comes from (repair-order, payment, debt,
 * invoice, stock, cashbook). That makes the role views (owner, manager, advisor, cashier, storekeeper) follow the role matrix.
 *  - `report-daily`: the financial daily report (revenue, labor/parts split); `:export` = CSV of it (audited).
 *  - `report-alert:view`: the exception list. `report-job:manage`: run the due job and rebuild a day (derived data only).
 *  - `report-config`: effective-dated `report-policy` thresholds (owner).
 */
const RPT_BASIC = flatten([g('report-dashboard', 'view'), g('report-alert', 'view')]);
const RPT_CH = flatten([
  g('report-dashboard', 'view'),
  g('report-alert', 'view'),
  g('report-daily', 'view', 'export'),
  g('report-job', 'manage'),
  g('report-config', 'view', 'update', 'approve', 'reject'),
]);
/** Slice 2.1, Q85 default: the branch ranking is for the owner and the regional manager; a branch manager sees only their own branch's reports. */
const RPT_RANKING = flatten([g('report-ranking', 'view')]);
/** FR-SYS-016: head office releases shared catalogues to chosen branches; effective-dated config, so proposals need a second approver. */
const CATALOG_RELEASE = flatten([g('catalog-release', 'view', 'update', 'approve', 'reject')]);
const RPT_QV = flatten([
  g('report-dashboard', 'view'),
  g('report-alert', 'view'),
  g('report-daily', 'view'),
]);
const RPT_QL = flatten([
  g('report-dashboard', 'view'),
  g('report-alert', 'view'),
  g('report-daily', 'view', 'export'),
  g('report-job', 'manage'),
  g('report-config', 'view'),
]);
const RPT_KT = flatten([
  g('report-dashboard', 'view'),
  g('report-alert', 'view'),
  g('report-daily', 'view', 'export'),
]);

/**
 * SYS slice 1.11 (FR-SYS-007 Excel import) [Đề xuất dev - chờ xác nhận: Khách]: `data-import` view (history, templates), create
 * (upload, dry run, write) and archive (undo a batch). A kind also needs the owning module's own rights (customer + vehicle
 * create, part create, stock-doc create), so a role never imports what it could not enter by hand. CH, QL (own branch), TK.
 */
const IMP_FULL = flatten([g('data-import', 'view', 'create', 'archive')]);

/**
 * HRM slice 2.6a (staff records and technician labor; FR-HRM-001, 006, 007, 008, 015, 020) default grants
 * [Đề xuất dev - chờ xác nhận: BA/Khách], from ba-answers-04 Phụ lục C and D. The proposed "NS" (nhân sự) role is not in
 * the ten-role matrix, so its duties fall to QL (own branch) and CH until the BA decides how it is realised.
 *  - `employee`: view (personal data still masked by role, Phụ lục D), create and update = the staff record and its
 *    leaving date (QL in the working branch, CH). QD sees names and positions only (the PII policy hides the rest).
 *  - `labor:view` = every technician's labor in the scope; `labor-own:view` = a technician's own lines only.
 *  - `labor-adjustment:create` = a manual adjustment line (above the configured threshold the owner approves it).
 *  - `labor-rule`: view the rules in force, update = propose a new version (QL: its own branch only), approve/reject = CH.
 */
const HR_VIEW = flatten([g('employee', 'view'), g('labor', 'view'), g('labor-rule', 'view')]);
const HR_QL = flatten([
  g('employee', 'view', 'create', 'update'),
  g('labor', 'view'),
  g('labor-adjustment', 'create'),
  g('labor-rule', 'view', 'update'),
]);
const HR_CH = flatten([
  g('employee', 'view', 'create', 'update'),
  g('labor', 'view'),
  g('labor-rule', 'view', 'update', 'approve', 'reject'),
]);
const HR_QD = flatten([g('employee', 'view')]);
const HR_TH = flatten([g('labor-own', 'view')]);

/**
 * REC slice 2.8b (appointments, warranty; FR-REC-018, 019, 027, 036) default grants [Đề xuất dev - chờ xác nhận: BA/Khách],
 * from G2-APT-01/02 (CV = S, QL; CH, QV = X) and G2-DLV-05/06 (CV, QL = S; CH, QV = X).
 *  - `appointment`: view the branch calendar; create = book; update = move, change advisor, cancel, no-show, "Đã đến".
 *  - `appointment-policy`: the effective-dated on/off switch and daily capacity (QL proposes for its branch, CH approves).
 */
const APT_S = flatten([g('appointment', 'view', 'create', 'update')]);
const APT_VIEW = flatten([g('appointment', 'view')]);
const APT_POLICY_CH = flatten([g('appointment-policy', 'view', 'update', 'approve', 'reject')]);
const APT_POLICY_QL = flatten([g('appointment-policy', 'view', 'update')]);
/**
 *  - `warranty`: view = warranty coverage of a vehicle (own branch in full, other branches through projection P4);
 *    create = open warranty work (a warranty intake linked to the origin order).
 *  - `warranty-policy`: the warranty terms and the cross-branch policy (CH approves; KT reads).
 */
const WAR_S = flatten([g('warranty', 'view', 'create')]);
const WAR_VIEW = flatten([g('warranty', 'view')]);
const WAR_POLICY_CH = flatten([g('warranty-policy', 'view', 'update', 'approve', 'reject')]);
const WAR_POLICY_VIEW = flatten([g('warranty-policy', 'view')]);
/** FR-CRM-003: merging two customer records (kept, audited, never deleted): CH and QL in the working branch. */
const CRM_MERGE = flatten([g('customer-merge', 'create')]);

const CH = [
  ...flatten([
    g('user', 'view', 'create', 'update', 'archive', 'approve', 'reject', 'manage', 'export'),
    g('user-credential', 'manage'),
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
  ...REC_VIEW_ALL,
  ...ORD_VIEW,
  ...PHOTO_HIDE,
  ...ACC_CH,
  ...EIN_CH,
  ...RPT_CH,
  ...RPT_RANKING,
  ...CATALOG_RELEASE,
  ...IMP_FULL,
  ...HR_CH,
  ...APT_S,
  ...APT_POLICY_CH,
  ...WAR_S,
  ...WAR_POLICY_CH,
  ...CRM_MERGE,
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
    g('stock-cost', 'view'),
    g('stock-reservation', 'view'),
    g('inventory-policy', 'view'),
  ])
    .concat(INV_VIEW)
    .concat(REC_VIEW_ALL)
    .concat(ORD_VIEW)
    .concat(ACC_VIEW_ALL)
    .concat(EIN_VIEW)
    .concat(RPT_QV)
    .concat(RPT_RANKING)
    .concat(flatten([g('catalog-release', 'view')]))
    .concat(HR_VIEW)
    .concat(APT_VIEW, WAR_VIEW, WAR_POLICY_VIEW),
  QL: flatten([
    g('user', 'view', 'create', 'update', 'archive', 'manage'),
    g('user-credential', 'manage'),
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
    g('vehicle-history-cross', 'view'),
    g('consent', 'view', 'create', 'update'),
    g('data-request', 'view', 'create', 'update'),
    g('customer-lookup', 'view'),
    g('customer-lookup-customer', 'view'),
    g('stock-cost', 'view'),
    g('stock-level', 'update'),
    g('stock-reservation', 'view', 'create', 'update'),
    g('stock-doc', 'approve'),
    g('inventory-policy', 'view'),
  ])
    .concat(INV_VIEW)
    .concat(REC_S)
    .concat(flatten([g('quote', 'approve', 'reject')]))
    .concat(ORD_QL)
    .concat(ACC_QL)
    .concat(EIN_VIEW)
    .concat(RPT_QL)
    .concat(IMP_FULL)
    .concat(HR_QL)
    .concat(APT_S, APT_POLICY_QL, WAR_S, WAR_POLICY_VIEW, CRM_MERGE),
  CV: flatten([
    g('service-catalog', 'view'),
    g('price-list', 'view'),
    g('discount-limit', 'view'),
    g('tax-rate', 'view'),
    g('doc-template', 'view'),
    g('customer', 'view', 'create', 'update'),
    g('vehicle', 'view', 'create', 'update'),
    g('vehicle-history', 'view'),
    g('vehicle-history-cross', 'view'),
    g('consent', 'view', 'create', 'update'),
    g('data-request', 'view', 'create'),
    g('customer-lookup', 'view'),
    g('customer-lookup-customer', 'view'),
    // read-only catalogue + availability; reservations are made by REC on the advisor's behalf
    g('part', 'view'),
    g('stock-availability', 'view'),
    g('stock-reservation', 'create', 'update'),
  ])
    .concat(REC_S)
    .concat(ORD_CV)
    .concat(ACC_CV)
    .concat(RPT_BASIC)
    .concat(APT_S, WAR_S),
  QD: flatten([
    g('device', 'view'),
    g('worker-pin', 'manage'),
    g('service-catalog', 'view'),
    g('customer', 'view'),
    g('vehicle', 'view'),
    g('vehicle-history', 'view'),
    g('vehicle-history-cross', 'view'),
    g('customer-lookup', 'view'),
  ])
    .concat(REC_VIEW_ALL)
    .concat(ORD_QD)
    .concat(RPT_BASIC)
    .concat(HR_QD)
    .concat(APT_VIEW, WAR_VIEW),
  TH: ORD_TH.concat(HR_TH),
  TK: flatten([
    g('warehouse', 'view'),
    g('price-list', 'view'),
    g('part', 'create', 'update', 'archive'),
    g('part-catalog', 'update'),
    g('stock-level', 'update'),
    g('stock-doc', 'create', 'update'),
    g('stock-reservation', 'view', 'create', 'update'),
  ])
    .concat(INV_VIEW)
    .concat(REC_VIEW_QUOTE)
    .concat(ORD_TK)
    .concat(RPT_BASIC)
    .concat(IMP_FULL),
  TN: flatten([
    g('doc-template', 'view'),
    g('customer', 'view'),
    g('vehicle', 'view'),
    g('customer-lookup', 'view'),
    g('customer-lookup-customer', 'view'),
  ])
    .concat(REC_VIEW_ALL)
    .concat(ORD_TN)
    .concat(ACC_TN)
    .concat(EIN_TN)
    .concat(RPT_BASIC)
    .concat(APT_VIEW),
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
  ])
    .concat(INV_VIEW)
    .concat(REC_VIEW_QUOTE)
    .concat(flatten([g('repair-order', 'view')]))
    .concat(ACC_KT)
    .concat(EIN_KT)
    .concat(RPT_KT)
    .concat(HR_VIEW)
    .concat(WAR_VIEW, WAR_POLICY_VIEW),
  // AD has no approve/reject and no customer data (BA §2.4)
  AD: flatten([
    g('user', 'view', 'create', 'update', 'archive', 'manage'),
    g('user-credential', 'manage'),
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
  ]).concat(EIN_AD),
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
  /** a fresh seed already contains every top-up, so none is re-applied to it */
  appliedTopUps: string[];
}

/**
 * R30 / R21: permissions added to the default matrix AFTER roles may already exist in a real database.
 * A role document remembers which top-ups it received (`appliedTopUps`), so applying is idempotent and a
 * permission an administrator later removed on purpose is not put back. Only ADD here; applied through
 * `applyPermissionTopUps` (owner, audited, one audit line per role).
 */
export interface PermissionTopUp {
  id: string;
  note: string;
  grants: Partial<Record<RoleCode, readonly string[]>>;
}

export const PERMISSION_TOPUPS: readonly PermissionTopUp[] = [
  {
    id: '2026-11-rec-1.5-approval',
    note: 'R30/C20: quote:approve for CV and QL; vehicle-history-cross:view for CH, CV, QL, QD',
    grants: {
      CV: ['quote:approve', 'vehicle-history-cross:view'],
      QL: ['quote:approve', 'quote:reject', 'vehicle-history-cross:view'],
      CH: ['vehicle-history-cross:view'],
      QD: ['vehicle-history-cross:view'],
    },
  },
  {
    id: '2026-11-rec-1.6-orders',
    note: 'Slice 1.6: repair orders, items, part requests, proposals, QC and handover',
    grants: {
      CH: ORD_VIEW,
      QV: ORD_VIEW,
      QL: ORD_QL,
      CV: ORD_CV,
      QD: ORD_QD,
      TH: ORD_TH,
      TK: ORD_TK,
      TN: ORD_TN,
      KT: flatten([g('repair-order', 'view')]),
    },
  },
  {
    id: '2026-11-acc-1.7-money',
    note: 'Slice 1.7: receipts, deposits, cashbook, shifts, day close, debt, approvals (FR-ACC-001..004, 006, SYS-004); R48 quote-verbal-over-limit:approve',
    grants: {
      CH: ACC_CH,
      QV: ACC_VIEW_ALL,
      QL: ACC_QL,
      CV: ACC_CV,
      TN: ACC_TN,
      KT: ACC_KT,
    },
  },
  {
    id: '2026-11-ein-1.8-invoice',
    note: 'Slice 1.8: e-invoice issue, queue, correction with approval, issuer configuration (FR-EIN-001..013)',
    grants: {
      CH: EIN_CH,
      QV: EIN_VIEW,
      QL: EIN_VIEW,
      TN: EIN_TN,
      KT: EIN_KT,
      AD: EIN_AD,
    },
  },
  {
    id: '2026-11-rpt-1.9-reports',
    note: 'Slice 1.9: single-branch dashboard, daily report, alerts, rollup job, CSV export, report-policy config (FR-RPT-001, 003, 004, 011..014)',
    grants: {
      CH: RPT_CH,
      QV: RPT_QV,
      QL: RPT_QL,
      CV: RPT_BASIC,
      QD: RPT_BASIC,
      TK: RPT_BASIC,
      TN: RPT_BASIC,
      KT: RPT_KT,
    },
  },
  {
    id: '2026-11-hrm-2.6a-labor',
    note: 'Slice 2.6a: staff records, technician labor, manual adjustment, labor rules (FR-HRM-001, 006, 007, 008, 015, 020)',
    grants: { CH: HR_CH, QV: HR_VIEW, QL: HR_QL, QD: HR_QD, TH: HR_TH, KT: HR_VIEW },
  },
  {
    id: '2026-11-rec-photo-hide',
    note: 'R104: rec-photo:update (hide a wrongly uploaded photo with a reason) for QL and CH',
    grants: { CH: PHOTO_HIDE, QL: PHOTO_HIDE },
  },
  {
    id: '2026-11-rpt-2.1-consolidation',
    note: 'Slice 2.1: branch ranking for CH and QV (Q85 default); catalogue release from head office for CH (FR-SYS-016)',
    grants: {
      CH: [...RPT_RANKING, ...CATALOG_RELEASE],
      QV: [...RPT_RANKING, 'catalog-release:view'],
    },
  },
  {
    id: '2026-11-sys-2.5-approvals',
    note: 'Slice 2.5: approval delegation, owner only (FR-SYS-033)',
    grants: { CH: flatten([g('approval-delegation', 'view', 'update')]) },
  },
  {
    id: '2026-11-sys-worker-login',
    note: 'P2-C (owner decision 07/11/2026): user-credential:manage = set a temporary password for a staff member without email (CH, QL, AD)',
    grants: {
      CH: ['user-credential:manage'],
      QL: ['user-credential:manage'],
      AD: ['user-credential:manage'],
    },
  },
  {
    id: '2026-11-sys-1.11-import',
    note: 'Slice 1.11: Excel data import, dry run, commit and undo (FR-SYS-007)',
    grants: { CH: IMP_FULL, QL: IMP_FULL, TK: IMP_FULL },
  },
  {
    id: '2026-11-rec-2.8b-appointments',
    note: 'Slice 2.8b: appointment calendar and capacity policy, warranty coverage and policy, customer merge (FR-REC-018, 019, 027, 036, FR-CRM-003)',
    grants: {
      CH: [...APT_S, ...APT_POLICY_CH, ...WAR_S, ...WAR_POLICY_CH, ...CRM_MERGE],
      QV: [...APT_VIEW, ...WAR_VIEW, ...WAR_POLICY_VIEW],
      QL: [...APT_S, ...APT_POLICY_QL, ...WAR_S, ...WAR_POLICY_VIEW, ...CRM_MERGE],
      CV: [...APT_S, ...WAR_S],
      QD: [...APT_VIEW, ...WAR_VIEW],
      TN: APT_VIEW,
      KT: [...WAR_VIEW, ...WAR_POLICY_VIEW],
    },
  },
];

export function defaultRoleSeeds(): RoleSeed[] {
  return ROLE_CODES.map((code) => ({
    code,
    name: ROLE_NAMES[code],
    permissions: [...(matrix[code] ?? [])].sort(),
    canConsolidate: CONSOLIDATING.includes(code),
    appliedTopUps: PERMISSION_TOPUPS.map((t) => t.id),
  }));
}

/** Every resource:action the platform knows; role administration rejects anything else. */
export function knownPermissions(): Set<string> {
  return new Set(defaultRoleSeeds().flatMap((r) => r.permissions));
}
