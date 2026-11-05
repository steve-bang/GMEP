import { getTranslations } from 'next-intl/server';
import { listMyWork } from '@/modules/rec';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { AutoRefresh } from '@/ui/components/AutoRefresh';
import { ErrorFor } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { isoToVi } from '@/platform/format/date';
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
  'reason_awaiting_supplement_approval',
  'otherNote',
  'otherNoteHint',
  'pauseConfirm',
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
  'filterLabel',
  'filterAll',
  'filterDoing',
  'filterTodo',
  'filterPaused',
  'filterEmpty',
  'customer',
  'standardHours',
  'promised',
  'redo',
  'doneNote',
  'qcTitle',
  'qcNoNote',
  'qcFailed',
  'why_waiting_parts',
  'why_order_paused',
  'why_order_not_active',
  'lockedQuoted',
  'lockedOpen',
  'lockedWhyQuoted',
  'lockedWhyOpen',
  'offlineTitle',
  'offlineText',
  'offlineLock',
] as const;

const hoursText = (min: number) => (Math.round(min / 6) / 10).toFixed(1).replace('.', ',');
const weekdayOf = (d: Date) =>
  new Intl.DateTimeFormat('vi-VN', { weekday: 'long', timeZone: 'Asia/Ho_Chi_Minh' }).format(d);

/**
 * G1-DSH-07 / G2-TEC-01 / FR-REC-013: the technician's own work on a tablet, the real page behind "Việc của tôi" (the
 * technician's `/` redirects here); a technician never sees another's work and never a customer's phone or address.
 */
export default async function WorkPage() {
  const t = await getTranslations();
  const { actor, user } = await requireSession();
  const head = { title: t('rec.work.titleToday'), desc: t('rec.work.lead') };
  const res = await load(() => listMyWork(getContainer().rec, actor, {}));
  if (res.error)
    return (
      <RecPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </RecPage>
    );
  const { summary, locked, day } = res.data;
  const dayVi = isoToVi(day);
  const full = {
    title: head.title,
    desc: t('rec.work.leadLong', {
      weekday: weekdayOf(getContainer().rec.sys.clock.now()),
      date: dayVi,
      name: user.displayName,
    }),
  };
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
    customerShort: i.customerShort,
    promisedDate: i.promisedDate ? isoToVi(i.promisedDate) : null,
    blockedReason: i.blockedReason,
    qcReturn: i.qcReturn,
    partLines: i.partLines,
  }));
  return (
    <RecPage {...full}>
      <AutoRefresh seconds={30} />
      <section className="card" aria-labelledby="h-sum" data-testid="work-summary">
        <div className="card__header">
          <div>
            <h2 className="card__title" id="h-sum">
              {t('rec.work.summaryTitle')}
            </h2>
            <div className="card__subtitle">{t('rec.work.summarySub', { date: dayVi })}</div>
          </div>
        </div>
        <div className="card__body g1-sum">
          <div>
            <span className="g1-note">{t('rec.work.summaryStandard')}</span>
            <strong data-testid="sum-standard">
              {t('rec.work.hours', { h: hoursText(summary.standardDoneMinutes) })}
            </strong>
          </div>
          <div>
            <span className="g1-note">{t('rec.work.summaryWorked')}</span>
            <strong data-testid="sum-worked">
              {t('rec.work.hours', { h: hoursText(summary.workedMinutes) })}
            </strong>
          </div>
          <div>
            <span className="g1-note">{t('rec.work.summaryDone')}</span>
            <strong data-testid="sum-done">
              {summary.doneCount} / {summary.totalCount}
            </strong>
          </div>
        </div>
      </section>
      {cards.length === 0 && locked.length === 0 ? (
        <EmptyState title={t('rec.work.emptyTitle')} text={t('rec.work.emptyText')} />
      ) : (
        <WorkCards cards={cards} locked={locked} labels={pickLabels(t, 'rec.work', KEYS)} />
      )}
    </RecPage>
  );
}
