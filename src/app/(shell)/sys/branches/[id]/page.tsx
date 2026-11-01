import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { hasPermission } from '@/platform/rbac/rbac';
import { BRANCH_TRANSITIONS, getBranch } from '@/modules/sys';
import { formLabels } from '@/composition/labels';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ActionButton, ResourceForm } from '@/ui/components/ResourceForm';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { SettingsPage } from '../../SettingsPage';
import { ErrorFor } from '@/ui/components/PageParts';

export const dynamic = 'force-dynamic';

const TONE = { active: 'success', closing: 'warning', locked: 'danger' } as const;

export default async function BranchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations();
  const { id } = await params;
  const { actor } = await requireSession();
  const res = await load(() => getBranch(getContainer().sys, actor, id));
  if (res.error)
    return (
      <SettingsPage
        current="branches"
        parent={{ label: t('branches.title'), href: '/sys/branches' }}
        title={t('branches.title')}
      >
        <ErrorFor error={res.error} t={t} />
      </SettingsPage>
    );
  const b = res.data;
  const canEdit = hasPermission(actor, 'branch-config:update');
  const canState = hasPermission(actor, 'org:archive');
  const targets = BRANCH_TRANSITIONS[b.status as keyof typeof BRANCH_TRANSITIONS];
  return (
    <SettingsPage
      current="branches"
      parent={{ label: t('branches.title'), href: '/sys/branches' }}
      title={`${b.code} · ${b.name}`}
      desc={t('branches.detailLead')}
      actions={
        <Link className="btn btn--ghost" href="/sys/branches">
          {t('common.back')}
        </Link>
      }
    >
      <p>
        <StatusBadge tone={TONE[b.status as keyof typeof TONE]}>
          {t(`scope.status.${b.status}`)}
        </StatusBadge>
      </p>
      {canEdit ? (
        <div className="g1-auth-card g1-auth-card--wide">
          <ResourceForm
            testId="branch-edit"
            endpoint={`/api/v1/sys/branches/${b.id}`}
            method="PATCH"
            extra={{ version: b.version }}
            labels={formLabels(t, 'common.save', false)}
            fields={[
              ...(hasPermission(actor, 'org:update')
                ? [
                    {
                      name: 'name',
                      label: t('branches.colName'),
                      required: true,
                      defaultValue: b.name,
                      maxLength: 120,
                    },
                  ]
                : []),
              {
                name: 'hours',
                label: t('branches.hours'),
                defaultValue: b.hours ?? '',
                maxLength: 200,
              },
              {
                name: 'contact',
                label: t('branches.contact'),
                defaultValue: b.contact ?? '',
                maxLength: 200,
              },
            ]}
          />
        </div>
      ) : null}
      {canState ? (
        <section aria-labelledby="state-h" className="stack">
          <h2 id="state-h">{t('branches.stateTitle')}</h2>
          <p className="text-secondary">{t('branches.stateLead')}</p>
          <div className="g5-actions">
            {targets.map((s) => (
              <ActionButton
                key={s}
                testId={`branch-to-${s}`}
                endpoint={`/api/v1/sys/branches/${b.id}/status`}
                body={{ status: s, version: b.version, reason: t('branches.stateReason') }}
                label={t(`branches.to.${s}`)}
                variant={s === 'locked' ? 'danger' : 'secondary'}
                confirm={t('branches.stateConfirm', { state: t(`scope.status.${s}`) })}
                errorFallback={t('common.unexpected')}
              />
            ))}
          </div>
        </section>
      ) : null}
    </SettingsPage>
  );
}
