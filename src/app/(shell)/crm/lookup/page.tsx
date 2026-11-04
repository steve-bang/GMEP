import { getTranslations } from 'next-intl/server';
import { resolveScope } from '@/platform/rbac/rbac';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { ErrorFor } from '@/ui/components/PageParts';
import { CrmPage } from '../CrmPage';
import { LookupForm } from './LookupForm';

export const dynamic = 'force-dynamic';

/** FR-CRM-002/004, BA §10 P1/P2: exact plate or full phone across all branches; white-listed fields only. */
export default async function LookupPage() {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const res = await load(async () => resolveScope(actor, 'customer-lookup:view'));
  const crumbs = [{ label: t('crm.customers.title'), href: '/crm/customers' }];
  if (res.error)
    return (
      <CrmPage title={t('crm.lookup.title')} crumbs={crumbs}>
        <ErrorFor error={res.error} t={t} />
      </CrmPage>
    );
  const tt = (k: string) => t(k);
  return (
    <CrmPage title={t('crm.lookup.title')} desc={t('crm.lookup.lead')} crumbs={crumbs}>
      <LookupForm
        labels={{
          plate: tt('crm.lookup.plate'),
          phone: tt('crm.lookup.phone'),
          search: tt('crm.lookup.search'),
          none: tt('crm.lookup.none'),
          owner: tt('crm.lookup.owner'),
          branches: tt('crm.lookup.branches'),
          vehicles: tt('crm.lookup.vehicles'),
          marketing: tt('crm.lookup.marketing'),
          noMarketing: tt('crm.lookup.noMarketing'),
          open: tt('crm.lookup.open'),
          relate: tt('crm.lookup.relate'),
          related: tt('crm.lookup.related'),
          failed: tt('common.unexpected'),
          history: tt('crm.lookup.history'),
          hint: tt('crm.lookup.hint'),
        }}
        canRelate={resolveScopeSafe(actor)}
      />
    </CrmPage>
  );
}

function resolveScopeSafe(actor: Parameters<typeof resolveScope>[0]): boolean {
  try {
    resolveScope(actor, 'customer-lookup:view');
    return !!actor.workingBranchId;
  } catch {
    return false;
  }
}
