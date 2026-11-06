import { resolveScope } from '@/platform/rbac/rbac';
import { AppError } from '@/platform/errors/errors';
import {
  ImportStepError,
  type ImportColumn,
  type ImportEntityRef,
  type ImportKindHandler,
  type ImportUnit,
  type RowIssue,
} from '@/modules/sys';
import {
  isPlausiblePhone,
  isPlausiblePlate,
  isValidTaxCode,
  isValidVin,
  normalizePhone,
  normalizePlate,
  normalizeTaxCode,
  normalizeVin,
} from '../domain/normalize';
import type { CrmDeps } from '../ports/deps';
import { auditEntry } from './support';
import { createCustomer } from './customers';
import { createVehicle } from './vehicles';

/**
 * FR-SYS-007 import of customers and their vehicles (CRM). One row = one customer, optionally with one vehicle; rows
 * that share a "Mã khách cũ" are ONE customer with several vehicles. Writes go through createCustomer/createVehicle
 * as the actor (permissions, numbering, audit, plate/VIN registry), with keys derived from the batch so a retry never
 * duplicates. Undo deletes only records that are still exactly as imported (version 1, one owner record, no other
 * vehicle, no blocker from REC/ACC); anything else refuses the whole undo.
 */
const col = (
  field: string,
  label: string,
  required: boolean,
  example: string,
  aliases: string[] = [],
): ImportColumn => ({ field, label, required, example, aliases });

export const CUSTOMER_IMPORT_COLUMNS: readonly ImportColumn[] = [
  col('externalCode', 'Mã khách cũ', false, 'KH001', ['Mã KH', 'Mã khách']),
  col('type', 'Loại khách', false, 'Cá nhân', ['Loại']),
  col('name', 'Tên khách hàng', true, 'Nguyễn Văn A', ['Tên khách', 'Họ tên', 'Tên']),
  col('phone', 'Số điện thoại', false, '0901234567', ['SĐT', 'Điện thoại', 'Phone']),
  col('email', 'Email', false, 'a@example.com'),
  col('address', 'Địa chỉ', false, '1 Lê Lợi, Quận 1'),
  col('taxCode', 'Mã số thuế', false, '', ['MST']),
  col('contactName', 'Người liên hệ', false, ''),
  col('plate', 'Biển số xe', false, '51A-123.45', ['Biển số', 'Biển số xe']),
  col('make', 'Hãng xe', false, 'Toyota', ['Hãng']),
  col('model', 'Dòng xe', false, 'Vios', ['Mẫu xe', 'Dòng']),
  col('year', 'Năm sản xuất', false, '2020', ['Năm SX', 'Năm']),
  col('vin', 'Số khung', false, '', ['VIN']),
  col('engineNo', 'Số máy', false, ''),
  col('isCommercial', 'Xe kinh doanh', false, 'Không', ['Kinh doanh']),
  col('lastKm', 'Số km', false, '45000', ['Km', 'Số km hiện tại']),
];

const VEHICLE_FIELDS = [
  'plate',
  'make',
  'model',
  'year',
  'vin',
  'engineNo',
  'isCommercial',
  'lastKm',
];
const yes = (s: string) =>
  ['co', 'có', 'yes', 'y', 'true', '1', 'x'].includes(s.trim().toLowerCase());
const no = (s: string) =>
  ['khong', 'không', 'no', 'n', 'false', '0', ''].includes(s.trim().toLowerCase());

interface VehicleIn {
  row: number;
  plate: string;
  make: string;
  model: string;
  year: number;
  vin?: string;
  engineNo?: string;
  isCommercial: boolean;
  lastKm?: number;
}
interface CustomerIn {
  type: 'individual' | 'business';
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  taxCode?: string;
  contactName?: string;
}
interface CustomerUnitData {
  customer: CustomerIn;
  vehicles: VehicleIn[];
}

