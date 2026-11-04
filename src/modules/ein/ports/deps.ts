import type { FileStore } from '@/platform/files/fileStore';
import type { SysDeps } from '@/modules/sys';
import type {
  BuyerSource,
  InvoiceOrderSource,
  InvoiceQueueRepository,
  InvoiceRepository,
  InvoiceRequestRepository,
  OrderInvoiceIndexRepository,
} from './ports';
import type { ProviderRegistry } from './provider';

/** Technical limits (not business rules); business policy is the effective-dated `einvoice-policy` config. */
export interface EinConfig {
  /** items kept in one branch queue document; a full queue refuses new issues rather than dropping a request */
  queueMax: number;
  /** how long a claimed attempt may hold a request before it counts as unknown */
  leaseMs: number;
  /** rows scanned for one list page / warning list */
  scanMax: number;
  listPageSize: number;
  /** attempts kept on a request */
  attemptsKept: number;
  /** due requests handled by one job run */
  jobBatch: number;
}

export const DEFAULT_EIN_CONFIG: EinConfig = {
  queueMax: 500,
  leaseMs: 120_000,
  scanMax: 500,
  listPageSize: 50,
  attemptsKept: 12,
  jobBatch: 25,
};

export interface EinDeps {
  sys: SysDeps;
  invoices: InvoiceRepository;
  requests: InvoiceRequestRepository;
  index: OrderInvoiceIndexRepository;
  queue: InvoiceQueueRepository;
  orders: InvoiceOrderSource;
  buyers: BuyerSource;
  providers: ProviderRegistry;
  files: FileStore;
  ein: EinConfig;
}
