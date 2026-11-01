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
  unreadNotifications: number;
}

/** Data for the application shell: what the user may see and which branches that covers. */
export async function getShellInfo(deps: SysDeps, actor: Actor): Promise<ShellInfo> {
  const can = (p: `${string}:view`) => hasPermission(actor, p);
  const [scope, unread] = await Promise.all([
    getScopeInfo(deps, actor),
    deps.notifications.unreadCount(actor.userId, 100),
  ]);
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
    unreadNotifications: unread,
  };
}
