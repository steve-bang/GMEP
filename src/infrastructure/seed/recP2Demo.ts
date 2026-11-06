/**
 * FAKE REC phase-2 demo data (slice 2.8b). EVERY value is a SAMPLE ("minh họa"): whether the client takes appointments
 * at all is open (BRD Discovery 13) and the workshop capacity is the client's number. They are ordinary approved config
 * versions; nothing in code reads these values. The second demo tenant has NO version, so appointments are off there.
 */
import { configVersionId } from '@/modules/sys';
import { COL } from '../repos/queries';
import type { SeedDoc } from './types';

const AT = new Date('2026-10-01T00:00:00.000Z');
const TENANT = 'tnt_demo';
const DAY = '2026-10-01';

export function recP2DemoDocs(): SeedDoc[] {
  const docs: SeedDoc[] = [];
  const cfg = (type: string, scopeKey: string, payload: Record<string, unknown>) =>
    docs.push({
      collection: COL.configVersions,
      id: configVersionId(TENANT, type, scopeKey, DAY),
      data: {
        tenantId: TENANT,
        type,
        scopeKey,
        effectiveFrom: DAY,
        status: 'approved',
        payload,
        proposedBy: 'seed',
        proposedAt: AT,
        reason: 'Dữ liệu minh họa (Discovery câu 13 chưa xác nhận)',
        decidedBy: 'seed',
        decidedAt: AT,
        decisionNote: null,
        version: 1,
      },
    });
  // FR-REC-019, 027: appointments on for the demo company (20 cars a day), Quận 7 overrides with a small capacity
  cfg('appointment-policy', 'tenant', { enabled: true, dailyCapacity: 20 });
  cfg('appointment-policy', 'branch:br_q7', { enabled: true, dailyCapacity: 2 });
  return docs;
}
