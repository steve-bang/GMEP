import type { BadgeTone } from '@/ui/components/StatusBadge';

/** Repair order, repair item and part request status -> badge tone (always shown with its text label too). */
export const ORDER_TONE: Record<string, BadgeTone> = {
  approved: 'info',
  in_progress: 'warning',
  paused: 'neutral',
  awaiting_qc: 'purple',
  ready_for_delivery: 'success',
  completed: 'success',
  cancelled: 'danger',
};
export const ORDER_STATUS_LIST = [
  'approved',
  'in_progress',
  'paused',
  'awaiting_qc',
  'ready_for_delivery',
  'completed',
  'cancelled',
] as const;
export const ITEM_TONE: Record<string, BadgeTone> = {
  not_started: 'neutral',
  in_progress: 'warning',
  paused: 'neutral',
  done: 'success',
  returned: 'danger',
};
export const REQUEST_TONE: Record<string, BadgeTone> = {
  requested: 'warning',
  issued: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
};

/** milliseconds as "1 giờ 05 phút" / "35 phút" (display only; hours are computed on the server from events) */
export function formatDuration(ms: number): string {
  const min = Math.floor(ms / 60_000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} giờ ${String(m).padStart(2, '0')} phút` : `${m} phút`;
}

/** stored quantity at its scale as a display number */
export const qtyText = (qty: number, scale: number): string =>
  new Intl.NumberFormat('vi-VN').format(qty / (scale || 1));

/** copies the wanted keys of a translation namespace into a plain object for a client component */
export function pickLabels(
  t: (key: string, values?: Record<string, string | number>) => string,
  ns: string,
  keys: readonly string[],
): Record<string, string> {
  return Object.fromEntries(
    keys.map((k) => [
      k,
      t(`${ns}.${k}`, { n: '{n}', name: '{name}', number: '{number}', km: '{km}' }),
    ]),
  );
}

/** A filter chip that is a link: the active one is marked with aria-current (aria-pressed is not allowed on links). */
export const chip = (active: boolean) => ({
  className: `chip-filter${active ? ' is-active' : ''}`,
  ...(active ? { 'aria-current': 'true' as const } : {}),
});
