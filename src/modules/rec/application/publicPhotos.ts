import type { Scope } from '@/platform/scope/scope';
import type { PhotoRef, Quote } from '../domain/entities';
import type { RecDeps } from '../ports/deps';
import type { PhotoParent } from './photos';

/**
 * FR-REC-034: photos the customer sees on the quote link. Information only (never part of the approval).
 * Which photos: the vehicle-condition photos of the intake the quote is for, and, on a supplementary quote, the
 * photos the technician attached to the proposal that became this quote (FR-REC-014). Photos carry no link to a
 * quote item, so they are shown as one gallery, not per item. R104: a hidden photo never leaves the staff screens.
 */
export interface PublicPhotoDto {
  /** reference only: the bytes are served by the token-authenticated read route, never by a storage URL */
  id: string;
  caption: string | null;
  kind: 'intake' | 'proposal';
}

export interface PublicPhotoSource {
  parent: PhotoParent;
  /** id of the intake or order that owns the photo */
  parentId: string;
  tenantId: string;
  branchId: string;
  kind: PublicPhotoDto['kind'];
  ref: PhotoRef;
}

interface PhotoOwner {
  id: string;
  tenantId: string;
  branchId: string;
  photos?: readonly PhotoRef[];
}

/** Pure filter: what of the given records may reach a customer. Intake photos, then proposal photos, hidden ones dropped. */
export function publicPhotoSources(input: {
  intake: PhotoOwner | null;
  order: (PhotoOwner & { proposals: readonly { id: string; quoteId?: string }[] }) | null;
  quoteId: string;
  max: number;
}): PublicPhotoSource[] {
  const out: PublicPhotoSource[] = [];
  const { intake, order } = input;
  if (intake)
    for (const ref of intake.photos ?? [])
      if (!ref.hidden)
        out.push({
          parent: 'intake',
          parentId: intake.id,
          tenantId: intake.tenantId,
          branchId: intake.branchId,
          kind: 'intake',
          ref,
        });
  if (order) {
    const mine = new Set(
      order.proposals.filter((p) => p.quoteId === input.quoteId).map((p) => p.id),
    );
    for (const ref of order.photos ?? [])
      if (!ref.hidden && ref.proposalId && mine.has(ref.proposalId))
        out.push({
          parent: 'order',
          parentId: order.id,
          tenantId: order.tenantId,
          branchId: order.branchId,
          kind: 'proposal',
          ref,
        });
  }
  return out.slice(0, input.max);
}

/** Loads the quote's records inside the link's branch scope and applies the filter. */
export async function loadPublicPhotoSources(
  deps: RecDeps,
  scope: Scope,
  q: Pick<Quote, 'id' | 'intakeId' | 'supplementOfOrderId'>,
): Promise<PublicPhotoSource[]> {
  const intake = await deps.intakes.get(scope, q.intakeId);
  const order = q.supplementOfOrderId ? await deps.orders.get(scope, q.supplementOfOrderId) : null;
  return publicPhotoSources({ intake, order, quoteId: q.id, max: deps.rec.maxPhotosPerRecord });
}

export const toPublicPhotoDto = (s: PublicPhotoSource): PublicPhotoDto => ({
  id: s.ref.id,
  caption: s.ref.caption ?? null,
  kind: s.kind,
});
