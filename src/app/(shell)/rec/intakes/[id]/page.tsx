import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { formatDateTime, isoToVi } from '@/platform/format/date';
import { hasPermission } from '@/platform/rbac/rbac';
import { getVehicle } from '@/modules/crm';
import { BELONGINGS, getIntake } from '@/modules/rec';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ErrorFor } from '@/ui/components/PageParts';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { formatKm } from '../../format';
import { RecPage } from '../../RecPage';
import { IntakeWizard } from './IntakeWizard';
import { StartQuote } from './StartQuote';

export const dynamic = 'force-dynamic';

/** templates keep their {placeholders} for the client to fill */
const PLACEHOLDERS = { step: '{step}', time: '{time}', km: '{km}' };
const WIZARD_KEYS = [
  'step1',
  'step2',
  'step3',
  'step4',
  'step5',
  'stepOf',
  'next',
  'prev',
  'saveDraft',
  'savedAt',
  'finish',
  'cancelIntake',
  'cancelReason',
  'cancelConfirm',
  'keep',
  'vehicle',
  'owner',
  'lastKm',
  'km',
  'kmUnit',
  'kmRequired',
  'kmWarnTitle',
  'kmWarnText',
  'kmReason',
  'kmReason_typo',
  'kmReason_odometer_replaced',
  'kmReason_other',
  'kmNote',
  'fuel',
  'fuel_empty',
  'fuel_quarter',
  'fuel_half',
  'fuel_three_quarters',
  'fuel_full',
  'request',
  'requestHint',
  'requestRequired',
  'condition',
  'belongings',
  'belongingsOther',
  'belongingsHint',
  'photosNote',
  'serviceType',
  'serviceType_maintenance',
  'serviceType_general_repair',
  'serviceType_tire_wheel',
  'serviceType_body_paint',
  'advisor',
  'promisedDate',
  'promisedDateRequired',
  'promisedTime',
  'customerParts',
  'customerPartsHint',
  'partName',
  'partQty',
  'partCondition',
  'addPart',
  'removePart',
  'internalNote',
  'review',
  'edit',
  'noQuote',
  'offline',
  'unexpected',
  'conflict',
  'abnormalNote',
] as const;

/** G2-REC-01: the 5-step wizard resumes from the saved draft; a completed intake is a summary with "Lập báo giá". */
export default async function IntakePage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations();
  const { id } = await params;
  const { actor } = await requireSession();
  const container = getContainer();
  const crumbs = [{ label: t('rec.intakes.title'), href: '/rec/intakes' }];
  const res = await load(async () => {
    const intake = await getIntake(container.rec, actor, id);
    // the odometer rule compares with the vehicle's last reading as it is now
    const vehicle = await getVehicle(container.crm, actor, intake.vehicleId).catch(() => null);
    return { intake, lastKm: vehicle?.lastKm ?? intake.lastKmAtOpen };
  });
  if (res.error)
    return (
      <RecPage title={t('rec.intakes.title')} crumbs={crumbs}>
        <ErrorFor error={res.error} t={t} />
      </RecPage>
    );
  const { intake, lastKm } = res.data;
  const canEdit = hasPermission(actor, 'intake:update');
  const tone = { draft: 'neutral', completed: 'success', cancelled: 'danger' } as const;
  const head = {
    title: `${t('rec.intakes.record')} ${intake.number}`,
    desc: t('rec.intakes.recordLead'),
    crumbs,
    actions: (
      <StatusBadge tone={tone[intake.status]}>
        {t(`rec.intakes.status_${intake.status}`)}
      </StatusBadge>
    ),
  };
  if (intake.status === 'draft' && canEdit) {
    const labels = Object.fromEntries(
      WIZARD_KEYS.map((k) => [k, t(`rec.wizard.${k}`, PLACEHOLDERS)]),
    );
    const belongingLabels = Object.fromEntries(
      BELONGINGS.map((b) => [b, t(`rec.belongings.${b}`)]),
    );
    return (
      <RecPage {...head}>
        <IntakeWizard
          intake={intake}
          lastKm={lastKm}
          labels={labels}
          belongingLabels={belongingLabels}
          advisorName={actor.displayName}
        />
      </RecPage>
    );
  }
  return (
    <RecPage {...head}>
      <section className="card" aria-label={t('rec.intakes.record')}>
        <dl className="inv-facts" data-testid="intake-summary">
          <div>
            <dt>{t('rec.plate')}</dt>
            <dd>
              <span className="plate">{intake.plate}</span>
            </dd>
          </div>
          <div>
            <dt>{t('rec.vehicle')}</dt>
            <dd>{intake.vehicleLabel}</dd>
          </div>
          <div>
            <dt>{t('rec.customer')}</dt>
            <dd>{intake.customerName}</dd>
          </div>
          <div>
            <dt>{t('rec.wizard.km')}</dt>
            <dd className="num">{intake.km === null ? '—' : formatKm(intake.km)}</dd>
          </div>
          <div>
            <dt>{t('rec.wizard.request')}</dt>
            <dd>{intake.customerRequest ?? '—'}</dd>
          </div>
          <div>
            <dt>{t('rec.wizard.serviceType')}</dt>
            <dd>{intake.serviceType ? t(`rec.wizard.serviceType_${intake.serviceType}`) : '—'}</dd>
          </div>
          <div>
            <dt>{t('rec.wizard.promisedDate')}</dt>
            <dd className="num">
              {intake.promisedDate ? isoToVi(intake.promisedDate) : '—'} {intake.promisedTime ?? ''}
            </dd>
          </div>
          <div>
            <dt>{t('rec.updatedAt')}</dt>
            <dd>{formatDateTime(new Date(intake.updatedAt))}</dd>
          </div>
          {intake.kmAbnormal ? (
            <div>
              <dt>{t('rec.intakes.flags')}</dt>
              <dd>
                <StatusBadge tone="warning">{t('rec.intakes.kmAbnormal')}</StatusBadge>
              </dd>
            </div>
          ) : null}
        </dl>
      </section>
      <div className="rec-actions">
        {intake.quoteId ? (
          <Link
            className="btn btn--primary"
            href={`/rec/quotes/${encodeURIComponent(intake.quoteId)}`}
          >
            {t('rec.intakes.openQuote')}
          </Link>
        ) : intake.status === 'completed' && hasPermission(actor, 'quote:create') ? (
          <StartQuote
            intakeId={intake.id}
            labels={{ start: t('rec.intakes.startQuote'), unexpected: t('rec.wizard.unexpected') }}
          />
        ) : null}
      </div>
    </RecPage>
  );
}
