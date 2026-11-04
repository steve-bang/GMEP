import { createHash } from 'node:crypto';
import { z } from 'zod';
import { filePath } from '@/platform/files/fileStore';
import { fingerprintOf, runIdempotent } from '@/platform/idempotency/idempotency';
import { hasPermission, resolveScope, type Actor, type Permission } from '@/platform/rbac/rbac';
import type { Scope } from '@/platform/scope/scope';
import type { Tx } from '@/platform/tx/unitOfWork';
import type { PhotoRef } from '../domain/entities';
import { stripImageMetadata } from '../domain/imageMeta';
import { isOrderOpen } from '../domain/orderState';
import type { RecDeps } from '../ports/deps';
import {
  AppError,
  assertWritable,
  auditEntry,
  idemOf,
  notFound,
  parseInput,
  type RequestCtx,
} from './support';

/**
 * Photos on an intake (vehicle condition at the counter) and on a repair order (damage found, work proof; FR-REC-014
 * "thợ tạo đề xuất kèm ảnh"). The browser uploads through this API only; bytes go to the FileStore under a
 * server-chosen, branch-prefixed path and the record keeps a reference (hash, size, type). A photo is read back only
 * through the API after the Scope check of its record (NFR-ISO-01); nothing is public. Photos are never deleted by
 * users (evidence of the vehicle's condition); they go with the record's retention.
 * Content type comes from the file's own bytes, not from the client's declared type.
 */
export type PhotoParent = 'intake' | 'order';

const captionSchema = z.object({
  caption: z.string().trim().max(200).optional(),
  proposalId: z.string().trim().min(1).max(128).optional(),
});

/** type by magic bytes: JPEG, PNG, WebP only (no SVG: it can carry script) */
export function sniffImage(b: Uint8Array): PhotoRef['contentType'] | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v))
    return 'image/png';
  if (
    b.length >= 12 &&
    String.fromCharCode(...b.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...b.slice(8, 12)) === 'WEBP'
  )
    return 'image/webp';
  return null;
}

const EXT: Record<PhotoRef['contentType'], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** who may add / see photos of each parent (resolveScope throws forbidden when none is held) */
const WRITE: Record<PhotoParent, Permission[]> = {
  intake: ['intake:update'],
  order: ['repair-order:update', 'work-proposal:create'],
};
const READ: Record<PhotoParent, Permission[]> = {
  intake: ['intake:view'],
  order: ['repair-order:view'],
};

function scopeFor(actor: Actor, perms: Permission[]): Scope {
  const p = perms.find((x) => hasPermission(actor, x)) ?? perms[0]!;
  return resolveScope(actor, p);
}

interface Parent {
  companyId: string;
  branchId: string;
  open: boolean;
  photos: PhotoRef[];
  proposalIds: string[];
}

async function load(
  deps: RecDeps,
  parent: PhotoParent,
  scope: Scope,
  id: string,
  tx?: Tx,
): Promise<Parent> {
  if (parent === 'intake') {
    const i = tx ? await deps.intakes.getInTx(tx, scope, id) : await deps.intakes.get(scope, id);
    if (!i) throw notFound();
    return {
      companyId: i.companyId,
      branchId: i.branchId,
      open: i.status === 'draft',
      photos: i.photos ?? [],
      proposalIds: [],
    };
  }
  const o = tx ? await deps.orders.getInTx(tx, scope, id) : await deps.orders.get(scope, id);
  if (!o) throw notFound();
  return {
    companyId: o.companyId,
    branchId: o.branchId,
    open: isOrderOpen(o.status),
    photos: o.photos ?? [],
    proposalIds: o.proposals.map((p) => p.id),
  };
}

