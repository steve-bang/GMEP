import { businessDate } from '@/platform/format/date';
import { resolveScope, type Actor } from '@/platform/rbac/rbac';
import type { Tx } from '@/platform/tx/unitOfWork';
import {
  allocateDocumentNumber,
  resolveCatalogAt,
  resolveConfigAt,
  type Branch,
} from '@/modules/sys';
import type { RecDeps } from '../ports/deps';
import { AppError } from './support';

/**
 * What slice 1.6 (repair order) needs from slice 1.5 besides the approved lines (`getApprovedQuote`):
 * the order code and the workflow of the service type. Neither creates an order.
 */

/**
 * FR-REC-030: the repair order code is allocated by the numbering service of the branch and period
 * (series `repair-order`, effective-dated config), unique per company and idempotent per `requestKey`
 * (a retried request gets the same code). Must run in the transaction that creates the order.
 */
export async function allocateRepairOrderNumber(
  deps: RecDeps,
  tx: Tx,
  p: { branch: Branch; orderId: string; businessDate: string; requestKey: string },
): Promise<string> {
  const r = await allocateDocumentNumber(deps.sys, tx, {
    branch: p.branch,
    docType: 'repair-order',
    businessDate: p.businessDate,
    stage: 'create',
    documentId: p.orderId,
    requestKey: p.requestKey,
  });
  if (!r.number) throw new AppError('order_number_unavailable', 409);
  return r.number;
}

export interface WorkflowStep {
  code: string;
  name: string;
  responsibleRole?: string;
  /** R36 */
  expectedDays?: number;
  countsTowardLabor?: boolean;
}
export interface ServiceWorkflowDto {
  serviceType: string;
  versionId: string;
  effectiveFrom: string;
  steps: WorkflowStep[];
}

/**
 * FR-REC-032 / BR-REC-13: the steps configured for a service type on a date (effective-dated config
 * `service-workflow`). Two types can have two different step sets on the same order. Returns null when
 * the type has no workflow configured (the order then has no steps; nothing is assumed).
 */
export async function getServiceWorkflow(
  deps: RecDeps,
  actor: Actor,
  serviceType: string,
  date: string = businessDate(deps.sys.clock.now()),
): Promise<ServiceWorkflowDto | null> {
  resolveScope(actor, 'intake:view');
  const c = await resolveConfigAt(deps.sys, {
    companyId: actor.companyId,
    type: 'service-workflow',
    scopeKey: serviceType,
    date,
  });
  if (!c) return null;
  return {
    serviceType,
    versionId: c.versionId,
    effectiveFrom: c.effectiveFrom,
    steps: (c.payload as { steps: WorkflowStep[] }).steps,
  };
}

export async function listServiceWorkflows(
  deps: RecDeps,
  actor: Actor,
  date: string = businessDate(deps.sys.clock.now()),
): Promise<{ serviceType: string; steps: WorkflowStep[] }[]> {
  resolveScope(actor, 'intake:view');
  return (
    await resolveCatalogAt(deps.sys, { companyId: actor.companyId, type: 'service-workflow', date })
  ).map((r) => ({ serviceType: r.code, steps: (r.payload as { steps: WorkflowStep[] }).steps }));
}
