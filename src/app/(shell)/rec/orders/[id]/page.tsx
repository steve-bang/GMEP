import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { formatDateTime, isoToVi } from '@/platform/format/date';
import { hasPermission } from '@/platform/rbac/rbac';
import { getOrder, listTechnicians, type TechnicianOption } from '@/modules/rec';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ErrorFor } from '@/ui/components/PageParts';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { money } from '../../format';
import {
  formatDuration,
  ITEM_TONE,
  ORDER_TONE,
  pickLabels,
  qtyText,
  REQUEST_TONE,
} from '../../orderUi';
import { RecPage } from '../../RecPage';
import { AssignSelect, OrderActions, ProposalRow } from './OrderPanels';

export const dynamic = 'force-dynamic';

const ACTION_KEYS = [
  'submitQc',
  'runQc',
  'handover',
  'resume',
  'pause',
  'recheck',
  'supplement',
  'cancel',
  'cancelIssued',
  'reason',
  'confirm',
  'keep',
  'unexpected',
] as const;
const ASSIGN_KEYS = [
  'technician',
  'unassigned',
  'assign',
  'reason',
  'reasonPlaceholder',
  'unexpected',
] as const;
const PROPOSAL_KEYS = ['makeQuote', 'dismiss', 'dismissReason', 'unexpected'] as const;

