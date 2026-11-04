import { formatBp } from '@/platform/format/percent';
import type { Actor } from '@/platform/rbac/rbac';
import { getPart } from '@/modules/inv';
import { getService, resolveConfigAt } from '@/modules/sys';
import type { LaborLine, PartLine, QuoteItem, QuoteLine, TaxSnapshot } from '../domain/entities';
import {
  computeTotals,
  defaultSelected,
  discountBpOf,
  laborAmount,
  maxDiscountBp,
  partAmount,
  standardHoursDelta,
  sumLines,
} from '../domain/pricing';
import type { RecDeps } from '../ports/deps';
import { AppError, roleCodesOf, validationFailed, z } from './support';

/**
 * Turns the advisor's input into priced lines (FR-REC-004, FR-REC-005). The server owns every
 * number: the client sends WHAT (service, part, quantity, optional actual price) and the server
 * reads the list price, standard hours, hourly rate, discount limit and tax rate from the
 * effective-dated configuration in force on the pricing date (NFR-MNT-01) - nothing is hard-coded,
 * and the version ids used are stored on the line (price snapshot, FR-REC-031).
 */
const vnd = z.number().int().min(0).max(1_000_000_000);

export const laborInput = z.object({
  kind: z.literal('labor'),
  serviceId: z.string().trim().min(1).max(100),
  /** defaults to the standard hours of the service */
  minutes: z.number().int().min(1).max(7200).optional(),
  /** actual hourly price; defaults to the list hourly rate */
  unitVnd: vnd.optional(),
});
export const partInput = z.object({
  kind: z.literal('part'),
  partId: z.string().trim().min(1).max(100),
  qty: z.number().int().min(1).max(100_000),
  unitVnd: vnd.optional(),
});

export const itemInput = z.object({
  name: z.string().trim().min(1).max(160),
  necessity: z.enum(['required', 'optional']),
  customerRequested: z.boolean().default(false),
  lines: z.array(z.discriminatedUnion('kind', [laborInput, partInput])).min(1),
});
export type ItemInput = z.infer<typeof itemInput>;

export interface BuiltQuote {
  items: QuoteItem[];
  totals: ReturnType<typeof computeTotals>;
  /** R2: distinct tax keys used by the lines, each with the version it was read from */
  taxes: TaxSnapshot[];
}

/**
 * R2: which `tax-rate` key a line uses. The `tax-mapping` config (company, effective-dated) maps the kind
 * of line (labor, part, optionally the part's group) to a key; with no version in force every kind uses
 * the default key (`vat`). The accountant's answer is only ever a data change.
 */
interface TaxResolver {
  keyFor(kind: 'labor' | 'part', partGroup?: string): string;
  snapshot(key: string): Promise<TaxSnapshot>;
  all(): TaxSnapshot[];
}

async function taxResolver(deps: RecDeps, actor: Actor, date: string): Promise<TaxResolver> {
  const m = (
    await resolveConfigAt(deps.sys, {
      companyId: actor.companyId,
      type: 'tax-mapping',
      scopeKey: 'company',
      date,
    })
  )?.payload as { labor: string; part: string; partGroups?: Record<string, string> } | undefined;
  const used = new Map<string, TaxSnapshot>();
  return {
    keyFor: (kind, group) =>
      kind === 'labor'
        ? (m?.labor ?? deps.rec.defaultTaxRateKey)
        : ((group ? m?.partGroups?.[group] : undefined) ?? m?.part ?? deps.rec.defaultTaxRateKey),
    async snapshot(key) {
      const have = used.get(key);
      if (have) return have;
      const t = await resolveConfigAt(deps.sys, {
        companyId: actor.companyId,
        type: 'tax-rate',
        scopeKey: key,
        date,
      });
      if (!t) throw new AppError('tax_rate_missing', 409);
      const p = t.payload as { name: string; rateBp: number };
      const snap: TaxSnapshot = {
        key,
        versionId: t.versionId,
        name: p.name,
        rateBp: p.rateBp,
        effectiveFrom: t.effectiveFrom,
      };
      used.set(key, snap);
      return snap;
    },
    all: () => [...used.values()].sort((a, b) => a.key.localeCompare(b.key)),
  };
}

