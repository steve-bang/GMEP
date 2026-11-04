import type { Reservation } from '../domain/entities';

/** Fields of a reservation that change after creation (shared by holds, releases and document postings). */
export const reservationPatch = (r: Reservation) => ({
  qty: r.qty,
  heldQty: r.heldQty,
  issuedQty: r.issuedQty,
  unmetQty: r.unmetQty,
  closed: r.closed,
  status: r.status,
  opCount: r.opCount,
  updatedAt: r.updatedAt,
  updatedBy: r.updatedBy,
  version: r.version,
});
