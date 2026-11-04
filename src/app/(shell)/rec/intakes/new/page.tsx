import { getTranslations } from 'next-intl/server';
import { hasPermission } from '@/platform/rbac/rbac';
import { requireSession } from '@/composition/session';
import { NoPermissionState } from '@/ui/components/States';
import { pickerLabels } from '../../../crm/pickerLabels';
import { RecPage } from '../../RecPage';
import { NewIntake } from './NewIntake';

export const dynamic = 'force-dynamic';

const KEYS = [
  'plate',
  'plateHint',
  'search',
  'searching',
  'noneFound',
  'start',
  'lookupTitle',
  'lookupBranches',
  'adopt',
  'newVehicle',
  'newVehicleLead',
  'owner',
  'make',
  'model',
  'year',
  'createVehicle',
  'back',
  'lastKm',
  'owner_',
  'failed',
  'unexpected',
  'requiredOwner',
] as const;

/** G2-REC-01 step 1: find the vehicle by plate; the owner and the history come from CRM (FR-REC-001). */
export default async function NewIntakePage() {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const crumbs = [{ label: t('rec.intakes.title'), href: '/rec/intakes' }];
  if (!hasPermission(actor, 'intake:create'))
    return (
      <RecPage title={t('rec.intakes.new')} crumbs={crumbs}>
        <NoPermissionState
          title={t('states.noPermissionTitle')}
          text={t('states.noPermissionText')}
        />
      </RecPage>
    );
  const labels = Object.fromEntries(KEYS.map((k) => [k, t(`rec.intakes.start_${k}`)]));
  return (
    <RecPage title={t('rec.intakes.new')} desc={t('rec.intakes.newLead')} crumbs={crumbs}>
      <NewIntake
        labels={labels}
        picker={pickerLabels(t)}
        canLookup={
          hasPermission(actor, 'customer-lookup-customer:view') &&
          hasPermission(actor, 'customer:update')
        }
      />
    </RecPage>
  );
}