export async function addPhoto(
  deps: RecDeps,
  actor: Actor,
  parent: PhotoParent,
  id: string,
  input: { bytes: Buffer; caption?: unknown; proposalId?: unknown },
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = scopeFor(actor, WRITE[parent]);
  const data = parseInput(captionSchema, {
    ...(typeof input.caption === 'string' && input.caption ? { caption: input.caption } : {}),
    ...(typeof input.proposalId === 'string' && input.proposalId
      ? { proposalId: input.proposalId }
      : {}),
  });
  const p0 = await load(deps, parent, scope, id);
  // a technician (no right to edit the order) photographs only an order where an item is assigned to them
  if (parent === 'order' && !hasPermission(actor, 'repair-order:update')) {
    const mine = (await deps.items.listByOrder(scope, id, deps.rec.maxItemsPerOrder)).some(
      (i) => i.technicianId === actor.userId,
    );
    if (!mine) throw notFound();
  }
  if (input.bytes.length === 0 || input.bytes.length > deps.rec.photoMaxBytes)
    throw new AppError('photo_invalid', 422);
  const contentType = sniffImage(input.bytes);
  if (!contentType) throw new AppError('photo_invalid', 422);
  // R104 / PDPL: GPS and other metadata are removed before anything is stored (the hash and size are of what is kept)
  const clean = stripImageMetadata(input.bytes, contentType);
  if (!clean) throw new AppError('photo_invalid', 422);
  const bytes = Buffer.from(clean);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const photoId = `ph_${sha256.slice(0, 20)}`;
  const path = filePath(
    `rec-photos-${parent}`,
    p0.companyId,
    p0.branchId,
    `${id}_${photoId}.${EXT[contentType]}`,
  );
  // bytes first (same bytes -> same path, so a retry rewrites the same object); the reference is added atomically below
  await deps.files.put(path, { bytes, contentType });
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/rec/${parent === 'intake' ? 'intakes' : 'orders'}/${id}/photos`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ id, sha256, ...data }),
    },
    async (tx) => {
      const p = await load(deps, parent, scope, id, tx);
      if (!p.open)
        throw new AppError(parent === 'intake' ? 'state_invalid' : 'order_state_invalid', 409);
      if (data.proposalId && !p.proposalIds.includes(data.proposalId))
        throw new AppError('photo_invalid', 422);
      await assertWritable(deps, tx, actor, scope, p.branchId, 'edit_open_order');
      if (p.photos.some((x) => x.id === photoId)) return { status: 200, body: { id: photoId } };
      if (p.photos.length >= deps.rec.maxPhotosPerRecord) throw new AppError('photo_limit', 422);
      const now = deps.sys.clock.now();
      const ref: PhotoRef = {
        id: photoId,
        contentType,
        size: bytes.length,
        sha256,
        ...(data.caption ? { caption: data.caption } : {}),
        ...(data.proposalId ? { proposalId: data.proposalId } : {}),
        takenBy: actor.userId,
        takenAt: now,
      };
      // a separate field: adding evidence does not bump the record's version (no edit conflict for the screen)
      const patch = { photos: [...p.photos, ref], updatedAt: now, updatedBy: actor.userId };
      if (parent === 'intake') deps.intakes.update(tx, id, patch);
      else deps.orders.update(tx, id, patch);
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: p.branchId,
          entityType: parent === 'intake' ? 'intake' : 'repairOrder',
          entityId: id,
          action: `${parent === 'intake' ? 'intake' : 'repairOrder'}.photo-add`,
          after: { photoId, size: ref.size, contentType },
        }),
      );
      return { status: 201, body: { id: photoId } };
    },
  );
}

const hideSchema = z.object({ reason: z.string().trim().min(5).max(300) });

/**
 * R104: hides a wrongly uploaded photo (wrong vehicle, a person who should not be in it). Not a delete: the file and the
 * reference stay (evidence, retention), the photo just leaves the screens and the readers without `rec-photo:update`
 * (branch manager, owner). Reason required; audited in the same transaction. Hiding twice is a no-op.
 */
export async function hidePhoto(
  deps: RecDeps,
  actor: Actor,
  parent: PhotoParent,
  id: string,
  photoId: string,
  input: unknown,
  ctx: RequestCtx & { idempotencyKey: string },
) {
  const scope = resolveScope(actor, 'rec-photo:update');
  const data = parseInput(hideSchema, input);
  await load(deps, parent, scope, id); // 404 outside the scope before anything else
  return runIdempotent(
    idemOf(deps),
    {
      userId: actor.userId,
      route: `POST /api/v1/rec/${parent === 'intake' ? 'intakes' : 'orders'}/${id}/photos/${photoId}/hide`,
      key: ctx.idempotencyKey,
      fingerprint: fingerprintOf({ id, photoId, ...data }),
    },
    async (tx) => {
      const p = await load(deps, parent, scope, id, tx);
      const ref = p.photos.find((x) => x.id === photoId);
      if (!ref) throw notFound();
      if (ref.hidden) return { status: 200, body: { id: photoId, hidden: true } };
      await assertWritable(deps, tx, actor, scope, p.branchId, 'edit_open_order');
      const now = deps.sys.clock.now();
      const hidden = { at: now, by: actor.userId, reason: data.reason };
      const patch = {
        photos: p.photos.map((x) => (x.id === photoId ? { ...x, hidden } : x)),
        updatedAt: now,
        updatedBy: actor.userId,
      };
      if (parent === 'intake') deps.intakes.update(tx, id, patch);
      else deps.orders.update(tx, id, patch);
      deps.sys.audit.record(
        tx,
        auditEntry(deps.sys, actor, ctx, {
          branchId: p.branchId,
          entityType: parent === 'intake' ? 'intake' : 'repairOrder',
          entityId: id,
          action: `${parent === 'intake' ? 'intake' : 'repairOrder'}.photo-hide`,
          before: { photoId, hidden: false },
          after: { photoId, hidden: true },
          reason: data.reason,
        }),
      );
      return { status: 200, body: { id: photoId, hidden: true } };
    },
  );
}

/** Scope-checked read of one photo (the API serves the bytes; there is no public or signed URL in this slice). */
export async function readPhoto(
  deps: RecDeps,
  actor: Actor,
  parent: PhotoParent,
  id: string,
  photoId: string,
) {
  const scope = scopeFor(actor, READ[parent]);
  const p = await load(deps, parent, scope, id);
  const ref = p.photos.find((x) => x.id === photoId);
  if (!ref) throw notFound();
  // R104: a hidden photo is served only to someone who may hide photos
  if (ref.hidden && !hasPermission(actor, 'rec-photo:update')) throw notFound();
  const ext = EXT[ref.contentType];
  const file = await deps.files.get(
    filePath(`rec-photos-${parent}`, p.companyId, p.branchId, `${id}_${photoId}.${ext}`),
  );
  if (!file) throw notFound();
  return file;
}

export interface PhotoDto {
  id: string;
  contentType: string;
  size: number;
  caption: string | null;
  proposalId: string | null;
  takenBy: string;
  takenAt: string;
  /** R104: set only for readers with `rec-photo:update`, who see hidden photos marked as hidden */
  hidden: { at: string; by: string; reason: string } | null;
}

/** hidden photos (R104) are listed only when `includeHidden` (managers), always marked */
export const toPhotoDtos = (
  photos: readonly PhotoRef[] | undefined,
  includeHidden = false,
): PhotoDto[] =>
  (photos ?? [])
    .filter((p) => includeHidden || !p.hidden)
    .map((p) => ({
      hidden: p.hidden
        ? { at: p.hidden.at.toISOString(), by: p.hidden.by, reason: p.hidden.reason }
        : null,
      id: p.id,
      contentType: p.contentType,
      size: p.size,
      caption: p.caption ?? null,
      proposalId: p.proposalId ?? null,
      takenBy: p.takenBy,
      takenAt: p.takenAt.toISOString(),
    }));
