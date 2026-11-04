import type { RevealLabels } from '@/ui/components/RevealField';

type T = (key: string) => string;
export const revealLabels = (t: T): RevealLabels => ({
  show: t('pii.show'),
  hide: t('pii.hide'),
  reason: t('pii.reasonLabel'),
  note: t('pii.noteLabel'),
  invoiceCheck: t('pii.reasons.invoice_check'),
  debt: t('pii.reasons.debt_collection'),
  other: t('pii.reasons.other'),
  failed: t('pii.failed'),
});
