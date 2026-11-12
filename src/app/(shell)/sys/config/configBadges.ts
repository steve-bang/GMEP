import type { ConfigVersionDto } from '@/modules/sys';
import { viewStatuses } from './configView';

/** Badges of one type from its loaded versions: how many await a decision, and whether an approved one is not yet in force. */
export function typeBadges(
  versions: readonly ConfigVersionDto[],
  today: string,
): { pending: number; upcoming: boolean } {
  let pending = 0;
  let upcoming = false;
  for (const s of viewStatuses(versions, today).values()) {
    if (s === 'pending') pending++;
    else if (s === 'upcoming') upcoming = true;
  }
  return { pending, upcoming };
}
