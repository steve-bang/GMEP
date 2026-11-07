import { LoadingState } from '@/ui/components/States';
import { aptLabels } from './labels';

/** G2-APT-01 loading state: a skeleton list while the tab and its counters are read. */
export default function Loading() {
  return <LoadingState label={aptLabels().loading ?? ''} rows={4} cols={3} />;
}
