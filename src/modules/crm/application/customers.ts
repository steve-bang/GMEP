import { AppError, validationFailed } from '@/platform/errors/errors';
import {
  decodeCursor,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  type Page,
} from '@/platform/pagination/pagination';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import type { PresentedPii } from '@/platform/pii/pii';
import { resolveScope, resolveWorkingScope, type Actor } from '@/platform/rbac/rbac';
import { businessDate } from '@/platform/format/date';
import { normalizeSearch } from '@/platform/text/normalize';
import { allocateDocumentNumber } from '@/modules/sys';
import {
  CUSTOMER_LABELS,
  type Customer,
  type CustomerPii,
  type CustomerType,
} from '../domain/entities';
import {
  isPlausiblePhone,
  isValidTaxCode,
  normalizePhone,
  normalizePlate,
  normalizeTaxCode,
} from '../domain/normalize';
import type { CrmDeps } from '../ports/deps';
import {
  accessEntry,
  auditEntry,
  idemOf,
  notFound,
  parseInput,
  PII_FIELDS,
  versionConflict,
  writableWorkingBranch,
  z,
  type RequestCtx,
} from './support';

export interface CustomerDto {
  id: string;
  code: string;
  type: CustomerType;
  name: string;
  taxCode: string | null;
  contactName: string | null;
  labels: string[];
  status: string;
  vehicleCount: number;
  marketing: string[];
  branchId: string;
  branchIds: string[];
  createdAt: string;
  version: number;
  phone: PresentedPii;
  email: PresentedPii;
  address: PresentedPii;
}

/**
 * Serializer: personal fields pass through PiiPolicy for the actor's roles, so a masked/hidden
 * field never carries its full value (NFR-SEC-03). Every customer response is built here.
 */
export function toCustomerDto(
  deps: CrmDeps,
  actor: Actor,
  c: Customer,
  pii: CustomerPii | null,
): CustomerDto {
  return {
    id: c.id,
    code: c.code,
    type: c.type,
    name: c.name,
    taxCode: c.taxCode ?? null,
    contactName: c.contactName ?? null,
    labels: c.labels,
    status: c.status,
    vehicleCount: c.vehicleCount,
    marketing: c.marketing,
    branchId: c.branchId,
    branchIds: c.branchIds,
    createdAt: c.createdAt.toISOString(),
    version: c.version,
    phone: deps.sys.pii.present(actor, 'phone', pii?.phone),
    email: deps.sys.pii.present(actor, 'email', pii?.email),
    address: deps.sys.pii.present(actor, 'address', pii?.address),
  };
}

// ---- list / search -----------------------------------------------------------------

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  cursor: z.string().max(512).optional(),
  q: z.string().trim().max(100).optional(),
  type: z.enum(['individual', 'business']).optional(),
  direction: z.enum(['asc', 'desc']).default('asc'),
});

export const MIN_PHONE_SEARCH_DIGITS = 4;
/** Phone and plate searches look at most this many matches (BA §11: first 50). */
const SEARCH_BOUND = 50;

/** `capped` = more matches exist than shown: the UI must say "N+ kết quả, hãy nhập thêm" (C12). */
export type SearchPage<T> = Page<T> & { capped: boolean };

/** Search mode from the shape of the text (FR-CRM-001 search by name, phone or plate). */
export function searchMode(q: string): 'phone' | 'plate' | 'name' {
  // C12: a phone search needs at least 4 digits so the list cannot be browsed by "0"
  if (/^[\d\s.+-]+$/.test(q) && q.replace(/\D/g, '').length >= MIN_PHONE_SEARCH_DIGITS)
    return 'phone';
  if (/^\d{2}\s?[A-Za-z]{1,2}[\s.-]?\d/.test(q)) return 'plate';
  return 'name';
}

/**
 * FR-CRM-001/002: list and diacritics-insensitive search inside the working scope of `customer:view`
 * (NFR-ISO-01). Phone and plate searches return at most one bounded batch (no cursor), name search pages.
 */