export async function buildItems(
  deps: RecDeps,
  actor: Actor,
  branchId: string,
  date: string,
  inputs: readonly ItemInput[],
): Promise<BuiltQuote> {
  if (inputs.length > deps.rec.maxItems) throw new AppError('quote_too_large', 422);
  const lineCount = inputs.reduce((s, i) => s + i.lines.length, 0);
  if (inputs.some((i) => i.lines.length > deps.rec.maxLinesPerItem) || lineCount > 200)
    throw new AppError('quote_too_large', 422);

  const tax = await taxResolver(deps, actor, date);
  // a missing tax rate is a configuration failure of the whole quote: report it before any line error
  const kinds = new Set(inputs.flatMap((i) => i.lines.map((l) => l.kind)));
  if (kinds.has('labor')) await tax.snapshot(tax.keyFor('labor'));
  if (kinds.has('part')) await tax.snapshot(tax.keyFor('part'));
  const limits = (
    await resolveConfigAt(deps.sys, {
      companyId: actor.companyId,
      type: 'discount-limit',
      scopeKey: 'company',
      date,
      branchId,
    })
  )?.payload as { maxDiscountBpByRole?: Record<string, number> } | undefined;
  const allowedBp = maxDiscountBp(limits?.maxDiscountBpByRole ?? null, roleCodesOf(actor));
  const rate = await resolveConfigAt(deps.sys, {
    companyId: actor.companyId,
    type: 'labor-rate',
    scopeKey: 'company',
    date,
    branchId,
  });

  const errors: { field: string; message: string }[] = [];
  const items: QuoteItem[] = [];
  let no = 0;
  for (const [ii, input] of inputs.entries()) {
    const lines: QuoteLine[] = [];
    for (const [li, l] of input.lines.entries()) {
      const field = `items.${ii}.lines.${li}`;
      const built =
        l.kind === 'labor'
          ? await laborLine(deps, actor, date, rate, tax, l)
          : await partLine(deps, actor, date, tax, l);
      if (!built.ok) {
        errors.push({ field, message: built.message });
        continue;
      }
      const line = { ...built.line, lineNo: li + 1 };
      // FR-INV-025: discount only within the limit of the actor's role (a missing limit means none)
      if (line.discountBp > allowedBp)
        errors.push({
          field: `${field}.unitVnd`,
          message: `Giảm giá ${formatBp(line.discountBp)} vượt hạn mức ${formatBp(allowedBp)} của vai trò của bạn. Nhờ Quản lý chi nhánh điều chỉnh hoặc giảm lại.`,
        });
      lines.push(line);
    }
    no += 1;
    const item: QuoteItem = {
      no,
      name: input.name,
      necessity: input.necessity,
      customerRequested: input.customerRequested,
      selected: defaultSelected(input.necessity, input.customerRequested),
      lines,
      subtotalVnd: 0,
    };
    item.subtotalVnd = sumLines(item);
    items.push(item);
  }
  if (errors.length) throw validationFailed(errors);
  return { items, totals: computeTotals(items), taxes: tax.all() };
}

type Built<L> =
  { ok: true; line: Omit<L, 'lineNo'> & { lineNo: number } } | { ok: false; message: string };

