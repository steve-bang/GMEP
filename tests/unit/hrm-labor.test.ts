import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LABOR_POLICY,
  adjustmentNeedsOwner,
  apportion,
  computeItemLabor,
  earnedLineId,
  liveEarned,
  methodScopeKeys,
  netOf,
  reverseLine,
  roundToStep,
  statusOf,
  workedMsByTechnician,
  type LaborLine,
  type LaborMethod,
  type LaborPolicy,
  type LaborSheet,
} from '@/modules/hrm';
import {
  changePosition,
  employeePiiLevel,
  maskNationalId,
  presentEmployeeField,
} from '@/modules/hrm';
import { CONFIG_TYPES } from '@/modules/sys';

/**
 * FR-HRM-006, 007, 008, 015, 020 / RULE-038 / NFR-MNT-01: pure labor engine. The examples are SAMPLES ("minh họa"): the
 * client's formula is open (Q73) and `signedOffBy` is empty, so these tests prove the MECHANISM and UAT-11 stays open.
 */
type Example = {
  id: string;
  title: string;
  method: LaborMethod;
  standardMinutes: number;
  laborAmountVnd: number;
  techs: { key: string; actualMinutes: number; coefficientBp: number }[];
  expected: {
    key: string;
    actualMinutes: number;
    convertedMinutes: number | null;
    amountVnd: number;
  }[];
};
const fx = JSON.parse(
  readFileSync(new URL('../fixtures/hrm/labor-examples.json', import.meta.url), 'utf8'),
) as { label: string; signedOffBy: string | null; signedAt: string | null; examples: Example[] };

const run = (
  e: Pick<Example, 'method' | 'standardMinutes' | 'laborAmountVnd' | 'techs'>,
  policy: LaborPolicy = DEFAULT_LABOR_POLICY,
) =>
  computeItemLabor({
    method: e.method,
    policy,
    standardMinutes: e.standardMinutes,
    laborAmountVnd: e.laborAmountVnd,
    techs: e.techs.map((t) => ({
      key: t.key,
      actualMs: t.actualMinutes * 60_000,
      coefficientBp: t.coefficientBp,
    })),
  });

describe('UAT-11 sample examples (minh họa, not signed off) FR-HRM-020', () => {
  it('the fixture is flagged as a sample until the client accountant signs', () => {
    expect(fx.label).toBe('minh họa');
    // when someone signs, both fields must be filled together
    expect(Boolean(fx.signedOffBy)).toBe(Boolean(fx.signedAt));
  });
  for (const e of fx.examples)
    it(`FR-HRM-020 ${e.id}: ${e.title}`, () => {
      expect(run(e)).toEqual(e.expected);
    });
});

describe('FR-HRM-008 technician change: time is shared along the assignment timeline', () => {
  const at = (hhmm: string) => new Date(`2026-11-02T${hhmm}:00Z`);
  const events = [
    { type: 'start', at: at('08:00') },
    { type: 'pause', at: at('08:30') },
    { type: 'start', at: at('09:00') },
    { type: 'finish', at: at('09:30') },
  ];
  it('splits a segment cut by a reassignment and ignores the paused gap', () => {
    const w = workedMsByTechnician(events, [
      { technicianId: 'a', at: at('07:50') },
      { technicianId: 'b', at: at('08:20') },
    ]);
    // a: 08:00-08:20 = 20 min; b: 08:20-08:30 + 09:00-09:30 = 40 min
    expect(w.get('a')).toBe(20 * 60_000);
    expect(w.get('b')).toBe(40 * 60_000);
  });
  it('an undone event does not count and time before the first assignment goes to the first assignee', () => {
    const w = workedMsByTechnician(
      [
        { type: 'start', at: at('08:00') },
        { type: 'finish', at: at('08:10'), undone: true },
      ],
      [{ technicianId: 'a', at: at('08:05') }],
    );
    expect(w.size).toBe(0);
    const w2 = workedMsByTechnician(
      [
        { type: 'start', at: at('08:00') },
        { type: 'finish', at: at('08:10') },
      ],
      [{ technicianId: 'a', at: at('08:05') }],
    );
    expect(w2.get('a')).toBe(10 * 60_000);
  });
});

