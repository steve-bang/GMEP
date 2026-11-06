import { beforeAll, describe, expect, it } from 'vitest';
import { getTenant, provisionTenant, transitionTenant } from '@/modules/sys';
import { journey, newStaffUser, type Row, type Staff } from '../helpers/journey';
import { allRouteFiles, backends, createHarness, type Harness } from './harness';

/**
 * NFR-ISO-01 / FR-SYS-002 / UAT-06 / security checklist #4: the generated isolation matrix.
 *
 * Every GET route file under src/app/api must have a row in ROUTES below (or an EXEMPT line with the reason), so a new
 * route without a row fails this test. Rows are checked against real records created through the public API in two
 * branches (Q7 with the full chain down to payment and invoice, TD with intake, quote and order):
 *  - leak: a branch-scoped viewer's response never contains an identifier of the other branch;
 *  - list: the viewer's own record is there, the other branch's is not;
 *  - detail: out-of-scope is 404 and identical to a missing id (no existence oracle);
 *  - export (POST): the file holds the viewer's scope only.
 * Runs on the in-memory adapters always and on the Firestore Emulator when available.
 */

type Ids = Record<string, string>;
type Kind = 'list' | 'detail' | 'report';
interface RouteRow {
  kind: Kind;
  /** list/report: the path with query; detail: the path built from the id of that branch */
  path: (ids: Ids) => string;
  /** key in Ids that must appear in a list of the owning branch's scope */
  has?: string;
  /** detail: how to build the path for a given id; the id comes from ids[idKey] */
  idKey?: string;
  /** a read that answers 200 with an empty result for any unknown id: out-of-scope must equal missing */
  emptyForUnknown?: boolean;
  detail?: (id: string) => string;
}
const dir = (file: string) =>
  file.replace('/src/app/api/', '').replace('/route.ts', '').replace(/\/$/, '');