function parseCustomer(
  c: Record<string, string>,
  row: number,
  issues: RowIssue[],
): CustomerIn | null {
  const bad = (field: string, message: string) => issues.push({ row, field, message });
  const before = issues.length;
  const t = c.type!.trim().toLowerCase();
  let type: CustomerIn['type'] = 'individual';
  if (['doanh nghiep', 'doanh nghiệp', 'dn', 'business', 'cong ty', 'công ty'].includes(t))
    type = 'business';
  else if (t && !['ca nhan', 'cá nhân', 'cn', 'individual'].includes(t))
    bad('type', 'Loại khách chỉ nhận "Cá nhân" hoặc "Doanh nghiệp".');
  const name = c.name!.trim();
  if (name.length < 2 || name.length > 120) bad('name', 'Tên khách gồm 2 đến 120 ký tự.');
  let phone: string | undefined;
  if (c.phone) {
    let norm = normalizePhone(c.phone);
    // a spreadsheet number cell drops the leading zero
    if (/^[1-9]\d{8}$/.test(norm)) norm = `0${norm}`;
    if (!isPlausiblePhone(norm))
      bad('phone', 'Số điện thoại chưa đúng (10 hoặc 11 số, bắt đầu bằng 0).');
    else phone = norm;
  }
  if (c.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email) || c.email.length > 120))
    bad('email', 'Email chưa đúng.');
  if (c.address!.length > 300) bad('address', 'Địa chỉ tối đa 300 ký tự.');
  if (c.contactName!.length > 120) bad('contactName', 'Người liên hệ tối đa 120 ký tự.');
  let taxCode: string | undefined;
  if (c.taxCode) {
    taxCode = normalizeTaxCode(c.taxCode);
    if (!isValidTaxCode(taxCode)) bad('taxCode', 'Mã số thuế gồm 10 số, có thể kèm -NNN.');
    else if (type === 'individual') bad('taxCode', 'Chỉ khách doanh nghiệp có mã số thuế.');
  }
  if (issues.length > before) return null;
  return {
    type,
    name,
    ...(phone ? { phone } : {}),
    ...(c.email ? { email: c.email } : {}),
    ...(c.address ? { address: c.address } : {}),
    ...(taxCode ? { taxCode } : {}),
    ...(c.contactName ? { contactName: c.contactName } : {}),
  };
}

function parseVehicle(
  c: Record<string, string>,
  row: number,
  thisYear: number,
  issues: RowIssue[],
): VehicleIn | null {
  if (VEHICLE_FIELDS.every((f) => !c[f])) return null;
  const before = issues.length;
  const bad = (field: string, message: string) => issues.push({ row, field, message });
  const plateNorm = normalizePlate(c.plate!);
  if (!c.plate) bad('plate', 'Dòng có thông tin xe nhưng thiếu biển số.');
  else if (!isPlausiblePlate(plateNorm))
    bad('plate', 'Biển số chưa đúng (5-12 ký tự gồm chữ và số).');
  if (!c.make) bad('make', 'Thiếu hãng xe.');
  if (!c.model) bad('model', 'Thiếu dòng xe.');
  const year = Number(c.year);
  if (!c.year || !Number.isInteger(year) || year < 1950 || year > thisYear + 1)
    bad('year', 'Năm sản xuất chưa hợp lệ.');
  let vin: string | undefined;
  if (c.vin) {
    vin = normalizeVin(c.vin);
    if (!isValidVin(vin)) bad('vin', 'Số khung gồm 17 ký tự chữ và số, không có I, O, Q.');
  }
  if (c.isCommercial && !yes(c.isCommercial) && !no(c.isCommercial))
    bad('isCommercial', 'Xe kinh doanh chỉ nhận "Có" hoặc "Không".');
  let lastKm: number | undefined;
  if (c.lastKm) {
    lastKm = Number(c.lastKm.replace(/[.,\s]/g, ''));
    if (!Number.isInteger(lastKm) || lastKm < 0 || lastKm > 9_999_999)
      bad('lastKm', 'Số km chưa hợp lệ.');
  }
  if (issues.length > before) return null;
  return {
    row,
    plate: c.plate!.trim().toUpperCase(),
    make: c.make!,
    model: c.model!,
    year,
    ...(vin ? { vin } : {}),
    ...(c.engineNo ? { engineNo: c.engineNo } : {}),
    isCommercial: yes(c.isCommercial ?? ''),
    ...(lastKm !== undefined ? { lastKm } : {}),
  };
}