describe('FR-HRM-006/015 methods and rounding (no float, parts add up)', () => {
  const one = (method: LaborMethod, actual: number, std = 60, labor = 100_000) =>
    run({
      method,
      standardMinutes: std,
      laborAmountVnd: labor,
      techs: [{ key: 'a', actualMinutes: actual, coefficientBp: 10_000 }],
    })[0]!;

  it('approved actual hours follow the actual time, capped by a share of the standard hours', () => {
    const m: LaborMethod = { method: 'approved_actual', hourlyRateVnd: 60_000, capBp: 12_000 };
    expect(one(m, 50).convertedMinutes).toBe(50);
    expect(one(m, 50).amountVnd).toBe(50_000);
    // 90 actual vs a cap of 120% x 60 = 72
    expect(one(m, 90).convertedMinutes).toBe(72);
    expect(one(m, 90).amountVnd).toBe(72_000);
    expect(one({ method: 'approved_actual', hourlyRateVnd: 60_000 }, 90).convertedMinutes).toBe(90);
  });

  it('fixed plus bonus: the bonus needs the actual time to stay within the configured share of the standard', () => {
    const m: LaborMethod = {
      method: 'fixed_bonus',
      fixedVnd: 10_000,
      bonusVnd: 5_000,
      bonusMaxActualBp: 10_000,
    };
    expect(one(m, 60).amountVnd).toBe(15_000);
    expect(one(m, 61).amountVnd).toBe(10_000);
  });

  it('rounding mode and steps are policy: 1 minute at 100000/h is 1666.67 VND', () => {
    const m: LaborMethod = { method: 'standard_hours', hourlyRateVnd: 100_000 };
    const e = {
      method: m,
      standardMinutes: 1,
      laborAmountVnd: 0,
      techs: [{ key: 'a', actualMinutes: 1, coefficientBp: 10_000 }],
    };
    expect(run(e, { ...DEFAULT_LABOR_POLICY, roundingMode: 'half_up' })[0]!.amountVnd).toBe(1667);
    expect(run(e, { ...DEFAULT_LABOR_POLICY, roundingMode: 'down' })[0]!.amountVnd).toBe(1666);
    expect(run(e, { ...DEFAULT_LABOR_POLICY, roundingMode: 'up' })[0]!.amountVnd).toBe(1667);
    expect(run(e, { ...DEFAULT_LABOR_POLICY, moneyStepVnd: 500 })[0]!.amountVnd).toBe(1500);
    expect(roundToStep(7, 5, 'half_up')).toBe(5);
    expect(roundToStep(8, 5, 'half_up')).toBe(10);
  });

  it('apportion always adds up exactly, ties go to the lower index, no weights go to the first', () => {
    expect(apportion(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(apportion(10, [0, 0])).toEqual([10, 0]);
    for (let total = 0; total < 200; total += 7)
      for (const w of [
        [1, 2, 3],
        [5, 0, 5],
        [1, 1],
        [13, 29, 7, 1],
      ])
        expect(apportion(total, w).reduce((a, b) => a + b, 0)).toBe(total);
  });

  it('every result is a safe integer (money is integer VND, never a float)', () => {
    for (const method of [
      { method: 'standard_hours', hourlyRateVnd: 123_457 },
      { method: 'approved_actual', hourlyRateVnd: 99_999, capBp: 11_111 },
      { method: 'percent', rateBp: 1_234 },
    ] as LaborMethod[])
      for (const r of run({
        method,
        standardMinutes: 47,
        laborAmountVnd: 987_654,
        techs: [
          { key: 'a', actualMinutes: 33, coefficientBp: 10_333 },
          { key: 'b', actualMinutes: 17, coefficientBp: 9_001 },
        ],
      })) {
        expect(Number.isSafeInteger(r.amountVnd)).toBe(true);
        expect(Number.isSafeInteger(r.actualMinutes)).toBe(true);
      }
  });
});

describe('FR-HRM-020 method priority: branch+service+position, branch+service, tenant+service+position, tenant+service', () => {
  it('lists the keys most specific first', () => {
    expect(methodScopeKeys('b1', 'maintenance', 'mechanic4')).toEqual([
      'branch:b1:svc:maintenance:pos:mechanic4',
      'branch:b1:svc:maintenance',
      'svc:maintenance:pos:mechanic4',
      'svc:maintenance',
    ]);
    expect(methodScopeKeys('b1', 'maintenance', null)).toEqual([
      'branch:b1:svc:maintenance',
      'svc:maintenance',
    ]);
  });
  it('the config schema accepts exactly these keys and refuses a half-filled method (NFR-MNT-01)', () => {
    const def = CONFIG_TYPES['labor-method']!;
    for (const k of methodScopeKeys('b1', 'tire_wheel', 'apprentice'))
      expect(def.scopeKey.safeParse(k).success, k).toBe(true);
    expect(def.scopeKey.safeParse('svc:').success).toBe(false);
    expect(def.payload.safeParse({ method: 'flat' }).success).toBe(false);
    expect(def.payload.safeParse({ method: 'flat', amountVnd: 1, rateBp: 5 }).success).toBe(false);
    expect(def.payload.safeParse({ method: 'flat', amountVnd: 20_000 }).success).toBe(true);
    expect(
      def.payload.safeParse({
        method: 'fixed_bonus',
        fixedVnd: 1,
        bonusVnd: 1,
        bonusMaxActualBp: 1,
      }).success,
    ).toBe(true);
  });
});

describe('FR-HRM-007/008 lines: reversal and rework keep history (RULE-010)', () => {
  const line = (over: Partial<LaborLine> = {}): LaborLine => ({
    id: earnedLineId('ro1', 1, 1, 'a'),
    tenantId: 't',
    branchId: 'b',
    orderId: 'ro1',
    orderNumber: 'LSC-1',
    itemId: 'ro1__i1',
    itemNo: 1,
    itemName: 'Thay dầu',
    serviceType: 'maintenance',
    kind: 'earned',
    technicianId: 'a',
    employeeId: null,
    positionCode: null,
    qcRun: 1,
    actualMinutes: 24,
    standardMinutes: 18,
    convertedMinutes: 18,
    amountVnd: 30_000,
    method: 'standard_hours',
    rule: null,
    positionVersionId: null,
    policyVersionId: null,
    hoursVersionIds: [],
    warnings: [],
    at: new Date('2026-11-02T10:00:00Z'),
    businessDate: '2026-11-02',
    createdBy: 'qd',
    ...over,
  });
  const sheet = (lines: LaborLine[]): LaborSheet => ({
    id: 'ro1',
    tenantId: 't',
    branchId: 'b',
    orderId: 'ro1',
    orderNumber: 'LSC-1',
    lines,
    recordedAt: new Date(),
    version: 1,
  });

  it('example 6, cancel after labor was recorded: the opposite line brings the net to zero, the original is untouched', () => {
    const l = line();
    const r = reverseLine(l, {
      at: new Date(),
      businessDate: '2026-11-03',
      by: 'ql',
      reason: 'order_cancelled',
    });
    expect(r.amountVnd).toBe(-30_000);
    expect(r.convertedMinutes).toBe(-18);
    expect(r.reversesLineId).toBe(l.id);
    expect(netOf([l, r]).amountVnd).toBe(0);
    const s = sheet([l, r]);
    expect(statusOf(s, l)).toBe('reversed');
    expect(liveEarned(s, l.itemId)).toEqual([]);
    expect(l.amountVnd).toBe(30_000);
  });

  it('example 5, rework: a QC return earns nothing; labor counts once after the next pass', () => {
    const marker = line({
      id: 'ro1__1__q1__returned',
      kind: 'qc_returned',
      amountVnd: 0,
      convertedMinutes: null,
      actualMinutes: 0,
    });
    expect(netOf([marker]).amountVnd).toBe(0);
    expect(statusOf(sheet([marker]), marker)).toBe('qc_returned');
    const pass2 = line({ id: earnedLineId('ro1', 1, 2, 'a'), qcRun: 2, reworkOfLineId: marker.id });
    expect(netOf([marker, pass2]).amountVnd).toBe(30_000);
    expect(liveEarned(sheet([marker, pass2]), 'ro1__i1')).toHaveLength(1);
  });

  it('line ids are fixed by (order, item, QC run, technician): a replayed QC meets the same id', () => {
    expect(earnedLineId('ro1', 3, 2, 'u_th')).toBe(earnedLineId('ro1', 3, 2, 'u_th'));
    expect(earnedLineId('ro1', 3, 2, 'u_th')).not.toBe(earnedLineId('ro1', 3, 3, 'u_th'));
  });

  it('FR-HRM-020 manual adjustment: above either configured threshold the owner decides', () => {
    const p = { ...DEFAULT_LABOR_POLICY, adjustThresholdMinutes: 60, adjustThresholdVnd: 300_000 };
    expect(adjustmentNeedsOwner(p, 60, 300_000)).toBe(false);
    expect(adjustmentNeedsOwner(p, -61, 0)).toBe(true);
    expect(adjustmentNeedsOwner(p, 0, 300_001)).toBe(true);
    // no configuration: nothing is assumed, every adjustment goes to the owner
    expect(adjustmentNeedsOwner(DEFAULT_LABOR_POLICY, 1, 0)).toBe(true);
  });
});

describe('FR-HRM-001 staff record and personal data by role (Phụ lục D)', () => {
  it('positions keep history: a change closes the open stint the day before', () => {
    const next = changePosition(
      [{ positionCode: 'mechanic3', from: '2021-06-12', to: null }],
      'mechanic4',
      '2025-01-01',
    );
    expect(next).toEqual([
      { positionCode: 'mechanic3', from: '2021-06-12', to: '2024-12-31' },
      { positionCode: 'mechanic4', from: '2025-01-01', to: null },
    ]);
    expect(() => changePosition(next, 'mechanic3', '2025-01-01')).toThrow();
  });
  it('masks by role: QL full phone and masked id, KT masked phone and no id, QD nothing, own record full', () => {
    expect(employeePiiLevel(['QL'], 'phone', false)).toBe('full');
    expect(employeePiiLevel(['QL'], 'nationalId', false)).toBe('reveal');
    expect(employeePiiLevel(['CH'], 'birthDate', false)).toBe('masked');
    expect(employeePiiLevel(['KT'], 'phone', false)).toBe('masked');
    expect(employeePiiLevel(['KT'], 'nationalId', false)).toBe('hidden');
    expect(employeePiiLevel(['QD'], 'phone', false)).toBe('hidden');
    expect(employeePiiLevel(['TH'], 'phone', true)).toBe('full');
    expect(employeePiiLevel(['TH'], 'phone', false)).toBe('hidden');
  });
  it('a hidden field carries no value at all; a masked id keeps three digits', () => {
    expect(presentEmployeeField('hidden', 'nationalId', '079123456789')).toEqual({
      masked: true,
      reveal: false,
    });
    expect(maskNationalId('079123456789')).toMatch(/789$/);
    expect(maskNationalId('079123456789')).not.toContain('0791');
    const p = presentEmployeeField('reveal', 'phone', '0901234567');
    expect(p?.reveal).toBe(true);
    expect(p?.value).not.toContain('1234');
  });
});
