import { getTranslations } from 'next-intl/server';
import { hasPermission } from '@/platform/rbac/rbac';
import { formatDateTime } from '@/platform/format/date';
import { listImportKinds, listImports, listWarehouses } from '@/modules/sys';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { NoPermissionState } from '@/ui/components/States';
import { ErrorFor } from '@/ui/components/PageParts';
import { SettingsPage } from '../SettingsPage';
import { ImportWorkbench } from './ImportWorkbench';

export const dynamic = 'force-dynamic';

/** FR-SYS-007 / G4-SYS-20, 21: dry run with row errors, batch write, history and undo, on the working branch. */
export default async function ImportsPage() {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const deps = getContainer().sys;
  const head = {
    current: 'imports',
    code: 'G4-SYS-20',
    title: t('import.title'),
    desc: t('import.lead'),
  };
  if (!hasPermission(actor, 'data-import:view'))
    return (
      <SettingsPage {...head}>
        <NoPermissionState
          title={t('states.noPermissionTitle')}
          text={t('states.noPermissionText')}
        />
      </SettingsPage>
    );
  if (!actor.workingBranchId)
    return (
      <SettingsPage {...head}>
        <div className="alert alert--warning" role="note">
          <div className="alert__body">{t('import.noBranch')}</div>
        </div>
      </SettingsPage>
    );
  const res = await load(async () => ({
    kinds: listImportKinds(deps, actor),
    history: await listImports(deps, actor),
    warehouses: hasPermission(actor, 'warehouse:view')
      ? (await listWarehouses(deps, actor, { branchId: actor.workingBranchId!, limit: 100 })).items
      : [],
  }));
  if (res.error)
    return (
      <SettingsPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </SettingsPage>
    );
  const { kinds, history, warehouses } = res.data;
  return (
    <SettingsPage {...head} scopeText={t('import.scope')}>
      <ImportWorkbench
        kinds={kinds}
        warehouses={warehouses
          .filter((w) => w.status === 'active')
          .map((w) => ({ id: w.id, name: w.name }))}
        history={history.map((b) => ({
          ...b,
          createdAtText: formatDateTime(new Date(b.createdAt)),
        }))}
        canUndo={hasPermission(actor, 'data-import:archive')}
        limits={{
          mb: Math.round(deps.config.importMaxBytes / (1024 * 1024)),
          rows: deps.config.importMaxRows,
        }}
      />
    </SettingsPage>
  );
}
