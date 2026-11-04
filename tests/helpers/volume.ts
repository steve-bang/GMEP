import { expect } from 'vitest';
import type { Harness } from '../integration/harness';

/**
 * Volume generators for the performance-regression suite (NFR-PERF-01/02). Fake, deterministic data only.
 * Bulk customers and vehicles go through the real Excel import route (FR-SYS-007), which doubles as the
 * measurement of the 2.000-row batch the R94 decision depends on.
 */
export const IMPORT_HEAD =
  'Mã khách cũ,Tên khách hàng,Số điện thoại,Biển số xe,Hãng xe,Dòng xe,Năm sản xuất';

export function customersCsv(from: number, count: number): string {
  const lines = [IMPORT_HEAD];
  for (let i = from; i < from + count; i++) {
    lines.push(
      [
        `VOL${i}`,
        `Khach Volume ${i}`,
        `09${String(10_000_000 + i)}`,
        `99K-${String(10_000 + i)}`,
        'Kia',
        'Morning',
        2015 + (i % 9),
      ].join(','),
    );
  }
  return lines.join('\r\n') + '\r\n';
}

let n = 0;
export interface BatchTiming {
  id: string;
  rows: number;
  dryRunMs: number;
  commitMs: number;
}

/** Upload (dry run) and commit one import batch; returns the wall time of both steps. */
export async function importCustomers(
  h: Harness,
  cookie: string,
  from: number,
  count: number,
): Promise<BatchTiming> {
  const form = new FormData();
  form.set('kind', 'customers-vehicles');
  form.set('file', new File([new Uint8Array(Buffer.from(customersCsv(from, count)))], 'vol.csv'));
  const t0 = performance.now();
  const up = await h.call('POST', '/api/v1/sys/imports', {
    cookie,
    form,
    key: `vol-up-${String(++n).padStart(6, '0')}-xxxxxxxx`,
  });
  const t1 = performance.now();
  expect(up.status, up.text.slice(0, 300)).toBe(201);
  expect(up.json.status, up.text.slice(0, 300)).toBe('validated');
  expect(up.json.issueCount ?? 0, up.text.slice(0, 300)).toBe(0);
  let cm = await h.call('POST', `/api/v1/sys/imports/${up.json.id}/commit`, {
    cookie,
    key: `vol-cm-${String(++n).padStart(6, '0')}-xxxxxxxx`,
    body: {},
  });
  // a batch that is written in steps (R94) answers "committing" until the last step: keep committing
  let guard = 0;
  while (cm.status === 200 && cm.json.status === 'committing' && guard++ < 200)
    cm = await h.call('POST', `/api/v1/sys/imports/${up.json.id}/commit`, {
      cookie,
      key: `vol-cm-${String(++n).padStart(6, '0')}-xxxxxxxx`,
      body: {},
    });
  const t2 = performance.now();
  expect([200, 201], cm.text.slice(0, 300)).toContain(cm.status);
  expect(cm.json.status, cm.text.slice(0, 300)).toBe('committed');
  return {
    id: up.json.id as string,
    rows: count,
    dryRunMs: Math.round(t1 - t0),
    commitMs: Math.round(t2 - t1),
  };
}

export const percentile = (xs: number[], p: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]!;
};

export interface Sample {
  ms: number;
  reads: number;
  queries: number;
  writes: number;
}

/** Run `op` `times` times and record wall time and document reads/queries/writes (container store counters). */
export async function sampleOp(
  h: Harness,
  times: number,
  op: (i: number) => Promise<unknown>,
): Promise<Sample[]> {
  const out: Sample[] = [];
  for (let i = 0; i < times; i++) {
    const s0 = { ...h.container.store.stats };
    const t0 = performance.now();
    await op(i);
    const ms = performance.now() - t0;
    const s1 = h.container.store.stats;
    out.push({
      ms,
      reads: s1.reads - s0.reads,
      queries: s1.queries - s0.queries,
      writes: s1.writes - s0.writes,
    });
  }
  return out;
}
