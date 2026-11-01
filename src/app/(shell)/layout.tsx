import { getTranslations } from 'next-intl/server';
import { getShellInfo, ROLE_NAMES } from '@/modules/sys';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { AppShell, type NavGroup } from '@/ui/components/AppShell';
import { OfflineBanner } from '@/ui/components/OfflineBanner';
import { ScopePicker } from '@/ui/components/ScopePicker';

export const dynamic = 'force-dynamic';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
  ).toUpperCase();
}

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations();
  const deps = getContainer().sys;
  const session = await requireSession();
  const info = await getShellInfo(deps, session.actor);
  const can = info.can;

  const item = (
    key: string,
    href: string,
    label: string,
    icon: string,
    match: 'exact' | 'prefix' = 'prefix',
  ) => ({
    key,
    href,
    label,
    icon,
    match,
  });
  const nav: NavGroup[] = [
    {
      label: t('shell.nav.groupWorkspace'),
      items: [item('dash', '/', t('shell.nav.dashboard'), 'layout-dashboard', 'exact')],
    },
    {
      label: t('shell.nav.groupSystem'),
      items: [
        ...(can.branches ? [item('br', '/sys/branches', t('shell.nav.branches'), 'map-pin')] : []),
        ...(can.warehouses
          ? [item('wh', '/sys/warehouses', t('shell.nav.warehouses'), 'warehouse')]
          : []),
        ...(can.users ? [item('us', '/sys/users', t('shell.nav.users'), 'users')] : []),
        ...(can.services ? [item('sv', '/sys/services', t('shell.nav.services'), 'wrench')] : []),
        ...(can.priceLists
          ? [item('pl', '/sys/price-lists', t('shell.nav.priceLists'), 'receipt')]
          : []),
        ...(can.config || can.templates || can.priceLists || can.services
          ? [item('cfg', '/sys/config', t('shell.nav.config'), 'settings')]
          : []),
        ...(can.audit ? [item('au', '/sys/audit', t('shell.nav.audit'), 'history')] : []),
      ],
    },
  ].filter((g) => g.items.length > 0);

  const roleNames: Record<string, string> = ROLE_NAMES;

  return (
    <AppShell
      nav={nav}
      brand={t('app.name')}
      labels={{
        skip: t('shell.skip'),
        navLabel: t('shell.navLabel'),
        openMenu: t('shell.openMenu'),
        closeMenu: t('shell.closeMenu'),
        scopeCaption: t('shell.scopeCaption'),
        userMenu: t('shell.userMenu'),
        logout: t('shell.logout'),
      }}
      scopeSlot={<ScopePicker scope={info.scope} roleNames={roleNames} />}
      bell={{
        href: '/notifications',
        label: t('shell.notifications'),
        count: info.unreadNotifications,
      }}
      banner={
        <OfflineBanner
          title={t('offline.title')}
          text={t('offline.text')}
          restored={t('offline.restored')}
        />
      }
      user={{ name: info.displayName, initials: initials(info.displayName) }}
    >
      {children}
    </AppShell>
  );
}
