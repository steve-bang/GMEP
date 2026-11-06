import type { Actor } from '@/platform/rbac/rbac';
import { allBranchesScope } from '@/platform/scope/scope';
import { runDueRollups } from '@/modules/rpt';
import { runDueRequests } from '@/modules/ein';
import { runMessageRetry, runQuoteExpiry } from '@/modules/rec';
import { discardAbandonedImports } from '@/modules/sys';
import type { ApiCtx } from './api';
import { getContainer } from './container';

/** Service actor of one branch: only the job permissions, no user behind it (audit shows actor `system:cron`). */
function cronActor(tenantId: string, branchId: string): Actor {
  return {
    userId: 'system:cron',
    tenantId,
    displayName: 'Hệ thống (cron)',
    assignments: [{ roleCode: 'SYSTEM_CRON', branchId }],
    rolePermissions: {
      SYSTEM_CRON: [
        'report-job:manage',
        'invoice-queue:update',
        'data-import:create',
        // R10/R17: expire quotes past their validity and remind the advisor (no real role holds this)
        'quote:manage',
      ],
    },
    canConsolidate: false,
    workingBranchId: branchId,
  };
}

interface CronJobInput {
  c: ApiCtx;
  actor: Actor;
  branchId: string;
  ctx: { requestId: string };
}

/**
 * One scheduled job: `run` is for ONE branch, must be idempotent (a repeat or an overlapping run is safe) and returns the
 * value reported under `name` in the response. A throw is caught per branch and per job and reported as 'failed'.
 */
export interface CronJob {
  name: string;
  run(i: CronJobInput): Promise<unknown>;
}

export const CRON_JOBS: readonly CronJob[] = [
  {
    // FR-RPT-003: refresh the due report days
    name: 'rpt',
    run: async ({ c, actor, branchId, ctx }) => {
      await runDueRollups(c.rpt, actor, { branchId }, ctx);
      return 'ok';
    },
  },
  // FR-EIN-010: retry the due e-invoice requests
  { name: 'ein', run: ({ c, actor, ctx }) => runDueRequests(c.ein, actor, ctx) },
  {
    // R99: staged import rows hold personal data; abandoned dry runs are purged even when nobody uploads again
    name: 'importPurge',
    run: ({ c, actor, branchId, ctx }) => discardAbandonedImports(c.sys, actor, branchId, ctx),
  },
  // R10/R17 (FR-REC-011): persist "Hết hạn" on quotes past validity and remind the advisor before expiry
  { name: 'quoteExpiry', run: ({ c, actor, ctx }) => runQuoteExpiry(c.rec, actor, ctx) },
  // A4: send again the quote links the message gateway refused (bounded attempts, backoff, per branch)
  { name: 'messageRetry', run: ({ c, actor, ctx }) => runMessageRetry(c.rec, actor, ctx) },
];

/**
 * Scheduler-ready entry: per branch of the configured company, run every registered job. Jobs are idempotent, so a repeat or
 * an overlapping run is safe. One job failing never stops the other jobs, and one branch failing never stops the others.
 * Response: `{ configured, branches: [{ branchId, <job name>: result | 'failed' }] }`.
 */
export async function runScheduledJobs(c: ApiCtx, jobs: readonly CronJob[] = CRON_JOBS) {
  const tenantId = getContainer().env.CRON_TENANT_ID;
  if (!tenantId) return { configured: false, branches: [] as unknown[] };
  const branches = await c.sys.branches.list(allBranchesScope(tenantId));
  const out: ({ branchId: string } & Record<string, unknown>)[] = [];
  for (const b of branches) {
    const input: CronJobInput = {
      c,
      actor: cronActor(tenantId, b.id),
      branchId: b.id,
      ctx: { requestId: c.requestId },
    };
    const row: { branchId: string } & Record<string, unknown> = { branchId: b.id };
    for (const job of jobs) {
      try {
        row[job.name] = await job.run(input);
      } catch (err) {
        row[job.name] = 'failed';
        c.log.error({ err, branchId: b.id, job: job.name }, 'cron job failed');
      }
    }
    out.push(row);
  }
  return { configured: true, branches: out };
}
