import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { formatDateTime, isoToVi } from '@/platform/format/date';
import { hasPermission } from '@/platform/rbac/rbac';
import { getPayment } from '@/modules/acc';
import { findActiveApprovalFor } from '@/modules/sys';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ErrorFor } from '@/ui/components/PageParts';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { AccPage, accLabels, KIND_TONE, money, Note } from '../../accUi';
import { ReversalPanel } from './ReversalPanel';

export const dynamic = 'force-dynamic';

/** G4-ACC-03: one payment, its lines and the reversal path (RULE-010). */
export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations();
  const { id } = await params;
  const { actor } = await requireSession();
  const l = accLabels('payment');
  const c = accLabels('common');
  const crumbs = [{ label: t('shell.nav.payments'), href: '/acc/payments' }];
  const res = await load(async () => {
    const p = await getPayment(getContainer().acc, actor, id);
    const approval = hasPermission(actor, 'approval:view')
      ? await findActiveApprovalFor(getContainer().sys, actor, {
          kind: 'payment_reversal',
          subjectId: id,
          branchId: actor.workingBranchId ?? '',
        }).catch(() => null)
      : null;
    return { p, approval };
  });
  if (res.error)
    return (
      <AccPage title={l.title!} crumbs={crumbs}>
        <ErrorFor error={res.error} t={t} />
      </AccPage>
    );
  const { p, approval } = res.data;
  const canReverse =
    p.kind !== 'reversal' && !p.reversedBy && hasPermission(actor, 'payment:archive');
  return (
    <AccPage title={`${l.title} · ${p.number}`} crumbs={crumbs}>
      {p.reversedBy ? (
        <Note tone="warning" testId="reversed-note">
          {l.reversedBy}{' '}
          <Link href={`/acc/payments/${encodeURIComponent(p.reversedBy)}`}>{l.seeReversal}</Link>
        </Note>
      ) : null}
      <section className="card">
        <dl className="detail-list">
          <div>
            <dt>{l.number}</dt>
            <dd>
              <span className="code">{p.number}</span>{' '}
              <StatusBadge tone={KIND_TONE[p.kind] ?? 'neutral'}>{c[`kind_${p.kind}`]}</StatusBadge>
            </dd>
          </div>
          <div>
            <dt>{l.at}</dt>
            <dd>{formatDateTime(new Date(p.createdAt))}</dd>
          </div>
          <div>
            <dt>{l.by}</dt>
            <dd>{p.createdByName}</dd>
          </div>
          {p.orderId ? (
            <div>
              <dt>{l.order}</dt>
              <dd>
                <Link href={`/acc/orders/${encodeURIComponent(p.orderId)}`}>{p.orderNumber}</Link>
              </dd>
            </div>
          ) : null}
          {p.customerName ? (
            <div>
              <dt>{l.customer}</dt>
              <dd>{p.customerName}</dd>
            </div>
          ) : null}
          <div>
            <dt>{l.total}</dt>
            <dd className="num">{money(p.totalVnd)}</dd>
          </div>
          {p.applicationVnd > 0 ? (
            <div>
              <dt>{l.applied}</dt>
              <dd className="num">{money(p.applicationVnd)}</dd>
            </div>
          ) : null}
          {p.depositHeldVnd !== null ? (
            <div>
              <dt>{l.heldDeposit}</dt>
              <dd className="num">{money(p.depositHeldVnd)}</dd>
            </div>
          ) : null}
          {p.categoryCode ? (
            <div>
              <dt>{l.category}</dt>
              <dd>{p.categoryCode}</dd>
            </div>
          ) : null}
          {p.payee ? (
            <div>
              <dt>{l.payee}</dt>
              <dd>{p.payee}</dd>
            </div>
          ) : null}
          {p.description ? (
            <div>
              <dt>{l.description}</dt>
              <dd>{p.description}</dd>
            </div>
          ) : null}
          {p.kind === 'expense' ? (
            <div>
              <dt>{l.source}</dt>
              <dd>{p.sourceRef ?? <span className="tag tag--warning">{l.sourceMissing}</span>}</dd>
            </div>
          ) : null}
          {p.reason ? (
            <div>
              <dt>{l.reason}</dt>
              <dd>{p.reason}</dd>
            </div>
          ) : null}
          {p.reversesNumber ? (
            <div>
              <dt>{l.reverses}</dt>
              <dd className="code">{p.reversesNumber}</dd>
            </div>
          ) : null}
          <div>
            <dt>{l.date}</dt>
            <dd>{isoToVi(p.businessDate)}</dd>
          </div>
        </dl>
      </section>
      <section className="card">
        <div className="card__header">
          <h2 className="card__title">{l.lines}</h2>
        </div>
        <ul className="stack-2" data-testid="pay-lines">
          {p.lines.map((x, i) => (
            <li key={i} className="num">
              {c[`method_${x.method}`]}: {money(x.amountVnd)}
              {x.reference ? ` · ${x.reference}` : ''}
            </li>
          ))}
        </ul>
      </section>
      {canReverse ? (
        <ReversalPanel
          paymentId={p.id}
          number={p.number}
          approval={
            approval
              ? {
                  id: approval.id,
                  number: approval.number,
                  status: approval.status,
                  consumed: approval.consumed,
                  decisionNote: approval.decisionNote,
                }
              : null
          }
          canRequest
          labels={l}
          common={c}
        />
      ) : null}
    </AccPage>
  );
}
