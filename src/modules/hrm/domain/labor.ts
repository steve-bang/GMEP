/**
 * Technician labor ("công thợ", FR-HRM-006/007/008/015/020, RULE-038). Pure functions, no I/O, NO number from the
 * client is written here: methods, hourly rates, position coefficients, rounding and thresholds are effective-dated
 * configuration (`labor-method`, `labor-position`, `labor-policy`) resolved by the application layer. The accountant's
 * formula is still open (Q73): this is a general mechanism, the sample rows used in tests are marked "minh họa".
 *
 * Two quantities are stored per line: converted hours (integer minutes, only for hour-based methods) and the labor
 * amount in whole VND. What is summed and exported is the amount; commission is NOT part of it (slice 2.6b).
 * Integer arithmetic only (BigInt inside), so there is no float anywhere in money or hours.
 */

export type LaborMethodKind =
  'standard_hours' | 'approved_actual' | 'flat' | 'percent' | 'fixed_bonus';
export const LABOR_METHOD_KINDS: readonly LaborMethodKind[] = [
  'standard_hours',
  'approved_actual',
  'flat',
  'percent',
  'fixed_bonus',
];

/** Payload of a `labor-method` version: which fields are required depends on `method` (validated in the config schema). */
export interface LaborMethod {
  method: LaborMethodKind;
  /** standard_hours, approved_actual: VND per converted hour */
  hourlyRateVnd?: number;
  /** approved_actual: approved hours never exceed this share of the standard hours (basis points); absent = no cap */
  capBp?: number;
  /** flat (khoán): the amount of one item */
  amountVnd?: number;
  /** percent: share of the approved labor amount of the item (before tax), basis points */
  rateBp?: number;
  /** fixed_bonus: fixed amount, plus the bonus when actual time is within `bonusMaxActualBp` of the standard time */
  fixedVnd?: number;
  bonusVnd?: number;
  bonusMaxActualBp?: number;
}

export type RoundingMode = 'half_up' | 'down' | 'up';
export interface LaborPolicy {
  roundingMode: RoundingMode;
  /** the labor amount is rounded to a multiple of this many VND (1 = no rounding) */
  moneyStepVnd: number;
  /** converted and actual minutes are rounded to a multiple of this (1 = exact minutes) */
  minutesStep: number;
  /** a manual adjustment above either threshold needs the owner (Phụ lục E #9 is only a sample); 0 = always */
  adjustThresholdMinutes: number;
  adjustThresholdVnd: number;
  /** what a QC return of an item that already has recorded labor does with that labor (FR-HRM-008 "làm lại") */
  reworkMode: 'keep_original' | 'reverse_original';
}

/** Neutral fallback when no `labor-policy` version is in force: exact arithmetic, nothing assumed about the client. */
export const DEFAULT_LABOR_POLICY: LaborPolicy = {
  roundingMode: 'half_up',
  moneyStepVnd: 1,
  minutesStep: 1,
  adjustThresholdMinutes: 0,
  adjustThresholdVnd: 0,
  reworkMode: 'keep_original',
};

/** Position coefficient used when the position has no `labor-position` row: 1.0 (10000 basis points). */
export const NEUTRAL_COEFFICIENT_BP = 10_000;

// ---- integer helpers --------------------------------------------------------------------------------

/** n / d for n >= 0, d > 0, with the policy's rounding mode. */
export function divRound(n: bigint, d: bigint, mode: RoundingMode): bigint {
  if (n < 0n || d <= 0n) throw new RangeError('divRound domain');
  const q = n / d;
  const r = n % d;
  if (r === 0n) return q;
  if (mode === 'down') return q;
  if (mode === 'up') return q + 1n;
  return r * 2n >= d ? q + 1n : q;
}

/** x rounded to a multiple of `step` (step >= 1). */
export function roundToStep(x: number, step: number, mode: RoundingMode): number {
  if (!Number.isSafeInteger(x) || x < 0) throw new RangeError('roundToStep value');
  if (!Number.isInteger(step) || step < 1) throw new RangeError('roundToStep step');
  if (step === 1) return x;
  return Number(divRound(BigInt(x), BigInt(step), mode) * BigInt(step));
}

