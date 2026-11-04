import type { Actor } from '@/platform/rbac/rbac';
import { allBranchesScope } from '@/platform/scope/scope';
import { runDueRollups } from '@/modules/rpt';
import { runDueRequests } from '@/modules/ein';
import { discardAbandonedImports } from '@/modules/sys';
import type { ApiCtx } from './api';
import { getContainer } from './container';

/** Service actor of one branch: only the two job permissions, no user behind it (audit shows actor `system:cron`). */
function cronActor(companyId: string, branchId: string): Actor {
  return {
    userId: 'system:cron',
    companyId,
    displayName: 'Hệ thống (cron)',
    assignments: [{ roleCode: 'SYSTEM_CRON', branchId }],
    rolePermissions: {
      SYSTEM_CRON: ['report-job:manage', 'invoice-queue:update', 'data-import:create'],
    },
    canConsolidate: false,
    workingBranchId: branchId,
  };
}

/**
 * Scheduler-ready entry (FR-RPT-003, FR-EIN-010): per branch of the configured company, refresh the due report days and
 * retry the due e-invoice requests. Both jobs are idempotent, so a repeat or an overlapping run is safe. One branch failing
 * never stops the others.
 */
export async function runScheduledJobs(c: ApiCtx) {
  const companyId = getContainer().env.CRON_COMPANY_ID;
  if (!companyId) return { configured: false, branches: [] as unknown[] };
  const branches = await c.sys.branches.list(allBranchesScope(companyId));
  const out: {
    branchId: string;
    rpt: 'ok' | 'failed';
    ein: { due: number; handled: number } | 'failed';
  }[] = [];
  for (const b of branches) {
    const actor = cronActor(companyId, b.id);
    const ctx = { requestId: c.requestId };
    const row: (typeof out)[number] = { branchId: b.id, rpt: 'ok', ein: 'failed' };
    try {
      await runDueRollups(c.rpt, actor, { branchId: b.id }, ctx);
    } catch (err) {
      row.rpt = 'failed';
      c.log.error({ err, branchId: b.id }, 'cron rpt failed');
    }
    try {
      row.ein = await runDueRequests(c.ein, actor, ctx);
    } catch (err) {
      c.log.error({ err, branchId: b.id }, 'cron ein failed');
    }
    try {
      // R99: staged import rows hold personal data; abandoned dry runs are purged even when nobody uploads again
      await discardAbandonedImports(c.sys, actor, b.id, ctx);
    } catch (err) {
      c.log.error({ err, branchId: b.id }, 'cron import purge failed');
    }
    out.push(row);
  }
  return { configured: true, branches: out };
}
