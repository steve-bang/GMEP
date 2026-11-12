import { DEFAULT_ACC_POLICY } from '@/modules/acc';
import { APPOINTMENT_RULE_DEFAULTS } from '@/modules/rec';
import { DEFAULT_RATE_LIMITS } from '@/platform/ratelimit/ratelimit';

/**
 * What the system uses when an optional box of a version is left empty, per type and field. Every number is read
 * from the constant the server itself falls back to, never typed here (NFR-MNT-01). A field without an entry here
 * still says "empty = system default" without a number.
 */
export const OPTIONAL_DEFAULTS: Record<string, Record<string, number>> = {
  'appointment-policy': { ...APPOINTMENT_RULE_DEFAULTS },
  'acc-policy': {
    debtMaxDays: DEFAULT_ACC_POLICY.debtMaxDays,
    sourceFlagNoticeDays: DEFAULT_ACC_POLICY.sourceFlagNoticeDays,
  },
  'public-rate-limit': {
    photoViewLimit: DEFAULT_RATE_LIMITS['customer-link-photo'].limit,
    photoViewWindowSeconds: DEFAULT_RATE_LIMITS['customer-link-photo'].windowMs / 1000,
  },
};
