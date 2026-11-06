import { messages } from '@/platform/i18n/messages';
import type { BadgeTone } from '@/ui/components/StatusBadge';
import { RecPage } from '../rec/RecPage';

export const HrmPage = RecPage;

type Dict = Record<string, string>;
const m = messages as unknown as { hrm: Record<string, Dict> };
/** Plain string maps (the vi.json resources; nothing is hard-coded in a component). */
export const hrmLabels = (ns: string): Dict => m.hrm[ns]!;

export const EMPLOYEE_TONE: Record<string, BadgeTone> = {
  active: 'success',
  on_leave: 'warning',
  left: 'neutral',
};

/** ba-answers-04 Phụ lục A: pending QC purple, recorded success, QC returned danger, reversed neutral. */
export const LINE_TONE: Record<string, BadgeTone> = {
  recorded: 'success',
  qc_returned: 'danger',
  reversed: 'neutral',
  pending_qc: 'purple',
};

/** 0,30 giờ (two decimals, comma): minutes are stored as integers, hours are only a display. */
export const hoursText = (minutes: number): string =>
  `${new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minutes / 60)}`;
