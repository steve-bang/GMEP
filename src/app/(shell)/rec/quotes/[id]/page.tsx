import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { formatDateTime, isoToVi } from '@/platform/format/date';
import { formatBp } from '@/platform/format/percent';
import { getQuote, type QuoteItemDto } from '@/modules/rec';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ErrorFor, first, type SearchParams } from '@/ui/components/PageParts';
import { Icon } from '@/ui/components/Icon';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { formatMinutes, money } from '../../format';
import { RecPage } from '../../RecPage';
import { QUOTE_TONE } from '../statusTone';
import { QuoteActions } from './QuoteActions';
import { QuoteEditor, type EditItem } from './QuoteEditor';

export const dynamic = 'force-dynamic';

const EDITOR_KEYS = [
  'lines',
  'linesLead',
  'addItem',
  'itemDefault',
  'itemName',
  'necessity',
  'required',
  'optional',
  'customerRequested',
  'removeItem',
  'line',
  'qtyOrMinutes',
  'listPrice',
  'actualPrice',
  'amount',
  'removeLine',
  'standard',
  'differs',
  'minutes',
  'qty',
  'short',
  'available',
  'discount',
  'addLabor',
  'laborPlaceholder',
  'addPart',
  'partPlaceholder',
  'none',
  'noPrice',
  'hourUnit',
  'noItems',
  'save',
  'saveNew',
  'unsaved',
  'reviseNote',
  'offline',
  'conflict',
  'unexpected',
] as const;
const ACTION_KEYS = [
  'send',
  'sendNeedsLines',
  'reject',
  'rejectReason',
  'rejectHint',
  'rejectConfirm',
  'keep',
  'unexpected',
] as const;

const toEdit = (items: QuoteItemDto[]): EditItem[] =>
  items.map((it) => ({
    uid: `i${it.no}`,
    name: it.name,
    necessity: it.necessity,
    customerRequested: it.customerRequested,
    lines: it.lines.map((l) => ({
      uid: `i${it.no}l${l.lineNo}`,
      kind: l.kind,
      ...(l.serviceId ? { serviceId: l.serviceId } : {}),
      ...(l.partId ? { partId: l.partId } : {}),
      code: l.code,
      name: l.name,
      amount: (l.kind === 'labor' ? l.minutes : l.qty) ?? 1,
      standardMinutes: l.standardMinutes,
      listUnitVnd: l.listUnitVnd,
      // an unchanged price stays "list"; a discounted one keeps its typed value
      unit: l.unitVnd === l.listUnitVnd ? '' : String(l.unitVnd),
      amountVnd: l.amountVnd,
      discountBp: l.discountBp,
      available: l.available,
    })),
  }));

