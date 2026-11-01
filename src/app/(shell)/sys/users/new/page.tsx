import { getTranslations } from 'next-intl/server';
import { hasPermission, resolveScope } from '@/platform/rbac/rbac';
import { OWNER_APPROVED_ROLES, ROLE_CODES, ROLE_NAMES } from '@/modules/sys';
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
    return getContainer().sys.branches.list(scope);
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
          branches={res.data.map((b) => ({ value: b.id, label: b.name }))}
          roles={roles.map((r) => ({ value: r, label: ROLE_NAMES[r] }))}
          labels={formLabels(t, 'users.sendInvite')}
          text={{
            code: t('users.colCode'),
            name: t('users.colName'),
            email: t('users.colEmail'),
            phone: t('users.colPhone'),
            role: t('users.role'),
            branch: t('users.branch'),
            codeHint: t('users.codeHint'),
          }}
        />
      </div>
    </SettingsPage>
  );
}
