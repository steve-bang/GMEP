/**
 * Owner decision 07/11/2026: reissues the six-digit tenant code ("Mã công ty") of a tenant when it leaked.
 *   pnpm tsx --tsconfig tsconfig.json scripts/tenant-code.ts --tenant tnt_x --operator <who> --role CNT|QTN \
 *     --reason "Mã bị lộ ra ngoài" --version <tenant version> --key <idempotency key>
 * Until MT-1 builds the platform session this is the only way in; it acts as the platform role given (`cli:<operator>`)
 * and the platform audit log records it with the reason. Re-running with the same --key returns the same result and
 * never draws a second code. The old code is retired, not freed: no other tenant gets it during the holding period
 * (`tenantCodeHoldDays`, [Cần xác nhận], default 90 days). Staff keep signing in with the NEW code; their passwords and
 * sessions are untouched.
 */
import { loadEnv } from '@/platform/config/env';
import { createContainer } from '@/composition/container';
import { reissueTenantCode, type PlatformActor } from '@/modules/sys';

const arg = (name: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (!v || v.startsWith('--')) throw new Error(`missing --${name}`);
  return v;
};

async function main() {
  const role = arg('role');
  if (role !== 'CNT' && role !== 'QTN') throw new Error('--role must be CNT or QTN');
  const container = createContainer({ env: loadEnv(process.env) });
  const actor: PlatformActor = {
    kind: 'platform',
    platformUserId: `cli:${arg('operator')}`,
    role,
    displayName: `cli:${arg('operator')}`,
  };
  const r = await reissueTenantCode(
    container.sys,
    actor,
    arg('tenant'),
    { reason: arg('reason'), version: Number(arg('version')) },
    { requestId: `cli-${Date.now()}`, idempotencyKey: arg('key') },
  );
  console.log(
    JSON.stringify(
      {
        tenantId: r.tenant.id,
        tenantCode: r.tenant.tenantCode,
        previousCode: r.previousCode,
        previousCodeReleaseAfter: r.releaseAfter,
        replayed: r.replayed,
      },
      null,
      2,
    ),
  );
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
