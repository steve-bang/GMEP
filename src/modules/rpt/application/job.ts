import { businessDate } from '@/platform/format/date';
import { resolveWorkingScope, type Actor } from '@/platform/rbac/rbac';
import { scopeAllows, type Scope } from '@/platform/scope/scope';
import { computeDaily, addDays, DATE_RE, type DailyRollup } from '../domain/rollup';
import type { RptDeps } from '../ports/deps';
import { loadFacts } from './facts';
import {
  AppError,
  auditEntry,
  dateSchema,
  fingerprintOf,
  forbidden,
  parseInput,
  rptPolicyOf,
  z,
  type RequestCtx,
} from './support';

export type RefreshMode = 'auto' | 'rebuild';

export interface DayOutcome {
  date: string;
  result: 'created' | 'updated' | 'unchanged' | 'skipped_official';
}
export interface BranchOutcome {
  branchId: string;
  days: DayOutcome[];
}

/**
 * Computes the given days of one branch from the source documents and writes each rollup only when its content changed
 * (same facts, same `sourceHash`, no write: the job is idempotent and safe to run twice at once, the last writer
 * writes identical content). The write and its audit entry share one transaction (FR-SYS-003).
 * An OFFICIAL day (closed in ACC) is not touched by `auto`; a `rebuild` recomputes it and says so in the audit entry.
 */
async function refreshDays(
  deps: RptDeps,
  actor: Actor,
  scope: Scope,
  ctx: RequestCtx,
  branchId: string,
  dates: string[],
  mode: RefreshMode,
): Promise<BranchOutcome> {
  const now = deps.sys.clock.now();
  const existing = new Map(
    (
      await deps.rollups.getMany(
        scope,
        dates.map((date) => ({ branchId, date })),
      )
    ).map((r) => [r.date, r]),
  );
  const todo = dates.filter((d) => mode === 'rebuild' || !existing.get(d)?.official);
  const days: DayOutcome[] = dates
    .filter((d) => !todo.includes(d))
    .map((date) => ({ date, result: 'skipped_official' as const }));
  if (todo.length > 0) {
    const facts = await loadFacts(deps, scope, branchId, todo, now);
    for (const date of todo) {
      const policy = await rptPolicyOf(deps, actor.tenantId, branchId, date);
      const next = computeDaily(
        { tenantId: actor.tenantId, branchId, date },
        facts.get(date)!,
        policy,
        { refsMax: deps.rpt.refsMax, alertsMax: deps.rpt.alertsMax },
        now,
        fingerprintOf,
      );
      const result = await deps.sys.uow.run(async (tx) => {
        const cur = await deps.rollups.getInTx(tx, scope, branchId, date);
        if (cur && cur.sourceHash === next.sourceHash) return 'unchanged' as const;
        deps.rollups.save(tx, next);
        deps.sys.audit.record(
          tx,
          auditEntry(deps.sys, actor, ctx, {
            branchId,
            entityType: 'rollup',
            entityId: next.id,
            action: mode === 'rebuild' ? 'rollup.rebuild' : 'rollup.refresh',
            before: cur ? { sourceHash: cur.sourceHash, official: cur.official } : null,
            after: { sourceHash: next.sourceHash, official: next.official, date },
          }),
        );
        return cur ? ('updated' as const) : ('created' as const);
      });
      days.push({ date, result });
    }
  }
  return { branchId, days: days.sort((a, b) => a.date.localeCompare(b.date)) };
}

const branchInput = z.object({ branchId: z.string().trim().min(1).max(64).optional() }).strict();

async function targetBranches(
  deps: RptDeps,
  actor: Actor,
  scope: Scope,
  requested?: string,
): Promise<string[]> {
  if (requested) {
    if (!scopeAllows(scope, actor.tenantId, requested)) throw forbidden();
    return [requested];
  }
  const list = await deps.sys.branches.list(scope);
  // a locked branch still has reports (read-only data); only writes are blocked in the other modules
  return list.map((b) => b.id);
}

/**
 * The due job (FR-RPT-003): refreshes today and `refreshDays` days before it, and creates a day inside `catchUpDays`
 * that has no rollup yet. There is no scheduler yet [Cần xác nhận: hạ tầng]; Cloud Scheduler calls this through the
 * API with a service account and a person can press it on the report screen. Safe to repeat.
 */
export async function runDueRollups(deps: RptDeps, actor: Actor, raw: unknown, ctx: RequestCtx) {
  const scope = resolveWorkingScope(actor, 'report-job:manage');
  const input = parseInput(branchInput, raw ?? {});
  const today = businessDate(deps.sys.clock.now());
  const ids = (await targetBranches(deps, actor, scope, input.branchId)).slice(
    0,
    deps.rpt.maxBranchesPerRun,
  );
  const out: BranchOutcome[] = [];
  for (const branchId of ids) {
    const recent = Array.from({ length: deps.rpt.refreshDays + 1 }, (_, i) => addDays(today, -i));
    const catchUp = Array.from({ length: deps.rpt.catchUpDays }, (_, i) =>
      addDays(today, -(deps.rpt.refreshDays + 1 + i)),
    );
    const have = new Set(
      (
        await deps.rollups.getMany(
          scope,
          catchUp.map((date) => ({ branchId, date })),
        )
      ).map((r) => r.date),
    );
    const dates = [...recent, ...catchUp.filter((d) => !have.has(d))];
    out.push(await refreshDays(deps, actor, scope, ctx, branchId, dates, 'auto'));
  }
  return { date: today, branches: out };
}

const rebuildInput = z
  .object({ date: dateSchema, branchId: z.string().trim().min(1).max(64).optional() })
  .strict();

/** Recomputes one day from the source documents regardless of what is stored (also an official day, audited). */
export async function rebuildRollup(deps: RptDeps, actor: Actor, raw: unknown, ctx: RequestCtx) {
  const scope = resolveWorkingScope(actor, 'report-job:manage');
  const input = parseInput(rebuildInput, raw);
  const today = businessDate(deps.sys.clock.now());
  if (!DATE_RE.test(input.date) || input.date > today) throw new AppError('date_in_future', 422);
  if (input.date < addDays(today, -deps.rpt.rebuildMaxDays))
    throw new AppError('date_too_old', 422);
  const ids = await targetBranches(deps, actor, scope, input.branchId);
  const out: BranchOutcome[] = [];
  for (const branchId of ids.slice(0, deps.rpt.maxBranchesPerRun))
    out.push(await refreshDays(deps, actor, scope, ctx, branchId, [input.date], 'rebuild'));
  return { date: input.date, branches: out };
}

export type { DailyRollup };
