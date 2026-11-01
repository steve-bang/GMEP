import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { hasPermission, resolveScope } from '@/platform/rbac/rbac';
import { formatDateTime, isoToVi, viToIso } from '@/platform/format/date';
import {
  AUDIT_PAGE_SIZES,
  AUDIT_RESTRICTED_TYPES,
  CONFIG_TYPES,
  ROLE_NAMES,
  isFullAuditViewer,
  listAudit,
  searchUsers,
  type UserDto,
} from '@/modules/sys';
import { auditActionLabel, auditEntityLabel } from '@/composition/labels';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { DateInput } from '@/ui/components/DateInput';
import { FilterBar, SearchField } from '@/ui/components/FilterBar';
import { Button } from '@/ui/components/Button';
import { Icon } from '@/ui/components/Icon';
import { EmptyState } from '@/ui/components/States';
import { ErrorFor, first, Pager, type SearchParams } from '@/ui/components/PageParts';
import { SettingsPage } from '../SettingsPage';
import { AuditExport } from './AuditExport';

export const dynamic = 'force-dynamic';

/** Entity types offered in the filter: every type the module writes (restricted viewers only see their own subset). */
const ENTITY_TYPES = [
  'user',
  'roleAssignment',
  'role',
  'session',
  'branch',
  'warehouse',
  'service',
  'priceList',
  ...Object.keys(CONFIG_TYPES).map((c) => `config.${c}`),
  'audit',
];
const ACTIONS = [
  'auth.login',
  'auth.logout',
  'auth.password_reset_requested',
  'auth.password_reset',
  'user.invite',
  'user.invite_resend',
  'user.activate',
  'user.update',
  'user.disable',
  'user.enable',
  'user.unlock',
  'user.sessions_revoked',
  'assignment.add',
  'assignment.remove',
  'role.update',
  'branch.create',
  'branch.update',
  'branch.status',
  'warehouse.create',
  'warehouse.update',
  'warehouse.deactivate',
  'warehouse.reactivate',
  'warehouse.export',
  'service.create',
  'service.update',
  'priceList.create',
  'priceList.update',
  'config.propose',
  'config.approve',
  'config.reject',
  'audit.export',
];

/** one level of nesting flattened to "path -> text" so the detail never shows raw JSON */
function flatten(v: unknown, prefix = ''): [string, string][] {
  if (v === null || v === undefined) return [];
  if (typeof v !== 'object') return [[prefix, String(v)]];
  if (Array.isArray(v))
    return [[prefix, v.map((x) => (typeof x === 'object' ? '…' : String(x))).join(', ')]];
  return Object.entries(v as Record<string, unknown>).flatMap(([k, x]) =>
    flatten(x, prefix ? `${prefix}.${k}` : k),
  );
}

