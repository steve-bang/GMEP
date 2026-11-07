import { decodeCursor } from '@/platform/pagination/pagination';
import { pickEffective } from '@/platform/effective/effective';
import { resolveScope, type Actor } from '@/platform/rbac/rbac';
import type { ConfigVersion } from '@/modules/sys';
import type { InvDeps } from '../ports/deps';
import { today } from './config';

export type CatalogKind = 'group' | 'unit';
export const CATALOG_TYPE: Record<CatalogKind, 'part-group' | 'part-unit'> = {
  group: 'part-group',
  unit: 'part-unit',
};

export interface CatalogEntry {
  code: string;
  name: string;
  active: boolean;
}

const PAGE = 100;
const MAX_PAGES = 5;

/**
 * I14: company-level catalogue of part groups / units, read from the approved, effective-dated
 * `part-group` / `part-unit` configuration (one scope key per entry). Entries are deactivated, never
 * deleted; a part keeps pointing at an inactive entry.
 */
export async function resolveCatalog(
  deps: InvDeps,
  tenantId: string,
  kind: CatalogKind,
  date: string,
): Promise<CatalogEntry[]> {
  const type = CATALOG_TYPE[kind];
  const byKey = new Map<string, ConfigVersion[]>();
  let cursor: { v: string; id: string } | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await deps.sys.configs.listByType(tenantId, type, 'approved', PAGE, cursor);
    for (const v of page.items) byKey.set(v.scopeKey, [...(byKey.get(v.scopeKey) ?? []), v]);
    if (!page.nextCursor) break;
    cursor = decodeCursor(page.nextCursor) ?? undefined;
  }
  const out: CatalogEntry[] = [];
  for (const [code, versions] of byKey) {
    const v = pickEffective(versions, date);
    if (!v) continue;
    const p = v.payload as { name?: string; status?: string };
    out.push({ code, name: p.name ?? code, active: p.status !== 'inactive' });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

/** The two catalogues for forms and filters (part:view). */
export async function getPartCatalogs(
  deps: InvDeps,
  actor: Actor,
): Promise<{ groups: CatalogEntry[]; units: CatalogEntry[] }> {
  resolveScope(actor, 'part:view');
  const date = today(deps);
  const [groups, units] = await Promise.all([
    resolveCatalog(deps, actor.tenantId, 'group', date),
    resolveCatalog(deps, actor.tenantId, 'unit', date),
  ]);
  return { groups, units };
}
