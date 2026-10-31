import { getTranslations } from 'next-intl/server';
import { LoadingState } from '@/ui/components/States';

export default async function Loading() {
  const t = await getTranslations('states');
  return <LoadingState label={t('loading')} />;
}
