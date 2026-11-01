import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { CONFIG_TYPES, canViewConfig } from '@/modules/sys';
import { requireSession } from '@/composition/session';
import { EmptyState } from '@/ui/components/States';
import { PageHeader } from '@/ui/components/PageParts';

export const dynamic = 'force-dynamic';

/** FR-SYS-004: entry point to every effective-dated configuration type the user may see. */
export default async function ConfigIndexPage() {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const types = Object.keys(CONFIG_TYPES).filter((x) => canViewConfig(actor, x));
  return (
    <>
      <PageHeader title={t('config.title')} lead={t('config.lead')} />
      {types.length === 0 ? (
        <EmptyState title={t('states.noPermissionTitle')} text={t('states.noPermissionText')} />
      ) : (
        <ul className="stack" data-testid="config-types">
          {types.map((x) => (
            <li key={x}>
              <Link href={`/sys/config/${x}`}>{t(`config.types.${x}.title`)}</Link>
              <span className="text-secondary"> · {t(`config.types.${x}.lead`)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
