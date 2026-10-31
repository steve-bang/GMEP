import { createHash } from 'node:crypto';
import { AppError } from '../errors/errors';
import type { Tx, UnitOfWork } from '../tx/unitOfWork';

/**
 * Idempotency-Key support (plan §2.8, FR-EIN-013 pattern). The key document is created in the
 * SAME transaction as the business write and stores the response, so a repeated or concurrent
 * request returns the original result and never produces a second effect.
 */
export interface StoredResponse {
  status: number;
  body: unknown;
}

export interface IdempotencyRecord {
  id: string;
  userId: string;
  route: string;
  fingerprint: string;
  response: StoredResponse;
  createdAt: Date;
  expiresAt: Date;
}

export interface IdempotencyStore {
  find(tx: Tx, id: string): Promise<IdempotencyRecord | null>;
  /** Must fail (not overwrite) if the id exists. */
  create(tx: Tx, record: IdempotencyRecord): void;
}

const KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export function parseIdempotencyKey(header: string | null, required: boolean): string | null {
  if (header === null || header === '') {
    if (required) throw new AppError('idempotency_key_required', 400);
    return null;
  }
  if (!KEY_PATTERN.test(header)) throw new AppError('idempotency_key_invalid', 400);
  return header;
}

export const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

export function idempotencyDocId(userId: string, route: string, key: string): string {
  return sha256(`${userId}\n${route}\n${key}`);
}

/** Stable fingerprint of the request body so the same key cannot be reused for different content. */
export function fingerprintOf(value: unknown): string {
  return sha256(stableStringify(value));
}

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .filter((k) => o[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(',')}}`;
}

export interface IdempotentResult {
  response: StoredResponse;
  replayed: boolean;
}

export async function runIdempotent(
  deps: { uow: UnitOfWork; store: IdempotencyStore; now: () => Date; ttlMs: number },
  req: { userId: string; route: string; key: string; fingerprint: string },
  work: (tx: Tx) => Promise<StoredResponse>,
): Promise<IdempotentResult> {
  const id = idempotencyDocId(req.userId, req.route, req.key);
  return deps.uow.run(async (tx) => {
    // reads first (Firestore rule), then business writes, then the key document
    const existing = await deps.store.find(tx, id);
    if (existing) {
      if (existing.fingerprint !== req.fingerprint)
        throw new AppError('idempotency_key_reuse', 422);
      return { response: existing.response, replayed: true };
    }
    const response = await work(tx);
    const now = deps.now();
    deps.store.create(tx, {
      id,
      userId: req.userId,
      route: req.route,
      fingerprint: req.fingerprint,
      response,
      createdAt: now,
      expiresAt: new Date(now.getTime() + deps.ttlMs),
    });
    return { response, replayed: false };
  });
}
