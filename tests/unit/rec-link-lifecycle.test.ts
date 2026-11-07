import { describe, expect, it } from 'vitest';
import { pruneQueue, shouldRevokeOnActivation } from '@/modules/rec/domain/linkLifecycle';
import type { MessageQueue } from '@/modules/rec/domain/messaging';

// WP-A findings 1 and 6: pure decisions of the quote-link delivery lifecycle
const t = (ms: number) => new Date(ms);

describe('shouldRevokeOnActivation (finding 1)', () => {
  it('revokes an older live current link', () => {
    expect(shouldRevokeOnActivation({ createdAt: t(1) }, t(2))).toBe(true);
  });
  it('keeps a link created after the delivery link (staff copied it meanwhile)', () => {
    expect(shouldRevokeOnActivation({ createdAt: t(3) }, t(2))).toBe(false);
  });
  it('keeps a link created at the same instant, and ignores a missing or already revoked one', () => {
    expect(shouldRevokeOnActivation({ createdAt: t(2) }, t(2))).toBe(false);
    expect(shouldRevokeOnActivation(null, t(2))).toBe(false);
    expect(shouldRevokeOnActivation({ createdAt: t(1), revokedAt: t(1) }, t(2))).toBe(false);
  });
});

describe('pruneQueue (finding 6)', () => {
  const q: MessageQueue = {
    id: 'b',
    tenantId: 'c',
    branchId: 'b',
    items: {
      live: { nextAttemptAt: t(1), attempts: 1, expiresAt: t(100) },
      expired: { nextAttemptAt: t(1), attempts: 1, expiresAt: t(50) },
      legacy: { nextAttemptAt: t(1), attempts: 1 },
    },
  };
  it('drops expired items and keeps live and legacy ones', () => {
    expect(Object.keys(pruneQueue(q, t(60)).items).sort()).toEqual(['legacy', 'live']);
  });
  it('treats expiresAt = now as expired and returns the same object when nothing expired', () => {
    expect(Object.keys(pruneQueue(q, t(50)).items)).not.toContain('expired');
    expect(pruneQueue(q, t(10))).toBe(q);
  });
});