const ROUTES: Record<string, RouteRow> = {
  // CRM
  'v1/crm/customers': {
    kind: 'list',
    path: () => '/api/v1/crm/customers?limit=100',
    has: 'customerId',
  },
  'v1/crm/customers/[id]': {
    kind: 'detail',
    path: () => '',
    idKey: 'customerId',
    detail: (id) => `/api/v1/crm/customers/${id}`,
  },
  'v1/crm/customers/[id]/consents': {
    kind: 'detail',
    path: () => '',
    idKey: 'customerId',
    detail: (id) => `/api/v1/crm/customers/${id}/consents`,
  },
  'v1/crm/customers/[id]/vehicles': {
    kind: 'detail',
    path: () => '',
    idKey: 'customerId',
    detail: (id) => `/api/v1/crm/customers/${id}/vehicles`,
  },
  'v1/crm/data-requests': { kind: 'list', path: () => '/api/v1/crm/data-requests?limit=100' },
  'v1/crm/data-requests/[id]': {
    kind: 'detail',
    path: () => '',
    idKey: 'dsrId',
    detail: (id) => `/api/v1/crm/data-requests/${id}`,
  },
  'v1/crm/vehicles': {
    kind: 'list',
    path: () => '/api/v1/crm/vehicles?limit=100',
    has: 'vehicleId',
  },
  'v1/crm/vehicles/[id]': {
    kind: 'detail',
    path: () => '',
    idKey: 'vehicleId',
    detail: (id) => `/api/v1/crm/vehicles/${id}`,
  },
  'v1/crm/vehicles/[id]/history': {
    emptyForUnknown: true,
    kind: 'detail',
    path: () => '',
    idKey: 'vehicleId',
    detail: (id) => `/api/v1/crm/vehicles/${id}/history`,
  },
  'v1/crm/vehicles/[id]/owner': {
    kind: 'detail',
    path: () => '',
    idKey: 'vehicleId',
    detail: (id) => `/api/v1/crm/vehicles/${id}/owner`,
  },
  // REC
  'v1/rec/board': { kind: 'list', path: () => '/api/v1/rec/board', has: 'orderId' },
  'v1/rec/intakes': { kind: 'list', path: () => '/api/v1/rec/intakes?limit=100', has: 'intakeId' },
  'v1/rec/intakes/[id]': {
    kind: 'detail',
    path: () => '',
    idKey: 'intakeId',
    detail: (id) => `/api/v1/rec/intakes/${id}`,
  },
  'v1/rec/orders': { kind: 'list', path: () => '/api/v1/rec/orders?limit=100', has: 'orderId' },
  'v1/rec/orders/[id]': {
    kind: 'detail',
    path: () => '',
    idKey: 'orderId',
    detail: (id) => `/api/v1/rec/orders/${id}`,
  },
  'v1/rec/orders/[id]/qc-checklist': {
    kind: 'detail',
    path: () => '',
    idKey: 'orderId',
    detail: (id) => `/api/v1/rec/orders/${id}/qc-checklist`,
  },
  'v1/rec/orders/[id]/photos': {
    kind: 'detail',
    path: () => '',
    idKey: 'orderId',
    detail: (id) => `/api/v1/rec/orders/${id}/photos`,
  },
  'v1/rec/quotes': { kind: 'list', path: () => '/api/v1/rec/quotes?limit=100', has: 'quoteId' },
  'v1/rec/quotes/[id]': {
    kind: 'detail',
    path: () => '',
    idKey: 'quoteId',
    detail: (id) => `/api/v1/rec/quotes/${id}`,
  },
  'v1/rec/quotes/[id]/approved': {
    kind: 'detail',
    path: () => '',
    idKey: 'quoteId',
    detail: (id) => `/api/v1/rec/quotes/${id}/approved`,
  },
  'v1/rec/quotes/[id]/pdf': {
    kind: 'detail',
    path: () => '',
    idKey: 'quoteId',
    detail: (id) => `/api/v1/rec/quotes/${id}/pdf`,
  },
  'v1/rec/part-requests': { kind: 'list', path: () => '/api/v1/rec/part-requests' },
  'v1/rec/work': { kind: 'list', path: () => '/api/v1/rec/work' },
  'v1/rec/technicians': { kind: 'list', path: () => '/api/v1/rec/technicians' },
  // ACC
  'v1/acc/payments': {
    kind: 'list',
    path: () => '/api/v1/acc/payments?limit=100',
    has: 'paymentId',
  },
  'v1/acc/payments/[id]': {
    kind: 'detail',
    path: () => '',
    idKey: 'paymentId',
    detail: (id) => `/api/v1/acc/payments/${id}`,
  },
  'v1/acc/payments/[id]/pdf': {
    kind: 'detail',
    path: () => '',
    idKey: 'paymentId',
    detail: (id) => `/api/v1/acc/payments/${id}/pdf`,
  },
  'v1/acc/orders/[id]': {
    kind: 'detail',
    path: () => '',
    idKey: 'orderId',
    detail: (id) => `/api/v1/acc/orders/${id}`,
  },
  'v1/acc/cashbook': { kind: 'report', path: () => '/api/v1/acc/cashbook' },
  'v1/acc/day-close': { kind: 'report', path: () => '/api/v1/acc/day-close' },
  'v1/acc/debts': { kind: 'list', path: () => '/api/v1/acc/debts' },
  // EIN
  'v1/ein/invoices': {
    kind: 'list',
    path: () => '/api/v1/ein/invoices?limit=100',
    has: 'invoiceId',
  },
  'v1/ein/invoices/[id]': {
    kind: 'detail',
    path: () => '',
    idKey: 'invoiceId',
    detail: (id) => `/api/v1/ein/invoices/${id}`,
  },
  'v1/ein/invoices/[id]/files/[kind]': {
    kind: 'detail',
    path: () => '',
    idKey: 'invoiceId',
    detail: (id) => `/api/v1/ein/invoices/${id}/files/xml`,
  },
  'v1/ein/orders/[id]/invoice-check': {
    kind: 'detail',
    path: () => '',
    idKey: 'orderId',
    detail: (id) => `/api/v1/ein/orders/${id}/invoice-check`,
  },
  'v1/ein/queue': { kind: 'list', path: () => '/api/v1/ein/queue' },
  'v1/ein/warnings': { kind: 'list', path: () => '/api/v1/ein/warnings' },
  // INV
  'v1/inv/documents': { kind: 'list', path: () => '/api/v1/inv/documents?limit=100', has: 'docId' },
  'v1/inv/documents/[id]': {
    kind: 'detail',
    path: () => '',
    idKey: 'docId',
    detail: (id) => `/api/v1/inv/documents/${id}`,
  },
  'v1/inv/stock': { kind: 'list', path: () => '/api/v1/inv/stock?limit=100' },
  'v1/inv/reservations': {
    kind: 'report',
    path: () => '/api/v1/inv/reservations?partId=part_seed_01',
  },
  'v1/inv/reservations/open': {
    kind: 'report',
    path: () => '/api/v1/inv/reservations/open?kind=short',
  },
  'v1/inv/parts/[id]/stock': { kind: 'report', path: () => '/api/v1/inv/parts/part_seed_01/stock' },
  'v1/inv/parts/[id]/ledger': {
    kind: 'report',
    path: (ids) => `/api/v1/inv/parts/part_seed_01/ledger?warehouseId=${ids.warehouseId}`,
  },
  // SYS (branch-scoped records)
  'v1/sys/warehouses': {
    kind: 'list',
    path: () => '/api/v1/sys/warehouses?limit=100',
    has: 'warehouseId',
  },
  'v1/sys/warehouses/[id]': {
    kind: 'detail',
    path: () => '',
    idKey: 'warehouseId',
    detail: (id) => `/api/v1/sys/warehouses/${id}`,
  },
  'v1/sys/warehouses/export': {
    kind: 'list',
    path: () => '/api/v1/sys/warehouses/export',
    has: 'warehouseId',
  },
  'v1/sys/branches': { kind: 'list', path: () => '/api/v1/sys/branches' },
  'v1/sys/branches/[id]': {
    kind: 'detail',
    path: () => '',
    idKey: 'branchId',
    detail: (id) => `/api/v1/sys/branches/${id}`,
  },
  'v1/sys/audit': { kind: 'list', path: () => '/api/v1/sys/audit?limit=100' },
  'v1/sys/approvals': { kind: 'list', path: () => '/api/v1/sys/approvals?limit=100' },
  'v1/sys/imports': { kind: 'list', path: () => '/api/v1/sys/imports' },
  'v1/sys/users': { kind: 'list', path: () => '/api/v1/sys/users?limit=100' },
  // RPT (rollup of the branch of the viewer)
  'v1/rpt/daily': { kind: 'report', path: () => '/api/v1/rpt/daily' },
  'v1/rpt/dashboard': { kind: 'report', path: () => '/api/v1/rpt/dashboard' },
  'v1/rpt/monthly': { kind: 'report', path: () => `/api/v1/rpt/monthly?month=${monthOfToday()}` },
  'v1/rpt/reconcile': { kind: 'report', path: () => '/api/v1/rpt/reconcile' },
  'v1/rpt/warehouse': { kind: 'report', path: () => '/api/v1/rpt/warehouse' },
  'v1/rpt/technicians': { kind: 'report', path: () => '/api/v1/rpt/technicians' },
  'v1/rpt/alerts': { kind: 'report', path: () => '/api/v1/rpt/alerts' },
  // slice 2.1: consolidated reads cover the whole permission scope (the working branch does not narrow a comparison); the outsider sees nothing of tnt_demo
  'v1/rpt/customers': {
    kind: 'report',
    path: () => `/api/v1/rpt/customers?from=${isoToday()}&to=${isoToday()}`,
  },
  'v1/rpt/indicators': {
    kind: 'report',
    path: () => `/api/v1/rpt/indicators?from=${isoToday()}&to=${isoToday()}`,
  },
  'v1/rpt/groups': { kind: 'report', path: () => '/api/v1/rpt/groups' },
  // HRM slice 2.6a: staff records and technician labor are branch records (labor of an order is read by key)
  'v1/hrm/employees': {
    kind: 'list',
    path: () => '/api/v1/hrm/employees',
    has: 'employeeId',
  },
  'v1/hrm/employees/[id]': {
    kind: 'detail',
    path: () => '',
    idKey: 'employeeId',
    detail: (id) => `/api/v1/hrm/employees/${id}`,
  },
  'v1/hrm/labor': { kind: 'list', path: () => '/api/v1/hrm/labor', has: 'orderId' },
  'v1/hrm/labor/orders/[id]': {
    kind: 'detail',
    path: () => '',
    idKey: 'orderId',
    detail: (id) => `/api/v1/hrm/labor/orders/${id}`,
  },
};

