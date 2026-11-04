import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { formatDateTime } from '@/platform/format/date';
import { getHandoverPrint } from '@/modules/rec';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ErrorFor, first, type SearchParams } from '@/ui/components/PageParts';
import { money } from '../../../../format';
import { chip, pickLabels } from '../../../../orderUi';
import { RecPage } from '../../../../RecPage';
import { PrintHandover } from './PrintHandover';

export const dynamic = 'force-dynamic';

/**
 * G2-DLV-04 / G2-PRT-01 (A5 and 80 mm thermal): the handover record, print-first HTML. Opening the page writes
 * nothing; the button logs the print. No phone or address of the customer is printed (PDPL).
 */
export default async function HandoverPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const t = await getTranslations();
  const { id } = await params;
  const format = first((await searchParams).f) === 'thermal' ? 'thermal' : 'a5';
  const { actor } = await requireSession();
  const crumbs = [
    { label: t('rec.orders.title'), href: '/rec/orders' },
    { label: t('rec.orders.titleShort'), href: `/rec/orders/${id}` },
  ];
  const res = await load(() => getHandoverPrint(getContainer().rec, actor, id));
  if (res.error)
    return (
      <RecPage title={t('rec.handover.printTitle')} crumbs={crumbs}>
        <ErrorFor error={res.error} t={t} />
      </RecPage>
    );
  const p = res.data;
  const pageSize = format === 'a5' ? 'A5 portrait' : '80mm auto';
  return (
    <RecPage title={`${t('rec.handover.printTitle')} · ${p.orderNumber}`} crumbs={crumbs}>
      <style>{`@media print { @page { size: ${pageSize}; margin: 0; } }`}</style>
      <div className="rec-actions no-print">
        <Link
          {...chip(format === 'a5')}
          href={`/rec/orders/${encodeURIComponent(id)}/handover/print?f=a5`}
        >
          A5
        </Link>
        <Link
          {...chip(format === 'thermal')}
          href={`/rec/orders/${encodeURIComponent(id)}/handover/print?f=thermal`}
        >
          {t('rec.handover.thermal')}
        </Link>
      </div>
      <PrintHandover
        orderId={id}
        format={format}
        reprint={p.reprint}
        labels={pickLabels(t, 'rec.handover', ['print', 'reprintReason', 'unexpected'])}
      />
      <div className="hv-wrap">
        <article className={`hv-sheet hv-sheet--${format}`} data-testid="handover-sheet">
          <h1>{t('rec.handover.printTitle')}</h1>
          {p.reprint ? <div className="hv-reprint">{t('rec.handover.reprintMark')}</div> : null}
          <table>
            <tbody>
              <tr>
                <th scope="row">{t('rec.orders.no')}</th>
                <td>{p.orderNumber}</td>
              </tr>
              <tr>
                <th scope="row">{t('rec.plate')}</th>
                <td>{p.plate}</td>
              </tr>
              <tr>
                <th scope="row">{t('rec.vehicle')}</th>
                <td>{p.vehicleLabel}</td>
              </tr>
              <tr>
                <th scope="row">{t('rec.customer')}</th>
                <td>{p.customerName}</td>
              </tr>
              <tr>
                <th scope="row">{t('rec.orders.at')}</th>
                <td>{formatDateTime(new Date(p.handover.at))}</td>
              </tr>
              {p.handover.km !== null ? (
                <tr>
                  <th scope="row">{t('rec.handover.km')}</th>
                  <td>{p.handover.km}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <strong>{t('rec.handover.workDone')}</strong>
          <table>
            <tbody>
              {p.items.map((i) => (
                <tr key={i.no}>
                  <td>
                    {i.no}. {i.name}
                    {i.parts.map((x) => (
                      <div key={x.name}>
                        &nbsp;&nbsp;- {x.name} x {x.qty}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div>
            {t('rec.orders.total')}: <strong>{money(p.totalVnd)}</strong>
          </div>
          <div>
            {p.handover.belongingsReturned ? '[x]' : '[ ]'} {t('rec.handover.belongings')}
          </div>
          <div>
            {p.handover.oldPartsReturned ? '[x]' : '[ ]'} {t('rec.handover.oldParts')}
          </div>
          <div>
            {t('rec.handover.confirmation')}: {t(`rec.handover.confirm_${p.handover.confirmation}`)}
            {p.handover.paperRef ? ` (${p.handover.paperRef})` : ''}
          </div>
          <div className="hv-sign">
            <div>
              {t('rec.handover.receiver')}
              <i>{p.handover.receiverName || t('rec.handover.signHere')}</i>
            </div>
            <div>
              {t('rec.handover.staff')}
              <i>{t('rec.handover.signHere')}</i>
            </div>
          </div>
        </article>
      </div>
    </RecPage>
  );
}
