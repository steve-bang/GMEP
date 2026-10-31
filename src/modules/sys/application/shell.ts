import { describeScope } from '@/platform/scope/scope';
import { assignedScope, hasPermission, type Actor } from '@/platform/rbac/rbac';
import type { SysDeps } from '../ports/deps';

export interface ShellInfo {
  displayName: string;
  /** Visible branch scope for the top bar (design: "Phạm vi dữ liệu"). */
  scope: { kind: 'all' | 'single' | 'many' | 'none'; count: number; names: string[] };
  /** branches visible to the user (id + name), for labels in lists */
  branches: { id: string; name: string }[];
  canViewWarehouses: boolean;
}

/** Data for the application shell: what the user may see and which branches that covers. */
export async function getShellInfo(deps: SysDeps, actor: Actor): Promise<ShellInfo> {
  const canViewWarehouses = hasPermission(actor, 'warehouse:view');
  const scope = assignedScope(actor);
  if (!scope) {
    return {
      displayName: actor.displayName,
      scope: { kind: 'none', count: 0, names: [] },
      branches: [],
      canViewWarehouses,
    };
  }
  const branches = await deps.branches.list(scope);
  const d = describeScope(scope);
  return {
    displayName: actor.displayName,
    scope: {
      kind: d.kind,
      count: scope.kind === 'all' ? branches.length : d.count,
      names: branches.map((b) => b.name),
    },
    branches: branches.map((b) => ({ id: b.id, name: b.name })),
    canViewWarehouses,
  };
}