/** GET routes that carry no branch data. A new GET route must be classified in ROUTES or here, with the reason. */
const EXEMPT: Record<string, string> = {
  health: 'liveness probe, no data',
  'v1/auth/me': 'the caller’s own session',
  'v1/auth/tenants':
    'the caller’s own memberships (FR-TEN-016); covered by tests/integration/tenant-identity.test.ts',
  'v1/sys/scope': 'the caller’s own selectable scope (derived from role assignments)',
  'v1/sys/roles': 'role matrix: company-level configuration, not branch data',
  'v1/sys/config/[type]':
    'effective-dated configuration, company-level with branch overrides covered in config-admin.test.ts',
  'v1/sys/services': 'service catalogue, company-level',
  'v1/sys/services/[id]': 'service catalogue, company-level',
  'v1/sys/price-lists': 'price list headers, company-level',
  'v1/sys/notifications': 'the caller’s own notifications',
  'v1/sys/users/[id]': 'user admin, covered in admin.test.ts (assignment scope)',
  'v1/sys/users/[id]/sessions': 'user admin, covered in admin.test.ts',
  'v1/sys/approvals/delegations':
    'FR-SYS-033: tenant-wide (not per branch), read by tenantId; tenant axis in sys-approvals-p2.test.ts and the exempt-list check below',
  'v1/sys/approvals/[id]': 'covered by the approvals list scope and acc.test.ts approvals',
  'v1/sys/imports/[id]': 'covered in import.test.ts (batch of another branch is 404)',
  'v1/sys/imports/[id]/issues': 'covered in import.test.ts (batch of another branch is 404)',
  'v1/sys/imports/kinds': 'static import kinds',
  'v1/sys/imports/template': 'static template file',
  'v1/inv/parts':
    'part catalogue, company-level (balances are branch-scoped and covered by v1/inv/stock)',
  'v1/inv/parts/[id]': 'part catalogue, company-level',
  'v1/inv/parts/[id]/prices': 'price config, company-level',
  'v1/inv/availability':
    'availability by part per warehouse of the working scope, covered in inv.test.ts',
  'v1/acc/expense-categories': 'expense category catalogue, company-level',
  'v1/rec/pickers/parts': 'catalogue picker, company-level',
  'v1/rec/pickers/services': 'catalogue picker, company-level',
  'v1/rec/service-workflows': 'workflow catalogue, company-level',
  'v1/rec/intakes/[id]/photos/[pid]':
    'file download, covered in rec-photos tests of rec-orders.test.ts',
  'v1/rec/orders/[id]/photos/[pid]': 'file download, covered in rec-orders.test.ts',
  'v1/rec/public/quote/photos/[pid]':
    'public, token-authenticated file read (no session): covered in rec-public-photos.test.ts',
  'v1/ein/connection': 'issuer connection state of the working branch, no records',
  'v1/rpt/ranking':
    'consolidated by nature: branch-bound roles are refused (403); owner, region group and tenant axis are covered in consolidation.test.ts',
  'v1/sys/login-history':
    'own sign-in history, or another person inside the permission scope (audited); covered in consolidation.test.ts',
  'v1/sys/catalog-releases':
    'catalogue release of the tenant (branches of the scope only); covered in consolidation.test.ts',
  'v1/hrm/labor/rules':
    'labor rules in force: effective-dated configuration, company-level with branch overrides filtered by scope (covered in hrm.test.ts)',
  'v1/rpt/drill': 'drill-down needs a metric and a date; scope rules are covered in rpt.test.ts',
};

const strip = (j: Row | null): Row | null => {
  if (!j || typeof j !== 'object') return j;
  const { traceId: _t, instance: _i, requestId: _r, ...rest } = j; // eslint-disable-line @typescript-eslint/no-unused-vars
  return rest;
};

describe('FR-SYS-002 isolation matrix: route registry', () => {
  it('every GET route is classified in the matrix or exempted with a reason (a new route fails here)', () => {
    const gets = allRouteFiles()
      .filter((r) => r.methods.includes('GET'))
      .map((r) => dir(r.file));
    const unclassified = gets.filter((g) => !(g in ROUTES) && !(g in EXEMPT));
    expect(unclassified, 'add a ROUTES row (or an EXEMPT line with the reason)').toEqual([]);
    const stale = [...Object.keys(ROUTES), ...Object.keys(EXEMPT)].filter((k) => !gets.includes(k));
    expect(stale, 'rows for routes that no longer exist').toEqual([]);
  });
});

