import type { CustomerPickerLabels } from '@/ui/components/CustomerPicker';

type T = (key: string) => string;
export const pickerLabels = (t: T): CustomerPickerLabels => ({
  placeholder: t('crm.picker.placeholder'),
  hint: t('crm.picker.hint'),
  searching: t('crm.picker.searching'),
  none: t('crm.picker.none'),
  capped: t('crm.picker.capped'),
  clear: t('crm.picker.clear'),
  selected: t('crm.picker.selected'),
  otherBranch: t('crm.picker.otherBranch'),
  adopt: t('crm.picker.adopt'),
  failed: t('crm.picker.failed'),
});