/** G2-REC-04 / FR-REC-010, 012, 014, 015, 028: the repair order with its items, technicians, parts, QC and handover. */
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations();
  const { id } = await params;
  const { actor } = await requireSession();
  const crumbs = [{ label: t('rec.orders.title'), href: '/rec/orders' }];
  const res = await load(() => getOrder(getContainer().rec, actor, id));
  if (res.error)
    return (
      <RecPage title={t('rec.orders.title')} crumbs={crumbs}>
        <ErrorFor error={res.error} t={t} />
      </RecPage>
    );
  const o = res.data;
  const canAssign = o.allowed.assign;
  let techs: TechnicianOption[] = [];
  if (canAssign) techs = (await load(() => listTechnicians(getContainer().rec, actor))).data ?? [];
  const mayPropose = hasPermission(actor, 'work-proposal:update');
  const issuedParts = o.partRequests.some((r) => r.status === 'issued');
  const nameOf = (userId: string | null) => userId ?? '—';
  return (
    <RecPage
      title={o.number}
      desc={t('rec.orders.detailLead')}
      crumbs={crumbs}
      actions={
        <>
          <StatusBadge tone={ORDER_TONE[o.status] ?? 'neutral'}>
            {t(`rec.orders.status_${o.status}`)}
          </StatusBadge>
          {o.late ? <span className="tag tag--danger">{t('rec.orders.late')}</span> : null}
        </>
      }
    >
      <section className="card" aria-label={t('rec.vehicle')}>
        <dl className="inv-facts" data-testid="order-facts">
          <div>
            <dt>{t('rec.plate')}</dt>
            <dd>
              <span className="plate">{o.plate}</span>
            </dd>
          </div>
          <div>
            <dt>{t('rec.vehicle')}</dt>
            <dd>{o.vehicleLabel}</dd>
          </div>
          <div>
            <dt>{t('rec.customer')}</dt>
            <dd>{o.customerName}</dd>
          </div>
          <div>
            <dt>{t('rec.orders.fromQuote')}</dt>
            <dd>
              <Link href={`/rec/quotes/${encodeURIComponent(o.quoteId)}`}>{o.quoteNumber}</Link>
            </dd>
          </div>
          {o.promisedDate ? (
            <div>
              <dt>{t('rec.orders.promised')}</dt>
              <dd className="num">{isoToVi(o.promisedDate)}</dd>
            </div>
          ) : null}
          <div>
            <dt>{t('rec.orders.progress')}</dt>
            <dd className="num" data-testid="order-progress">
              {o.doneCount}/{o.itemCount}
            </dd>
          </div>
          <div>
            <dt>{t('rec.orders.total')}</dt>
            <dd className="num">{money(o.totalVnd)}</dd>
          </div>
          {o.supplements.length ? (
            <div>
              <dt>{t('rec.orders.supplements')}</dt>
              <dd>{o.supplements.map((s) => s.number).join(', ')}</dd>
            </div>
          ) : null}
          {o.pausedReason ? (
            <div>
              <dt>{t('rec.orders.pausedBecause')}</dt>
              <dd>{o.pausedReason}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {o.unmetLines > 0 && o.status !== 'completed' && o.status !== 'cancelled' ? (
        <div className="alert alert--warning" role="note" data-testid="order-shortage">
          <div className="alert__body">
            {t('rec.orders.shortageNote', { n: o.unmetLines })}
            {o.shortages?.length
              ? ` ${o.shortages.map((s) => `${s.partCode} (-${s.unmetQty})`).join(', ')}`
              : ''}
          </div>
        </div>
      ) : null}

      <section className="card" aria-labelledby="oa-h">
        <div className="card__header">
          <h2 className="card__title" id="oa-h">
            {t('rec.orders.actions')}
          </h2>
        </div>
        <div className="card__body">
          <OrderActions
            orderId={o.id}
            version={o.version}
            allowed={o.allowed}
            hasIssuedParts={issuedParts}
            labels={pickLabels(t, 'rec.orders.act', ACTION_KEYS)}
          />
        </div>
      </section>

      <section className="card" aria-labelledby="oi-h">
        <div className="card__header">
          <h2 className="card__title" id="oi-h">
            {t('rec.orders.items')}
          </h2>
        </div>
        <div className="card__body stack">
          {o.items.map((it) => (
            <div key={it.id} className="rec-item" data-testid="order-item">
              <div className="rec-item__head">
                <strong>
                  {it.no}. {it.name}
                </strong>
                <StatusBadge tone={ITEM_TONE[it.status] ?? 'neutral'}>
                  {t(`rec.orders.item_${it.status}`)}
                </StatusBadge>
                {it.waitingParts ? (
                  <span className="tag tag--warning">{t('rec.orders.waitingParts')}</span>
                ) : null}
                {it.origin === 'supplement' ? (
                  <span className="tag tag--info">{t('rec.orders.supplementTag')}</span>
                ) : null}
                <span className="text-secondary">
                  {t('rec.orders.workedOf', {
                    worked: formatDuration(it.workedNowMs),
                    approved: formatDuration(it.approvedMinutes * 60_000),
                  })}
                </span>
                <span className="num rec-item__sum">{money(it.subtotalVnd)}</span>
              </div>
              <div className="table-scroll" tabIndex={0} role="region" aria-label={it.name}>
                <table className="table table--compact">
                  <tbody>
                    {it.lines.map((l) => (
                      <tr key={l.lineKey}>
                        <td>
                          <span className="cell-primary">{l.name}</span>
                          <span className="cell-sub num">{l.code}</span>
                        </td>
                        <td className="col-num num">
                          {l.kind === 'labor'
                            ? formatDuration((l.minutes ?? 0) * 60_000)
                            : qtyText(l.qty ?? 0, l.qtyScale ?? 1)}
                        </td>
                        <td className="col-num num">{money(l.amountVnd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="field">
                <span className="field__label">{t('rec.orders.technician')}</span>
                {canAssign && it.status !== 'done' ? (
                  <AssignSelect
                    itemId={it.id}
                    version={it.version}
                    current={it.technicianId}
                    options={techs}
                    disabled={it.status === 'in_progress'}
                    labels={pickLabels(t, 'rec.orders.assign', ASSIGN_KEYS)}
                  />
                ) : (
                  <span data-testid="item-technician">
                    {it.technicianName ?? t('rec.orders.unassigned')}
                  </span>
                )}
                {it.assignments.length > 1 ? (
                  <ul className="text-secondary">
                    {it.assignments.map((a, i) => (
                      <li key={i}>
                        {formatDateTime(new Date(a.at))}: {nameOf(a.technicianId)}
                        {a.reason ? ` (${a.reason})` : ''}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      {o.partRequests.length ? (
        <section className="card" aria-labelledby="op-h">
          <div className="card__header">
            <h2 className="card__title" id="op-h">
              {t('rec.orders.partRequests')}
            </h2>
          </div>
          <div className="card__body">
            <div
              className="table-scroll"
              tabIndex={0}
              role="region"
              aria-label={t('rec.orders.partRequests')}
            >
              <table className="table table--compact">
                <tbody>
                  {o.partRequests.map((r) => (
                    <tr key={r.id} data-testid="order-part-request">
                      <td>
                        <span className="cell-primary">{r.partName}</span>
                        <span className="cell-sub num">{r.partCode}</span>
                      </td>
                      <td className="col-num num">{qtyText(r.qty, r.qtyScale)}</td>
                      <td>
                        <StatusBadge tone={REQUEST_TONE[r.status] ?? 'neutral'}>
                          {t(`rec.requests.status_${r.status}`)}
                        </StatusBadge>
                      </td>
                      <td className="num">{r.issueDocumentNo ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {o.proposals.length ? (
        <section className="card" aria-labelledby="opp-h">
          <div className="card__header">
            <h2 className="card__title" id="opp-h">
              {t('rec.orders.proposals')}
            </h2>
          </div>
          <div className="card__body stack">
            {o.proposals.map((p) => (
              <div key={p.id} className="rec-item" data-testid="order-proposal">
                <div className="rec-item__head">
                  <strong>{p.title}</strong>
                  <StatusBadge tone={p.status === 'open' ? 'warning' : 'neutral'}>
                    {t(`rec.orders.proposal_${p.status}`)}
                  </StatusBadge>
                  {p.quoteId ? (
                    <Link href={`/rec/quotes/${encodeURIComponent(p.quoteId)}`}>
                      {t('rec.orders.openSupplement')}
                    </Link>
                  ) : null}
                </div>
                {p.note ? <p className="text-secondary">{p.note}</p> : null}
                {p.status === 'open' ? (
                  <ProposalRow
                    orderId={o.id}
                    version={o.version}
                    proposalId={p.id}
                    canUpdate={mayPropose}
                    labels={pickLabels(t, 'rec.orders.proposalAct', PROPOSAL_KEYS)}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {o.qcRuns.length ? (
        <section className="card" aria-labelledby="oq-h">
          <div className="card__header">
            <h2 className="card__title" id="oq-h">
              {t('rec.orders.qcHistory')}
            </h2>
          </div>
          <div className="card__body stack">
            {o.qcRuns.map((r) => (
              <div key={r.n} data-testid="order-qc-run">
                <strong>
                  {t('rec.orders.qcRun', { n: r.n })} · {formatDateTime(new Date(r.at))}
                </strong>{' '}
                <StatusBadge tone={r.result === 'pass' ? 'success' : 'danger'}>
                  {t(`rec.orders.qc_${r.result}`)}
                </StatusBadge>
                <ul>
                  {r.checks
                    .filter((c) => !c.ok)
                    .map((c) => (
                      <li key={c.code}>
                        {c.name}: {c.note}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {o.handover ? (
        <section className="card" aria-labelledby="oh-h">
          <div className="card__header">
            <h2 className="card__title" id="oh-h">
              {t('rec.orders.handoverRecord')}
            </h2>
            <Link className="btn btn--secondary" href={`/rec/orders/${o.id}/handover/print`}>
              {t('rec.orders.openPrint')}
            </Link>
          </div>
          <div className="card__body">
            <dl className="inv-facts" data-testid="order-handover">
              <div>
                <dt>{t('rec.handover.receiver')}</dt>
                <dd>{o.handover.receiverName || '—'}</dd>
              </div>
              <div>
                <dt>{t('rec.orders.at')}</dt>
                <dd>{formatDateTime(new Date(o.handover.at))}</dd>
              </div>
              <div>
                <dt>{t('rec.handover.confirmation')}</dt>
                <dd>{t(`rec.handover.confirm_${o.handover.confirmation}`)}</dd>
              </div>
              {o.handover.km !== null ? (
                <div>
                  <dt>{t('rec.handover.km')}</dt>
                  <dd className="num">{o.handover.km}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </section>
      ) : null}

      <section className="card" aria-labelledby="ohi-h">
        <div className="card__header">
          <h2 className="card__title" id="ohi-h">
            {t('rec.orders.history')}
          </h2>
        </div>
        <div className="card__body">
          <ol className="timeline" data-testid="order-history">
            {[...o.history].reverse().map((h, i) => (
              <li key={i} className="timeline__item">
                <span className="num">{formatDateTime(new Date(h.at))}</span>{' '}
                {t(`rec.orders.event_${h.event}`)} → {t(`rec.orders.status_${h.to}`)}
                {h.reason ? ` (${h.reason})` : ''}
              </li>
            ))}
          </ol>
        </div>
      </section>
    </RecPage>
  );
}