export function buildCustomerImport(getDeps: () => CrmDeps): ImportKindHandler {
  return {
    kind: 'customers-vehicles',
    label: 'Khách hàng và xe',
    columns: CUSTOMER_IMPORT_COLUMNS,
    needsWarehouse: false,
    chunkSize: 20,
    requires: ['customer:create', 'vehicle:create'],

    async validate(actor, rows) {
      const deps = getDeps();
      const issues: RowIssue[] = [];
      const warnings: RowIssue[] = [];
      const thisYear = deps.sys.clock.now().getUTCFullYear();
      const units = new Map<string, ImportUnit & { data: CustomerUnitData }>();
      const plates = new Map<string, number>();
      const vins = new Map<string, number>();
      for (const r of rows) {
        const c = r.cells;
        const mark = issues.length;
        const customer = parseCustomer(c, r.row, issues);
        const vehicle = parseVehicle(c, r.row, thisYear, issues);
        if (issues.length > mark) continue;
        const key = c.externalCode ? `x:${c.externalCode.trim().toLowerCase()}` : `r:${r.row}`;
        const unit = units.get(key);
        if (unit) {
          if (customer!.name.toLowerCase() !== unit.data.customer.name.toLowerCase())
            issues.push({
              row: r.row,
              field: 'name',
              message: `Cùng "Mã khách cũ" với dòng ${unit.row} nhưng khác tên khách.`,
            });
          unit.rows.push(r.row);
          if (vehicle) unit.data.vehicles.push(vehicle);
        } else {
          units.set(key, {
            row: r.row,
            rows: [r.row],
            data: { customer: customer!, vehicles: vehicle ? [vehicle] : [] },
          });
        }
        if (vehicle) {
          const pn = normalizePlate(vehicle.plate);
          const dup = plates.get(pn);
          if (dup !== undefined)
            issues.push({
              row: r.row,
              field: 'plate',
              message: `Biển số trùng với dòng ${dup} trong tệp.`,
            });
          else plates.set(pn, r.row);
          if (vehicle.vin) {
            const dv = vins.get(vehicle.vin);
            if (dv !== undefined)
              issues.push({
                row: r.row,
                field: 'vin',
                message: `Số khung trùng với dòng ${dv} trong tệp.`,
              });
            else vins.set(vehicle.vin, r.row);
          }
        }
      }
      // clashes with data already in the system (plate and VIN are unique in the whole company)
      for (const [pn, row] of plates) {
        if (await deps.vehicles.vehicleIdByPlate(actor.tenantId, pn))
          issues.push({ row, field: 'plate', message: 'Biển số đã có trong hệ thống.' });
      }
      for (const [vin, row] of vins) {
        if (await deps.vehicles.vehicleIdByVin(actor.tenantId, vin))
          issues.push({ row, field: 'vin', message: 'Số khung đã gắn với một xe khác.' });
      }
      const cScope = resolveScope(actor, 'customer:create');
      for (const u of units.values()) {
        const phone = u.data.customer.phone;
        // R97/NFR-ISO-01: warn only about customers the importer may see; a hit outside the scope stays silent
        const hits = phone
          ? await deps.customers.customerIdsByPhone(actor.tenantId, phone, 'exact', 5)
          : [];
        if (hits.length && (await deps.customers.getMany(cScope, hits)).length)
          warnings.push({
            row: u.row,
            field: 'phone',
            message: 'Số điện thoại đã có ở một khách khác; vẫn sẽ tạo khách mới.',
          });
      }
      return { units: [...units.values()], issues, warnings };
    },

    async commit(actor, units, ctx) {
      const deps = getDeps();
      const refs: ImportEntityRef[] = [];
      try {
        for (const u of units) {
          const d = u.data as unknown as CustomerUnitData;
          const base = `imp-${ctx.batchId}-${u.row}`;
          const c = await createCustomer(deps, actor, d.customer, {
            idempotencyKey: `${base}-c`,
            requestId: ctx.requestId,
          });
          const customerId = (c.response.body as { id: string }).id;
          refs.push({ type: 'customer', id: customerId, row: u.row });
          for (const [i, { row, ...vehicle }] of d.vehicles.entries()) {
            const vr = await createVehicle(
              deps,
              actor,
              { ...vehicle, customerId },
              { idempotencyKey: `${base}-v${i}`, requestId: ctx.requestId },
            );
            refs.push({ type: 'vehicle', id: (vr.response.body as { id: string }).id, row });
          }
        }
      } catch (e) {
        throw new ImportStepError(refs, e);
      }
      return refs;
    },

    async undo(actor, refs, ctx) {
      const deps = getDeps();
      const cScope = resolveScope(actor, 'customer:create');
      const vScope = resolveScope(actor, 'vehicle:create');
      const blocked: string[] = [];
      // preflight: nothing is deleted unless every record is still exactly as imported
      const vehicleOwner = new Map<string, string>();
      for (const r of refs.filter((x) => x.type === 'vehicle')) {
        const v = await deps.vehicles.get(vScope, r.id);
        if (!v) continue;
        const own = await deps.ownerships.listByVehicle(actor.tenantId, v.id);
        if (v.version !== 1 || own.length !== 1 || v.branchIds.length !== 1)
          blocked.push(`Dòng ${r.row}: xe đã được sửa hoặc đổi chủ sau khi nhập.`);
        vehicleOwner.set(v.id, v.currentOwnerId ?? '');
      }
      const perCustomer = new Map<string, number>();
      for (const owner of vehicleOwner.values())
        perCustomer.set(owner, (perCustomer.get(owner) ?? 0) + 1);
      for (const r of refs.filter((x) => x.type === 'customer')) {
        const c = await deps.customers.get(cScope, r.id);
        if (!c) continue;
        const check = await deps.retention.check(actor.tenantId, c.id);
        if (
          c.version !== 1 ||
          c.branchIds.length !== 1 ||
          c.vehicleCount !== (perCustomer.get(c.id) ?? 0) ||
          check.blockers.length > 0 ||
          check.retained.length > 0
        )
          blocked.push(`Dòng ${r.row}: khách đã được dùng hoặc sửa sau khi nhập.`);
      }
      if (blocked.length)
        throw new AppError(
          'import_undo_blocked',
          409,
          blocked.slice(0, 50).map((message) => ({ field: 'refs', message })),
        );
      // vehicles first (the customer counter), then customers
      const vids = [...vehicleOwner.keys()];
      for (let i = 0; i < vids.length; i += 20)
        await deps.sys.uow.run(async (tx) => {
          // Firestore: every read of the transaction comes before its first write
          const found: {
            id: string;
            v: NonNullable<Awaited<ReturnType<typeof deps.vehicles.getInTx>>>;
            own: Awaited<ReturnType<typeof deps.ownerships.listByVehicleInTx>>;
          }[] = [];
          for (const id of vids.slice(i, i + 20)) {
            const v = await deps.vehicles.getInTx(tx, vScope, id);
            if (!v) continue;
            found.push({
              id,
              v,
              own: await deps.ownerships.listByVehicleInTx(tx, actor.tenantId, id),
            });
          }
          for (const { id, v, own } of found) {
            deps.vehicles.remove(tx, v);
            for (const o of own) deps.ownerships.remove(tx, o.id);
            deps.sys.audit.record(
              tx,
              auditEntry(deps.sys, actor, ctx, {
                branchId: v.branchId,
                entityType: 'vehicle',
                entityId: id,
                action: 'vehicle.import-undo',
                // R96: the undo audit carries no personal or identifying value (no plate, name, phone)
                before: { imported: true },
                reason: ctx.reason,
              }),
            );
          }
        });
      const cids = refs.filter((x) => x.type === 'customer').map((x) => x.id);
      for (let i = 0; i < cids.length; i += 20)
        await deps.sys.uow.run(async (tx) => {
          const found: {
            id: string;
            c: NonNullable<Awaited<ReturnType<typeof deps.customers.getInTx>>>;
          }[] = [];
          for (const id of cids.slice(i, i + 20)) {
            const c = await deps.customers.getInTx(tx, cScope, id);
            if (c) found.push({ id, c });
          }
          for (const { id, c } of found) {
            deps.customers.remove(tx, c);
            deps.sys.audit.record(
              tx,
              auditEntry(deps.sys, actor, ctx, {
                branchId: c.branchId,
                entityType: 'customer',
                entityId: id,
                action: 'customer.import-undo',
                before: { code: c.code },
                reason: ctx.reason,
              }),
            );
          }
        });
    },
  };
}