export async function listCustomers(
  deps: CrmDeps,
  actor: Actor,
  raw: unknown,
): Promise<SearchPage<Customer>> {
  const scope = resolveWorkingScope(actor, 'customer:view');
  const q = parseInput(listSchema, raw);
  const text = q.q ?? '';
  const mode = text ? searchMode(text) : 'name';
  if (mode === 'name')
    return {
      ...(await deps.customers.list(scope, {
        direction: q.direction,
        limit: q.limit,
        ...(q.type ? { type: q.type } : {}),
        ...(text ? { namePrefix: normalizeSearch(text) } : {}),
        ...(q.cursor ? { cursor: decodeCursor(q.cursor)! } : {}),
      })),
      capped: false,
    };
  let ids: string[];
  let capped = false;
  if (mode === 'phone') {
    // one extra row tells whether the bound cut the list
    ids = await deps.customers.customerIdsByPhone(
      actor.tenantId,
      normalizePhone(text),
      'prefix',
      SEARCH_BOUND + 1,
    );
    capped = ids.length > SEARCH_BOUND;
    ids = ids.slice(0, SEARCH_BOUND);
  } else {
    const vs = await deps.vehicles.list(scope, {
      platePrefix: normalizePlate(text),
      direction: 'asc',
      limit: SEARCH_BOUND,
    });
    capped = vs.nextCursor !== null;
    ids = vs.items.flatMap((v) => (v.currentOwnerId ? [v.currentOwnerId] : []));
  }
  const found = await deps.customers.getMany(scope, [...new Set(ids)]);
  const matches = found
    .filter((c) => !q.type || c.type === q.type)
    .sort((a, b) => (a.nameNorm < b.nameNorm ? -1 : a.nameNorm > b.nameNorm ? 1 : 0));
  return {
    items: matches.slice(0, q.limit),
    nextCursor: null,
    capped: capped || matches.length > q.limit,
  };
}

export async function listCustomerDtos(
  deps: CrmDeps,
  actor: Actor,
  raw: unknown,
): Promise<SearchPage<CustomerDto>> {
  const page = await listCustomers(deps, actor, raw);
  const piis = await Promise.all(
    page.items.map((c) => deps.customers.getPii(actor.tenantId, c.id)),
  );
  return {
    items: page.items.map((c, i) => toCustomerDto(deps, actor, c, piis[i] ?? null)),
    nextCursor: page.nextCursor,
    capped: page.capped,
  };
}

/**
 * Detail. Out-of-scope behaves exactly like missing (NFR-ISO-01). Opening the record as a role that
 * sees personal data in full is written to the access log once per open (BA §7.3 event 1).
 */
export async function getCustomer(
  deps: CrmDeps,
  actor: Actor,
  id: string,
  ctx: { requestId: string; sessionId?: string },
): Promise<CustomerDto> {
  const scope = resolveScope(actor, 'customer:view');
  const c = await deps.customers.get(scope, id);
  if (!c) throw notFound();
  const pii = await deps.customers.getPii(actor.tenantId, id);
  const dto = toCustomerDto(deps, actor, c, pii);
  const seenFull = PII_FIELDS.filter((f) => deps.sys.pii.level(actor, f) === 'full' && !!pii?.[f]);
  if (seenFull.length)
    await deps.sys.piiLog.record(
      accessEntry(deps, actor, ctx.sessionId, ctx.requestId, {
        entityType: 'customer',
        entityId: id,
        purpose: 'open_record',
        fields: [...seenFull],
        branchId: c.branchId,
      }),
    );
  return dto;
}

// ---- create / update ---------------------------------------------------------------

const text = (max: number) => z.string().trim().max(max);
const optText = (max: number) => text(max).optional();

const baseFields = {
  name: z.string().trim().min(2).max(120),
  phone: optText(20),
  email: z.string().trim().max(120).email().optional().or(z.literal('')),
  address: optText(300),
  taxCode: optText(14),
  contactName: optText(120),
  labels: z.array(z.enum(CUSTOMER_LABELS)).max(CUSTOMER_LABELS.length).optional(),
};

