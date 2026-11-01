import { getTranslations } from 'next-intl/server';
import { resolveScope } from '@/platform/rbac/rbac';
import { formLabels } from '@/composition/labels';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ResourceForm } from '@/ui/components/ResourceForm';
import { SettingsPage } from '../../SettingsPage';
import { ErrorFor } from '@/ui/components/PageParts';

export const dynamic = 'force-dynamic';

/** FR-SYS-005 create form. The branch list offers only branches where the actor may create (and shows their state). */
export default async function NewWarehousePage() {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const res = await load(async () => {
    const scope = resolveScope(actor, 'warehouse:create');
    return getContainer().sys.branches.list(scope);
  });
  if (res.error)
    return (
      <SettingsPage
        current="warehouses"
        parent={{ label: t('warehouses.title'), href: '/sys/warehouses' }}
        title={t('warehouses.create')}
      >
        <ErrorFor error={res.error} t={t} />
      </SettingsPage>
    );
  return (
    <SettingsPage
      current="warehouses"
      parent={{ label: t('warehouses.title'), href: '/sys/warehouses' }}
      title={t('warehouses.create')}
    >
      <div className="g1-auth-card g1-auth-card--wide">
        <ResourceForm
          testId="warehouse-form"
          endpoint="/api/v1/sys/warehouses"
          redirectTo="/sys/warehouses"
          cancelHref="/sys/warehouses"
          labels={formLabels(t, 'warehouses.save')}
          fields={[
            {
              name: 'branchId',
              label: t('warehouses.colBranch'),
              type: 'select',
              required: true,
              options: res.data.map((b) => ({
                value: b.id,
                label: `${b.name}${b.status !== 'active' ? ` (${t(`scope.status.${b.status}`)})` : ''}`,
              })),
            },
            {
              name: 'code',
              label: t('warehouses.colCode'),
              required: true,
              hint: t('warehouses.codeHint'),
              maxLength: 20,
            },
            { name: 'name', label: t('warehouses.colName'), required: true, maxLength: 120 },
            { name: 'note', label: t('warehouses.note'), type: 'textarea', maxLength: 300 },
          ]}
        />
      </div>
    </SettingsPage>
  );
}
