/**
 * Session lifetime policy per role (ba-answers-for-dev §1.5, D-05). All numbers are
 * [Đề xuất BA - chờ xác nhận: Khách] defaults and configuration, not business rules.
 * Multi-role users get the SMALLEST idle timeout of their roles (BA "mạnh nhất").
 */
export interface SessionLimits {
  idleMs: number;
  absoluteMs: number;
}

export interface SessionPolicy {
  default: SessionLimits;
  /** per role overrides of the idle timeout */
  idleByRole: Record<string, number>;
}

const MIN = 60_000;
const HOUR = 60 * MIN;

export const DEFAULT_SESSION_POLICY: SessionPolicy = {
  default: { idleMs: 30 * MIN, absoluteMs: 12 * HOUR },
  idleByRole: { CH: 15 * MIN, KT: 15 * MIN, AD: 15 * MIN },
};

export function sessionLimitsFor(
  policy: SessionPolicy,
  roleCodes: readonly string[],
): SessionLimits {
  const idles = roleCodes.map((r) => policy.idleByRole[r] ?? policy.default.idleMs);
  return {
    idleMs: idles.length ? Math.min(...idles) : policy.default.idleMs,
    absoluteMs: policy.default.absoluteMs,
  };
}
