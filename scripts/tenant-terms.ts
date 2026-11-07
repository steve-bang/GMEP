/**
 * RULE-029 / FR-TEN-037 (minimum): records, by hand, that a tenant accepted the Terms and the DPA.
 *   pnpm tsx --tsconfig tsconfig.json scripts/tenant-terms.ts --tenant tnt_x --operator <who> \
 *     --terms-version 2026-11-v1 --dpa-version 2026-11-v1 --accepted-by "Nguyen Van A" --capacity "Chu garage" \
 *     --accepted-on 2026-11-06 --document-ref "HS-Q38/khach-so-1.pdf"
 * Until MT-1 builds the platform session this is the only way in; it acts as a platform owner (CNT) named
 * `cli:<operator>` and the platform audit log records it. The signed file stays outside the system.
 */
import { loadEnv } from '@/platform/config/env';
import { createContainer } from '@/composition/container';
import { recordTermsAcceptance, type PlatformActor } from '@/modules/sys';

const arg = (name: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (!v || v.startsWith('--')) throw new Error(`missing --${name}`);
  return v;
};

async function main() {
  const container = createContainer({ env: loadEnv(process.env) });
  const actor: PlatformActor = {
    kind: 'platform',
    platformUserId: `cli:${arg('operator')}`,
    role: 'CNT',
    displayName: `cli:${arg('operator')}`,
  };
  const t = await recordTermsAcceptance(
    container.sys,
    actor,
    arg('tenant'),
    {
      termsVersion: arg('terms-version'),
      dpaVersion: arg('dpa-version'),
      acceptedByName: arg('accepted-by'),
      acceptedByCapacity: arg('capacity'),
      acceptedOn: arg('accepted-on'),
      documentRef: arg('document-ref'),
    },
    { requestId: `cli-${Date.now()}` },
  );
  console.log(JSON.stringify({ tenantId: t.id, termsAcceptance: t.termsAcceptance }, null, 2));
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