describe.each(backends)('FR-SYS-002 / UAT-06 generated isolation matrix [%s]', (backend) => {
  let h: Harness;
  const viewers: Record<string, string> = {};
  const readers: Record<string, Record<string, string>> = {};
  const q7: Ids = {};
  const td: Ids = {};
  let q7Markers: string[] = [];
  let tdMarkers: string[] = [];

  beforeAll(async () => {
    h = await createHarness(backend);
    const j = journey(h);
    // the demo data has counter staff only at Q7: Thu Duc gets fresh single-branch users through the invite flow
    const owner0 = await h.loginAt('u_owner', 'all');
    const tdStaff: Staff = { cv: '', qd: '', th: '', tn: '', tk: '' };
    const tdUsers: Record<string, string> = {};
    for (const [field, role] of [
      ['cv', 'CV'],
      ['qd', 'QD'],
      ['th', 'TH'],
      ['tn', 'TN'],
      ['tk', 'TK'],
    ] as const) {
      const u = await newStaffUser(h, owner0, role, 'br_td', field);
      tdStaff[field] = u.cookie;
      tdUsers[field] = u.userId;
    }
    const staffQ7: Staff = {
      cv: await h.loginAt('u_cv_q7', 'br_q7'),
      qd: await h.loginAt('u_qd_q7', 'br_q7'),
      th: await h.loginAt('u_th_q7', 'br_q7'),
      tn: await h.loginAt('u_tn_q7', 'br_q7'),
      tk: await h.loginAt('u_tk_q7', 'br_q7'),
      kt: await h.loginAt('u_kt', 'br_q7'),
    };
    // single-branch readers per branch (a person with two branches can see both by design, FR-SYS-012)
    readers.br_q7 = {
      qlQ7: await h.loginAt('u_ql_q7', 'br_q7'),
      cvQ7: staffQ7.cv,
      tnQ7: staffQ7.tn,
      tkQ7: staffQ7.tk!,
    };
    readers.br_td = {
      qlTD: await h.loginAt('u_ql_td', 'br_td'),
      cvTD: tdStaff.cv,
      tnTD: tdStaff.tn,
      tkTD: tdStaff.tk!,
    };
    viewers.ownerQ7 = await h.loginAt('u_owner', 'br_q7');
    viewers.ownerTD = await h.loginAt('u_owner', 'br_td');
    viewers.ownerAll = await h.loginAt('u_owner', 'all');
    viewers.qlQ7 = await h.loginAt('u_ql_q7', 'br_q7');
    viewers.qlTD = await h.loginAt('u_ql_td', 'br_td');

    const build = async (
      branch: 'br_q7' | 'br_td',
      staff: Staff,
      techId: string,
      tag: string,
      plate: string,
      wh: string,
      ids: Ids,
    ) => {
      const c = await j.customerWithVehicle(staff.cv, tag, plate);
      const ro = await j.readyOrder(staff, c.vehicleId, undefined, techId);
      const pay = await j.payFull(staff.tn, ro.order.id);
      const inv = await j.issueInvoice(staff.tn, ro.order.id);
      const grn = await j.post(staff.tk!, '/api/v1/inv/documents', {
        warehouseId: wh,
        type: 'GRN',
        source: { type: 'purchase-order', id: `po-iso-${branch}` },
        lines: [{ partId: 'part_seed_01', qty: 11, unitCostVnd: 85_000 }],
      });
      expect(grn.status, grn.text).toBe(201);
      const emp = await j.post(
        branch === 'br_q7' ? viewers.qlQ7! : viewers.qlTD!,
        '/api/v1/hrm/employees',
        {
          code: `E${tag}`,
          fullName: `Nhan su ${tag}`,
          positionCode: 'mechanic3',
          joinedOn: '2024-01-01',
        },
      );
      expect(emp.status, emp.text).toBe(201);
      const dsr = await j.post(staff.cv, '/api/v1/crm/data-requests', {
        customerId: c.customerId,
        type: 'delete',
        receivedVia: 'in_person',
        note: 'Khách yêu cầu xóa (cách ly)',
      });
      expect(dsr.status, dsr.text).toBe(201);
      Object.assign(ids, {
        dsrId: dsr.json.id,
        employeeId: emp.json.id,
        customerId: c.customerId,
        vehicleId: c.vehicleId,
        intakeId: ro.intakeId,
        quoteId: ro.quoteId,
        orderId: ro.order.id,
        paymentId: pay.id ?? pay.paymentId,
        invoiceId: inv.invoiceId,
        docId: grn.json.id,
        warehouseId: wh,
        partId: 'part_seed_01',
        branchId: branch,
      });
      return [
        c.customerId,
        c.vehicleId,
        ro.intakeId,
        ro.quoteId,
        ro.order.id,
        plate,
        tag,
        ids.paymentId,
        ids.invoiceId,
        ids.docId,
        emp.json.id,
      ].filter(Boolean) as string[];
    };
    q7Markers = await build(
      'br_q7',
      staffQ7,
      'u_th_q7',
      'ZZQ7',
      '51A-777.01',
      'wh_br_q7_WH-CHINH',
      q7,
    );
    tdMarkers = await build(
      'br_td',
      tdStaff,
      tdUsers.th!,
      'ZZTD',
      '51B-888.02',
      'wh_br_td_WH-CHINH',
      td,
    );

    // rollups for both branches (RPT reads them by key)
    for (const who of [viewers.ownerQ7, viewers.ownerTD]) {
      await h.call('POST', '/api/v1/rpt/jobs/run-due', {
        cookie: who,
        key: 'rpt-run-0000000001',
        body: {},
      });
    }
  });

  const containsAny = (text: string, markers: string[]) => markers.filter((m) => text.includes(m));
  const hiddenFor = (branch: string) => (branch === 'br_q7' ? tdMarkers : q7Markers);
  const idsOf = (branch: string) => (branch === 'br_q7' ? q7 : td);
  const otherOf = (branch: string) => (branch === 'br_q7' ? 'br_td' : 'br_q7');

  describe.each(Object.entries(ROUTES))('%s', (route, spec) => {
    it(`${spec.kind}: branch-bound readers never see another branch; owner with a working branch is narrowed in lists`, async () => {
      let readableOwn = 0;
      for (const branch of ['br_q7', 'br_td']) {
        const own = idsOf(branch);
        const other = idsOf(otherOf(branch));
        for (const [name, cookie] of Object.entries(readers[branch]!)) {
          const label = `${route} ${name}`;
          if (spec.kind === 'detail') {
            const mine = await h.call('GET', spec.detail!(own[spec.idKey!]!), { cookie });
            expect([200, 403], `${label} own ${mine.status} ${mine.text.slice(0, 200)}`).toContain(
              mine.status,
            );
            expect(containsAny(mine.text, hiddenFor(branch)), `${label} own leaks`).toEqual([]);
            const missing = await h.call('GET', spec.detail!('nope_NOPE_0000'), { cookie });
            const cross = await h.call('GET', spec.detail!(other[spec.idKey!]!), { cookie });
            // C20 / F-2: only holders of vehicle-history-cross:view (CH, CV, QL, QĐ) may get 200 for a vehicle of
            // another branch; every other role answers exactly like a missing id
            const mayReadAcross = spec.emptyForUnknown && /^(ql|cv)/.test(name);
            if (!mayReadAcross)
              expect(cross.status, `${label} cross ${cross.text.slice(0, 200)}`).not.toBe(200);
            expect(containsAny(cross.text, hiddenFor(branch)), `${label} cross leaks`).toEqual([]);
            if (mine.status === 200) {
              readableOwn++;
              // out of scope answers exactly like a missing id: no existence oracle (NFR-ISO-01)
              if (mayReadAcross) {
                // the projection holds only white-listed fields of the other branch: no marker of it may leak
                expect(Array.isArray(cross.json.items), `${label} cross shape`).toBe(true);
              } else {
                expect(cross.status, `${label} cross ${cross.text.slice(0, 200)}`).toBe(404);
                expect(strip(cross.json)).toEqual(strip(missing.json));
              }
            }
          } else {
            const res = await h.call('GET', spec.path(own), { cookie });
            expect([200, 403, 409], `${label} ${res.status} ${res.text.slice(0, 200)}`).toContain(
              res.status,
            );
            expect(containsAny(res.text, hiddenFor(branch)), `${label} leaks`).toEqual([]);
            if (res.status === 200) {
              readableOwn++;
              if (spec.has)
                expect(res.text, `${label} own record missing`).toContain(own[spec.has]!);
            }
          }
        }
      }
      // the route is really exercised: somebody in each branch could read it
      expect(
        readableOwn,
        `${route}: no reader could read its own branch (extend the readers)`,
      ).toBeGreaterThan(0);

      // owner who picked a working branch: lists are narrowed to it (resolveWorkingScope)
      if (spec.kind !== 'detail') {
        for (const [name, branch] of [
          ['ownerQ7', 'br_q7'],
          ['ownerTD', 'br_td'],
        ] as const) {
          const res = await h.call('GET', spec.path(idsOf(branch)), { cookie: viewers[name] });
          if (res.status === 200) {
            expect(containsAny(res.text, hiddenFor(branch)), `${route} ${name} leaks`).toEqual([]);
            if (spec.has) expect(res.text).toContain(idsOf(branch)[spec.has]!);
          }
        }
        const all = await h.call('GET', spec.path(q7), { cookie: viewers.ownerAll });
        if (all.status === 200 && spec.has) {
          expect(all.text).toContain(q7[spec.has]!);
          if (td[spec.has]) expect(all.text).toContain(td[spec.has]!);
        }
      }
    });
  });

  describe('F-1 / BA §25: working branch is a filter, not a read boundary (CH, KT)', () => {
    it('owner and accountant with a working branch read a record of the other branch by id (200, with its branch) while lists stay narrowed', async () => {
      const kt = await h.loginAt('u_kt', 'br_q7');
      for (const [name, cookie] of [
        ['ownerQ7', viewers.ownerQ7!],
        ['kt@Q7', kt],
      ] as const) {
        const order = await h.call('GET', `/api/v1/rec/orders/${td.orderId}`, { cookie });
        if (name === 'kt@Q7' && order.status === 403) continue; // the accountant may lack repair-order:view
        expect(order.status, `${name} ${order.text.slice(0, 200)}`).toBe(200);
        // the order DTO carries no branch label yet (reported to designer/BA): assert it only when present
        if (order.json.branchId !== undefined) expect(order.json.branchId).toBe('br_td');
        const list = await h.call('GET', '/api/v1/rec/orders?limit=100', { cookie });
        if (list.status === 200) expect(list.text).not.toContain(td.orderId!);
      }
    });

    it('BA §25 F-1(3): a write on a record of another branch is refused until the working branch is switched (CRM, SYS; REC/INV/ACC writes are not held by CH/KT, see tests/unit/rbac-write-fence.test.ts)', async () => {
      const owner = viewers.ownerQ7!; // working branch Q7, company-wide permissions
      const switchTo = viewers.ownerTD!; // same person, working branch Thu Duc
      const noBranch = viewers.ownerAll!; // consolidated view, no working branch: behaviour unchanged
      const refused = (r: { status: number; json: Row; text: string }, what: string) => {
        expect(r.status, `${what} ${r.text.slice(0, 200)}`).toBe(409);
        expect(r.json.code, what).toBe('switch_branch_required');
        expect(r.text, what).not.toContain('ZZTD');
      };
      const vehicle = (cookie: string, version: number, k: string) =>
        h.call('PATCH', `/api/v1/crm/vehicles/${td.vehicleId}`, {
          cookie,
          key: k,
          body: { version, color: 'Đen' },
        });
      const customer = (cookie: string, version: number, k: string) =>
        h.call('PATCH', `/api/v1/crm/customers/${td.customerId}`, {
          cookie,
          key: k,
          body: { version, labels: [] },
        });
      const warehouse = (cookie: string, version: number, k: string) =>
        h.call('PATCH', `/api/v1/sys/warehouses/${td.warehouseId}`, {
          cookie,
          key: k,
          body: { version, note: 'ghi chéo' },
        });

      // reads by id stay open (200)
      const rv = await h.call('GET', `/api/v1/crm/vehicles/${td.vehicleId}`, { cookie: owner });
      const rc = await h.call('GET', `/api/v1/crm/customers/${td.customerId}`, { cookie: owner });
      const rw = await h.call('GET', `/api/v1/sys/warehouses/${td.warehouseId}`, { cookie: owner });
      expect([rv.status, rc.status, rw.status]).toEqual([200, 200, 200]);

      // writes while working at Q7 are refused with a clear code
      refused(await vehicle(owner, rv.json.version, 'xw-veh-000001'), 'vehicle');
      refused(await customer(owner, rc.json.version, 'xw-cus-000001'), 'customer');
      refused(await warehouse(owner, rw.json.version, 'xw-wh-0000001'), 'warehouse');
      // nothing changed
      const after = await h.call('GET', `/api/v1/crm/vehicles/${td.vehicleId}`, { cookie: owner });
      expect(after.json.version).toBe(rv.json.version);

      // an id that does not exist at all is refused the same way for this actor (no existence oracle either way)
      const ghost = await h.call('PATCH', '/api/v1/crm/vehicles/nope_NOPE_0000', {
        cookie: owner,
        key: 'xw-ghost-00001',
        body: { version: 1, color: 'Đen' },
      });
      refused(ghost, 'unknown id');

      // switching the working branch makes the same writes work
      const ok = await vehicle(switchTo, rv.json.version, 'xw-veh-000002');
      expect(ok.status, ok.text.slice(0, 200)).toBe(200);
      const okc = await customer(switchTo, rc.json.version, 'xw-cus-000002');
      expect(okc.status, okc.text.slice(0, 200)).toBe(200);
      const okw = await warehouse(switchTo, rw.json.version, 'xw-wh-0000002');
      expect(okw.status, okw.text.slice(0, 200)).toBe(200);

      // no working branch chosen (consolidated owner): unchanged, the write is allowed by permission
      const cur = await h.call('GET', `/api/v1/crm/vehicles/${td.vehicleId}`, { cookie: noBranch });
      const un = await vehicle(noBranch, cur.json.version, 'xw-veh-000003');
      // (unchanged: this write needs a working branch, so the consolidated view answers scope_merged as before)
      expect(un.json.code, un.text.slice(0, 200)).toBe('scope_merged');
      expect(un.json.code).not.toBe('switch_branch_required');

      // a single-branch user still gets 404 for a record outside the permission scope
      const qlq7 = readers.br_q7!.qlQ7!;
      const other = await h.call('PATCH', `/api/v1/crm/vehicles/${td.vehicleId}`, {
        cookie: qlq7,
        key: 'xw-ql-0000001',
        body: { version: 1, color: 'Đen' },
      });
      expect(other.status).toBe(404);
      expect(other.json.code).toBe('not_found');

      // company-level records are not fenced: a tax rate is proposed while working at Q7 (kt@Q7 in the UAT-09 test)
    });

    it('F1-1 / F1-3: a customer and a vehicle linked to Q7 and Thu Duc are writable from either branch; the 409 body never names the target branch', async () => {
      // seed: cus_an and veh_an carry branchIds [br_q7, br_td] (F1-1 option A: every linked branch may edit)
      const patch = (cookie: string, path: string, version: number, body: Row, k: string) =>
        h.call('PATCH', path, { cookie, key: k, body: { version, ...body } });
      for (const [who, cookie, tag] of [
        ['ownerQ7', viewers.ownerQ7!, 'q7'],
        ['ownerTD', viewers.ownerTD!, 'td'],
      ] as const) {
        const rv = await h.call('GET', '/api/v1/crm/vehicles/veh_an', { cookie });
        const rc = await h.call('GET', '/api/v1/crm/customers/cus_an', { cookie });
        expect([rv.status, rc.status], who).toEqual([200, 200]);
        const v = await patch(
          cookie,
          '/api/v1/crm/vehicles/veh_an',
          rv.json.version,
          { color: 'Xanh' },
          `f11-veh-${tag}-0001`,
        );
        expect(v.status, `${who} vehicle ${v.text.slice(0, 200)}`).toBe(200);
        const c = await patch(
          cookie,
          '/api/v1/crm/customers/cus_an',
          rc.json.version,
          { labels: [] },
          `f11-cus-${tag}-0001`,
        );
        expect(c.status, `${who} customer ${c.text.slice(0, 200)}`).toBe(200);
      }

      // F1-3: a record outside the working branch is refused without naming the target branch (code, name, id)
      const refused = await patch(
        viewers.ownerQ7!,
        `/api/v1/crm/vehicles/${td.vehicleId}`,
        1,
        { color: 'Đen' },
        'f13-body-000001',
      );
      expect(refused.status).toBe(409);
      expect(refused.json.code).toBe('switch_branch_required');
      for (const leak of ['br_td', 'Thủ Đức', 'Thu Duc', 'ZZTD'])
        expect(refused.text, `409 body must not contain ${leak}`).not.toContain(leak);
    });
  });

  describe('exports (POST) carry the viewer scope only', () => {
    const exports = [
      { name: 'crm/customers/export', path: '/api/v1/crm/customers/export', body: {} },
      {
        name: 'sys/audit/export',
        path: '/api/v1/sys/audit/export',
        body: { reason: 'kiểm tra cách ly' },
      },
      {
        name: 'rpt/export monthly',
        path: '/api/v1/rpt/export',
        body: { kind: 'monthly', month: monthOfToday(), reason: 'kiểm tra' },
      },
      {
        name: 'rpt/export reconcile',
        path: '/api/v1/rpt/export',
        body: { kind: 'reconcile', reason: 'kiểm tra' },
      },
      {
        name: 'rpt/export warehouse',
        path: '/api/v1/rpt/export',
        body: { kind: 'warehouse', reason: 'kiểm tra' },
      },
      {
        name: 'rpt/export technicians',
        path: '/api/v1/rpt/export',
        body: { kind: 'technicians', reason: 'kiểm tra' },
      },
    ];
    it.each(exports)('$name: no identifier of the other branch', async ({ path, body }) => {
      for (const branch of ['br_q7', 'br_td']) {
        for (const [name, cookie] of [
          ...Object.entries(readers[branch]!),
          [
            branch === 'br_q7' ? 'ownerQ7' : 'ownerTD',
            viewers[branch === 'br_q7' ? 'ownerQ7' : 'ownerTD']!,
          ],
        ] as [string, string][]) {
          const r = await h.call('POST', path, {
            cookie,
            key: `exp-${name}-${Math.random().toString(36).slice(2, 12)}`,
            body,
          });
          expect([200, 403], `${path} ${name} ${r.status} ${r.text.slice(0, 200)}`).toContain(
            r.status,
          );
          expect(containsAny(r.text, hiddenFor(branch)), `${path} ${name}`).toEqual([]);
        }
      }
    });
    it('the customer export of each branch holds its own customer and not the other one (UAT-06, FR-CRM-017)', async () => {
      const a = await h.call('POST', '/api/v1/crm/customers/export', {
        cookie: viewers.ownerQ7,
        key: 'exp-cus-q7-000001',
        body: {},
      });
      const b = await h.call('POST', '/api/v1/crm/customers/export', {
        cookie: viewers.ownerTD,
        key: 'exp-cus-td-000001',
        body: {},
      });
      expect(a.status, a.text).toBe(200);
      expect(b.status, b.text).toBe(200);
      expect(a.text).toContain('ZZQ7');
      expect(a.text).not.toContain('ZZTD');
      expect(b.text).toContain('ZZTD');
      expect(b.text).not.toContain('ZZQ7');
    });
  });

  describe('stock card and balances of another branch\u2019s warehouse', () => {
    it('INV ledger / stock for a warehouse of another branch answer like a missing warehouse and show no rows (RULE-009, NFR-ISO-01)', async () => {
      for (const branch of ['br_q7', 'br_td']) {
        const other = idsOf(otherOf(branch));
        for (const [name, cookie] of Object.entries(readers[branch]!)) {
          const cross = await h.call(
            'GET',
            `/api/v1/inv/parts/part_seed_01/ledger?warehouseId=${other.warehouseId}`,
            { cookie },
          );
          const missing = await h.call(
            'GET',
            '/api/v1/inv/parts/part_seed_01/ledger?warehouseId=wh_nope_NOPE',
            { cookie },
          );
          expect(cross.status, `${name} ${cross.text.slice(0, 200)}`).toBe(missing.status);
          expect(strip(cross.json)).toEqual(strip(missing.json));
          if (cross.status === 200) expect(cross.json.items).toEqual([]);
          expect(containsAny(cross.text, hiddenFor(branch))).toEqual([]);
        }
      }
    });
  });

  describe('a branch-bound viewer asking for another branch with the branchId parameter', () => {
    it.each(['daily', 'dashboard', 'alerts'])(
      'rpt/%s?branchId=<other> is refused or answers only the own branch',
      async (r) => {
        const res = await h.call('GET', `/api/v1/rpt/${r}?branchId=br_td`, {
          cookie: readers.br_q7!.qlQ7,
        });
        if (res.status === 200) expect(JSON.stringify(res.json)).not.toContain('br_td');
        else expect([400, 403, 404, 409]).toContain(res.status);
      },
    );
  });

  /**
   * Tenant axis (FR-TEN-009, 014; UAT-TEN-05; RULE-016, 017): the reader is the owner (role CH, every branch: the
   * widest reader a tenant has) of ANOTHER tenant. Whatever the route, a record of tenant tnt_demo answers exactly like
   * an id that does not exist, and no list, report or export of the outsider carries any identifier of tnt_demo.
   */
  describe('tenant axis: the owner of another tenant', () => {
    let outsider = '';
    beforeAll(async () => {
      const cnt = {
        kind: 'platform',
        platformUserId: 'pf_owner',
        role: 'CNT',
        displayName: 'CNT',
      } as const;
      const email = 'owner@outsider.test';
      const r = await provisionTenant(
        h.container.sys,
        cnt,
        {
          code: 'tnt_outsider',
          name: 'Garage Outsider',
          environment: 'demo',
          owner: { email, name: 'Chủ ngoài', employeeCode: 'CH01' },
        },
        { requestId: 'req-out-1', idempotencyKey: 'prov-outsider-1' },
      );
      expect(r.state).toBe('provisioned');
      const t = await getTenant(h.container.sys, cnt, 'tnt_outsider');
      await transitionTenant(
        h.container.sys,
        cnt,
        'tnt_outsider',
        { to: 'active', version: t.version },
        { requestId: 'req-out-2' },
      );
      const act = await h.call('POST', '/api/v1/auth/activate', {
        body: {
          token: await h.latestToken(email, 'invitation'),
          password: 'Valid-Password-2026!',
          consent: true,
        },
        headers: { 'x-forwarded-for': '10.8.8.8' },
      });
      expect(act.status, act.text).toBe(200);
      const login = await h.call('POST', '/api/v1/auth/login', {
        body: { identifier: email, password: 'Valid-Password-2026!' },
        headers: { 'x-forwarded-for': '10.8.8.9' },
      });
      expect(login.status, login.text).toBe(200);
      outsider = login.headers
        .getSetCookie()
        .find((c) => c.startsWith('__Host-gmep_session='))!
        .split(';')[0]!;
    });

    const everyId = () => [...Object.values(q7), ...Object.values(td), ...q7Markers, ...tdMarkers];

    describe.each(Object.entries(ROUTES))('%s', (route, spec) => {
      it(`${spec.kind}: another tenant's record answers like a missing id; lists carry nothing of tnt_demo`, async () => {
        if (spec.kind === 'detail') {
          const missing = await h.call('GET', spec.detail!('nope_NOPE_0000'), { cookie: outsider });
          for (const ids of [q7, td]) {
            const id = ids[spec.idKey!]!;
            const res = await h.call('GET', spec.detail!(id), { cookie: outsider });
            expect(strip(res.json), `${route} foreign id must equal a missing id`).toEqual(
              strip(missing.json),
            );
            expect(res.status).toBe(missing.status);
            expect(containsAny(res.text, everyId())).toEqual([]);
          }
        } else {
          const res = await h.call('GET', spec.path(q7), { cookie: outsider });
          expect([200, 403, 404, 409], `${route} ${res.status}`).toContain(res.status);
          expect(containsAny(res.text, everyId()), `${route} leaks tnt_demo`).toEqual([]);
        }
      });
    });

    // the routes the branch matrix exempts as "company-level" are TENANT-level data: each must be closed to an outsider
    it.each([
      '/api/v1/sys/users/u_ql_q7',
      '/api/v1/sys/users/u_ql_q7/sessions',
      '/api/v1/sys/services/svc_tnt_demo_SV-DAU',
      '/api/v1/inv/parts/part_seed_01',
      '/api/v1/inv/parts/part_seed_01/prices',
      '/api/v1/sys/branches/br_q7',
      '/api/v1/sys/warehouses/wh_br_q7_WH-CHINH',
    ])('exempt detail %s answers like a missing id', async (path) => {
      const missing = await h.call(
        'GET',
        path.replace(/[^/]+(\/sessions|\/prices)?$/, (m) => m.replace(/^[^/]+/, 'nope_NOPE_0000')),
        { cookie: outsider },
      );
      const res = await h.call('GET', path, { cookie: outsider });
      expect(res.status, path).toBe(missing.status);
      expect(strip(res.json)).toEqual(strip(missing.json));
      expect(res.status).not.toBe(200);
    });

    // P2-C write route: a password reset aimed at a user of tnt_demo answers like a missing id (branch axis and
    // same-code-in-two-tenants are covered in worker-login.test.ts)
    it.each(['u_th_q7', 'u_ql_q7'])(
      'reset-password of %s (tnt_demo) answers like a missing id',
      async (id) => {
        const body = { temporaryPassword: 'Tam-Cheo-2026-zz', reason: 'thử chéo', version: 1 };
        const missing = await h.call('POST', '/api/v1/sys/users/nope_NOPE_0000/reset-password', {
          cookie: outsider,
          body,
        });
        const res = await h.call('POST', `/api/v1/sys/users/${id}/reset-password`, {
          cookie: outsider,
          body,
        });
        expect(res.status).toBe(404);
        expect(res.status).toBe(missing.status);
        expect(strip(res.json)).toEqual(strip(missing.json));
      },
    );

    it.each([
      '/api/v1/sys/roles',
      '/api/v1/sys/config/labor-rate',
      '/api/v1/sys/config/tax-rate',
      '/api/v1/sys/services?limit=100',
      '/api/v1/sys/price-lists',
      '/api/v1/inv/parts?limit=100',
      '/api/v1/acc/expense-categories',
      '/api/v1/rec/pickers/parts?q=a',
      '/api/v1/rec/pickers/services?q=a',
      '/api/v1/rec/service-workflows',
      '/api/v1/ein/connection',
      '/api/v1/sys/approvals',
      '/api/v1/sys/approvals/delegations',
    ])('exempt list %s carries nothing of tnt_demo', async (path) => {
      const res = await h.call('GET', path, { cookie: outsider });
      expect([200, 400, 403, 404, 409, 422], `${path} ${res.status}`).toContain(res.status);
      expect(res.text, path).not.toMatch(/tnt_demo|part_seed|SV-DAU|svc_tnt|Garage Demo/);
      expect(containsAny(res.text, everyId()), path).toEqual([]);
    });

    // FR-TEN-009 / UAT-TEN-05 / ADR 0001 §7.3: files are served by the API after a Scope check (no signed URL yet), and no
    // route takes a storage path from the caller, so knowing a path or an id of tnt_demo gives an outsider nothing
    it('a REC photo and an e-invoice file of tnt_demo are not served to the outsider, even with the exact ids and a forged path', async () => {
      const PNG = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHnOcQAAAAABJRU5ErkJggg==',
        'base64',
      );
      const form = new FormData();
      form.set('file', new File([new Uint8Array(PNG)], 'x.png', { type: 'image/png' }));
      const orderId = q7.orderId!;
      const up = await h.call('POST', `/api/v1/rec/orders/${orderId}/photos`, {
        cookie: readers.br_q7!.cvQ7!,
        form,
        key: 'tenant-axis-photo-000001',
      });
      expect(up.status, up.text).toBeLessThan(300);
      const own = await h.call('GET', `/api/v1/rec/orders/${orderId}/photos/${up.json.id}`, {
        cookie: readers.br_q7!.cvQ7!,
      });
      expect(own.status).toBe(200);
      const files = (h.container as { files?: { files?: Map<string, unknown> } }).files?.files;
      const stored = files ? [...files.keys()].filter((k) => k.includes('/tnt_demo/')) : [];
      const probes = [
        `/api/v1/rec/orders/${orderId}/photos/${up.json.id}`,
        `/api/v1/rec/orders/${orderId}/photos/${encodeURIComponent('../../' + (stored[0] ?? 'x'))}`,
        `/api/v1/ein/invoices/${q7.invoiceId}/files/xml`,
        `/api/v1/ein/invoices/${q7.invoiceId}/files/pdf`,
      ];
      const missing = await h.call('GET', '/api/v1/rec/orders/nope_NOPE_0000/photos/ph_none', {
        cookie: outsider,
      });
      for (const path of probes) {
        const res = await h.call('GET', path, { cookie: outsider });
        expect(res.status, path).toBe(404);
        expect(res.headers.get('content-type') ?? '', path).not.toMatch(/image|xml|pdf/);
        expect(strip(res.json), path).toEqual(strip(missing.json));
      }
    });

    it('availability of a part id of another tenant echoes the id and shows nothing: no quantity, no warehouse', async () => {
      const res = await h.call('GET', '/api/v1/inv/availability?partIds=part_seed_01', {
        cookie: outsider,
      });
      expect(res.status).toBe(200);
      expect(res.json.items).toEqual([{ partId: 'part_seed_01', available: 0, warehouses: [] }]);
    });

    it.each([
      { path: '/api/v1/crm/customers/export', body: {} },
      { path: '/api/v1/sys/audit/export', body: { reason: 'kiểm tra cách ly' } },
      {
        path: '/api/v1/rpt/export',
        body: { kind: 'monthly', month: monthOfToday(), reason: 'kiểm tra' },
      },
      { path: '/api/v1/rpt/export', body: { kind: 'reconcile', reason: 'kiểm tra' } },
    ])('export $path: nothing of tnt_demo', async ({ path, body }) => {
      const res = await h.call('POST', path, {
        cookie: outsider,
        key: 'exp-outsider-0000001',
        body,
      });
      expect([200, 403, 409, 422]).toContain(res.status);
      expect(containsAny(res.text, everyId())).toEqual([]);
    });

    it('search, notifications and the audit trail of the outsider carry nothing of tnt_demo', async () => {
      for (const path of [
        '/api/v1/crm/customers?q=ZZQ7&limit=20',
        '/api/v1/crm/customers?q=ZZTD&limit=20',
        '/api/v1/sys/audit?limit=100',
        '/api/v1/sys/notifications',
        '/api/v1/sys/users?limit=100',
      ]) {
        const res = await h.call('GET', path, { cookie: outsider });
        expect([200, 403, 404]).toContain(res.status);
        expect(containsAny(res.text, everyId()), path).toEqual([]);
        expect(res.text).not.toContain('tnt_demo');
      }
    });

    it('an idempotency key used in tnt_demo does not replay for the outsider (two tenants, two independent results)', async () => {
      const key = 'shared-key-000000000001';
      const body = { type: 'individual', name: 'Khach trung khoa', phone: '0912345678' };
      const demo = await h.call('POST', '/api/v1/crm/customers', {
        cookie: viewers.ownerAll,
        key,
        body,
      });
      const other = await h.call('POST', '/api/v1/crm/customers', { cookie: outsider, key, body });
      expect(demo.headers.get('idempotent-replayed')).toBeNull();
      expect(other.headers.get('idempotent-replayed')).toBeNull();
      if (demo.status === 201 && other.status === 201) expect(other.json.id).not.toBe(demo.json.id);
    });
  });
});

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}
function monthOfToday(): string {
  return new Date().toISOString().slice(0, 7);
}
