/**
 * One-time, idempotent bootstrap of the MINIMUM data a real environment (staging, prod) needs to be logged into:
 * company, first branch, its main warehouse, the 10 default roles, and the owner (CH) account in `invited` status.
 *
 * Rules (security checklist 9, FR-SYS-001/002/012):
 *  - everything comes from environment variables; NO password and NO secret is stored or embedded. The owner gets an
 *    unknown random password and a single-use activation link (72 h, only its sha256 is stored) printed once;
 *  - NO demo data (see `demo.ts`, emulator only);
 *  - re-running creates only what is missing and never overwrites (roles keep edits, ids are deterministic);
 *  - legal-entity model [Cần xác nhận]: `legalEntityIds` stays empty, to be configured later (one or several entities).
 * Effective-dated configuration (tax, labor, price limits, numbering, e-invoice issuer) is NOT created here: the
 * accountant's values are entered through the admin screens.
 */
import { z } from 'zod';
import {
  BRANCH_CODE_PATTERN,
  defaultRoleSeeds,
  newOpaqueToken,
  normalizeEmployeeCode,
  roleAssignmentId,
  warehouseId,
  type Branch,
  type User,
  type Warehouse,
} from '@/modules/sys';
import type { DocData } from '@/platform/store/docStore';
import { normalizeSearch } from '@/platform/text/normalize';
import { COL } from '../repos/queries';
import { userToDoc, warehouseToDoc } from '../repos/repos';
import type { SeedDoc } from './types';

const idPart = z
  .string()
  .trim()
  .regex(/^[a-z0-9_]{3,40}$/, 'must be 3-40 chars of a-z, 0-9, _');

const bootstrapSchema = z.object({
  /** must equal GCLOUD_PROJECT: a typo cannot write to the wrong project */
  BOOTSTRAP_CONFIRM_PROJECT: z.string().min(1),
  BOOTSTRAP_TENANT_ID: idPart.default('tnt_main'),
  BOOTSTRAP_TENANT_NAME: z.string().trim().min(2).max(120),
  BOOTSTRAP_BRANCH_CODE: z.string().trim().toUpperCase().regex(BRANCH_CODE_PATTERN),
  BOOTSTRAP_BRANCH_NAME: z.string().trim().min(2).max(120),
  BOOTSTRAP_WAREHOUSE_CODE: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,20}$/)
    .default('WH-CHINH'),
  BOOTSTRAP_WAREHOUSE_NAME: z.string().trim().min(2).max(120).optional(),
  BOOTSTRAP_OWNER_EMAIL: z.string().trim().toLowerCase().email(),
  BOOTSTRAP_OWNER_NAME: z.string().trim().min(2).max(120),
  BOOTSTRAP_OWNER_CODE: z.string().trim().min(2).max(20).default('NV0001'),
  /** `1` = issue a new activation link for an owner who is still `invited` (lost link) */
  BOOTSTRAP_REISSUE_INVITE: z.enum(['0', '1']).default('0'),
});

export interface BootstrapConfig {
  tenantId: string;
  tenantName: string;
  branchCode: string;
  branchName: string;
  warehouseCode: string;
  warehouseName: string;
  ownerEmail: string;
  ownerName: string;
  ownerCode: string;
  reissueInvite: boolean;
}

/** Validates the bootstrap variables; the error lists every missing/invalid name (never a value). */
export function loadBootstrapConfig(
  source: Record<string, string | undefined>,
  gcloudProject: string,
): BootstrapConfig {
  const parsed = bootstrapSchema.safeParse(source);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
    throw new Error(`Bootstrap configuration missing or invalid: ${names.join(', ')}`);
  }
  const e = parsed.data;
  if (e.BOOTSTRAP_CONFIRM_PROJECT !== gcloudProject)
    throw new Error('BOOTSTRAP_CONFIRM_PROJECT must equal GCLOUD_PROJECT (refusing to continue).');
  return {
    tenantId: e.BOOTSTRAP_TENANT_ID,
    tenantName: e.BOOTSTRAP_TENANT_NAME,
    branchCode: e.BOOTSTRAP_BRANCH_CODE,
    branchName: e.BOOTSTRAP_BRANCH_NAME,
    warehouseCode: e.BOOTSTRAP_WAREHOUSE_CODE,
    warehouseName: e.BOOTSTRAP_WAREHOUSE_NAME ?? `Kho chính ${e.BOOTSTRAP_BRANCH_NAME}`,
    ownerEmail: e.BOOTSTRAP_OWNER_EMAIL,
    ownerName: e.BOOTSTRAP_OWNER_NAME,
    ownerCode: normalizeEmployeeCode(e.BOOTSTRAP_OWNER_CODE),
    reissueInvite: e.BOOTSTRAP_REISSUE_INVITE === '1',
  };
}

export const OWNER_USER_ID = 'u_owner';

