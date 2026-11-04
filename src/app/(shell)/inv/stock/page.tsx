import type { SearchParams } from '@/ui/components/PageParts';
import { StockTable } from '../StockTable';

export const dynamic = 'force-dynamic';

export default function StockPage({ searchParams }: { searchParams: SearchParams }) {
  return <StockTable base="/inv/stock" low={false} searchParams={searchParams} />;
}
