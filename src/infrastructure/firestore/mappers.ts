import type { Timestamp } from 'firebase-admin/firestore';
import type { AuditEntry } from '@/platform/audit/audit';
import type { Branch, Role, SessionRecord, User, Warehouse } from '@/modules/sys';

/** Document <-> entity mapping. Timestamps become Dates; ids come from the document id. */
type Doc = Record<string, unknown>;
const d = (t: unknown): Date => (t as Timestamp).toDate();

export const userFromDoc = (id: string, x: Doc): User => ({
  id,
  companyId: x.companyId as string,
  email: x.email as string,
  employeeCode: x.employeeCode as string,
  displayName: x.displayName as string,
  status: x.status as User['status'],
});

export const roleFromDoc = (code: string, x: Doc): Role => ({
  code,
  name: x.name as string,
  permissions: (x.permissions as string[]) ?? [],
});

export const branchFromDoc = (id: string, x: Doc): Branch => ({
  id,
  companyId: x.companyId as string,
  code: x.code as string,
  name: x.name as string,
  status: x.status as Branch['status'],
});

export const warehouseFromDoc = (id: string, x: Doc): Warehouse => ({
  id,
  companyId: x.companyId as string,
  branchId: x.branchId as string,
  code: x.code as string,
  name: x.name as string,
  nameNorm: x.nameNorm as string,
  status: x.status as Warehouse['status'],
  createdAt: d(x.createdAt),
  createdBy: x.createdBy as string,
  updatedAt: d(x.updatedAt),
  updatedBy: x.updatedBy as string,
  version: x.version as number,
});

export const warehouseToDoc = (w: Warehouse): Doc => {
  const { id: _id, ...rest } = w;
  void _id;
  return rest;
};

export const sessionFromDoc = (id: string, x: Doc): SessionRecord => ({
  id,
  userId: x.userId as string,
  createdAt: d(x.createdAt),
  expiresAt: d(x.expiresAt),
  lastSeenAt: d(x.lastSeenAt),
  revokedAt: x.revokedAt ? d(x.revokedAt) : null,
});

export const auditFromDoc = (id: string, x: Doc): AuditEntry => ({
  id,
  at: d(x.at),
  companyId: x.companyId as string,
  branchId: (x.branchId as string | null) ?? null,
  actorId: x.actorId as string,
  actorRoles: (x.actorRoles as string[]) ?? [],
  entityType: x.entityType as string,
  entityId: x.entityId as string,
  action: x.action as string,
  before: (x.before as Record<string, unknown> | null) ?? null,
  after: (x.after as Record<string, unknown> | null) ?? null,
  ...(x.reason ? { reason: x.reason as string } : {}),
  requestId: x.requestId as string,
});