/** The documents of the minimum data set, with deterministic ids so a re-run finds them. */
export function bootstrapDocs(cfg: BootstrapConfig, now: Date): SeedDoc[] {
  const docs: SeedDoc[] = [];
  const put = (collection: string, id: string, data: DocData) =>
    docs.push({ collection, id, data });
  const audit = { createdAt: now, createdBy: 'bootstrap', updatedAt: now, updatedBy: 'bootstrap' };
  put(COL.tenants, cfg.tenantId, { name: cfg.tenantName, legalEntityIds: [] });
  for (const r of defaultRoleSeeds())
    put(COL.roles, r.code, {
      name: r.name,
      permissions: r.permissions,
      canConsolidate: r.canConsolidate,
      appliedTopUps: r.appliedTopUps,
    });
  const branch: Branch = {
    id: `br_${cfg.branchCode.toLowerCase()}`,
    tenantId: cfg.tenantId,
    code: cfg.branchCode,
    name: cfg.branchName,
    status: 'active',
    ...audit,
    version: 1,
  };
  const { id: branchId, ...branchRest } = branch;
  put(COL.branches, branchId, branchRest);
  put('branchCodes', `${cfg.tenantId}__${cfg.branchCode}`, { branchId });
  const wh: Warehouse = {
    id: warehouseId(branchId, cfg.warehouseCode),
    tenantId: cfg.tenantId,
    branchId,
    code: cfg.warehouseCode,
    name: cfg.warehouseName,
    nameNorm: normalizeSearch(cfg.warehouseName),
    status: 'active',
    isDefault: true,
    ...audit,
    version: 1,
  };
  put(COL.warehouses, wh.id, warehouseToDoc(wh));
  const owner: User = {
    id: OWNER_USER_ID,
    tenantId: cfg.tenantId,
    email: cfg.ownerEmail,
    employeeCode: cfg.ownerCode,
    displayName: cfg.ownerName,
    status: 'invited',
    ...audit,
    version: 1,
  };
  put(COL.users, owner.id, userToDoc(owner));
  put(COL.userKeys, `email__${owner.email.toLowerCase()}`, { userId: owner.id });
  put(COL.userKeys, `code__${owner.tenantId}__${owner.employeeCode}`, { userId: owner.id });
  put(COL.roleAssignments, roleAssignmentId(owner.id, 'CH', '*'), {
    userId: owner.id,
    tenantId: cfg.tenantId,
    roleCode: 'CH',
    branchId: '*',
    employeeCode: owner.employeeCode,
    createdAt: now,
    createdBy: 'bootstrap',
  });
  return docs;
}

export interface BootstrapStore {
  get(collection: string, id: string): Promise<DocData | null>;
  /** must fail if the document exists (never overwrite) */
  create(collection: string, id: string, data: DocData): Promise<void>;
}
export interface BootstrapIdentity {
  /** creates the account with a random unknown password if the uid does not exist yet */
  ensureUser(input: { uid: string; email: string; displayName: string }): Promise<void>;
}

export interface BootstrapResult {
  created: string[];
  skipped: string[];
  /** single-use activation link of the owner, shown once; null when no new link was issued */
  activationLink: string | null;
}

export async function runBootstrap(
  cfg: BootstrapConfig,
  io: { store: BootstrapStore; identity: BootstrapIdentity; now: Date; appBaseUrl: string },
): Promise<BootstrapResult> {
  const created: string[] = [];
  const skipped: string[] = [];
  const existingOwner = await io.store.get(COL.users, OWNER_USER_ID);
  if (existingOwner && existingOwner.email !== cfg.ownerEmail)
    throw new Error('An owner already exists with a different email; refusing to continue.');
  for (const d of bootstrapDocs(cfg, io.now)) {
    if (await io.store.get(d.collection, d.id)) {
      skipped.push(`${d.collection}/${d.id}`);
      continue;
    }
    await io.store.create(d.collection, d.id, d.data);
    created.push(`${d.collection}/${d.id}`);
  }
  await io.identity.ensureUser({
    uid: OWNER_USER_ID,
    email: cfg.ownerEmail,
    displayName: cfg.ownerName,
  });
  const owner = await io.store.get(COL.users, OWNER_USER_ID);
  const needsLink = owner?.status === 'invited' && (!existingOwner || cfg.reissueInvite);
  let activationLink: string | null = null;
  if (needsLink) {
    const { raw, id } = newOpaqueToken();
    await io.store.create(COL.authTokens, id, {
      kind: 'invite',
      userId: OWNER_USER_ID,
      tenantId: cfg.tenantId,
      createdAt: io.now,
      expiresAt: new Date(io.now.getTime() + 72 * 3_600_000),
      usedAt: null,
      revokedAt: null,
    });
    created.push(`${COL.authTokens}/<hash>`);
    activationLink = `${io.appBaseUrl.replace(/\/$/, '')}/activate?token=${encodeURIComponent(raw)}`;
  }
  return { created, skipped, activationLink };
}