async function laborLine(
  deps: RecDeps,
  actor: Actor,
  date: string,
  rate: Awaited<ReturnType<typeof resolveConfigAt>>,
  taxes: TaxResolver,
  l: Extract<ItemInputLine, { kind: 'labor' }>,
): Promise<Built<LaborLine>> {
  const service = await getService(deps.sys, actor, l.serviceId).catch(() => null);
  if (!service) return { ok: false, message: 'Không tìm thấy hạng mục dịch vụ.' };
  if (service.status !== 'active')
    return { ok: false, message: `Hạng mục ${service.code} đã ngừng dùng.` };
  const hours = await resolveConfigAt(deps.sys, {
    companyId: actor.companyId,
    type: 'standard-hours',
    scopeKey: `service:${service.code}`,
    date,
  });
  if (!hours)
    return { ok: false, message: `Hạng mục ${service.code} chưa có giờ chuẩn đang hiệu lực.` };
  if (!rate) return { ok: false, message: 'Chưa có đơn giá giờ công đang hiệu lực cho chi nhánh.' };
  const standardMinutes = (hours.payload as { standardMinutes: number }).standardMinutes;
  const listUnitVnd = (rate.payload as { hourlyRateVnd: number }).hourlyRateVnd;
  const minutes = l.minutes ?? standardMinutes;
  const unitVnd = l.unitVnd ?? listUnitVnd;
  const delta = standardHoursDelta(minutes, standardMinutes);
  const tax = await taxes.snapshot(taxes.keyFor('labor'));
  return {
    ok: true,
    line: {
      lineNo: 0,
      kind: 'labor',
      code: service.code,
      name: service.name,
      serviceId: service.id,
      minutes,
      standardMinutes,
      minutesDelta: delta.minutesDelta,
      minutesDeltaBp: delta.minutesDeltaBp,
      differsFromStandard: delta.differs,
      listUnitVnd,
      unitVnd,
      discountBp: discountBpOf(listUnitVnd, unitVnd),
      amountVnd: laborAmount(minutes, unitVnd),
      taxRateBp: tax.rateBp,
      taxKey: tax.key,
      taxVersionId: tax.versionId,
      rateVersionId: rate.versionId,
      hoursVersionId: hours.versionId,
    },
  };
}

async function partLine(
  deps: RecDeps,
  actor: Actor,
  date: string,
  taxes: TaxResolver,
  l: Extract<ItemInputLine, { kind: 'part' }>,
): Promise<Built<PartLine>> {
  const part = await getPart(deps.inv, actor, l.partId).catch(() => null);
  if (!part) return { ok: false, message: 'Không tìm thấy phụ tùng.' };
  if (part.status !== 'active')
    return { ok: false, message: `Phụ tùng ${part.code} đã ngừng dùng.` };
  const price = await resolveConfigAt(deps.sys, {
    companyId: actor.companyId,
    type: 'price-item',
    scopeKey: `${deps.rec.priceListCode}:${part.code}`,
    date,
  });
  if (!price)
    return { ok: false, message: `Phụ tùng ${part.code} chưa có giá bán trong bảng giá.` };
  const listUnitVnd = (price.payload as { listPriceVnd: number }).listPriceVnd;
  const unitVnd = l.unitVnd ?? listUnitVnd;
  const tax = await taxes.snapshot(taxes.keyFor('part', part.group));
  return {
    ok: true,
    line: {
      lineNo: 0,
      kind: 'part',
      code: part.code,
      name: part.name,
      partId: part.id,
      qty: l.qty,
      qtyScale: part.quantityScale,
      listUnitVnd,
      unitVnd,
      discountBp: discountBpOf(listUnitVnd, unitVnd),
      amountVnd: partAmount(l.qty, unitVnd, part.quantityScale),
      taxRateBp: tax.rateBp,
      taxKey: tax.key,
      taxVersionId: tax.versionId,
      priceListCode: deps.rec.priceListCode,
      priceVersionId: price.versionId,
    },
  };
}

type ItemInputLine = ItemInput['lines'][number];

/** The stored lines expressed as input again (an edit after sending starts from the stored version). */
export function itemsToInput(items: readonly QuoteItem[]): ItemInput[] {
  return items.map((i) => ({
    name: i.name,
    necessity: i.necessity,
    customerRequested: i.customerRequested,
    lines: i.lines.map((l) =>
      l.kind === 'labor'
        ? { kind: 'labor' as const, serviceId: l.serviceId, minutes: l.minutes }
        : { kind: 'part' as const, partId: l.partId, qty: l.qty },
    ),
  }));
}
