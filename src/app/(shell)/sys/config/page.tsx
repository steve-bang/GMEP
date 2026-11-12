import { getTranslations } from 'next-intl/server';
import {
  CONFIG_DESCRIPTORS,
  CONFIG_GROUPS,
  CONFIG_TYPES,
  canViewConfig,
  listConfigVersions,
} from '@/modules/sys';
import { getContainer } from '@/composition/container';
import { requireSession } from '@/composition/session';
import { businessDateOf } from '@/platform/effective/effective';
import { EmptyState } from '@/ui/components/States';
import { SettingsPage } from '../SettingsPage';
import { ConfigIndexList } from './ConfigIndexList';
import type { IndexCard } from './configIndex';
import { typeBadges } from './configBadges';

export const dynamic = 'force-dynamic';

/**
 * FR-SYS-004: every effective-dated configuration type the user may see, by business group, with badges for
 * versions awaiting a decision and approved versions not yet in force. One read per visible type through the
 * existing `listConfigVersions` (registered query `configVersions.byType`); a failed read only hides that badge.
 */
export default async function ConfigIndexPage() {
  const t = await getTranslations();
  const { actor } = await requireSession();
  const deps = getContainer().sys;
  const today = businessDateOf(deps.clock.now());
  const types = Object.keys(CONFIG_TYPES).filter((x) => canViewConfig(actor, x));
  const cards: IndexCard[] = await Promise.all(
    types.map(async (type) => {
      const badges = await listConfigVersions(deps, actor, type, { limit: 100 }).then(
        (p) => typeBadges(p.items, today),
        () => ({ pending: 0, upcoming: false }),
      );
      return {
        type,
        group: CONFIG_DESCRIPTORS[type]!.group,
        title: t(`config.types.${type}.title`),
        lead: t(`config.types.${type}.lead`),
        href: `/sys/config/${type}`,
        ...badges,
      };
    }),
  );
  return (
    <SettingsPage current="config" title={t('config.title')} desc={t('config.lead')}>
      {cards.length === 0 ? (
        <EmptyState title={t('states.noPermissionTitle')} text={t('states.noPermissionText')} />
      ) : (
        <ConfigIndexList
          cards={cards}
          labels={{
            search: t('config.index.search'),
            placeholder: t('config.index.placeholder'),
            noMatch: t('config.index.noMatch'),
            upcoming: t('config.index.upcoming'),
            pending: t('config.index.pending', { n: '{n}' }),
            order: CONFIG_GROUPS,
            groups: Object.fromEntries(CONFIG_GROUPS.map((g) => [g, t(`config.groups.${g}`)])),
          }}
        />
      )}
    </SettingsPage>
  );
}
