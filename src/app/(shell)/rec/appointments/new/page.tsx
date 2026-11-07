import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { businessDate } from '@/platform/format/date';
import { hasPermission } from '@/platform/rbac/rbac';
import { listAppointmentAdvisors, listAppointments, listServiceTypes } from '@/modules/rec';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ErrorFor } from '@/ui/components/PageParts';
import { EmptyState, NoPermissionState } from '@/ui/components/States';
import { RecPage } from '../../RecPage';
import { AppointmentForm } from '../AppointmentForm';
import { aptLabels } from '../labels';

export const dynamic = 'force-dynamic';

/** G2-APT-02 (create): FR-REC-019, 027. The form is offered only when the branch has appointments switched on. */
export default async function NewAppointmentPage() {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const l = aptLabels();
  const head = {
    title: l.new!,
    desc: l.newLead!,
    crumbs: [{ label: l.title!, href: '/rec/appointments' }],
  };
  if (!hasPermission(actor, 'appointment:create'))
    return (
      <RecPage {...head}>
        <NoPermissionState
          title={t('states.noPermissionTitle')}
          text={t('states.noPermissionText')}
        />
      </RecPage>
    );
  const today = businessDate(new Date());
  const container = getContainer();
  const res = await load(async () => ({
    cal: await listAppointments(container.rec, actor, { from: today, days: '1' }),
    services: (await listServiceTypes(container.rec, actor).catch(() => [])).filter(
      (x) => x.active,
    ),
    advisors: await listAppointmentAdvisors(container.rec, actor),
  }));
  if (res.error)
    return (
      <RecPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </RecPage>
    );
  if (!res.data.cal.enabled)
    return (
      <RecPage {...head}>
        <EmptyState
          title={l.disabledTitle!}
          text={l.disabledText!}
          actions={
            <Link className="btn btn--secondary" href="/rec/appointments">
              {l.toList}
            </Link>
          }
        />
      </RecPage>
    );
  return (
    <RecPage {...head}>
      <AppointmentForm
        labels={l}
        services={res.data.services.map((x) => ({ code: x.code, name: x.name }))}
        advisors={res.data.advisors}
        defaultDate={today}
      />
    </RecPage>
  );
}