const toSafe = (b: bigint): number => {
  if (b > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('amount too large');
  return Number(b);
};

/**
 * Splits an integer `total` over `weights` so the parts add up EXACTLY (largest remainder; ties go to the lower index).
 * All weights zero: everything goes to the first part.
 */
export function apportion(total: number, weights: readonly number[]): number[] {
  if (!Number.isSafeInteger(total) || total < 0) throw new RangeError('apportion total');
  if (weights.length === 0) return [];
  const w = weights.map((x) => BigInt(Math.max(0, Math.floor(x))));
  const sum = w.reduce((a, b) => a + b, 0n);
  if (sum === 0n) return weights.map((_, i) => (i === 0 ? total : 0));
  const T = BigInt(total);
  const base = w.map((x) => (T * x) / sum);
  let left = T - base.reduce((a, b) => a + b, 0n);
  const order = w
    .map((x, i) => ({ i, rem: (T * x) % sum }))
    .sort((a, b) => (a.rem === b.rem ? a.i - b.i : a.rem > b.rem ? -1 : 1));
  for (const o of order) {
    if (left === 0n) break;
    if (w[o.i]! > 0n) {
      base[o.i]! += 1n;
      left -= 1n;
    }
  }
  return base.map(toSafe);
}

// ---- hours: who worked how long ---------------------------------------------------------------------

export interface TimeEventFact {
  type: string;
  at: Date;
  undone?: boolean;
}
export interface AssignmentFact {
  technicianId: string | null;
  at: Date;
}

/** Key used for time nobody was assigned to (should not happen for a started item). */
export const UNASSIGNED = '';

/**
 * Worked milliseconds per technician (FR-HRM-005, 008): the closed start..pause/finish segments of the events that were
 * not undone (same rule as REC `workedMsOf`), each cut along the assignment timeline so that a change of technician in
 * the middle of a segment shares the time between the two people ("đổi thợ chia theo giờ thực").
 * Time before the first assignment entry belongs to the first assignee.
 */
/**
 * Technicians of one item, the lead first (2.6a-2, FR-HRM-020): most worked time first; on equal time the one assigned
 * earlier. The lead's position selects the method of the whole item. Pure.
 */
export function orderTechnicians(
  worked: ReadonlyMap<string, number>,
  assignments: readonly AssignmentFact[],
): string[] {
  const firstAssigned = new Map<string, number>();
  for (const a of assignments) {
    if (a.technicianId === null) continue;
    const t = a.at.getTime();
    const cur = firstAssigned.get(a.technicianId);
    if (cur === undefined || t < cur) firstAssigned.set(a.technicianId, t);
  }
  const rank = (k: string) => firstAssigned.get(k) ?? Number.MAX_SAFE_INTEGER;
  return [...worked.keys()].sort(
    (a, b) => worked.get(b)! - worked.get(a)! || rank(a) - rank(b) || (a < b ? -1 : 1),
  );
}

export function workedMsByTechnician(
  events: readonly TimeEventFact[],
  assignments: readonly AssignmentFact[],
): Map<string, number> {
  const segments: [number, number][] = [];
  let openAt: number | null = null;
  for (const e of events) {
    if (e.undone || e.type === 'undo') continue;
    if (e.type === 'start') openAt = e.at.getTime();
    else if ((e.type === 'pause' || e.type === 'finish') && openAt !== null) {
      if (e.at.getTime() > openAt) segments.push([openAt, e.at.getTime()]);
      openAt = null;
    }
  }
  const timeline = [...assignments]
    .map((a) => ({ at: a.at.getTime(), tech: a.technicianId ?? UNASSIGNED }))
    .sort((a, b) => a.at - b.at);
  const out = new Map<string, number>();
  const add = (k: string, ms: number) => {
    if (ms > 0) out.set(k, (out.get(k) ?? 0) + ms);
  };
  for (const [s, e] of segments) {
    if (timeline.length === 0) {
      add(UNASSIGNED, e - s);
      continue;
    }
    for (let i = 0; i < timeline.length; i++) {
      const from = i === 0 ? -Infinity : timeline[i]!.at;
      const to = i + 1 < timeline.length ? timeline[i + 1]!.at : Infinity;
      const lo = Math.max(s, from);
      const hi = Math.min(e, to);
      if (hi > lo) add(timeline[i]!.tech, hi - lo);
    }
  }
  return out;
}

// ---- the calculation --------------------------------------------------------------------------------

export interface TechShare {
  /** user id of the technician ('' = nobody) */
  key: string;
  actualMs: number;
  /** position coefficient in force (basis points); only hour-based methods use it */
  coefficientBp: number;
}

export interface ItemLaborInput {
  method: LaborMethod;
  policy: LaborPolicy;
  /** approved standard minutes of the item (labor lines of the approved quote) */
  standardMinutes: number;
  /** approved labor amount of the item, before tax (basis of the percent method) */
  laborAmountVnd: number;
  techs: readonly TechShare[];
}

export interface TechLabor {
  key: string;
  actualMinutes: number;
  /** converted hours in minutes; null when the method is not hour-based */
  convertedMinutes: number | null;
  amountVnd: number;
}

const msToMinutes = (ms: number, policy: LaborPolicy): number =>
  roundToStep(
    toSafe(divRound(BigInt(Math.max(0, Math.floor(ms))), 60_000n, policy.roundingMode)),
    policy.minutesStep,
    policy.roundingMode,
  );

const need = (v: number | undefined, name: string): number => {
  if (v === undefined || !Number.isSafeInteger(v) || v < 0)
    throw new RangeError(`labor method misses ${name}`);
  return v;
};

/**
 * Labor of ONE item that passed QC, split between the technicians by actual time. Rounding rule (fixed, FR-HRM-020):
 * minutes are rounded to `minutesStep`, VND amounts to `moneyStepVnd`, both with `roundingMode`; the pay of an
 * hour-based method is computed from the ROUNDED converted minutes, so hours x rate = amount can be checked by eye;
 * parts of a split always add up to the total (largest remainder).
 */
export function computeItemLabor(input: ItemLaborInput): TechLabor[] {
  const { method: m, policy, techs } = input;
  if (techs.length === 0) return [];
  const weights = techs.map((t) => Math.max(0, Math.floor(t.actualMs)));
  const totalMs = weights.reduce((a, b) => a + b, 0);
  const actualTotal = msToMinutes(totalMs, policy);
  const actualParts = apportion(actualTotal, weights);
  const money = (n: bigint) => roundToStep(toSafe(n), policy.moneyStepVnd, policy.roundingMode);

  if (m.method === 'standard_hours' || m.method === 'approved_actual') {
    const rate = BigInt(need(m.hourlyRateVnd, 'hourlyRateVnd'));
    let base = input.standardMinutes;
    if (m.method === 'approved_actual') {
      base = actualTotal;
      if (m.capBp !== undefined) {
        const cap = toSafe(
          divRound(BigInt(input.standardMinutes) * BigInt(m.capBp), 10_000n, policy.roundingMode),
        );
        base = Math.min(base, cap);
      }
    }
    const parts = apportion(base, weights);
    return techs.map((t, i) => {
      const converted = roundToStep(
        toSafe(divRound(BigInt(parts[i]!) * BigInt(t.coefficientBp), 10_000n, policy.roundingMode)),
        policy.minutesStep,
        policy.roundingMode,
      );
      return {
        key: t.key,
        actualMinutes: actualParts[i]!,
        convertedMinutes: converted,
        amountVnd: money(divRound(BigInt(converted) * rate, 60n, policy.roundingMode)),
      };
    });
  }

  let total: number;
  if (m.method === 'flat') total = need(m.amountVnd, 'amountVnd');
  else if (m.method === 'percent')
    total = money(
      divRound(
        BigInt(input.laborAmountVnd) * BigInt(need(m.rateBp, 'rateBp')),
        10_000n,
        policy.roundingMode,
      ),
    );
  else {
    // fixed_bonus: the bonus is earned when the actual time stays within the configured share of the standard time
    const within =
      BigInt(totalMs) * 10_000n <=
      BigInt(input.standardMinutes) *
        60_000n *
        BigInt(need(m.bonusMaxActualBp, 'bonusMaxActualBp'));
    total = need(m.fixedVnd, 'fixedVnd') + (within ? need(m.bonusVnd, 'bonusVnd') : 0);
  }
  const parts = apportion(total, weights);
  return techs.map((t, i) => ({
    key: t.key,
    actualMinutes: actualParts[i]!,
    convertedMinutes: null,
    amountVnd: parts[i]!,
  }));
}

// ---- rule selection (FR-HRM-020 priority) -----------------------------------------------------------

const CODE = /^[a-z][a-z0-9_-]{0,29}$/;
export const isCode = (s: string): boolean => CODE.test(s);

/**
 * `labor-method` scope keys, most specific first: branch + service + position, branch + service, tenant + service +
 * position, tenant + service. A key without a position applies to every position (FR-HRM-020, ba-answers-04 Câu 14).
 */
export function methodScopeKeys(
  branchId: string,
  serviceType: string,
  positionCode: string | null,
): string[] {
  const svc = `svc:${serviceType}`;
  const pos = positionCode ? `${svc}:pos:${positionCode}` : null;
  return [
    ...(pos ? [`branch:${branchId}:${pos}`] : []),
    `branch:${branchId}:${svc}`,
    ...(pos ? [pos] : []),
    svc,
  ];
}

export const positionScopeKey = (code: string): string => `position:${code}`;

// ---- lines ------------------------------------------------------------------------------------------

export type LaborLineKind = 'earned' | 'qc_returned' | 'reversal' | 'adjustment';
export type LaborLineWarning = 'no_rule' | 'no_technician' | 'no_profile';
/** G3-HRM-07 / ba-answers-04 Phụ lục A: pending QC, recorded, QC returned, reversed (derived, never stored) */
export type LaborLineStatus = 'recorded' | 'awaiting_payment' | 'qc_returned' | 'reversed';

export interface RuleRef {
  versionId: string;
  scopeKey: string;
  effectiveFrom: string;
  /** the payload that was applied, kept on the line so a later change of the rule never changes this line (RULE-038) */
  payload: LaborMethod;
}

export interface LaborLine {
  /** deterministic: `${orderId}__${itemNo}__q${qcRun}__${technician}` (earned), `${earnedId}__rev`, `adj_${approval or key}` */
  id: string;
  tenantId: string;
  branchId: string;
  orderId: string;
  orderNumber: string;
  itemId: string;
  itemNo: number;
  itemName: string;
  serviceType: string;
  kind: LaborLineKind;
  /** user id of the technician (the order's assignee), null when none was set */
  technicianId: string | null;
  employeeId: string | null;
  positionCode: string | null;
  qcRun: number | null;
  /** signed: a reversal and a negative adjustment carry negative figures */
  actualMinutes: number;
  standardMinutes: number;
  convertedMinutes: number | null;
  amountVnd: number;
  method: LaborMethodKind | null;
  rule: RuleRef | null;
  positionVersionId: string | null;
  policyVersionId: string | null;
  /** standard-hours versions of the labor lines of the item (FR-HRM-004) */
  hoursVersionIds: string[];
  warnings: LaborLineWarning[];
  /**
   * 2.6a-1 / FR-HRM-020, 021: a `percent` line is computed at QC but only EARNED when the order is paid in full
   * (commission on collection). While true it is "chờ thu đủ": shown apart, not in the recorded totals nor the
   * accountant export. The reversal and the adjustments copy the flag, so a pair always nets out on the same side.
   * Setting it to false when the order is paid in full is slice 2.6b.
   */
  awaitingPayment?: boolean;
  reversesLineId?: string;
  /** the earlier line of the same item that a rework replaces or follows (data link for HRM-016) */
  reworkOfLineId?: string;
  adjustsLineId?: string;
  approvalId?: string;
  reason?: string;
  at: Date;
  businessDate: string;
  createdBy: string;
}

export interface LaborSheet {
  /** the repair order id: one sheet per order, lines are only ever appended (RULE-010) */
  id: string;
  tenantId: string;
  branchId: string;
  orderId: string;
  orderNumber: string;
  lines: LaborLine[];
  /** time of the last appended line: the key the by-branch period query orders on */
  recordedAt: Date;
  version: number;
}

export const earnedLineId = (
  orderId: string,
  itemNo: number,
  qcRun: number,
  technician: string,
): string => `${orderId}__${itemNo}__q${qcRun}__${technician || 'none'}`;
export const reversalLineId = (lineId: string): string => `${lineId}__rev`;
export const returnedLineId = (orderId: string, itemNo: number, qcRun: number): string =>
  `${orderId}__${itemNo}__q${qcRun}__returned`;

/** Lines of one item that currently count: earned and not reversed. */
export function liveEarned(sheet: LaborSheet | null, itemId: string): LaborLine[] {
  if (!sheet) return [];
  const reversed = new Set(
    sheet.lines.filter((l) => l.reversesLineId).map((l) => l.reversesLineId),
  );
  return sheet.lines.filter(
    (l) => l.itemId === itemId && l.kind === 'earned' && !reversed.has(l.id),
  );
}

export function statusOf(sheet: Pick<LaborSheet, 'lines'>, line: LaborLine): LaborLineStatus {
  if (line.kind === 'qc_returned') return 'qc_returned';
  if (line.kind === 'earned' && sheet.lines.some((l) => l.reversesLineId === line.id))
    return 'reversed';
  return line.awaitingPayment ? 'awaiting_payment' : 'recorded';
}

/**
 * Net figures of the RECORDED lines (earned + adjustments + reversals): what is summed and exported is the amount.
 * Lines awaiting full payment (2.6a-1) are left out; use `netWithAwaiting` for the rule checks that need them.
 */
export function netOf(lines: readonly LaborLine[]): {
  amountVnd: number;
  convertedMinutes: number;
  actualMinutes: number;
} {
  return netWithAwaiting(lines.filter((l) => !l.awaitingPayment));
}

/** Value of the lines awaiting full payment, reversals included (so a reversed pair is 0): shown in its own column. */
export function awaitingPaymentVnd(lines: readonly LaborLine[]): number {
  return lines.reduce(
    (s, l) => (l.awaitingPayment && l.kind !== 'qc_returned' ? s + l.amountVnd : s),
    0,
  );
}

/** Net of every line, awaiting ones included: the basis of "an adjustment must not drop below zero". */
export function netWithAwaiting(lines: readonly LaborLine[]): {
  amountVnd: number;
  convertedMinutes: number;
  actualMinutes: number;
} {
  let amountVnd = 0;
  let convertedMinutes = 0;
  let actualMinutes = 0;
  for (const l of lines) {
    if (l.kind === 'qc_returned') continue;
    amountVnd += l.amountVnd;
    convertedMinutes += l.convertedMinutes ?? 0;
    actualMinutes += l.actualMinutes;
  }
  return { amountVnd, convertedMinutes, actualMinutes };
}

/** The line that undoes `l`: same figures, opposite sign, never an edit of `l`. */
export function reverseLine(
  l: LaborLine,
  v: { at: Date; businessDate: string; by: string; reason: string },
): LaborLine {
  return {
    ...l,
    id: reversalLineId(l.id),
    kind: 'reversal',
    actualMinutes: -l.actualMinutes,
    convertedMinutes: l.convertedMinutes === null ? null : -l.convertedMinutes,
    amountVnd: -l.amountVnd,
    reversesLineId: l.id,
    reason: v.reason,
    at: v.at,
    businessDate: v.businessDate,
    createdBy: v.by,
  };
}

/** True when a manual adjustment is above a configured threshold and therefore needs the owner. */
export function adjustmentNeedsOwner(
  policy: LaborPolicy,
  deltaMinutes: number,
  deltaVnd: number,
): boolean {
  return (
    Math.abs(deltaMinutes) > policy.adjustThresholdMinutes ||
    Math.abs(deltaVnd) > policy.adjustThresholdVnd
  );
}
