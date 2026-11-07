import { businessDate } from '@/platform/format/date';
import { json } from '@/platform/http/route';
import { authed } from '@/composition/api';
import { resolveScope } from '@/platform/rbac/rbac';
import { expenseCategories } from '@/modules/acc';

export const runtime = 'nodejs';

/** Active expense categories (effective-dated catalogue) for the voucher form. */
export const GET = authed(async ({ acc, session }) => {
  resolveScope(session.actor, 'cash-expense:view');
  return json({
    items: await expenseCategories(acc, session.actor.tenantId, businessDate(acc.sys.clock.now())),
  });
});
