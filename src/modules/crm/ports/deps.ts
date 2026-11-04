import type { SysDeps } from '@/modules/sys';
import type { ConsentBasis, ContactChannel } from '../domain/consent';
import {
  DEFAULT_INTERNAL_TARGET_HOURS,
  type RequestType,
  type RequestTypeHours,
} from '../domain/dataRequest';
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
  /** FR-CRM-011 / C3 internal target in hours per request type (starting value 72) */
  requestInternalTargetHours: RequestTypeHours;
  /** C3 legal deadline in hours per request type; absent = blank until the lawyer sets it [Cần xác nhận: Luật sư khách] */
  requestLegalDeadlineHours: Partial<Record<RequestType, number | null>>;
  /**
   * C4: when false (default) a delete request cannot complete while the retention gate cannot
   * verify its conditions. Only a test environment may set true.
   */
  allowUnverifiedRetention: boolean;
  /** C2: when true "use this record at my branch" needs an appointment/quote first [Cần xác nhận: Chủ dự án, Luật sư khách] */
  adoptRequiresBusinessEvent: boolean;
  /** C10: bases usable for new consent records; legitimate interest stays off until the lawyer confirms */
  consentBasesEnabled: readonly ConsentBasis[];
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
  requestInternalTargetHours: DEFAULT_INTERNAL_TARGET_HOURS,
  requestLegalDeadlineHours: {},
  allowUnverifiedRetention: false,
  adoptRequiresBusinessEvent: false,
  consentBasesEnabled: ['consent', 'contract', 'legal_obligation'],
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
