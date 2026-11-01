import { getTranslations } from 'next-intl/server';
import { resolveScope } from '@/platform/rbac/rbac';
import { formLabels } from '@/composition/labels';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { ResourceForm } from '@/ui/components/ResourceForm';
import { ErrorFor, PageHeader } from '@/ui/components/PageParts';

export const dynamic = 'force-dynamic';

/** Adding a branch is configuration only (NFR-SCA-01). */
export default async function NewBranchPage() {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const res = await load(async () => resolveScope(actor, 'org:create'));
  if (res.error)
    return (
      <>
        <PageHeader title={t('branches.create')} />
        <ErrorFor error={res.error} t={t} />
      </>
    );
  return (
    <>
      <PageHeader title={t('branches.create')} />
      <div className="g1-auth-card g1-auth-card--wide">
        <ResourceForm
          testId="branch-form"
          endpoint="/api/v1/sys/branches"
          redirectTo="/sys/branches"
          cancelHref="/sys/branches"
          labels={formLabels(t, 'branches.save')}
          fields={[
            {
              name: 'code',
              label: t('branches.colCode'),
              required: true,
              hint: t('branches.codeHint'),
              maxLength: 4,
            },
            { name: 'name', label: t('branches.colName'), required: true, maxLength: 120 },
            { name: 'hours', label: t('branches.hours'), maxLength: 200 },
            { name: 'contact', label: t('branches.contact'), maxLength: 200 },
          ]}
        />
      </div>
    </>
  );
}
