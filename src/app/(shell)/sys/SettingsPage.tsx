import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { hasPermission } from '@/platform/rbac/rbac';
import { formatDateTime } from '@/platform/format/date';
import { canViewConfig } from '@/modules/sys';
import { getContainer } from '@/composition/container';
import { requireSession } from '@/composition/session';
import { SettingsFrame, SettingsNav, type SettingsNavGroup } from '@/ui/components/SettingsFrame';

/**
 * Shared chrome for every settings screen (G4-SYS-*): breadcrumb, code + description, scope bar with
 * "Cập nhật lúc / Làm mới", and the left menu. The menu lists only screens that exist and that the
 * user may view; screens not built yet are simply absent.
 */
export async function SettingsPage(props: {
  /** key of the current menu entry: users | branches | warehouses | services | priceLists | audit | config:<type> */
  current: string;
  title: string;
  /** breadcrumb between "Cài đặt" and the title when the page is a detail/new screen */
  parent?: { label: string; href: string };
  code?: string;
  desc?: string;
  actions?: ReactNode;
  /** scope text; defaults to "follows the data scope picked in the top bar" */
  scopeText?: string;
  children: ReactNode;
}) {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const can = (p: `${string}:view`) => hasPermission(actor, p);
  const cfg = (type: string): SettingsNavGroup['items'] =>
    canViewConfig(actor, type)
      ? [
          {
            key: `config:${type}`,
            href: `/sys/config/${type}`,
            label: t(`config.types.${type}.title`),
          },
        ]
      : [];
  const groups: SettingsNavGroup[] = [
    {
      label: t('settings.groups.people'),
      items: can('user:view')
        ? [{ key: 'users', href: '/sys/users', label: t('shell.nav.users') }]
        : [],
    },
    {
      label: t('settings.groups.org'),
      items: [
        ...(can('org:view')
          ? [{ key: 'branches', href: '/sys/branches', label: t('shell.nav.branches') }]
          : []),
        ...(can('warehouse:view')
          ? [{ key: 'warehouses', href: '/sys/warehouses', label: t('shell.nav.warehouses') }]
          : []),
      ],
    },
    {
      label: t('settings.groups.catalog'),
      items: [
        ...(can('service-catalog:view')
          ? [{ key: 'services', href: '/sys/services', label: t('shell.nav.services') }]
          : []),
        ...(can('price-list:view')
          ? [{ key: 'priceLists', href: '/sys/price-lists', label: t('shell.nav.priceLists') }]
          : []),
        ...['tax-rate', 'labor-rate', 'standard-hours', 'discount-limit', 'price-item'].flatMap(
          cfg,
        ),
      ],
    },
    {
      label: t('settings.groups.docs'),
      items: ['doc-template', 'numbering-series'].flatMap(cfg),
    },
    {
      label: t('settings.groups.data'),
      items: can('audit-log:view')
        ? [{ key: 'audit', href: '/sys/audit', label: t('shell.nav.audit') }]
        : [],
    },
  ].filter((g) => g.items.length > 0);
  const firstHref = groups[0]?.items[0]?.href ?? '/';
  const asOf = formatDateTime(getContainer().sys.clock.now());
  return (
    <SettingsFrame
      crumbs={[
        { label: t('app.name'), href: '/' },
        { label: t('settings.crumb'), href: firstHref },
        ...(props.parent ? [props.parent] : []),
        { label: props.title },
      ]}
      {...(props.code ? { code: props.code } : {})}
      title={props.title}
      {...(props.desc ? { desc: props.desc } : {})}
      {...(props.actions ? { actions: props.actions } : {})}
      scope={{
        caption: t('settings.scopeCaption'),
        text: props.scopeText ?? t('settings.scopeFollowsPicker'),
        asOf: t('settings.asOf', { time: asOf }),
        refresh: t('settings.refresh'),
      }}
      labels={{ breadcrumb: t('settings.breadcrumb') }}
      nav={
        <SettingsNav
          groups={groups}
          current={props.current}
          labels={{ aria: t('settings.navLabel'), pick: t('settings.pick') }}
        />
      }
    >
      {props.children}
    </SettingsFrame>
  );
}
