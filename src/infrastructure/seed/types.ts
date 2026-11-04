import type { DocData } from '@/platform/store/docStore';

export interface SeedDoc {
  collection: string;
  id: string;
  data: DocData;
}
