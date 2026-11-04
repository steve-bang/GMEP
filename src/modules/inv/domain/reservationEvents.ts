/**
 * BA-07 reservation rules by event (docs/dev/ba-answers-for-dev.md §16.2.1, the 23-row table).
 * Data, so REC, the tests and the UI share one reading of the rules. `side` says who executes it:
 *  - 'inv'   the INV engine does it (function named in `by`)
 *  - 'rec'   REC raises the event and calls INV
 *  - 'later' needs a module that does not exist yet (transfers, notifications)
 * Status of the rules: BA proposal awaiting confirmation [Đề xuất BA - chờ xác nhận: Chủ dự án, Khách].
 */
export type ReservationAction =
  'none' | 'hold' | 'hold-more' | 'release' | 'consume' | 'restore' | 'shorten';

export interface ReservationEventRule {
  no: number;
  event: string;
  action: ReservationAction;
  side: 'inv' | 'rec' | 'later';
  /** INV entry point that implements the action, when there is one */
  by?: string;
}

export const RESERVATION_EVENTS: readonly ReservationEventRule[] = [
  { no: 1, event: 'quote-drafted-sent-viewed', action: 'none', side: 'rec' },
  {
    no: 2,
    event: 'quote-fully-approved-order-opened',
    action: 'hold',
    side: 'inv',
    by: 'holdForApproval',
  },
  { no: 3, event: 'quote-partly-approved', action: 'hold', side: 'inv', by: 'holdForApproval' },
  { no: 4, event: 'quote-rejected-expired-replaced', action: 'none', side: 'rec' },
  { no: 5, event: 'supplementary-quote-pending', action: 'none', side: 'rec' },
  {
    no: 6,
    event: 'supplementary-approved',
    action: 'hold-more',
    side: 'inv',
    by: 'holdForApproval',
  },
  { no: 7, event: 'supplementary-rejected-expired', action: 'none', side: 'rec' },
  { no: 8, event: 'item-cancelled-or-dropped', action: 'release', side: 'inv', by: 'releaseStock' },
  {
    no: 9,
    event: 'quantity-changed-after-approval',
    action: 'hold',
    side: 'inv',
    by: 'holdForApproval',
  },
  { no: 10, event: 'partial-issue-posted', action: 'consume', side: 'inv', by: 'postDocument' },
  { no: 11, event: 'full-demand-issued', action: 'consume', side: 'inv', by: 'postDocument' },
  { no: 12, event: 'return-to-stock-posted', action: 'none', side: 'inv', by: 'postDocument' },
  { no: 13, event: 'issue-reversed', action: 'restore', side: 'inv', by: 'reverseDocument' },
  {
    no: 14,
    event: 'item-completed-or-order-ready',
    action: 'release',
    side: 'inv',
    by: 'releaseStock',
  },
  { no: 15, event: 'item-paused-waiting-parts', action: 'none', side: 'rec' },
  { no: 16, event: 'goods-arrived', action: 'none', side: 'inv', by: 'holdForApproval' },
  { no: 17, event: 'order-cancel-pending', action: 'none', side: 'rec' },
  { no: 18, event: 'order-cancelled', action: 'release', side: 'inv', by: 'releaseStock' },
  { no: 19, event: 'order-closed', action: 'release', side: 'inv', by: 'releaseStock' },
  { no: 20, event: 'customer-supplied-part', action: 'none', side: 'rec' },
  { no: 21, event: 'retail-sale', action: 'none', side: 'inv', by: 'postDocument' },
  { no: 22, event: 'transfer-sent', action: 'none', side: 'later' },
  { no: 23, event: 'count-below-reserved', action: 'shorten', side: 'inv', by: 'postDocument' },
];
