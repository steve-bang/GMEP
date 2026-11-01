import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { hasPermission, resolveScope } from '@/platform/rbac/rbac';
import { getUser, OWNER_APPROVED_ROLES, ROLE_CODES, ROLE_NAMES } from '@/modules/sys';
import { formLabels } from '@/composition/labels';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ActionButton } from '@/ui/components/ResourceForm';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { ErrorFor, PageHeader } from '@/ui/components/PageParts';
import { AssignmentForm } from './AssignmentForm';
import { RevealPhone } from './RevealPhone';

export const dynamic = 'force-dynamic';

const TONE = { active: 'success', invited: 'info', disabled: 'neutral' } as const;

/** G4-SYS-02..04: user detail with role assignments (FR-SYS-012), status, unlock, session revoke. */
export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations();
  const { id } = await params;
  const { actor } = await requireSession();
  const deps = getContainer().sys;
  const res = await load(async () => {
    const user = await getUser(deps, actor, id);
    const branches = await deps.branches.list(resolveScope(actor, 'user:view'));
    return { user, branches };
  });
  if (res.error)
    return (
      <>
        <PageHeader title={t('users.title')} />
        <ErrorFor error={res.error} t={t} />
      </>
    );
  const { user: u, branches } = res.data;
  const branchName = (b: string) =>
    b === '*' ? t('shell.scopeAll') : (branches.find((x) => x.id === b)?.name ?? b);
  const canAssign = hasPermission(actor, 'user:update') && u.id !== actor.userId;
  const canManage = hasPermission(actor, 'user:manage') && u.id !== actor.userId;
  const canArchive =
    hasPermission(actor, 'user:archive') && u.id !== actor.userId && u.status !== 'invited';
  const isOwner = hasPermission(actor, 'user:approve');
  const roles = ROLE_CODES.filter((r) => isOwner || !OWNER_APPROVED_ROLES.includes(r));
  return (
    <>
      <PageHeader
        title={`${u.employeeCode} · ${u.displayName}`}
        lead={u.email}
        actions={
          <Link className="btn btn--ghost" href="/sys/users">
            {t('common.back')}
          </Link>
        }
      />
      <p>
        <StatusBadge tone={TONE[u.status as keyof typeof TONE]}>
          {t(`users.status.${u.status}`)}
        </StatusBadge>
      </p>
      <section aria-labelledby="contact-h">
        <h2 id="contact-h">{t('users.contact')}</h2>
        {u.phone ? (
          <RevealPhone
            userId={u.id}
            masked={u.phone}
            reveal={u.phoneReveal}
            labels={{
              show: t('pii.show'),
              hide: t('pii.hide'),
              reason: t('pii.reasonLabel'),
              note: t('pii.noteLabel'),
              invoiceCheck: t('pii.reasons.invoice_check'),
              debt: t('pii.reasons.debt_collection'),
              other: t('pii.reasons.other'),
              failed: t('pii.failed'),
              phone: t('users.colPhone'),
            }}
          />
        ) : (
          <p className="text-secondary">{t('users.noPhone')}</p>
        )}
      </section>
      <section aria-labelledby="roles-h" className="stack">
        <h2 id="roles-h">{t('users.assignments')}</h2>
        {u.assignments?.length ? (
          <ul className="stack" data-testid="assignments">
            {u.assignments.map((a) => (
              <li key={a.id} className="g5-actions">
                <span>
                  {ROLE_NAMES[a.roleCode as keyof typeof ROLE_NAMES] ?? a.roleCode} ·{' '}
                  {branchName(a.branchId)}
                </span>
                {canAssign ? (
                  <ActionButton
                    endpoint={`/api/v1/sys/users/${u.id}/assignments/${encodeURIComponent(a.id)}`}
                    method="DELETE"
                    label={t('users.removeAssignment')}
                    variant="ghost"
                    errorFallback={t('common.unexpected')}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-secondary">{t('users.noAssignments')}</p>
        )}
        {canAssign ? (
          <AssignmentForm
            userId={u.id}
            roles={roles.map((r) => ({ value: r, label: ROLE_NAMES[r] }))}
            branches={branches.map((b) => ({ value: b.id, label: b.name }))}
            labels={{ ...formLabels(t, 'users.addAssignment', false) }}
            text={{ role: t('users.role'), branch: t('users.branch') }}
          />
        ) : null}
      </section>
      <section aria-labelledby="acct-h" className="stack">
        <h2 id="acct-h">{t('users.account')}</h2>
        <div className="g5-actions">
          {canArchive ? (
            <ActionButton
              testId="user-status"
              endpoint={`/api/v1/sys/users/${u.id}/status`}
              body={{ status: u.status === 'disabled' ? 'active' : 'disabled', version: u.version }}
              label={u.status === 'disabled' ? t('users.enable') : t('users.disable')}
              variant={u.status === 'disabled' ? 'secondary' : 'danger'}
              confirm={u.status === 'disabled' ? undefined : t('users.disableConfirm')}
              errorFallback={t('common.unexpected')}
            />
          ) : null}
          {canManage && u.status === 'invited' ? (
            <ActionButton
              endpoint={`/api/v1/sys/users/${u.id}/resend-invite`}
              label={t('users.resendInvite')}
              errorFallback={t('common.unexpected')}
            />
          ) : null}
          {canManage ? (
            <ActionButton
              endpoint={`/api/v1/sys/users/${u.id}/unlock`}
              label={t('users.unlock')}
              errorFallback={t('common.unexpected')}
            />
          ) : null}
          {canManage ? (
            <ActionButton
              testId="revoke-sessions"
              endpoint={`/api/v1/sys/users/${u.id}/sessions`}
              method="DELETE"
              label={t('users.revokeSessions')}
              variant="danger"
              confirm={t('users.revokeConfirm')}
              errorFallback={t('common.unexpected')}
            />
          ) : null}
        </div>
      </section>
    </>
  );
}
