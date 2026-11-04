import type { BadgeTone } from '@/ui/components/StatusBadge';

/** Quote status -> badge tone; the label is always text too (never colour alone). */
export const QUOTE_TONE: Record<string, BadgeTone> = {
  draft: 'neutral',
  sent: 'warning',
  approved_full: 'success',
  approved_partial: 'info',
  rejected: 'danger',
  expired: 'neutral',
};
export const QUOTE_STATUS_LIST = [
  'draft',
  'sent',
  'approved_partial',
  'approved_full',
  'rejected',
  'expired',
] as const;
