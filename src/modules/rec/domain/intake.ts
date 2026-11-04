import { checkOdometer, type OdometerCheck } from '@/modules/crm';

/**
 * FR-REC-003 with the CRM rules of C5 (FR-CRM-002): a reading below the last known one is a warning,
 * not a block; the advisor must give a reason ('other' needs a note of at least 5 characters).
 * R9: there is ONE rule and ONE threshold (`abnormalKmDrop`), owned by CRM; this is the same function.
 */
export type KmCheck = OdometerCheck;
export const checkKm = checkOdometer;
