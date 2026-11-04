import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { getOrder } from '@/modules/rec';
import { getVehicle } from '@/modules/crm';
import { getOrderMoney } from '@/modules/acc';
import { hasPermission } from '@/platform/rbac/rbac';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ErrorFor } from '@/ui/components/PageParts';
import { pickLabels } from '../../../orderUi';
import { RecPage } from '../../../RecPage';
import { HandoverForm } from './HandoverForm';

export const dynamic = 'force-dynamic';

const KEYS = [
  'receiver',
  'receiverHint',
  'confirmation',
  'confirm_screen',
  'confirm_paper',
  'paperRef',
  'km',
  'lastKm',
  'kmReason',
  'pick',
  'reason_typo',
  'reason_odometer_replaced',
  'reason_other',
  'belongings',
  'oldParts',
  'note',
  'submit',
  'unexpected',
  'offline',
  'payTitle',
  'payReceivable',
  'payReceived',
  'payOutstanding',
  'payOk',
  'payDebtOk',
  'payBlocked',
  'payCollect',
  'payRequestDebt',
  'payPendingDebt',
  'payUnavailable',
  'exceptionReason',
  'exceptionHint',
] as const;

/** G2-DLV-03/04 / FR-REC-017: hand the vehicle over; this completes the order. */
export default async function HandoverPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations();
  const { id } = await params;
  const { actor } = await requireSession();
  const crumbs = [
    { label: t('rec.orders.title'), href: '/rec/orders' },
    { label: t('rec.orders.titleShort'), href: `/rec/orders/${id}` },
  ];
  const res = await load(async () => {
    const o = await getOrder(getContainer().rec, actor, id);
    const v = await getVehicle(getContainer().crm, actor, o.vehicleId).catch(() => null);
    // R44: what the order owes, read from ACC (the server re-reads it when it writes the handover)
    const pay = await getOrderMoney(getContainer().acc, actor, id).catch(() => null);
    return { o, lastKm: v?.lastKm ?? null, pay };
  });
  if (res.error)
    return (
      <RecPage title={t('rec.handover.title')} crumbs={crumbs}>
        <ErrorFor error={res.error} t={t} />
      </RecPage>
    );
  const { o, lastKm, pay } = res.data;
  return (
    <RecPage
      title={`${t('rec.handover.title')} · ${o.number}`}
      desc={t('rec.handover.lead')}
      crumbs={crumbs}
    >
      {o.status !== 'ready_for_delivery' ? (
        <div className="alert alert--info" role="note">
          <div className="alert__body">
            {t('rec.handover.notReady')}{' '}
            <Link href={`/rec/orders/${encodeURIComponent(o.id)}`}>{t('rec.qc.backToOrder')}</Link>
          </div>
        </div>
      ) : (
        <section className="card">
          <div className="card__body">
            <HandoverForm
              orderId={o.id}
              version={o.version}
              lastKm={lastKm}
              requireReceiver
              pay={
                pay
                  ? {
                      receivableVnd: pay.balance.receivableVnd,
                      receivedVnd: pay.balance.receivedVnd,
                      outstandingVnd: pay.balance.outstandingVnd,
                      debt: pay.balance.debt
                        ? {
                            amountVnd: pay.balance.debt.amountVnd,
                            dueDate: pay.balance.debt.dueDate,
                          }
                        : null,
                      pendingNumber:
                        pay.debtApproval?.status === 'pending' ? pay.debtApproval.number : null,
                      canRequestDebt: pay.actions.requestDebt.allowed,
                    }
                  : null
              }
              canException={hasPermission(actor, 'repair-order:approve')}
              labels={pickLabels(t, 'rec.handover', KEYS)}
            />
          </div>
        </section>
      )}
    </RecPage>
  );
}
