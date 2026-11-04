import { createPublicKey, verify as cryptoVerify } from 'node:crypto';
import type { Clock } from '@/platform/time/clock';

/**
 * Machine-to-machine authentication of the internal cron endpoint (Cloud Scheduler OIDC, README "Scheduler").
 * A port, so tests use a locally generated RSA key and never touch the network. The verifier only answers
 * yes/no: the caller turns "no" into 401 without saying which check failed.
 */
export interface CronAuthVerifier {
  /** true only for a valid, unexpired Google-signed token for the configured audience and service account */
  verify(bearerToken: string): Promise<boolean>;
}

/** Source of the public signing keys (JWK) by key id. Google publishes them at /oauth2/v3/certs. */
export interface JwksSource {
  getKey(kid: string): Promise<JsonWebKey | null>;
}

export const disabledCronAuth: CronAuthVerifier = { verify: async () => false };

const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);
const SKEW_SECONDS = 60;

function decode(part: string): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** RS256 JWT check: signature by the JWKS key, issuer, audience, service-account email and expiry. */
export function createOidcCronVerifier(opts: {
  audience: string;
  serviceAccount: string;
  keys: JwksSource;
  clock: Clock;
}): CronAuthVerifier {
  return {
    async verify(token) {
      const parts = token.split('.');
      if (parts.length !== 3 || token.length > 8192) return false;
      const header = decode(parts[0]!);
      const claims = decode(parts[1]!);
      if (!header || !claims) return false;
      if (header.alg !== 'RS256' || typeof header.kid !== 'string') return false;
      let jwk: JsonWebKey | null;
      try {
        jwk = await opts.keys.getKey(header.kid);
      } catch {
        return false;
      }
      if (!jwk) return false;
      try {
        const ok = cryptoVerify(
          'RSA-SHA256',
          Buffer.from(`${parts[0]}.${parts[1]}`),
          createPublicKey({ key: jwk, format: 'jwk' }),
          Buffer.from(parts[2]!, 'base64url'),
        );
        if (!ok) return false;
      } catch {
        return false;
      }
      const now = Math.floor(opts.clock.now().getTime() / 1000);
      const { iss, aud, email, email_verified: verified, exp, iat } = claims;
      return (
        typeof iss === 'string' &&
        ISSUERS.has(iss) &&
        aud === opts.audience &&
        email === opts.serviceAccount &&
        verified === true &&
        typeof exp === 'number' &&
        exp > now - SKEW_SECONDS &&
        (typeof iat !== 'number' || iat <= now + SKEW_SECONDS)
      );
    },
  };
}
