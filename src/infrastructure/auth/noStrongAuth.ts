import type { StrongAuthPort } from '@/modules/sys';

/**
 * Placeholder until the project owner supplies TOTP / device-PIN (ADR §2.1 A2).
 * Replace in src/composition/container.ts; dev must not implement TOTP/PIN itself.
 */
export const noStrongAuth: StrongAuthPort = {
  requirementFor: async () => 'none',
  verify: async () => false,
};
