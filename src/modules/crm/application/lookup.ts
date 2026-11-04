import { validationFailed } from '@/platform/errors/errors';
import { resolveScope, resolveWorkingScope, type Actor } from '@/platform/rbac/rbac';
import { allBranchesScope } from '@/platform/scope/scope';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import type { Customer, Vehicle } from '../domain/entities';
import {
  isPlausiblePhone,
  isPlausiblePlate,
  maskIdentifier,
  normalizePhone,
  normalizePlate,
} from '../domain/normalize';
import type { CrmDeps } from '../ports/deps';
import {
  accessEntry,
  auditEntry,
  idemOf,
  notFound,
  parseInput,
  writableWorkingBranch,
  z,
  type RequestCtx,
} from './support';

/**
 * Cross-branch exact lookup (FR-CRM-002 unique plate, FR-CRM-004; BA §10.1.4, projections P1 and P2).
 * Exact plate or full phone only, at most `lookupMaxResults` customers, no browsing, no export.
 * The result is a server-built projection with a white list of fields; contact data, notes, labels,
 * debts and the other branches' records are not part of it. Phone lookups are access-logged.
 */
export interface CustomerProjection {
  id: string;
  code: string;
  name: string;
  type: string;
  /** advertising channels the customer agreed to (yes/no per channel) */
  marketing: string[];
  /** names of the branches the customer is known at */
  branches: string[];
  vehicles: { id: string; plate: string; make: string; model: string; year: number }[];
  /** true when the actor's own scope already has a relation (full record available) */
  related: boolean;
}

export interface VehicleProjection {
  id: string;
  plate: string;
  make: string;
  model: string;
  year: number;
  isCommercial: boolean;
  /** VIN and engine number are shown partly masked outside the owning branch (P2) */
  vinMasked: string | null;
  engineNoMasked: string | null;
  lastKm: number | null;
  owner: CustomerProjection | null;
  related: boolean;
}

export interface LookupResult {
  vehicles: VehicleProjection[];
  customers: CustomerProjection[];
}

const lookupSchema = z
  .object({
    plate: z.string().trim().max(20).optional(),
    phone: z.string().trim().max(20).optional(),
  })
  .refine((d) => !!d.plate !== !!d.phone, { message: 'Nhập biển số hoặc số điện thoại.' });

