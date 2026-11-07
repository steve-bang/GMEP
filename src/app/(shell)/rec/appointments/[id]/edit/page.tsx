import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { hasPermission } from '@/platform/rbac/rbac';
import {
  getAppointment,
  listAppointmentAdvisors,
  listServiceTypes,
  type AppointmentDto,
} from '@/modules/rec';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ErrorFor } from '@/ui/components/PageParts';
import { EmptyState, NoPermissionState } from '@/ui/components/States';
import { RecPage } from '../../../RecPage';
import { AppointmentForm } from '../../AppointmentForm';
import { aptLabels } from '../../labels';

export const dynamic = 'force-dynamic';

/** G2-APT-02 (edit): FR-REC-027. Only a pending appointment of the working branch can be changed. */
export default async function EditAppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations();
  const { id } = await params;
  const { actor } = await requireSession();
  const l = aptLabels();
  const head = {
    title: l.edit!,
    desc: l.editLead!,
    crumbs: [{ label: l.title!, href: '/rec/appointments' }],
  };
  if (!hasPermission(actor, 'appointment:update'))
    return (
      <RecPage {...head}>
        <NoPermissionState
          title={t('states.noPermissionTitle')}
          text={t('states.noPermissionText')}
        />
      </RecPage>
    );
  const container = getContainer();
  const res = await load(async () => ({
    apt: await getAppointment(container.rec, actor, id),
    services: await listServiceTypes(container.rec, actor).catch(() => []),
    advisors: await listAppointmentAdvisors(container.rec, actor),
  }));
  if (res.error)
    return (
      <RecPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </RecPage>
    );
  const a: AppointmentDto = res.data.apt;
  if (a.status !== 'pending')
    return (
      <RecPage {...head}>
        <EmptyState
          title={l.e_appointment_state_invalid!}
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
        services={res.data.services
          .filter((x) => x.active || x.code === a.serviceType)
          .map((x) => ({ code: x.code, name: x.name }))}
        advisors={res.data.advisors}
        defaultDate={a.date}
        initial={{
          id: a.id,
          version: a.version,
          number: a.number,
          plate: a.plate,
          vehicleLabel: a.vehicleLabel,
          customerName: a.customerName,
          date: a.date,
          time: a.time,
          serviceType: a.serviceType,
          advisorId: a.advisorId,
          note: a.note,
        }}
      />
    </RecPage>
  );
}
