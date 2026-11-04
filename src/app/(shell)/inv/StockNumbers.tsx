import { getTranslations } from 'next-intl/server';
import { StatusBadge } from '@/ui/components/StatusBadge';
import type { StockStatus } from '@/modules/inv';

/** Badge with text, never colour alone (design-system accessibility rule). */
export async function StockStatusBadge({ status }: { status: StockStatus }) {
  const t = await getTranslations();
  return (
    <StatusBadge tone={status === 'out' ? 'danger' : status === 'low' ? 'warning' : 'success'}>
      {t(`inv.stockStatus.${status}`)}
    </StatusBadge>
  );
}

export const num = (n: number | null | undefined): string =>
  n === null || n === undefined ? '—' : n.toLocaleString('vi-VN');