/** FR-SYS-003 / G4-SYS-19: read-only audit viewer. Page size 25 or 100; scope enforced in the query. */
export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const sp = await searchParams;
  const q: Record<string, string> = Object.fromEntries(
    (['entityType', 'entityId', 'actorId', 'action', 'limit'] as const).flatMap((k) =>
      first(sp[k]) ? [[k, first(sp[k])!]] : [],
    ),
  );
  // dates are typed as dd/MM/yyyy; the application layer takes yyyy-MM-dd; an invalid one is ignored
  for (const k of ['from', 'to'] as const) {
    const iso = viToIso(first(sp[k]));
    if (iso) q[k] = iso;
  }
  const cursor = first(sp.cursor);
  const { actor } = await requireSession();
  const deps = getContainer().sys;
  const full = isFullAuditViewer(actor);
  // restricted viewers (KT) always filter by one of their entity types (FR-SYS-003 / BA)
  if (!full && !q.entityType) q.entityType = AUDIT_RESTRICTED_TYPES[0]!;
  const res = await load(async () => {
    const page = await listAudit(deps, actor, { ...q, ...(cursor ? { cursor } : {}) });
    // helpers for the filter and the branch column; a viewer without these permissions just gets fewer options
    const branches = await load(() => deps.branches.list(resolveScope(actor, 'audit-log:view')));
    const people: UserDto[] = [];
    if (hasPermission(actor, 'user:view')) {
      const first = await load(() => searchUsers(deps, actor, { sort: 'name', dir: 'asc' }));
      if (first.data) {
        people.push(...first.data.items);
        for (let p = 2; p <= first.data.pageCount; p++)
          people.push(
            ...(await searchUsers(deps, actor, { sort: 'name', dir: 'asc', page: p })).items,
          );
      }
    }
    return { page, branches: branches.data ?? [], people };
  });
  const head = {
    current: 'audit',
    code: 'G4-SYS-19',
    title: t('audit.title'),
    desc: t('audit.lead'),
    scopeText: full ? t('audit.scopeFull') : t('audit.scopeRestricted'),
  };
  if (res.error)
    return (
      <SettingsPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </SettingsPage>
    );
  const { page, branches, people } = res.data;
  const canExport = hasPermission(actor, 'audit-log:export');
  const filtered = ['entityType', 'entityId', 'actorId', 'action', 'from', 'to'].some(
    (k) => k in q && !(k === 'entityType' && !full),
  );
  const branchName = (id: string | null) =>
    id ? (branches.find((b) => b.id === id)?.name ?? id) : t('audit.allSystem');
  const fieldLabel = (f: string) => {
    const leaf = f.split('.').at(-1)!;
    return t.has(`audit.fields.${leaf}`) ? t(`audit.fields.${leaf}`) : f;
  };
  const rolesOf = (codes: string[]) =>
    codes.map((c) => ROLE_NAMES[c as keyof typeof ROLE_NAMES] ?? c).join(', ');
  return (
    <SettingsPage {...head}>
      <div className="alert alert--neutral" role="note">
        <Icon name="lock" />
        <div className="alert__body">{t('audit.readOnlyNote')}</div>
      </div>
      <FilterBar
        action="/sys/audit"
        actions={
          <>
            <Link className="btn btn--ghost" href="/sys/audit">
              {t('warehouses.reset')}
            </Link>
            <Button type="submit" variant="primary">
              {t('warehouses.apply')}
            </Button>
          </>
        }
      >
        <div className="field">
          <label className="field__label" htmlFor="from">
            {t('audit.from')}
          </label>
          <DateInput id="from" name="from" defaultValue={isoToVi(q.from)} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="to">
            {t('audit.to')}
          </label>
          <DateInput id="to" name="to" defaultValue={isoToVi(q.to)} />
        </div>
        {people.length > 0 ? (
          <div className="field">
            <label className="field__label" htmlFor="actorId">
              {t('audit.actor')}
            </label>
            <select className="select" id="actorId" name="actorId" defaultValue={q.actorId ?? ''}>
              <option value="">{t('common.all')}</option>
              {people.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="field">
          <label className="field__label" htmlFor="entityType">
            {t('audit.entityType')}
          </label>
          <select className="select" id="entityType" name="entityType" defaultValue={q.entityType}>
            {full ? <option value="">{t('common.all')}</option> : null}
            {(full ? ENTITY_TYPES : AUDIT_RESTRICTED_TYPES).map((e) => (
              <option key={e} value={e}>
                {auditEntityLabel(t, e)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="action">
            {t('audit.action')}
          </label>
          <select className="select" id="action" name="action" defaultValue={q.action ?? ''}>
            <option value="">{t('common.all')}</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {auditActionLabel(t, a)}
              </option>
            ))}
          </select>
        </div>
        <SearchField
          id="entityId"
          label={t('audit.searchId')}
          name="entityId"
          placeholder={t('audit.searchIdPlaceholder')}
          {...(q.entityId ? { defaultValue: q.entityId } : {})}
        />
        <div className="field">
          <label className="field__label" htmlFor="limit">
            {t('audit.pageSize')}
          </label>
          <select className="select" id="limit" name="limit" defaultValue={q.limit ?? '25'}>
            {AUDIT_PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </FilterBar>
      {page.items.length === 0 ? (
        filtered ? (
          <EmptyState
            title={t('audit.emptyFilteredTitle')}
            text={t('audit.emptyFilteredText')}
            actions={
              <Link className="btn btn--secondary" href="/sys/audit">
                {t('warehouses.reset')}
              </Link>
            }
          />
        ) : (
          <EmptyState title={t('audit.emptyTitle')} text={t('audit.emptyText')} />
        )
      ) : (
        <DataTable
          caption={t('audit.title')}
          rows={page.items}
          rowKey={(e) => e.id}
          toolbar={
            <>
              <span className="table-meta">{t('audit.summary', { count: page.items.length })}</span>
              <span className="table-meta" style={{ marginLeft: 'auto' }}>
                {t('audit.detailsHint')}
              </span>
            </>
          }
          detail={(e) => {
            const before = flatten(e.before);
            const after = flatten(e.after);
            const keys = [...new Set([...before.map(([k]) => k), ...after.map(([k]) => k)])];
            return (
              <details>
                <summary className="btn btn--secondary btn--sm">{t('audit.details')}</summary>
                <div className="stack-2" style={{ marginTop: 'var(--space-2)' }}>
                  {e.reason ? (
                    <p>
                      <strong>{t('audit.colReason')}:</strong> {e.reason}
                    </p>
                  ) : null}
                  {keys.length ? (
                    <table className="table table--compact">
                      <caption className="sr-only">{t('audit.details')}</caption>
                      <thead>
                        <tr>
                          <th scope="col">{t('audit.field')}</th>
                          <th scope="col">{t('audit.before')}</th>
                          <th scope="col">{t('audit.after')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {keys.map((k) => (
                          <tr key={k}>
                            <th scope="row" title={k}>
                              {fieldLabel(k)}
                            </th>
                            <td>{before.find(([x]) => x === k)?.[1] ?? '—'}</td>
                            <td>{after.find(([x]) => x === k)?.[1] ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-secondary">{t('audit.noValues')}</p>
                  )}
                  <p className="t-caption text-secondary">
                    {t('audit.requestId')}: {e.requestId}
                  </p>
                </div>
              </details>
            );
          }}
          columns={[
            {
              key: 'at',
              header: t('audit.colAt'),
              render: (e) => (
                <span className="num" style={{ whiteSpace: 'nowrap' }}>
                  {formatDateTime(new Date(e.at))}
                </span>
              ),
            },
            {
              key: 'actor',
              header: t('audit.colActor'),
              render: (e) => (
                <>
                  {e.actorName ?? e.actorId}
                  {e.actorRoles.length ? (
                    <span className="t-caption text-secondary" style={{ display: 'block' }}>
                      {rolesOf(e.actorRoles)}
                    </span>
                  ) : null}
                </>
              ),
            },
            {
              key: 'action',
              header: t('audit.colAction'),
              render: (e) => (
                <span data-testid="audit-action" title={e.action}>
                  {auditActionLabel(t, e.action)}
                </span>
              ),
            },
            {
              key: 'entity',
              header: t('audit.colEntity'),
              render: (e) => (
                <span title={`${e.entityType} · ${e.entityId}`}>
                  {auditEntityLabel(t, e.entityType)}
                  <span className="t-caption text-secondary" style={{ display: 'block' }}>
                    {e.entityId}
                  </span>
                </span>
              ),
            },
            {
              key: 'branch',
              header: t('audit.colBranch'),
              render: (e) => branchName(e.branchId),
            },
          ]}
        />
      )}
      <Pager
        base="/sys/audit"
        query={q}
        {...(cursor ? { cursor } : {})}
        next={page.nextCursor}
        labels={{
          prev: t('warehouses.prev'),
          next: t('warehouses.next'),
          aria: t('common.pagination'),
        }}
      />
      {canExport ? (
        <AuditExport
          filter={q}
          labels={{
            title: t('audit.exportTitle'),
            reason: t('audit.exportReason'),
            submit: t('audit.exportSubmit'),
            failed: t('common.unexpected'),
            hint: t('audit.exportHint'),
          }}
        />
      ) : null}
    </SettingsPage>
  );
}
