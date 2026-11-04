import type { Page } from '@/platform/pagination/pagination';
import type { Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import type {
  Part,
  PartStatus,
  Reservation,
  ReservationStatus,
  StockBalance,
  StockDocStatus,
  StockDocType,
  StockDocument,
  StockMovement,
} from '../domain/entities';

type Cursor = { v: string; id: string };
export interface PageQuery {
  limit: number;
  cursor?: Cursor;
}

/**
 * Every read takes a Scope (NFR-ISO-01). Parts are company-level master data: a scope grants
 * access to the company's catalogue, not to any branch's stock. Balances, movements, documents and
 * reservations are branch records filtered by `branchId` on the server.
 */
export interface PartRepository {
  list(
    scope: Scope,
    q: PageQuery & {
      sort: 'code' | 'name';
      prefix?: string;
      group?: string;
      status?: PartStatus;
    },
  ): Promise<Page<Part>>;
  get(scope: Scope, id: string): Promise<Part | null>;
  getInTx(tx: Tx, scope: Scope, id: string): Promise<Part | null>;
  getMany(scope: Scope, ids: readonly string[]): Promise<Part[]>;
  /** id of the part owning this uniqueness key (letters+digits of the code) */
  idByCodeKey(scope: Scope, codeKey: string): Promise<string | null>;
  idByBarcode(scope: Scope, barcode: string): Promise<string | null>;
  /** parts compatible with a vehicle line, ordered by code */
  listByCompat(scope: Scope, compatKey: string, limit: number): Promise<Part[]>;
  /** stages the part and its uniqueness slots; AlreadyExistsError when the code key or barcode is taken */
  create(tx: Tx, p: Part): void;
  update(tx: Tx, id: string, patch: Record<string, unknown>): void;
  /** moves the barcode slot; AlreadyExistsError when the new barcode is taken */
  rebarcode(
    tx: Tx,
    p: Pick<Part, 'id' | 'companyId'>,
    from: string | undefined,
    to: string | undefined,
  ): void;
  /** rewrites the vehicle-line links used by the model search */
  relinkCompat(
    tx: Tx,
    p: Pick<Part, 'id' | 'companyId' | 'code'>,
    from: readonly string[],
    to: readonly string[],
  ): void;
}

export interface StockBalanceRepository {
  list(
    scope: Scope,
    q: PageQuery & {
      prefix?: string;
      warehouseId?: string;
      lowStock?: boolean;
    },
  ): Promise<Page<StockBalance>>;
  /** all warehouses of one part inside the scope */
  listByPart(scope: Scope, partId: string, limit: number): Promise<StockBalance[]>;
  get(scope: Scope, id: string): Promise<StockBalance | null>;
  getInTx(tx: Tx, scope: Scope, id: string): Promise<StockBalance | null>;
  /** stages the full balance document (it was read in this transaction) */
  save(tx: Tx, b: StockBalance): void;
  /** true when some balance of the warehouse is not zero (guards deactivation, FR-SYS-029) */
  hasStock(companyId: string, warehouseId: string): Promise<boolean>;
}

export interface MovementRepository {
  /** create-only: ledger ids are deterministic, a repeat fails instead of writing twice */
  append(tx: Tx, m: StockMovement): void;
  /** the stock card, newest first (FR-INV-021, RULE-009) */
  listByBalance(
    scope: Scope,
    q: PageQuery & { warehouseId: string; partId: string },
  ): Promise<Page<StockMovement>>;
}

export interface StockDocumentRepository {
  list(
    scope: Scope,
    q: PageQuery & { type?: StockDocType; status?: StockDocStatus },
  ): Promise<Page<StockDocument>>;
  get(scope: Scope, id: string): Promise<StockDocument | null>;
  getInTx(tx: Tx, scope: Scope, id: string): Promise<StockDocument | null>;
  create(tx: Tx, d: StockDocument): void;
  update(tx: Tx, id: string, patch: Record<string, unknown>): void;
  /** true when a draft document refers to the warehouse (guards deactivation) */
  hasOpen(companyId: string, warehouseId: string): Promise<boolean>;
}

export interface ReservationRepository {
  get(scope: Scope, id: string): Promise<Reservation | null>;
  getInTx(tx: Tx, scope: Scope, id: string): Promise<Reservation | null>;
  listBySource(
    scope: Scope,
    sourceType: string,
    sourceId: string,
    limit: number,
  ): Promise<Reservation[]>;
  listByPart(
    scope: Scope,
    q: PageQuery & { partId: string; status?: ReservationStatus },
  ): Promise<Page<Reservation>>;
  /** open (holding) reservations of the scope, oldest first: shortage list and long-held report */
  listOpen(scope: Scope, limit: number): Promise<Reservation[]>;
  create(tx: Tx, r: Reservation): void;
  update(tx: Tx, id: string, patch: Record<string, unknown>): void;
}

/** Quantity of an issued GIN line already returned by RTN documents. */
export interface IssueReturnRepository {
  getInTx(tx: Tx, scope: Scope, id: string): Promise<{ returnedQty: number } | null>;
  save(
    tx: Tx,
    id: string,
    v: {
      companyId: string;
      branchId: string;
      documentId: string;
      lineNo: number;
      returnedQty: number;
    },
  ): void;
}
