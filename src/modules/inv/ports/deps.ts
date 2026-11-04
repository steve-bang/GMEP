import type { SysDeps } from '@/modules/sys';
import type {
  IssueReturnRepository,
  MovementRepository,
  PartRepository,
  ReservationRepository,
  StockBalanceRepository,
  StockDocumentRepository,
} from './ports';

/** INV configuration: documented defaults, none hard-coded in a use case. */
export interface InvConfig {
  /** lines per document; each line is one balance + one ledger row inside one transaction */
  maxDocLines: number;
  /** FR-INV-005 thresholds when no `inventory-policy` version is in force [Đề xuất dev - chờ xác nhận: Khách] */
  defaultGrnPriceVarianceBp: number;
  defaultGrnQtyVarianceBp: number;
  /** reorder list rows per page */
  lowStockMax: number;
}

export const DEFAULT_INV_CONFIG: InvConfig = {
  maxDocLines: 100,
  defaultGrnPriceVarianceBp: 500,
  defaultGrnQtyVarianceBp: 0,
  lowStockMax: 200,
};

export interface InvDeps {
  sys: SysDeps;
  parts: PartRepository;
  balances: StockBalanceRepository;
  movements: MovementRepository;
  documents: StockDocumentRepository;
  reservations: ReservationRepository;
  returns: IssueReturnRepository;
  inv: InvConfig;
}
