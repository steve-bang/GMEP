import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { formatDateTime } from '@/platform/format/date';
import {
  listApprovals,
  REAUTH_ON_APPROVE,
  type ApprovalDto,
  type ApprovalTab,
} from '@/modules/sys';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { DataTable } from '@/ui/components/DataTable';
import { ErrorFor, first, type SearchParams } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { StatusBadge, type BadgeTone } from '@/ui/components/StatusBadge';
import { AccPage, approvalLabels, money } from '../acc/accUi';
import { ApprovalActions } from './ApprovalActions';

export const dynamic = 'force-dynamic';

const TABS: ApprovalTab[] = ['toDecide', 'mine', 'done'];
const TONE: Record<string, BadgeTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  withdrawn: 'neutral',
};

function sourceOf(a: ApprovalDto): string {
  if (a.kind === 'payment_reversal') return `/acc/payments/${encodeURIComponent(a.subjectId)}`;
  if (a.kind === 'debt_handover') return `/acc/orders/${encodeURIComponent(a.subjectId)}`;
  if (a.kind === 'cash_variance') return '/acc/cashbook';
  if (a.kind.startsWith('invoice_'))
    return `/ein/invoices/${encodeURIComponent(a.subjectId.split(':')[0] ?? '')}`;
  return '/acc/cashbook';
}

/** G4-APR-01 / FR-SYS-004: the approval queue of the working branch. */
export default async function ApprovalsPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  const sp = await searchParams;
  const { actor } = await requireSession();
  const l = approvalLabels();
  const tab = TABS.find((x) => x === first(sp.tab)) ?? 'toDecide';
  const res = await load(() => listApprovals(getContainer().sys, actor, { tab }));
  const head = { title: l.title!, desc: l.lead! };
  if (res.error)
    return (
      <AccPage {...head}>
        <ErrorFor error={res.error} t={t} />
      </AccPage>
    );
  const { items, counts } = res.data;
  return (
    <AccPage {...head}>
      <div className="rec-chips" role="tablist" aria-label={l.title}>
        {TABS.map((x) => (
          <Link
            key={x}
            role="tab"
            aria-selected={tab === x}
            className={`chip${tab === x ? ' is-selected' : ''}`}
            href={`/approvals?tab=${x}`}
            data-testid={`tab-${x}`}
          >
            {x === 'toDecide'
              ? `${l.tabToDecide} (${counts.toDecide})`
              : x === 'mine'
                ? `${l.tabMine} (${counts.mine})`
                : l.tabDone}
          </Link>
        ))}
      </div>
      {items.length === 0 ? (
        <EmptyState title={l.emptyTitle!} text={l.emptyText} />
      ) : (
        <DataTable
          caption={l.title!}
          rows={items}
          rowKey={(a) => a.id}
          columns={[
            {
              key: 'n',
              header: l.colNumber!,
              render: (a) => <span className="code">{a.number}</span>,
            },
            { key: 'k', header: l.colKind!, render: (a) => l[`kind_${a.kind}`] },
            {
              key: 's',
              header: l.colSubject!,
              render: (a) => (
                <>
                  <Link href={sourceOf(a)}>{a.subjectLabel}</Link>
                  <div className="text-secondary">{a.reason}</div>
                </>
              ),
            },
            { key: 'b', header: l.colBy!, render: (a) => a.requestedByName },
            { key: 'v', header: l.colValue!, numeric: true, render: (a) => money(a.valueVnd) },
            { key: 'l', header: l.colLevel!, render: (a) => (a.level === 1 ? l.level1 : l.level2) },
            {
              key: 'w',
              header: l.colWait!,
              render: (a) => (
                <>
                  {formatDateTime(new Date(a.requestedAt))}
                  {a.overdue ? <span className="tag tag--danger">{l.overdue}</span> : null}
                </>
              ),
            },
            {
              key: 'st',
              header: l.colState!,
              render: (a) => (
                <>
                  <StatusBadge tone={TONE[a.status] ?? 'neutral'}>
                    {l[`status_${a.status}`]}
                  </StatusBadge>
                  {a.status === 'approved' ? (
                    <span className="tag">{a.consumed ? l.used : l.waitUse}</span>
                  ) : null}
                  {a.decisionNote ? <div className="text-secondary">{a.decisionNote}</div> : null}
                </>
              ),
            },
            {
              key: 'x',
              header: l.colActions!,
              render: (a) =>
                a.status === 'pending' ? (
                  <ApprovalActions
                    id={a.id}
                    version={a.version}
                    canDecide={a.actions.decide.allowed}
                    reauth={REAUTH_ON_APPROVE.includes(a.kind)}
                    canWithdraw={a.actions.withdraw.allowed}
                    selfNote={a.actions.decide.reasonCode === 'approval_self_decision'}
                    switchNote={a.actions.decide.reasonCode === 'switch_branch_required'}
                    labels={l}
                  />
                ) : a.status === 'approved' && !a.consumed ? (
                  <Link href={sourceOf(a)}>{l.toSource}</Link>
                ) : null,
            },
          ]}
        />
      )}
    </AccPage>
  );
}
