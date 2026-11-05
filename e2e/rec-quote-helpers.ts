import { crc32, deflateSync } from 'node:zlib';
import { expect, type APIRequestContext } from '@playwright/test';
import { hdr, patch, post, type Row } from './acc-helpers';

/** Demo customer `cus_an` (vehicle `veh_an`, branch Quận 7): phone on file, used for the sms dev channel. */
export const AN_CUSTOMER = 'cus_an';
export const AN_PHONE = '0900000211';
export const AN_VEHICLE = 'veh_an';

/** Business date (UTC+7) as yyyy-MM-dd, the format of the config API. */
export const businessToday = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

/** A small valid PNG (8x8) whose pixels depend on `seed`, so every upload is a different file. */
export function tinyPng(seed: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 0);
    return Buffer.concat([head, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(8, 0);
  ihdr.writeUInt32BE(8, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const rows: number[] = [];
  for (let y = 0; y < 8; y++) {
    rows.push(0);
    for (let x = 0; x < 8; x++) rows.push((seed * 37 + x * 20) % 256, (y * 30) % 256, 120);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.from(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * A SENT quote through the API like the advisor would (intake with optional photos, one required item). `km` must be
 * above the vehicle's last odometer; each spec file passes its own range (they run in file-name order on one database).
 * `expensive` adds ten of the dearest demo part so the total is far above any threshold used by the other specs.
 */
export async function sentQuote(
  req: APIRequestContext,
  opts: { km: number; photos?: number; expensive?: boolean },
): Promise<Row> {
  const intake = await post(req, '/api/v1/rec/intakes', { vehicleId: AN_VEHICLE });
  for (let i = 0; i < (opts.photos ?? 0); i++) {
    const r = await req.post(`/api/v1/rec/intakes/${intake.id}/photos`, {
      multipart: {
        caption: `Ảnh e2e ${i + 1}`,
        file: { name: 'x.png', mimeType: 'image/png', buffer: tinyPng(opts.km + i) },
      },
      headers: hdr(),
    });
    expect(r.status(), await r.text()).toBe(201);
  }
  const filled = await patch(req, `/api/v1/rec/intakes/${intake.id}`, {
    version: intake.version,
    step: 5,
    km: opts.km,
    customerRequest: 'Bảo dưỡng định kỳ',
    serviceType: 'maintenance',
    promisedDate: '2099-01-01',
  });
  const done = await post(req, `/api/v1/rec/intakes/${intake.id}/complete`, {
    version: filled.version,
  });
  const q = await post(req, '/api/v1/rec/quotes', { intakeId: done.id });
  const lines: Row[] = [{ kind: 'labor', serviceId: 'svc_cmp_demo_SV-DAU' }];
  if (opts.expensive) lines.push({ kind: 'part', partId: 'part_seed_03', qty: 10 });
  const e = await patch(req, `/api/v1/rec/quotes/${q.id}`, {
    version: q.version,
    items: [{ name: 'Thay dầu và lọc', necessity: 'required', lines }],
  });
  return post(req, `/api/v1/rec/quotes/${q.id}/send`, { version: e.version });
}

/** Link for a sent quote through the API; returns the raw token (shown once) and the page path. */
export async function makeLink(req: APIRequestContext, quoteId: string): Promise<Row> {
  const cur = (await (await req.get(`/api/v1/rec/quotes/${quoteId}`)).json()) as Row;
  return post(req, `/api/v1/rec/quotes/${quoteId}/link`, { version: cur.version });
}

/** Service consent of the demo customer for one channel: grants it (no-op when active) or withdraws the active ones. */
export async function setServiceConsent(
  req: APIRequestContext,
  channel: 'sms' | 'zalo' | 'email',
  on: boolean,
): Promise<void> {
  const list = (await (await req.get(`/api/v1/crm/customers/${AN_CUSTOMER}/consents`)).json()) as {
    items: Row[];
  };
  const active = list.items.filter(
    (c) => c.purpose === 'service' && c.channel === channel && c.status === 'granted',
  );
  if (on) {
    if (active.length > 0) return;
    await post(req, `/api/v1/crm/customers/${AN_CUSTOMER}/consents`, {
      purpose: 'service',
      channel,
      basis: 'contract',
      evidenceKind: 'paper-slip',
      evidence: 'Phiếu giấy mẫu e2e',
    });
    return;
  }
  for (const c of active)
    await post(req, `/api/v1/crm/consents/${c.id}/withdraw`, {
      reason: 'Khách yêu cầu (e2e)',
      version: c.version,
    });
}
