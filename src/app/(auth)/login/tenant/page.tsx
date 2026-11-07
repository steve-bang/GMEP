import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { AppError } from '@/platform/errors/errors';
import { SESSION_COOKIE } from '@/platform/http/cookies';
import { safeNext } from '@/platform/http/safeNext';
import { listTenantChoices } from '@/modules/sys';
import { getContainer } from '@/composition/container';
import { AuthLayout } from '@/ui/components/AuthLayout';
import { TenantPicker } from './TenantPicker';

export const dynamic = 'force-dynamic';

/**
 * FR-TEN-016/017: "Chọn công ty", shown only after a correct password when the person holds two or more active
 * memberships. Minimal functional version built from existing auth classes; the designed `CompanyPicker` is pending.
 */
export default async function ChooseTenantPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const t = await getTranslations();
  const next = safeNext((await searchParams).next);
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  const choices = await listTenantChoices(getContainer().sys, cookie).catch((e: unknown) => {
    if (e instanceof AppError && e.status === 401) return null;
    throw e;
  });
  if (!choices) redirect('/login');
  return (
    <AuthLayout
      brand={t('app.name')}
      skip={t('shell.skip')}
      title={t('login.tenant.title')}
      lead={t('login.tenant.lead')}
      footer={`${t('app.name')} · ${t('app.support')}`}
    >
      <TenantPicker choices={choices} next={next} />
    </AuthLayout>
  );
}
