import { businessDate } from '@/platform/format/date';
import { resolveScope, type Actor } from '@/platform/rbac/rbac';
import { scopeAllows } from '@/platform/scope/scope';
import { CONFIG_TYPES, resolveCatalogAt } from '@/modules/sys';
import {
  DEFAULT_LABOR_POLICY,
  computeItemLabor,
  type LaborMethod,
  type LaborPolicy,
  type TechLabor,
} from '../domain/labor';
import type { HrmDeps } from '../ports/deps';
import { laborPolicyAt, parseInput, z } from './support';

/**
 * Read-only view of the labor rules in force (G3-HRM-06) and the "thử tính" table. Rules are CHANGED through the
 * effective-dated configuration API (`labor-method`, `labor-position`, `labor-policy`: propose, approve, effective date);
 * this module never edits a version. The simulation is a pure calculation with the same engine the QC uses.
 */

export interface LaborRulesDto {
  date: string;
  methods: { scopeKey: string; payload: Record<string, unknown> }[];
  positions: { code: string; name: string; status: string; coefficientBp: number }[];
  policy: LaborPolicy;
  /** the policy comes from a version (null = the neutral fallback, nothing configured) */
  policyVersionId: string | null;
}

export async function getLaborRules(
  deps: HrmDeps,
  actor: Actor,
  q: { date?: string; branchId?: string },
): Promise<LaborRulesDto> {
  const scope = resolveScope(actor, 'labor-rule:view');
  const date =
    q.date && /^\d{4}-\d{2}-\d{2}$/.test(q.date) ? q.date : businessDate(deps.sys.clock.now());
  const branchId = q.branchId ?? actor.workingBranchId;
  const [methods, positions] = await Promise.all([
    resolveCatalogAt(deps.sys, { tenantId: actor.tenantId, type: 'labor-method', date }),
    resolveCatalogAt(deps.sys, { tenantId: actor.tenantId, type: 'labor-position', date }),
  ]);
  const visible = (key: string) => {
    const m = /^branch:([^:]+)/.exec(key);
    return !m || scopeAllows(scope, actor.tenantId, m[1]!);
  };
  const { policy, versionId } =
    branchId && scopeAllows(scope, actor.tenantId, branchId)
      ? await laborPolicyAt(deps, actor.tenantId, branchId, date)
      : await laborPolicyAt(deps, actor.tenantId, '', date);
  return {
    date,
    methods: methods
      .filter((m) => visible(m.code))
      .map((m) => ({ scopeKey: m.code, payload: m.payload })),
    positions: positions.map((p) => ({
      code: p.code.replace(/^position:/, ''),
      name: (p.payload as { name: string }).name,
      status: (p.payload as { status: string }).status,
      coefficientBp: (p.payload as { coefficientBp: number }).coefficientBp,
    })),
    policy: policy ?? DEFAULT_LABOR_POLICY,
    policyVersionId: versionId,
  };
}

const policyShape = z
  .object({
    roundingMode: z.enum(['half_up', 'down', 'up']),
    moneyStepVnd: z.number().int().min(1).max(1_000_000),
    minutesStep: z.number().int().min(1).max(60),
    adjustThresholdMinutes: z.number().int().min(0).max(1440),
    adjustThresholdVnd: z.number().int().min(0).max(1_000_000_000_000),
    reworkMode: z.enum(['keep_original', 'reverse_original']),
  })
  .partial();

export const simulateSchema = z.object({
  /** a draft payload is validated exactly like a proposal of the `labor-method` type */
  method: CONFIG_TYPES['labor-method']!.payload,
  policy: policyShape.optional(),
  standardMinutes: z
    .number()
    .int()
    .min(0)
    .max(24 * 60),
  laborAmountVnd: z.number().int().min(0).max(1_000_000_000_000),
  techs: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(40),
        actualMinutes: z
          .number()
          .int()
          .min(0)
          .max(24 * 60),
        coefficientBp: z.number().int().min(0).max(100_000).default(10_000),
      }),
    )
    .min(1)
    .max(5),
});

/** The "thử tính" of G3-HRM-06: what a method gives for given hours. Nothing is stored. */
export function simulateLabor(actor: Actor, input: unknown): { lines: TechLabor[] } {
  resolveScope(actor, 'labor-rule:view');
  const d = parseInput(simulateSchema, input);
  return {
    lines: computeItemLabor({
      method: d.method as unknown as LaborMethod,
      policy: { ...DEFAULT_LABOR_POLICY, ...(d.policy ?? {}) },
      standardMinutes: d.standardMinutes,
      laborAmountVnd: d.laborAmountVnd,
      techs: d.techs.map((t) => ({
        key: t.key,
        actualMs: t.actualMinutes * 60_000,
        coefficientBp: t.coefficientBp,
      })),
    }),
  };
}
