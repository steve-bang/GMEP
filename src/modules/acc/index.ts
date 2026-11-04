/**
 * ACC module public surface (the only file other modules, composition and infrastructure import).
 * Slice 1.7 "Tiền tối thiểu": receipts with several methods and deposits (FR-ACC-001, 002), the cash book per branch
 * (FR-ACC-003), shifts and day close with variance handling (FR-ACC-004), reversal entries (RULE-010), expense
 * vouchers over the approval limit (RULE-011), the approved debt at handover (FR-ACC-006 minimal) and the order balance
 * REC reads at handover (`getOrderBalance`, R44). Tax rates are SYS configuration (FR-ACC-009), reused by REC quotes.
 * Approvals (FR-SYS-004) live in SYS; this module registers the handlers of its kinds.
 */
export const MODULE_CODE = 'ACC' as const;

export * from './domain/payment';
export * from './domain/cash';
export * from './ports/ports';
export { DEFAULT_ACC_CONFIG } from './ports/deps';
export type { AccConfig, AccDeps } from './ports/deps';

export {
  collectPayment,
  collectSchema,
  getOrderBalanceInTx,
  getOrderBalanceInTx as getOrderBalance,
  getOrderMoney,
  getPayment,
  listPayments,
  toPaymentDto,
} from './application/payments';
export type {
  OrderBalanceDto,
  OrderMoneyDto,
  PaymentDto,
  PaymentListQuery,
} from './application/payments';
export { requestReversal, executeReversal } from './application/reversals';
export {
  createExpense,
  payApprovedExpense,
  expenseCategories,
  expenseApprovalNeed,
  hasExpenseSource,
} from './application/expenses';
export {
  openShift,
  closeShift,
  resubmitVariance,
  getCashbook,
  toShiftDto,
} from './application/shifts';
export type { ShiftDto, CashbookDto, CashEntryDto } from './application/shifts';
export { getDayStatus, closeDay } from './application/dayClose';
export type { DayStatusDto } from './application/dayClose';
export { requestDebt, listDebts, accApprovalHandlers } from './application/debts';
export type { DebtDto, DebtListDto } from './application/debts';
export { accPolicyOf } from './application/support';
