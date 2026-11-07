import type { Page } from '@/platform/pagination/pagination';
import type { Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import type { Consent } from '../domain/consent';
import type { DataRequest, RequestStatus, RetentionCheck } from '../domain/dataRequest';
import type {
  Customer,
  CustomerPii,
  CustomerType,
  RelationSource,
  Vehicle,
  VehicleHistoryEntry,
} from '../domain/entities';
import type { Ownership } from '../domain/ownership';

type Cursor = { v: string; id: string };
export interface PageQuery {
  limit: number;
  cursor?: Cursor;
}

/**
 * Every read takes a Scope (NFR-ISO-01). Company-level records are visible to a branch scope only
 * through links (relation with the branch); 'all' scopes read the collection directly.
 */
export interface CustomerRepository {
  list(
    scope: Scope,
    q: PageQuery & { type?: CustomerType; namePrefix?: string; direction: 'asc' | 'desc' },
  ): Promise<Page<Customer>>;
  /** null when missing or not linked to any branch of the scope */
  get(scope: Scope, id: string): Promise<Customer | null>;
  getInTx(tx: Tx, scope: Scope, id: string): Promise<Customer | null>;
  /** scope-checked batch read, order not guaranteed */
  getMany(scope: Scope, ids: readonly string[]): Promise<Customer[]>;
  /** company-wide read for a service that already authorised the access (projections, anonymisation) */
  getCompanyWide(tenantId: string, id: string): Promise<Customer | null>;
  /** same, inside the transaction (counters of a previous owner outside the actor's scope) */
  getCompanyWideInTx(tx: Tx, tenantId: string, id: string): Promise<Customer | null>;
  create(tx: Tx, c: Customer, pii: CustomerPii): void;
  /** FR-SYS-007 undo of an import ONLY: removes the customer, its contact document and its branch links */
  remove(tx: Tx, c: Pick<Customer, 'id' | 'branchIds'>): void;
  update(tx: Tx, id: string, patch: Record<string, unknown>): void;
  /** adds the link row for (customer, branch); idempotent */
  link(
    tx: Tx,
    c: Pick<Customer, 'id' | 'tenantId' | 'nameNorm' | 'type' | 'code'>,
    branchId: string,
    at: Date,
    relation: { source: RelationSource; by: string },
  ): void;
  /** keeps denormalised link columns in sync when name/type change */
  relink(
    tx: Tx,
    c: Pick<Customer, 'id' | 'tenantId' | 'nameNorm' | 'type' | 'code' | 'branchIds'>,
  ): void;
  getPii(tenantId: string, customerId: string): Promise<CustomerPii | null>;
  getPiiInTx(tx: Tx, tenantId: string, customerId: string): Promise<CustomerPii | null>;
  setPii(tx: Tx, customerId: string, patch: Record<string, unknown>): void;
  /** exact normalised phone, company-wide (cross-branch lookup P1 and phone search); at most `limit` ids */
  customerIdsByPhone(
    tenantId: string,
    phoneNorm: string,
    mode: 'exact' | 'prefix',
    limit: number,
  ): Promise<string[]>;
}

export interface VehicleRepository {
  list(
    scope: Scope,
    q: PageQuery & { platePrefix?: string; direction: 'asc' | 'desc' },
  ): Promise<Page<Vehicle>>;
  get(scope: Scope, id: string): Promise<Vehicle | null>;
  getInTx(tx: Tx, scope: Scope, id: string): Promise<Vehicle | null>;
  getMany(scope: Scope, ids: readonly string[]): Promise<Vehicle[]>;
  getCompanyWide(tenantId: string, id: string): Promise<Vehicle | null>;
  getCompanyWideInTx(tx: Tx, tenantId: string, id: string): Promise<Vehicle | null>;
  /** vehicleId that holds a plate in the company (uniqueness registry) or null */
  vehicleIdByPlate(tenantId: string, plateNorm: string): Promise<string | null>;
  /** C11: vehicleId holding the VIN in the company, or null */
  vehicleIdByVin(tenantId: string, vin: string): Promise<string | null>;
  /** moves the VIN registry slot (create new, free old); fails with AlreadyExistsError when taken */
  setVin(
    tx: Tx,
    v: Pick<Vehicle, 'id' | 'tenantId'>,
    oldVin: string | null,
    newVin: string | null,
  ): void;
  /** fails the transaction with AlreadyExistsError when the plate (or VIN) is taken */
  create(tx: Tx, v: Vehicle): void;
  /** FR-SYS-007 undo of an import ONLY: removes the vehicle, its plate and VIN slots and its branch links */
  remove(tx: Tx, v: Pick<Vehicle, 'id' | 'tenantId' | 'plateNorm' | 'vin' | 'branchIds'>): void;
  update(tx: Tx, id: string, patch: Record<string, unknown>): void;
  /** moves the plate registry slot and the link columns */
  changePlate(
    tx: Tx,
    v: Pick<Vehicle, 'id' | 'tenantId' | 'plateNorm' | 'branchIds'>,
    newPlateNorm: string,
  ): void;
  link(tx: Tx, v: Pick<Vehicle, 'id' | 'tenantId' | 'plateNorm'>, branchId: string, at: Date): void;
  byCustomer(scope: Scope, customerId: string, limit: number): Promise<Vehicle[]>;
}

export interface OwnershipRepository {
  /** newest first; authorisation is the caller's (it has already resolved the vehicle/customer in scope) */
  listByVehicle(tenantId: string, vehicleId: string): Promise<Ownership[]>;
  listByVehicleInTx(tx: Tx, tenantId: string, vehicleId: string): Promise<Ownership[]>;
  listByCustomer(tenantId: string, customerId: string, limit: number): Promise<Ownership[]>;
  create(tx: Tx, o: Ownership): void;
  /** FR-SYS-007 undo of an import ONLY */
  remove(tx: Tx, id: string): void;
  close(tx: Tx, id: string, to: string): void;
}

export interface ConsentRepository {
  /** newest first */
  listByCustomer(tenantId: string, customerId: string): Promise<Consent[]>;
  get(tenantId: string, id: string): Promise<Consent | null>;
  getInTx(tx: Tx, tenantId: string, id: string): Promise<Consent | null>;
  create(tx: Tx, c: Consent): void;
  update(tx: Tx, id: string, patch: Record<string, unknown>): void;
}

export interface DataRequestRepository {
  list(
    scope: Scope,
    q: PageQuery & { status?: RequestStatus; customerId?: string },
  ): Promise<Page<DataRequest>>;
  get(scope: Scope, id: string): Promise<DataRequest | null>;
  getInTx(tx: Tx, scope: Scope, id: string): Promise<DataRequest | null>;
  create(tx: Tx, r: DataRequest): void;
  update(tx: Tx, id: string, patch: Record<string, unknown>): void;
}

/**
 * Read model fed by REC (one entry per repair order). The projection is deliberately NOT scoped
 * by branch: FR-CRM-004 shows a vehicle's history at every branch, but only the white-listed fields
 * of VehicleHistoryEntry exist in it (BA §10, P3).
 */
export interface VehicleHistoryRepository {
  upsert(tx: Tx, e: VehicleHistoryEntry): void;
  listByVehicle(
    tenantId: string,
    vehicleId: string,
    q: PageQuery,
  ): Promise<Page<VehicleHistoryEntry>>;
}

/** Blockers to deleting a customer (open orders, debts, warranty): REC/ACC implement it later; stub returns none. */
export interface CustomerRetentionPort {
  check(tenantId: string, customerId: string): Promise<RetentionCheck>;
}
