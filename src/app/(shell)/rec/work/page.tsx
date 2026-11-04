import { getTranslations } from 'next-intl/server';
import { listMyWork } from '@/modules/rec';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { AutoRefresh } from '@/ui/components/AutoRefresh';
import { ErrorFor } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { pickLabels } from '../orderUi';
import { RecPage } from '../RecPage';
import { WorkCards } from './WorkCards';

export const dynamic = 'force-dynamic';

const KEYS = [
  'start',
  'resume',
  'finish',
  'pause',
  'undo',
  'pauseReason',
  'reason_waiting_parts',
  'reason_waiting_customer',
  'reason_break',
  'reason_other',
  'status_not_started',
  'status_in_progress',
  'status_paused',
  'status_returned',
  'status_done',
  'waitingParts',
  'parts',
  'partLine',
  'approved',
  'requested',
  'issued',
  'qty',
  'sendRequest',
  'propose',
  'proposeTitle',
  'proposeNote',
  'noPhotos',
  'sendProposal',
  'unexpected',
  'offline',
] as const;

/** G2-TEC-01 / FR-REC-013: the technician's own work on a tablet; a technician never sees another's. */
export default async function WorkPage() {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const head = { title: t('rec.work.title'), desc: t('rec.work.lead') };
  const res = await load(() => listMyWork(getContainer().rec, actor, {}));
  if (res.error)
    return (
      <RecPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </RecPage>
    );
  const cards = res.data.items.map((i) => ({
    id: i.id,
    version: i.version,
    no: i.no,
    name: i.name,
    status: i.status,
    pauseReason: i.pauseReason,
    waitingParts: i.waitingParts,
    orderId: i.orderId,
    orderVersion: i.orderVersion,
    orderNumber: i.orderNumber,
    plate: i.plate,
    vehicleLabel: i.vehicleLabel,
    approvedMinutes: i.approvedMinutes,
    workedNowMs: i.workedNowMs,
    running: i.status === 'in_progress',
    allowedEvents: i.allowedEvents,
    canUndo: i.canUndo,
    partLines: i.partLines,
  }));
  return (
    <RecPage {...head}>
      <AutoRefresh seconds={30} />
      {cards.length === 0 ? (
        <EmptyState title={t('rec.work.emptyTitle')} text={t('rec.work.emptyText')} />
      ) : (
        <WorkCards cards={cards} labels={pickLabels(t, 'rec.work', KEYS)} />
      )}
    </RecPage>
  );
}
