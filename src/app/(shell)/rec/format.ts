import { formatVnd } from '@/platform/format/vnd';

/** Display helpers shared by the REC screens (client and server): Vietnamese number grouping, integer VND. */
export const formatKm = (km: number): string => `${new Intl.NumberFormat('vi-VN').format(km)} km`;
export const money = (v: number): string => formatVnd(v);
/** minutes as "1 giờ 30 phút" */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h && m ? `${h} giờ ${m} phút` : h ? `${h} giờ` : `${m} phút`;
}
