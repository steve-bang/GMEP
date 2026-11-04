import type { ApprovedLine, DeclinedItem, QuoteItem } from './entities';
import { splitTaxByItems, type GrossSplit } from '@/platform/money/splitTax';

/**
 * Approval maths and rules (FR-REC-007, 009, 026; RULE-005; ba-answers-03 Câu 2). The unit of approval
 * is the ITEM (labor and parts that go together). All functions are pure and integer-only.
 */

export type { ItemGross, GrossSplit } from '@/platform/money/splitTax';

/**
 * R1 (BA §17): tax once per rate on the net total of the chosen items (the rule of `computeTotals`),
 * then split across the items (largest remainder) so item prices add up to EXACTLY the total payable.
 * The maths lives in platform so the customer page can recompute a selection in the browser.
 */
export function splitGross(items: readonly QuoteItem[]): GrossSplit {
  return splitTaxByItems(items);
}

export interface DeclineInput {
  itemNo: number;
  reasonCode?: string | undefined;
  reasonNote?: string | undefined;
}

export type ApprovalDecision =
  | {
      ok: true;
      mode: 'full' | 'partial';
      approved: QuoteItem[];
      declined: DeclinedItem[];
      split: GrossSplit;
    }
  | {
      ok: false;
      reason:
        'nothing_selected' | 'unknown_item' | 'required_item_locked' | 'decline_reason_missing';
      itemNo?: number;
    };

/**
 * Decides which items are approved. At least one item must be approved (refusing everything is the
 * separate "reject the whole quote" action). A refused REQUIRED item is allowed unless the branch
 * policy locks it (Câu 2: "Cho phép khách bỏ hạng mục bắt buộc", default yes); it needs a reason and
 * carries the safety flag for the reminder list (BR-REC-11). `reasonCodes` = active decline reasons.
 */
export function decideApproval(
  items: readonly QuoteItem[],
  selectedNos: readonly number[],
  declines: readonly DeclineInput[],
  policy: { allowDeclineRequired: boolean; reasonCodes: ReadonlySet<string> },
): ApprovalDecision {
  const known = new Set(items.map((i) => i.no));
  const chosen = new Set(selectedNos);
  for (const n of chosen)
    if (!known.has(n)) return { ok: false, reason: 'unknown_item', itemNo: n };
  for (const d of declines)
    if (!known.has(d.itemNo)) return { ok: false, reason: 'unknown_item', itemNo: d.itemNo };
  const approved = items.filter((i) => chosen.has(i.no));
  if (approved.length === 0) return { ok: false, reason: 'nothing_selected' };
  const declined: DeclinedItem[] = [];
  for (const item of items) {
    if (chosen.has(item.no)) continue;
    const d = declines.find((x) => x.itemNo === item.no);
    const required = item.necessity === 'required';
    if (required && !policy.allowDeclineRequired)
      return { ok: false, reason: 'required_item_locked', itemNo: item.no };
    if (required && (!d?.reasonCode || !policy.reasonCodes.has(d.reasonCode)))
      return { ok: false, reason: 'decline_reason_missing', itemNo: item.no };
    declined.push({
      itemNo: item.no,
      name: item.name,
      necessity: item.necessity,
      ...(d?.reasonCode ? { reasonCode: d.reasonCode } : {}),
      ...(d?.reasonNote ? { reasonNote: d.reasonNote } : {}),
      safety: required,
      subtotalVnd: item.subtotalVnd,
    });
  }
  return {
    ok: true,
    mode: declined.length === 0 ? 'full' : 'partial',
    approved,
    declined,
    split: splitGross(approved),
  };
}

/** The immutable key of a line of an approved version: what the order, the stock hold and the issue carry (I20). */
export const lineKeyOf = (quoteId: string, n: number, itemNo: number, lineNo: number): string =>
  `${quoteId}__v${n}_${itemNo}_${lineNo}`;

/** Flattens approved items into the lines the repair order is created from (slice 1.6). */
export function approvedLinesOf(
  quoteId: string,
  n: number,
  approved: readonly QuoteItem[],
): ApprovedLine[] {
  return approved.flatMap((item) =>
    item.lines.map((l): ApprovedLine => {
      const base = {
        lineKey: lineKeyOf(quoteId, n, item.no, l.lineNo),
        itemNo: item.no,
        itemName: item.name,
        lineNo: l.lineNo,
        code: l.code,
        name: l.name,
        unitVnd: l.unitVnd,
        amountVnd: l.amountVnd,
        taxKey: l.taxKey,
        taxVersionId: l.taxVersionId,
        taxRateBp: l.taxRateBp,
      };
      return l.kind === 'labor'
        ? {
            ...base,
            kind: 'labor',
            serviceId: l.serviceId,
            minutes: l.minutes,
            priceVersionId: l.rateVersionId,
            hoursVersionId: l.hoursVersionId,
          }
        : {
            ...base,
            kind: 'part',
            partId: l.partId,
            qty: l.qty,
            qtyScale: l.qtyScale,
            priceVersionId: l.priceVersionId,
          };
    }),
  );
}
