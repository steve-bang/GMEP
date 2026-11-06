import { getTranslations } from 'next-intl/server';
import { hasPermission, resolveScope } from '@/platform/rbac/rbac';
import {
  BRANCH_ASSIGNABLE_ROLES,
  OWNER_APPROVED_ROLES,
  ROLE_CODES,
  ROLE_NAMES,
  tenantCodeOf,
} from '@/modules/sys';
import { formLabels } from '@/composition/labels';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { InviteUserForm } from './InviteUserForm';
import { SettingsPage } from '../../SettingsPage';
import { ErrorFor } from '@/ui/components/PageParts';

export const dynamic = 'force-dynamic';

/** Invitation form: the first assignment is part of the invite (G5-AUT-03 shows it read-only to the invitee). */
export default async function InviteUserPage() {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const res = await load(async () => {
    const scope = resolveScope(actor, 'user:create');
    return {
      branches: await getContainer().sys.branches.list(scope),
      // owner decision 07/11/2026: the six-digit company code the manager hands over with the employee code
      companyCode: await tenantCodeOf(getContainer().sys, actor.tenantId),
    };
  });
  if (res.error)
    return (
      <SettingsPage
        current="users"
        parent={{ label: t('users.title'), href: '/sys/users' }}
        title={t('users.invite')}
      >
        <ErrorFor error={res.error} t={t} />
      </SettingsPage>
    );
  const isOwner = hasPermission(actor, 'user:approve');
  const roles = ROLE_CODES.filter((r) => isOwner || !OWNER_APPROVED_ROLES.includes(r));
  return (
    <SettingsPage
      current="users"
      parent={{ label: t('users.title'), href: '/sys/users' }}
      title={t('users.invite')}
      desc={t('users.inviteLead')}
    >
      <div className="g1-auth-card g1-auth-card--wide">
        <InviteUserForm
          branches={res.data.branches.map((b) => ({ value: b.id, label: b.name }))}
          companyCode={res.data.companyCode}
          roles={roles.map((r) => ({ value: r, label: ROLE_NAMES[r] }))}
          noEmailRoles={ROLE_CODES.filter((r) => BRANCH_ASSIGNABLE_ROLES.includes(r)).map((r) => ({
            value: r,
            label: ROLE_NAMES[r],
          }))}
          labels={formLabels(t, 'users.sendInvite')}
          noEmailLabels={formLabels(t, 'users.noEmail.create')}
          text={{
            code: t('users.colCode'),
            name: t('users.colName'),
            email: t('users.colEmail'),
            phone: t('users.colPhone'),
            role: t('users.role'),
            branch: t('users.branch'),
            codeHint: t('users.codeHint'),
            noEmail: t('users.noEmail.toggle'),
            noEmailHint: t('users.noEmail.toggleHint'),
            companyCode: t('users.noEmail.companyCode'),
            companyCodeHint: t('users.noEmail.companyCodeHint'),
            tempPassword: t('users.noEmail.temporaryPassword'),
            tempPasswordHint: t('users.noEmail.temporaryPasswordHint', {
              min: getContainer().sys.config.passwordPolicy.minLength,
              hours: Math.round(getContainer().sys.config.tempPasswordTtlMs / 3_600_000),
            }),
            // placeholders filled in the browser with the created account's codes
            created: t('users.noEmail.created', { company: '{company}', code: '{code}' }),
            show: t('login.showPassword'),
            capsLock: t('login.capsLock'),
          }}
        />
      </div>
    </SettingsPage>
  );
}