export const createCustomerSchema = z.object({
  type: z.enum(['individual', 'business']),
  ...baseFields,
});

/** Cross-field checks that do not belong in zod (messages in Vietnamese for the field). */
function checkCustomerFields(d: { type: CustomerType; phone?: string; taxCode?: string }): {
  phoneNorm?: string;
  taxCode?: string;
} {
  const errors: { field: string; message: string }[] = [];
  let phoneNorm: string | undefined;
  if (d.phone) {
    phoneNorm = normalizePhone(d.phone);
    if (!isPlausiblePhone(phoneNorm))
      errors.push({
        field: 'phone',
        message: 'Số điện thoại chưa đúng (10 hoặc 11 số, bắt đầu bằng 0).',
      });
  }
  let taxCode: string | undefined;
  if (d.taxCode) {
    taxCode = normalizeTaxCode(d.taxCode);
    if (!isValidTaxCode(taxCode))
      errors.push({ field: 'taxCode', message: 'Mã số thuế gồm 10 số, có thể kèm -NNN.' });
    if (d.type === 'individual')
      errors.push({ field: 'taxCode', message: 'Chỉ khách doanh nghiệp có mã số thuế.' });
  }
  if (errors.length) throw validationFailed(errors);
  return { ...(phoneNorm ? { phoneNorm } : {}), ...(taxCode ? { taxCode } : {}) };
}

/**
 * FR-CRM-001: individual or business customer (legal name, MST), created at the working branch.
 * Idempotent (Idempotency-Key); audit in the same transaction; contact data goes to the separate
 * `customerPii` document and the audit log only records that it changed (DM-8).
 */
export async function createCustomer(
  deps: CrmDeps,
  actor: Actor,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'customer:create');
  const data = parseInput(createCustomerSchema, input);
  const checked = checkCustomerFields(data);
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: 'POST /api/v1/crm/customers',
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf(data),
    },
    async (tx) => {
      const branch = await writableWorkingBranch(deps, tx, actor, scope);
      const now = deps.sys.clock.now();
      const id = `cus_${deps.sys.newId()}`;
      const num = await allocateDocumentNumber(deps.sys, tx, {
        branch,
        docType: 'customer',
        businessDate: businessDate(now),
        stage: 'create',
        documentId: id,
        requestKey: `${ctx.idempotencyKey}`,
      });
      const customer: Customer = {
        id,
        tenantId: actor.tenantId,
        branchId: branch.id,
        code: num.number!,
        type: data.type,
        name: data.name,
        nameNorm: normalizeSearch(data.name),
        ...(checked.taxCode ? { taxCode: checked.taxCode } : {}),
        ...(data.contactName ? { contactName: data.contactName } : {}),
        labels: data.labels ?? [],
        status: 'active',
        vehicleCount: 0,
        marketing: [],
        branchIds: [branch.id],
        createdAt: now,
        createdBy: actor.userId,
        updatedAt: now,
        updatedBy: actor.userId,
        version: 1,
      };
      const pii: CustomerPii = {
        customerId: id,
        tenantId: actor.tenantId,
        ...(data.phone ? { phone: data.phone, phoneNorm: checked.phoneNorm! } : {}),
        ...(data.email ? { email: data.email } : {}),
        ...(data.address ? { address: data.address } : {}),
        createdAt: now,
      };
      deps.customers.create(tx, customer, pii);
      deps.customers.link(tx, customer, branch.id, now, { source: 'created', by: actor.userId });
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: branch.id,
          entityType: 'customer',
          entityId: id,
          action: 'customer.create',
          after: {
            code: customer.code,
            type: customer.type,
            taxCode: customer.taxCode,
            labels: customer.labels,
            phone: pii.phone,
            email: pii.email,
            address: pii.address,
          },
        }),
      );
      // response of record: the creator sees the masked/full view their role allows
      return { status: 201, body: toCustomerDto(deps, actor, customer, pii) };
    },
  );
}

