import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { getOrder, getQcChecklist } from '@/modules/rec';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ErrorFor } from '@/ui/components/PageParts';
import { pickLabels } from '../../../orderUi';
import { RecPage } from '../../../RecPage';
import { QcForm } from './QcForm';

export const dynamic = 'force-dynamic';

const KEYS = [
  'noChecklist',
  'fault',
  'returnItems',
  'note',
  'pass',
  'fail',
  'unexpected',
  'offline',
] as const;

/** G2-DLV-01/02 / FR-REC-016: quality check of an order that is awaiting it. */
export default async function QcPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations();
  const { id } = await params;
  const { actor } = await requireSession();
  const crumbs = [
    { label: t('rec.orders.title'), href: '/rec/orders' },
    { label: t('rec.orders.titleShort'), href: `/rec/orders/${id}` },
  ];
  const res = await load(async () => {
    const rec = getContainer().rec;
    const [o, list] = await Promise.all([getOrder(rec, actor, id), getQcChecklist(rec, actor, id)]);
    return { o, list };
  });
  if (res.error)
    return (
      <RecPage title={t('rec.qc.title')} crumbs={crumbs}>
        <ErrorFor error={res.error} t={t} />
      </RecPage>
    );
  const { o, list } = res.data;
  return (
    <RecPage title={`${t('rec.qc.title')} · ${o.number}`} desc={t('rec.qc.lead')} crumbs={crumbs}>
      {o.status !== 'awaiting_qc' ? (
        <div className="alert alert--info" role="note">
          <div className="alert__body">
            {t('rec.qc.notAwaiting')}{' '}
            <Link href={`/rec/orders/${encodeURIComponent(o.id)}`}>{t('rec.qc.backToOrder')}</Link>
          </div>
        </div>
      ) : (
        <section className="card">
          <div className="card__body">
            <QcForm
              orderId={o.id}
              version={o.version}
              checks={list.checks}
              items={o.items
                .filter((i) => i.status === 'done')
                .map((i) => ({
                  id: i.id,
                  label: `${i.no}. ${i.name}`,
                  technician: i.technicianName ?? '',
                }))}
              labels={pickLabels(t, 'rec.qc', KEYS)}
            />
          </div>
        </section>
      )}
    </RecPage>
  );
}
