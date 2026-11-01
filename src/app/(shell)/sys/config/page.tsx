import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { CONFIG_TYPES, canViewConfig } from '@/modules/sys';
import { requireSession } from '@/composition/session';
import { EmptyState } from '@/ui/components/States';
import { SettingsPage } from '../SettingsPage';

export const dynamic = 'force-dynamic';

/** FR-SYS-004: entry point to every effective-dated configuration type the user may see. */
export default async function ConfigIndexPage() {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const types = Object.keys(CONFIG_TYPES).filter((x) => canViewConfig(actor, x));
  return (
    <SettingsPage current="config" title={t('config.title')} desc={t('config.lead')}>
      {types.length === 0 ? (
        <EmptyState title={t('states.noPermissionTitle')} text={t('states.noPermissionText')} />
      ) : (
        <ul
          className="stack-2"
          data-testid="config-types"
          style={{ listStyle: 'none', padding: 0 }}
        >
          {types.map((x) => (
            <li key={x} className="card" style={{ padding: 'var(--space-4)' }}>
              <Link href={`/sys/config/${x}`}>
                <strong>{t(`config.types.${x}.title`)}</strong>
              </Link>
              <div className="text-secondary">{t(`config.types.${x}.lead`)}</div>
            </li>
          ))}
        </ul>
      )}
    </SettingsPage>
  );
}