export const updateCustomerSchema = z.object({
  name: baseFields.name.optional(),
  phone: z.string().trim().max(20).nullable().optional(),
  email: z.string().trim().max(120).email().nullable().optional().or(z.literal('')),
  address: z.string().trim().max(300).nullable().optional(),
  taxCode: z.string().trim().max(14).nullable().optional(),
  contactName: z.string().trim().max(120).nullable().optional(),
  labels: z.array(z.enum(CUSTOMER_LABELS)).max(CUSTOMER_LABELS.length).optional(),
  /** optimistic locking */
  version: z.number().int().min(1),
});

export async function updateCustomer(
  deps: CrmDeps,
  actor: Actor,
  id: string,
  input: unknown,
  ctx: RequestCtx,
): Promise<CustomerDto> {
  const scope = resolveScope(actor, 'customer:update');
  const data = parseInput(updateCustomerSchema, input);
  return deps.sys.uow.run(async (tx) => {
    const c = await deps.customers.getInTx(tx, scope, id);
    if (!c) throw notFound();
    if (c.status === 'anonymized') throw new AppError('customer_anonymized', 409);
    if (c.version !== data.version) throw versionConflict();
    const pii = await deps.customers.getPiiInTx(tx, actor.tenantId, id);
    await writableWorkingBranch(deps, tx, actor, scope, 'edit_master');

    const checked = checkCustomerFields({
      type: c.type,
      ...(data.phone ? { phone: data.phone } : {}),
      ...(data.taxCode ? { taxCode: data.taxCode } : {}),
    });
    const nextName = data.name ?? c.name;
    const patch: Record<string, unknown> = {
      name: nextName,
      nameNorm: normalizeSearch(nextName),
      labels: data.labels ?? c.labels,
      updatedAt: deps.sys.clock.now(),
      updatedBy: actor.userId,
      version: c.version + 1,
    };
    if (data.taxCode !== undefined) patch.taxCode = checked.taxCode ?? null;
    if (data.contactName !== undefined) patch.contactName = data.contactName || null;
    deps.customers.update(tx, id, patch);

    const piiPatch: Record<string, unknown> = {};
    if (data.phone !== undefined) {
      piiPatch.phone = data.phone || null;
      piiPatch.phoneNorm = checked.phoneNorm ?? null;
    }
    if (data.email !== undefined) piiPatch.email = data.email || null;
    if (data.address !== undefined) piiPatch.address = data.address || null;
    if (Object.keys(piiPatch).length) deps.customers.setPii(tx, id, piiPatch);

    const next: Customer = { ...c, ...(patch as Partial<Customer>) };
    deps.customers.relink(tx, next);
    deps.sys.audit.record(
      tx,
      auditEntry(deps.sys, actor, ctx, {
        branchId: c.branchId,
        entityType: 'customer',
        entityId: id,
        action: 'customer.update',
        // the name is personal data too: the log keeps that it changed, never the value (anonymisation would not reach the log)
        before: {
          taxCode: c.taxCode,
          labels: c.labels,
          phone: pii?.phone,
          email: pii?.email,
          address: pii?.address,
        },
        after: {
          nameChanged: next.name !== c.name,
          taxCode: data.taxCode !== undefined ? (checked.taxCode ?? null) : c.taxCode,
          labels: next.labels,
          phone: data.phone !== undefined ? (data.phone ?? null) : pii?.phone,
          email: data.email !== undefined ? (data.email ?? null) : pii?.email,
          address: data.address !== undefined ? (data.address ?? null) : pii?.address,
        },
      }),
    );
    const merged = {
      ...(pii ?? { customerId: id, tenantId: actor.tenantId, createdAt: c.createdAt }),
      ...piiPatch,
    } as CustomerPii;
    return toCustomerDto(deps, actor, next, merged);
  });
}
