import type { Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import {
  DEFAULT_ACC_CONFIG,
  getOrderBalanceInTx,
  type AccDeps,
  type OrderSource,
  type PayableOrder,
} from '@/modules/acc';
import { isOrderOpen, type PaymentGate, type RecDeps, type RepairOrder } from '@/modules/rec';
import type { SysDeps } from '@/modules/sys';
import {
  DocCashRepository,
  DocDebtRepository,
  DocOrderAccountRepository,
  DocPaymentRepository,
} from '@/infrastructure/repos/accRepos';
import type { DocStore } from '@/platform/store/docStore';

/**
 * ACC and REC know each other only through ports (plan §2.2: no cycle between modules). This file is the one place
 * that connects them: ACC reads the repair order (the receivable) through `OrderSource`; REC asks ACC for the balance
 * through `PaymentGate`. Nothing else in the code base crosses that line.
 */
const toPayable = (o: RepairOrder): PayableOrder => ({
  id: o.id,
  companyId: o.companyId,
  branchId: o.branchId,
  number: o.number,
  status: o.status,
  open: isOrderOpen(o.status),
  cancelled: o.status === 'cancelled',
  qcPassed: o.status === 'ready_for_delivery' || o.status === 'completed',
  totalVnd: o.totalVnd,
  customerId: o.customerId,
  customerName: o.customerName,
  plate: o.plate,
});

export function recOrderSource(getRec: () => RecDeps): OrderSource {
  return {
    async get(scope: Scope, id: string) {
      const o = await getRec().orders.get(scope, id);
      return o ? toPayable(o) : null;
    },
    async getInTx(tx: Tx, scope: Scope, id: string) {
      const o = await getRec().orders.getInTx(tx, scope, id);
      return o ? toPayable(o) : null;
    },
    async getMany(companyId: string, ids: readonly string[]) {
      return (await getRec().orders.getMany(companyId, ids)).map(toPayable);
    },
    async listOpen(scope: Scope, limit: number) {
      return (await getRec().orders.listOpen(scope, limit)).map(toPayable);
    },
  };
}

export function buildAcc(sys: SysDeps, store: DocStore, getRec: () => RecDeps): AccDeps {
  return {
    sys,
    orders: recOrderSource(getRec),
    payments: new DocPaymentRepository(store),
    accounts: new DocOrderAccountRepository(store),
    cash: new DocCashRepository(store),
    debts: new DocDebtRepository(store),
    acc: { ...DEFAULT_ACC_CONFIG, agingCuts: [...DEFAULT_ACC_CONFIG.agingCuts] },
  };
}

/** REC's view of ACC: the balance of an order inside the caller's transaction (R44). */
export function accPaymentGate(getAcc: () => AccDeps): PaymentGate {
  return {
    async balanceInTx(tx, scope, orderId) {
      const b = await getOrderBalanceInTx(getAcc(), tx, scope, orderId);
      return {
        receivableVnd: b.receivableVnd,
        receivedVnd: b.receivedVnd,
        outstandingVnd: b.outstandingVnd,
        depositHeldVnd: b.depositHeldVnd,
        debt: b.debt
          ? {
              id: b.debt.id,
              amountVnd: b.debt.amountVnd,
              dueDate: b.debt.dueDate,
              approvalId: b.debt.approvalId,
            }
          : null,
      };
    },
  };
}