/** G2-QUO-02 + G2-QUO-03: edit the lines, see the versions and totals, send or record a refusal. */
export default async function QuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const t = await getTranslations();
  const { id } = await params;
  const v = Number(first((await searchParams).v));
  const { actor } = await requireSession();
  const crumbs = [{ label: t('rec.quotes.title'), href: '/rec/quotes' }];
  const res = await load(() =>
    getQuote(getContainer().rec, actor, id, Number.isInteger(v) && v > 0 ? v : undefined),
  );
  if (res.error)
    return (
      <RecPage title={t('rec.quotes.title')} crumbs={crumbs}>
        <ErrorFor error={res.error} t={t} />
      </RecPage>
    );
  const q = res.data;
  const s = q.shown;
  const canWrite = s.current && (q.allowed.includes('edit') || q.allowed.includes('revise'));
  const label = (keys: readonly string[], ns: string) =>
    Object.fromEntries(
      keys.map((k) => [k, t(`rec.${ns}.${k}`, { n: '{n}', pct: '{pct}', delta: '{delta}' })]),
    );
  return (
    <RecPage
      title={`${q.number}-v${s.n}`}
      desc={t('rec.quotes.detailLead')}
      crumbs={crumbs}
      actions={
        <>
          {!s.current ? <span className="tag">{t('rec.quotes.oldVersion')}</span> : null}
          <StatusBadge tone={QUOTE_TONE[s.status] ?? 'neutral'}>
            {t(`rec.quotes.status_${s.status}`)}
          </StatusBadge>
        </>
      }
    >
      {s.warnings.map((w) => (
        <div
          key={`${w.taxKey}-${w.effectiveFrom}`}
          className="alert alert--warning"
          role="note"
          data-testid="quote-tax-warning"
        >
          <Icon name="alert-triangle" />
          <div className="alert__body">
            {t('rec.quotes.taxChangeWarning', {
              validUntil: isoToVi(w.validUntil),
              effectiveFrom: isoToVi(w.effectiveFrom),
            })}
          </div>
        </div>
      ))}
      <section className="card" aria-label={t('rec.vehicle')}>
        <dl className="inv-facts" data-testid="quote-facts">
          <div>
            <dt>{t('rec.plate')}</dt>
            <dd>
              <span className="plate">{q.plate}</span>
            </dd>
          </div>
          <div>
            <dt>{t('rec.vehicle')}</dt>
            <dd>{q.vehicleLabel}</dd>
          </div>
          <div>
            <dt>{t('rec.customer')}</dt>
            <dd>{q.customerName}</dd>
          </div>
          <div>
            <dt>{t('rec.quotes.intake')}</dt>
            <dd>
              <Link href={`/rec/intakes/${encodeURIComponent(q.intakeId)}`}>
                {t('rec.quotes.openIntake')}
              </Link>
            </dd>
          </div>
          {s.sentAt ? (
            <div>
              <dt>{t('rec.quotes.sentAt')}</dt>
              <dd>{formatDateTime(new Date(s.sentAt))}</dd>
            </div>
          ) : null}
          {s.validUntil ? (
            <div>
              <dt>{t('rec.quotes.validUntil')}</dt>
              <dd className="num">{isoToVi(s.validUntil)}</dd>
            </div>
          ) : null}
          {s.sentVia ? (
            <div>
              <dt>{t('rec.quotes.sentVia')}</dt>
              {/* R10: `none` says plainly that nothing was delivered; no message channel exists yet */}
              <dd data-testid="quote-sent-via">{t(`rec.quotes.sentVia_${s.sentVia}`)}</dd>
            </div>
          ) : null}
          <div>
            <dt>{t('rec.quotes.pricedOn')}</dt>
            <dd className="num">{isoToVi(s.pricedOn)}</dd>
          </div>
          {s.rejectReason ? (
            <div>
              <dt>{t('rec.quotes.rejectedBecause')}</dt>
              <dd>{s.rejectReason}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {q.versions.length > 1 ? (
        <nav className="rec-chips" aria-label={t('rec.quotes.versions')}>
          {q.versions.map((x) => (
            <Link
              key={x.n}
              className="chip-filter"
              aria-current={x.n === s.n ? 'page' : undefined}
              aria-pressed={x.n === s.n}
              href={`/rec/quotes/${encodeURIComponent(q.id)}?v=${x.n}`}
            >
              v{x.n} · {t(`rec.quotes.status_${x.status}`)}
              {x.replacedByN ? ` · ${t('rec.quotes.replacedBy', { n: x.replacedByN })}` : ''}
            </Link>
          ))}
        </nav>
      ) : null}

      {canWrite ? (
        <QuoteEditor
          key={q.version}
          quoteId={q.id}
          version={q.version}
          nextVersionN={s.status === 'draft' ? null : s.n + 1}
          initial={toEdit(s.items)}
          labels={label(EDITOR_KEYS, 'editor')}
        />
      ) : (
        <section className="card" aria-labelledby="ro-h">
          <div className="card__header">
            <h2 className="card__title" id="ro-h">
              {t('rec.editor.lines')}
            </h2>
          </div>
          <div className="card__body stack">
            {s.items.length === 0 ? (
              <p className="text-secondary">{t('rec.editor.noItems')}</p>
            ) : null}
            {s.items.map((it) => (
              <div key={it.no} className="rec-item" data-testid="quote-item-ro">
                <div className="rec-item__head">
                  <strong>
                    {it.no}. {it.name}
                  </strong>
                  <StatusBadge tone={it.necessity === 'required' ? 'info' : 'neutral'}>
                    {t(it.necessity === 'required' ? 'rec.editor.required' : 'rec.editor.optional')}
                  </StatusBadge>
                  {it.customerRequested ? (
                    <span className="tag">{t('rec.editor.customerRequested')}</span>
                  ) : null}
                  <span className="num rec-item__sum">{money(it.subtotalVnd)}</span>
                </div>
                <div className="table-scroll" tabIndex={0} role="region" aria-label={it.name}>
                  <table className="table table--compact">
                    <thead>
                      <tr>
                        <th scope="col">{t('rec.editor.line')}</th>
                        <th scope="col" className="col-num">
                          {t('rec.editor.qtyOrMinutes')}
                        </th>
                        <th scope="col" className="col-num">
                          {t('rec.editor.listPrice')}
                        </th>
                        <th scope="col" className="col-num">
                          {t('rec.editor.actualPrice')}
                        </th>
                        <th scope="col" className="col-num">
                          {t('rec.editor.amount')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {it.lines.map((l) => (
                        <tr key={l.lineNo}>
                          <td>
                            <span className="cell-primary">{l.name}</span>
                            <span className="cell-sub num">{l.code}</span>
                            {l.differsFromStandard ? (
                              <span className="tag" data-testid="differs-standard">
                                {t('rec.editor.differs', { delta: l.minutesDelta ?? 0 })}
                              </span>
                            ) : null}
                          </td>
                          <td className="col-num num">
                            {l.kind === 'labor' ? formatMinutes(l.minutes ?? 0) : l.qty}
                          </td>
                          <td className="col-num num">{money(l.listUnitVnd)}</td>
                          <td className="col-num num">
                            {money(l.unitVnd)}
                            {l.discountBp > 0 ? ` (-${formatBp(l.discountBp)})` : ''}
                          </td>
                          <td className="col-num num">{money(l.amountVnd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card" aria-labelledby="tot-h">
        <div className="card__header">
          <h2 className="card__title" id="tot-h">
            {t('rec.quotes.totals')}
          </h2>
        </div>
        <dl className="rec-totals" data-testid="quote-totals">
          <div>
            <dt>{t('rec.quotes.subtotal')}</dt>
            <dd className="num" data-testid="total-subtotal">
              {money(s.totals.subtotalVnd)}
            </dd>
          </div>
          <div>
            <dt>{s.tax ? `${s.tax.name} (${formatBp(s.tax.rateBp)})` : t('rec.quotes.tax')}</dt>
            <dd className="num" data-testid="total-tax">
              {money(s.totals.taxVnd)}
            </dd>
          </div>
          <div className="rec-totals__grand">
            <dt>{t('rec.quotes.grand')}</dt>
            <dd className="num" data-testid="total-grand">
              {money(s.totals.totalVnd)}
            </dd>
          </div>
          <div>
            <dt>{t('rec.quotes.selectedTotal')}</dt>
            <dd className="num" data-testid="total-selected">
              {money(s.totals.selectedTotalVnd)}
            </dd>
          </div>
        </dl>
        <p className="text-secondary rec-note">{t('rec.quotes.totalsNote')}</p>
      </section>

      {s.current && q.allowed.some((a) => a === 'send' || a === 'reject') ? (
        <QuoteActions
          quoteId={q.id}
          version={q.version}
          allowed={q.allowed}
          hasLines={s.items.some((i) => i.lines.length > 0)}
          labels={label(ACTION_KEYS, 'actions')}
        />
      ) : null}
    </RecPage>
  );
}