export async function lookupExact(
  deps: CrmDeps,
  actor: Actor,
  raw: unknown,
  ctx: { requestId: string; sessionId?: string },
): Promise<LookupResult> {
  resolveScope(actor, 'customer-lookup:view');
  const data = parseInput(lookupSchema, raw);
  await deps.sys.limiter.hit('search', actor.userId);
  const companyId = actor.companyId;
  const mine = (() => {
    try {
      return resolveWorkingScope(actor, 'customer:view');
    } catch {
      return null;
    }
  })();
  const branchNames = new Map(
    (await deps.sys.branches.list(allBranchesScope(companyId))).map((b) => [b.id, b.name] as const),
  );
  const relatedTo = (branchIds: readonly string[]) =>
    !!mine &&
    (mine.kind === 'all' ||
      branchIds.some((b) => mine.kind === 'branches' && mine.branchIds.includes(b)));

  const projectCustomer = async (c: Customer): Promise<CustomerProjection> => {
    const owned = (await deps.ownerships.listByCustomer(companyId, c.id, 30)).filter(
      (o) => o.to === null,
    );
    const vs: Vehicle[] = [];
    for (const o of owned) {
      const v = await deps.vehicles.getCompanyWide(companyId, o.vehicleId);
      if (v) vs.push(v);
    }
    return {
      id: c.id,
      code: c.code,
      name: c.name,
      type: c.type,
      marketing: c.marketing,
      branches: c.branchIds.map((b) => branchNames.get(b) ?? b),
      vehicles: vs.map((v) => ({
        id: v.id,
        plate: v.plate,
        make: v.make,
        model: v.model,
        year: v.year,
      })),
      related: relatedTo(c.branchIds),
    };
  };

  if (data.plate) {
    const plateNorm = normalizePlate(data.plate);
    if (!isPlausiblePlate(plateNorm))
      throw validationFailed([{ field: 'plate', message: 'Biển số chưa đúng.' }]);
    const id = await deps.vehicles.vehicleIdByPlate(companyId, plateNorm);
    const v = id ? await deps.vehicles.getCompanyWide(companyId, id) : null;
    if (!v) return { vehicles: [], customers: [] };
    const owner = v.currentOwnerId
      ? await deps.customers.getCompanyWide(companyId, v.currentOwnerId)
      : null;
    const vp: VehicleProjection = {
      id: v.id,
      plate: v.plate,
      make: v.make,
      model: v.model,
      year: v.year,
      isCommercial: v.isCommercial,
      vinMasked: v.vin ? maskIdentifier(v.vin) : null,
      engineNoMasked: v.engineNo ? maskIdentifier(v.engineNo) : null,
      lastKm: v.lastKm ?? null,
      owner: owner && owner.status === 'active' ? await projectCustomer(owner) : null,
      related: relatedTo(v.branchIds),
    };
    return { vehicles: [vp], customers: [] };
  }

  const phoneNorm = normalizePhone(data.phone!);
  if (!isPlausiblePhone(phoneNorm))
    throw validationFailed([{ field: 'phone', message: 'Nhập đủ số điện thoại.' }]);
  const ids = await deps.customers.customerIdsByPhone(
    companyId,
    phoneNorm,
    'exact',
    deps.crm.lookupMaxResults,
  );
  const customers: CustomerProjection[] = [];
  for (const id of ids) {
    const c = await deps.customers.getCompanyWide(companyId, id);
    if (c && c.status === 'active') customers.push(await projectCustomer(c));
  }
  // BA §7.3 event 4: every phone search is logged (without the number)
  await deps.sys.piiLog.record(
    accessEntry(deps, actor, ctx.sessionId, ctx.requestId, {
      entityType: 'customer',
      entityId: '*',
      purpose: 'search_by_phone',
      fields: ['phone'],
      rowCount: customers.length,
    }),
  );
  return { vehicles: [], customers };
}

/**
 * Creates the relation between a customer (and the vehicles it owns) and the working branch, after
 * an exact lookup found the record at another branch (BA §10.1.5). REC calls this when an
 * appointment, quote or order is created. After it the branch sees the full record per its PII rights.
 */
export async function relateToWorkingBranch(
  deps: CrmDeps,
  actor: Actor,
  customerId: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  void input;
  const scope = resolveScope(actor, 'customer-lookup:view');
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/crm/customers/${customerId}/relate`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ customerId }),
    },
    async (tx) => {
      const c = await deps.customers.getCompanyWideInTx(tx, actor.companyId, customerId);
      if (!c || c.status !== 'active') throw notFound();
      const branch = await writableWorkingBranch(deps, tx, actor, scope);
      if (c.branchIds.includes(branch.id))
        return { status: 200, body: { id: c.id, related: true, changed: false } };
      const now = deps.sys.clock.now();
      // Firestore transactions: every read comes before the first write
      const owned = (await deps.ownerships.listByCustomer(actor.companyId, c.id, 100)).filter(
        (o) => o.to === null,
      );
      const vehicles = (
        await Promise.all(
          owned.map((o) => deps.vehicles.getCompanyWideInTx(tx, actor.companyId, o.vehicleId)),
        )
      ).flatMap((v) => (v && !v.branchIds.includes(branch.id) ? [v] : []));
      deps.customers.update(tx, c.id, { branchIds: [...c.branchIds, branch.id] });
      deps.customers.link(tx, c, branch.id, now);
      for (const v of vehicles) {
        deps.vehicles.update(tx, v.id, { branchIds: [...v.branchIds, branch.id] });
        deps.vehicles.link(tx, v, branch.id, now);
      }
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: branch.id,
          entityType: 'customer',
          entityId: c.id,
          action: 'customer.relate',
          after: { branchId: branch.id, vehicles: owned.length },
        }),
      );
      return { status: 200, body: { id: c.id, related: true, changed: true } };
    },
  );
}
