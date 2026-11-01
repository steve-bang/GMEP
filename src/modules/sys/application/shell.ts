import { hasPermission, type Actor } from '@/platform/rbac/rbac';
import type { SysDeps } from '../ports/deps';
import { getScopeInfo, type ScopeInfo } from './scope';

export interface ShellInfo {
  displayName: string;
  scope: ScopeInfo;
  /** nav visibility, derived from the permission set (the server still checks every action) */
  can: {
    warehouses: boolean;
    branches: boolean;
    users: boolean;
    audit: boolean;
    services: boolean;
    priceLists: boolean;
    config: boolean;
    templates: boolean;
  };
  /** nav entries the user can open but not change (shown with a "Chỉ xem" lock) */
  readOnly: Record<
    'warehouses' | 'branches' | 'users' | 'services' | 'priceLists' | 'config',
    boolean
  >;
  unreadNotifications: number;
}

/** Data for the application shell: what the user may see and which branches that covers. */
export async function getShellInfo(deps: SysDeps, actor: Actor): Promise<ShellInfo> {
  const can = (p: `${string}:view`) => hasPermission(actor, p);
  const [scope, unread] = await Promise.all([
    getScopeInfo(deps, actor),
    deps.notifications.unreadCount(actor.userId, 100),
  ]);
  const mayChange = (r: string) =>
    hasPermission(actor, `${r}:create` as 'x:create') ||
    hasPermission(actor, `${r}:update` as 'x:update') ||
    hasPermission(actor, `${r}:approve` as 'x:approve');
  return {
    displayName: actor.displayName,
    scope,
    can: {
      warehouses: can('warehouse:view'),
      branches: can('org:view'),
      users: can('user:view'),
      audit: can('audit-log:view'),
      services: can('service-catalog:view'),
      priceLists: can('price-list:view'),
      config: can('tax-rate:view') || can('discount-limit:view'),
      templates: can('doc-template:view'),
    },
    readOnly: {
      warehouses: !mayChange('warehouse'),
      branches: !mayChange('org'),
      users: !mayChange('user'),
      services: !mayChange('service-catalog'),
      priceLists: !mayChange('price-list'),
      config: ![
        'tax-rate',
        'discount-limit',
        'service-catalog',
        'doc-template',
        'numbering-series',
      ].some(mayChange),
    },
    unreadNotifications: unread,
  };
}
