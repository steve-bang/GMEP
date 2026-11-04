import { getTranslations } from 'next-intl/server';
import { hasPermission } from '@/platform/rbac/rbac';
import { getCashbook, getDayStatus } from '@/modules/acc';
import { load } from '@/composition/pageData';
import { requireSession } from '@/composition/session';
import { getContainer } from '@/composition/container';
import { ErrorFor } from '@/ui/components/PageParts';
import { EmptyState } from '@/ui/components/States';
import { AccPage, accLabels } from '../../accUi';
import { CloseShiftForm, ExplainAgainForm } from './CloseShiftForm';

export const dynamic = 'force-dynamic';

/** G4-ACC-08 / FR-ACC-004: close the shift: open orders, count, explanation of a difference, confirmation. */
export default async function CloseShiftPage() {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const l = accLabels('shiftClose');
  const c = accLabels('common');
  const crumbs = [{ label: t('shell.nav.cashbook'), href: '/acc/cashbook' }];
  const res = await load(async () => {
    const acc = getContainer().acc;
    const cb = await getCashbook(acc, actor);
    const day = hasPermission(actor, 'cash-day:view')
      ? await getDayStatus(acc, actor).catch(() => null)
      : null;
    return { cb, day };
  });
  if (res.error)
    return (
      <AccPage title={l.title!} crumbs={crumbs}>
        <ErrorFor error={res.error} t={t} />
      </AccPage>
    );
  const { cb, day } = res.data;
  const open = cb.shifts.find((s) => s.status === 'open');
  const rejected = cb.shifts.find((s) => s.varianceStatus === 'rejected');
  return (
    <AccPage title={l.title!} desc={l.lead} crumbs={crumbs}>
      {rejected ? <ExplainAgainForm shiftId={rejected.id} labels={l} common={c} /> : null}
      {open ? (
        <CloseShiftForm
          shiftId={open.id}
          version={open.version}
          bookVnd={cb.drawer.balanceVnd}
          openOrders={(day?.warnings.openOrders ?? []).map((o) => ({
            id: o.id,
            number: o.number,
            plate: o.plate,
            outstandingVnd: o.outstandingVnd,
          }))}
          labels={l}
          common={c}
        />
      ) : rejected ? null : (
        <EmptyState title={l.noShift!} />
      )}
    </AccPage>
  );
}
