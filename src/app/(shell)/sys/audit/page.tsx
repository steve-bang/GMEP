import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { hasPermission } from '@/platform/rbac/rbac';
import {
  AUDIT_PAGE_SIZES,
  AUDIT_RESTRICTED_TYPES,
  CONFIG_TYPES,
  isFullAuditViewer,
  listAudit,
} from '@/modules/sys';
import { auditActionLabel, auditEntityLabel } from '@/composition/labels';
import { isoToVi, viToIso } from '@/platform/format/date';
import { DateInput } from '@/ui/components/DateInput';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { FilterBar } from '@/ui/components/FilterBar';
import { Button } from '@/ui/components/Button';
import { EmptyState } from '@/ui/components/States';
import { SettingsPage } from '../SettingsPage';
import { ErrorFor, first, Pager, type SearchParams } from '@/ui/components/PageParts';
import { AuditExport } from './AuditExport';

export const dynamic = 'force-dynamic';

/** Entity types offered in the filter: every type the module writes (restricted viewers only see their own subset). */
const entityTypes = [
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

const fmt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  dateStyle: 'short',
  timeStyle: 'medium',
});

/** FR-SYS-003 / G4-SYS-19: read-only audit viewer. Page size 25 or 100; scope enforced in the query. */
export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const sp = await searchParams;
  const q: Record<string, string> = Object.fromEntries(
    (['entityType', 'entityId', 'limit'] as const).flatMap((k) =>
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
  const full = isFullAuditViewer(actor);
  // restricted viewers (KT) always filter by one of their entity types (FR-SYS-003 / BA)
  if (!full && !q.entityType) q.entityType = AUDIT_RESTRICTED_TYPES[0]!;
  const res = await load(() =>
    listAudit(getContainer().sys, actor, { ...q, ...(cursor ? { cursor } : {}) }),
  );
  const head = {
    current: 'audit',
    code: 'G4-SYS-19',
    title: t('audit.title'),
    desc: t('audit.lead'),
  };
  if (res.error)
    return (
      <SettingsPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </SettingsPage>
    );
  const page = res.data;
  const canExport = hasPermission(actor, 'audit-log:export');
  return (
    <SettingsPage {...head}>
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
          <label className="field__label" htmlFor="entityType">
            {t('audit.entityType')}
          </label>
          <select className="select" id="entityType" name="entityType" defaultValue={q.entityType}>
            {full ? <option value="">{t('common.all')}</option> : null}
            {(full ? entityTypes : AUDIT_RESTRICTED_TYPES).map((e) => (
              <option key={e} value={e}>
                {auditEntityLabel(t, e)}
              </option>
            ))}
          </select>
        </div>
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
        <EmptyState title={t('audit.emptyTitle')} text={t('audit.emptyText')} />
      ) : (
        <DataTable
          caption={t('audit.title')}
          rows={page.items}
          rowKey={(e) => e.id}
          columns={[
            { key: 'at', header: t('audit.colAt'), render: (e) => fmt.format(new Date(e.at)) },
            { key: 'actor', header: t('audit.colActor'), render: (e) => e.actorName ?? e.actorId },
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
                  {auditEntityLabel(t, e.entityType)} · {e.entityId}
                </span>
              ),
            },
            { key: 'reason', header: t('audit.colReason'), render: (e) => e.reason ?? '' },
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
