import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { isoToVi } from '@/platform/format/date';
import { getBoard } from '@/modules/rec';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ErrorFor, first, type SearchParams } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { chip, ORDER_TONE } from '../orderUi';
import { RecPage } from '../RecPage';

export const dynamic = 'force-dynamic';

const COLUMNS = ['approved', 'in_progress', 'paused', 'awaiting_qc', 'ready_for_delivery'] as const;

/** G2-REC-03 / FR-REC-022: dispatch board of the working branch (orders by state, late, waiting for parts) and G2-REC-05 technician load. */
export default async function BoardPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const sp = await searchParams;
  const technicianId = first(sp.technicianId);
  const late = first(sp.late) === '1';
  const waiting = first(sp.waitingParts) === '1';
  const { actor } = await requireSession();
  const head = { title: t('rec.board.title'), desc: t('rec.board.lead') };
  const res = await load(() =>
    getBoard(getContainer().rec, actor, {
      ...(technicianId ? { technicianId } : {}),
      ...(late ? { late: 'true' } : {}),
      ...(waiting ? { waitingParts: 'true' } : {}),
    }),
  );
  if (res.error)
    return (
      <RecPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </RecPage>
    );
  const b = res.data;
  const qs = (over: Record<string, string | null>) => {
    const p = new URLSearchParams({
      ...(technicianId ? { technicianId } : {}),
      ...(late ? { late: '1' } : {}),
      ...(waiting ? { waitingParts: '1' } : {}),
    });
    for (const [k, v] of Object.entries(over)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    const s = p.toString();
    return `/rec/board${s ? `?${s}` : ''}`;
  };
  return (
    <RecPage {...head}>
      <nav className="rec-chips" aria-label={t('rec.board.filters')}>
        <Link {...chip(late)} href={qs({ late: late ? null : '1' })} data-testid="board-late">
          {t('rec.board.onlyLate')}
        </Link>
        <Link
          {...chip(waiting)}
          href={qs({ waitingParts: waiting ? null : '1' })}
          data-testid="board-waiting"
        >
          {t('rec.board.onlyWaiting')}
        </Link>
        {b.load.map((l) => (
          <Link
            key={l.technicianId}
            {...chip(technicianId === l.technicianId)}
            href={qs({ technicianId: technicianId === l.technicianId ? null : l.technicianId })}
          >
            {t('rec.board.loadOf', { name: l.name, n: l.active })}
          </Link>
        ))}
      </nav>
      {b.total === 0 ? (
        <EmptyState title={t('rec.board.emptyTitle')} text={t('rec.board.emptyText')} />
      ) : (
        <div className="rec-board" data-testid="board">
          {COLUMNS.map((c) => (
            <section key={c} className="card rec-board__col" aria-labelledby={`bc-${c}`}>
              <div className="card__header">
                <h2 className="card__title" id={`bc-${c}`}>
                  {t(`rec.orders.status_${c}`)}
                </h2>
                <span className="tag">{b.columns[c].length}</span>
              </div>
              <div className="card__body stack">
                {b.columns[c].length === 0 ? (
                  <p className="text-secondary">{t('rec.board.noneHere')}</p>
                ) : null}
                {b.columns[c].map((o) => (
                  <Link
                    key={o.id}
                    href={`/rec/orders/${encodeURIComponent(o.id)}`}
                    className="rec-board__card"
                    data-testid="board-card"
                  >
                    <span className="code">{o.number}</span>
                    <span className="plate">{o.plate}</span>
                    <span className="text-secondary">{o.vehicleLabel}</span>
                    <span>
                      <StatusBadge tone={ORDER_TONE[o.status] ?? 'neutral'}>
                        {o.doneCount}/{o.itemCount}
                      </StatusBadge>
                      {o.late ? (
                        <span className="tag tag--danger">{t('rec.orders.late')}</span>
                      ) : null}
                      {o.waitingItems > 0 ? (
                        <span className="tag tag--warning">{t('rec.orders.waitingParts')}</span>
                      ) : null}
                      {o.unassignedItems > 0 ? (
                        <span className="tag">
                          {t('rec.board.unassigned', { n: o.unassignedItems })}
                        </span>
                      ) : null}
                      {o.pendingPartRequests > 0 ? (
                        <span className="tag tag--info">
                          {t('rec.board.partRequests', { n: o.pendingPartRequests })}
                        </span>
                      ) : null}
                    </span>
                    {o.technicians.length ? (
                      <span className="text-secondary">{o.technicians.join(', ')}</span>
                    ) : null}
                    {o.promisedDate ? (
                      <span className="text-secondary num">
                        {t('rec.orders.promised')}: {isoToVi(o.promisedDate)}
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </RecPage>
  );
}
