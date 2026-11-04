import type { SysDeps } from '@/modules/sys';
import type { ContactChannel } from '../domain/consent';
import type {
  ConsentRepository,
  CustomerRepository,
  CustomerRetentionPort,
  DataRequestRepository,
  OwnershipRepository,
  VehicleHistoryRepository,
  VehicleRepository,
} from './ports';

/** CRM configuration: every value is a documented default, none is hard-coded in a use case. */
export interface CrmConfig {
  /** BA §9: synchronous export row limits [Đề xuất BA - chờ xác nhận: Chủ dự án] */
  exportMaxRows: number;
  /** with full personal columns: lower limit [Cần xác nhận: Khách] */
  exportMaxRowsWithPii: number;
  /** FR-CRM-011 response deadline in hours [Cần xác nhận: Luật sư khách] */
  requestDeadlineHours: number;
  /** BA P3 [Cần xác nhận: Chủ dự án]: whether the cross-branch history shows prices */
  historyShowPrice: boolean;
  /** version of the notice recorded with consents; content supplied by the client */
  consentPolicyVersion: string;
  /** channels offered for advertising consent */
  marketingChannels: readonly ContactChannel[];
  /** max customers returned by an exact cross-branch lookup (BA §10.1.4: "vài kết quả") */
  lookupMaxResults: number;
}

export const DEFAULT_CRM_CONFIG: CrmConfig = {
  exportMaxRows: 5000,
  exportMaxRowsWithPii: 1000,
  requestDeadlineHours: 72,
  historyShowPrice: true,
  consentPolicyVersion: 'chưa có [do doanh nghiệp cung cấp]',
  marketingChannels: ['zalo', 'sms', 'email', 'phone'],
  lookupMaxResults: 5,
};

/** Cross-cutting services (transaction, audit, numbering, PII policy, limiter, branches) are the SYS ones. */
export interface CrmDeps {
  sys: SysDeps;
  customers: CustomerRepository;
  vehicles: VehicleRepository;
  ownerships: OwnershipRepository;
  consents: ConsentRepository;
  requests: DataRequestRepository;
  history: VehicleHistoryRepository;
  retention: CustomerRetentionPort;
  crm: CrmConfig;
}
