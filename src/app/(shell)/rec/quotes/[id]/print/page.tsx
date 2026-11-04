import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { formatDate, formatDateTime, isoToVi } from '@/platform/format/date';
import { formatBp } from '@/platform/format/percent';
import { splitTaxByItems } from '@/platform/money/splitTax';
import { getQuote } from '@/modules/rec';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ErrorFor, first, type SearchParams } from '@/ui/components/PageParts';
import { money } from '../../../format';
import { RecPage } from '../../../RecPage';
import { PrintButton } from './PrintButton';

export const dynamic = 'force-dynamic';

const hours = (min: number): string =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(min / 60);

/**
 * G2-PRT-01 (quote, A4): the same data as the screen, laid out for paper. Item prices include tax and
 * add up to the total (R1). Phone and address of the customer are never printed (PDPL); the sheet carries
 * the version and who printed it and when.
 */
export default async function QuotePrintPage({
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
      <RecPage title={t('rec.print.title')} crumbs={crumbs}>
        <ErrorFor error={res.error} t={t} />
      </RecPage>
    );
  const q = res.data;
  const s = q.shown;
  const split = splitTaxByItems(s.items.map((i) => ({ no: i.no, lines: i.lines })));
  const gross = new Map(split.items.map((i) => [i.no, i.grossVnd]));
  const now = new Date();
  return (
    <RecPage title={`${q.number}-v${s.n}`} desc={t('rec.print.preview')} crumbs={crumbs}>
      <div className="rec-actions no-print">
        <PrintButton label={t('rec.print.printButton')} />
        <Link className="btn btn--ghost" href={`/rec/quotes/${encodeURIComponent(q.id)}?v=${s.n}`}>
          {t('rec.print.back')}
        </Link>
      </div>
      <div className="g2q-paper-wrap">
        <article
          className="g2q-sheet g2q-sheet--a4"
          aria-label={t('rec.print.title')}
          data-testid="quote-sheet"
        >
          <header className="g2q-d-head">
            <div>
              <div className="g2q-d-brand">{q.branchName}</div>
            </div>
          </header>
          <div className="g2q-d-title">
            <h2>{t('rec.print.title')}</h2>
            <p>
              {t('rec.print.number')} {q.number}-v{s.n}
              {s.sentAt ? ` · ${t('rec.print.date')} ${formatDate(new Date(s.sentAt))}` : ''}
              {s.validUntil ? ` · ${t('rec.print.validUntil')} ${isoToVi(s.validUntil)}` : ''}
            </p>
          </div>
          <div className="g2q-d-grid">
            <div>
              <b>{t('rec.print.plate')}</b>
              <span className="plate">{q.plate}</span>
            </div>
            <div>
              <b>{t('rec.print.vehicle')}</b>
              <span>{q.vehicleLabel}</span>
            </div>
            <div>
              <b>{t('rec.print.customer')}</b>
              <span>{q.customerName}</span>
            </div>
            <div>
              <b>{t('rec.print.status')}</b>
              <span>{t(`rec.quotes.status_${s.status}`)}</span>
            </div>
          </div>
          <div className="g2q-dl g2q-dl--h">
            <span>{t('rec.print.item')}</span>
            <span>{t('rec.print.qty')}</span>
            <span>{t('rec.print.unit')}</span>
            <span>{t('rec.print.amount')}</span>
          </div>
          {s.items.map((it) => (
            <div key={it.no} data-testid="sheet-item">
              <div className="g2q-dl g2q-dl--g">
                <span>
                  {it.no}. {it.name} (
                  {t(
                    it.necessity === 'required'
                      ? 'rec.print.necessityRequired'
                      : 'rec.print.necessityOptional',
                  )}
                  ) ·{' '}
                  {s.approval ? (
                    s.approval.approvedItemNos.includes(it.no) ? (
                      t('rec.quotes.itemApproved')
                    ) : (
                      t('rec.quotes.itemDeclined')
                    )
                  ) : (
                    <>
                      <i className="g2q-d-check" />
                      {t('rec.print.agree')} <i className="g2q-d-check" />
                      {t('rec.print.disagree')}
                    </>
                  )}
                </span>
                <span>{money(gross.get(it.no) ?? 0)}</span>
              </div>
              {it.lines.map((l) => (
                <div key={l.lineNo} className="g2q-dl">
                  <span>{l.name}</span>
                  <span>{l.kind === 'labor' ? hours(l.minutes ?? 0) : l.qty}</span>
                  <span>{money(l.unitVnd)}</span>
                  <span>{money(l.amountVnd)}</span>
                </div>
              ))}
            </div>
          ))}
          <div className="g2q-d-tot">
            <div className="g2q-d-final">
              <span>{t('rec.print.grand')}</span>
              <span className="num">{money(split.totalVnd)}</span>
            </div>
            <div>
              <span>
                {s.tax ? `${s.tax.name} ${formatBp(s.tax.rateBp)}` : t('rec.print.taxLine')}
              </span>
              <span className="num">{money(split.taxVnd)}</span>
            </div>
            <div>
              <span>{t('rec.print.subtotal')}</span>
              <span className="num">{money(split.netVnd)}</span>
            </div>
            {s.approval ? (
              <div>
                <span>{t('rec.quotes.approvedTotal')}</span>
                <span className="num">{money(s.approval.approvedTotalVnd)}</span>
              </div>
            ) : null}
          </div>
          <p className="g2q-d-note">
            {t('rec.print.note')} {t('rec.print.priced', { date: isoToVi(s.pricedOn) })}
            {s.approval ? ` ${t('rec.quotes.approvalHash')}: ${s.approval.hash.slice(0, 16)}…` : ''}
          </p>
          <div className="g2q-d-sign">
            <div>
              {t('rec.print.customerSign')}
              <br />
              <small>{t('rec.print.customerSignHint')}</small>
              <i>&nbsp;</i>
            </div>
            <div>
              {t('rec.print.advisorSign')}
              <i>&nbsp;</i>
            </div>
          </div>
          <footer className="g2q-d-foot">
            <span>{t('rec.print.printedAt', { time: formatDateTime(now) })}</span>
            <span>{actor.displayName}</span>
          </footer>
        </article>
      </div>
    </RecPage>
  );
}
