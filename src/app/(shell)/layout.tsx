import { getTranslations } from 'next-intl/server';
import { getShellInfo } from '@/modules/sys';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { AppShell, type NavGroup } from '@/ui/components/AppShell';

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

  const nav: NavGroup[] = [
    {
      label: t('shell.nav.groupWorkspace'),
      items: [
        {
          key: 'dash',
          href: '/',
          label: t('shell.nav.dashboard'),
          icon: 'layout-dashboard',
          match: 'exact' as const,
        },
      ],
    },
    ...(info.canViewWarehouses
      ? [
          {
            label: t('shell.nav.groupSystem'),
            items: [
              {
                key: 'wh',
                href: '/sys/warehouses',
                label: t('shell.nav.warehouses'),
                icon: 'warehouse',
                match: 'prefix' as const,
              },
            ],
          },
        ]
      : []),
  ];

  const scopeLabel =
    info.scope.kind === 'all'
      ? t('shell.scopeAll')
      : info.scope.kind === 'none'
        ? t('shell.scopeNone')
        : info.scope.kind === 'single'
          ? (info.scope.names[0] ?? t('shell.scopeOwn'))
          : t('shell.scopeMany', { count: info.scope.count });

  return (
    <AppShell
      nav={nav}
      brand={t('app.name')}
      labels={{
        skip: t('shell.skip'),
        navLabel: t('shell.navLabel'),
        openMenu: t('shell.openMenu'),
        closeMenu: t('shell.closeMenu'),
        scopeCaption: info.scope.kind === 'single' ? t('shell.scopeOwn') : t('shell.scopeCaption'),
        userMenu: t('shell.userMenu'),
        logout: t('shell.logout'),
      }}
      scope={{ label: scopeLabel, detail: info.scope.names.join(', '), icon: 'map-pin' }}
      user={{ name: info.displayName, initials: initials(info.displayName) }}
    >
      {children}
    </AppShell>
  );
}
