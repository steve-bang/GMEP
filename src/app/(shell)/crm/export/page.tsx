import { getTranslations } from 'next-intl/server';
import { hasPermission, resolveWorkingScope } from '@/platform/rbac/rbac';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { ErrorFor } from '@/ui/components/PageParts';
import { CrmPage } from '../CrmPage';
import { ExportForm } from './ExportForm';

export const dynamic = 'force-dynamic';

/** G2-CRM-12 / FR-CRM-017: export needs the dedicated permission; full personal columns need reason + password. */
export default async function ExportPage() {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const res = await load(async () => resolveWorkingScope(actor, 'customer:export'));
  const crumbs = [{ label: t('crm.customers.title'), href: '/crm/customers' }];
  if (res.error)
    return (
      <CrmPage title={t('crm.export.title')} crumbs={crumbs}>
        <ErrorFor error={res.error} t={t} />
      </CrmPage>
    );
  return (
    <CrmPage title={t('crm.export.title')} desc={t('crm.export.lead')} crumbs={crumbs}>
      <ExportForm
        canIncludePii={hasPermission(actor, 'customer-pii:export')}
        labels={{
          type: t('crm.customers.type'),
          all: t('common.all'),
          individual: t('crm.type.individual'),
          business: t('crm.type.business'),
          q: t('crm.customers.search'),
          includePii: t('crm.export.includePii'),
          includePiiHint: t('crm.export.includePiiHint'),
          reason: t('crm.export.reason'),
          password: t('crm.export.password'),
          submit: t('crm.export.submit'),
          done: t('crm.export.done'),
          failed: t('common.unexpected'),
          limits: t('crm.export.limits'),
        }}
      />
    </CrmPage>
  );
}
