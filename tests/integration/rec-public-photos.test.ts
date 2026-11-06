import { beforeAll, describe, expect, it } from 'vitest';
import { businessDate } from '@/platform/format/date';
import { viewPublicQuote } from '@/modules/rec';
import { backends, createHarness, type Harness } from './harness';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
let seq = 0;
const key = (p: string) => `${p}-${String(++seq).padStart(6, '0')}-xxxxxxxx`;

const SV_DAU = 'svc_tnt_demo_SV-DAU';

// minimal JPEGs; the server strips metadata and trailing bytes, so each photo needs different scan data
const seg = (m: number, body: Buffer) =>
  Buffer.concat([Buffer.from([0xff, m, (body.length + 2) >> 8, (body.length + 2) & 0xff]), body]);
const jpeg = (n: number) =>
  Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    seg(0xdb, Buffer.from([0, 1, 2, 3])),
    seg(0xda, Buffer.from([1, 1, 0, 0, 63, 0])),
    Buffer.from([0x12, n, 0xff, 0xd9]),
  ]);

/**
 * FR-REC-034: photos on the customer quote link. Token-authenticated read through the API; the page DTO lists
 * references only; R104 hidden photos, other quotes' photos, expired/replaced links and rate limit.
 */
describe.each(backends)('REC public quote photos [%s]', (backend) => {
  let h: Harness;
  let cv: string;
  let ql: string;
  let odo = 400_000;
  let ip = 0;
  const addr = () => `198.51.100.${(ip++ % 200) + 10}`;

  const call = (cookie: string, method: string, path: string, body?: unknown) =>
    h.call(method, path, { cookie, key: key('pp'), ...(body !== undefined ? { body } : {}) });
  const photoGet = (token: string, pid: string, address = addr()) =>
    h.call('GET', `/api/v1/rec/public/quote/photos/${pid}?t=${encodeURIComponent(token)}`, {
      headers: { 'x-forwarded-for': address },
    });

  const photoViews = async (quoteId: string) => {
    const audit = await call(ql, 'GET', `/api/v1/sys/audit?entityType=quote&entityId=${quoteId}`);
    return (audit.json.items as Row[]).filter((e) => e.action === 'quote.photo-view');
  };
  const advance = (ms: number) => h.clock.set(new Date(h.clock.now().getTime() + ms).toISOString());

  /** R34: an approved `public-rate-limit` in force from 3 days ahead; the caller moves the clock there */
  async function configureLimits(payload: Row) {
    const eff = businessDate(new Date(h.clock.now().getTime() + 3 * 86_400_000));
    const prop = await h.call('POST', '/api/v1/sys/config/public-rate-limit', {
      as: 'u_ad',
      key: key('cfg'),
      body: {
        scopeKey: 'tenant',
        effectiveFrom: eff,
        reason: 'Đo giới hạn ảnh ở staging',
        payload,
      },
    });
    expect(prop.status, prop.text).toBe(201);
    const ok = await h.call(
      'POST',
      `/api/v1/sys/config/public-rate-limit/${encodeURIComponent(prop.json.id)}/decide`,
      { as: 'u_owner', key: key('cfg'), body: { decision: 'approve' } },
    );
    expect(ok.status, ok.text).toBe(200);
  }

  /** a sent quote with a link; the intake gets photos while still a draft; `hide` marks some hidden (R104) */
  async function quoteWithPhotos(
    vehicleId: string,
    n: number,
    opts: { hideSecond?: boolean } = {},
  ): Promise<{ quoteId: string; token: string; ids: string[]; version: number }> {
    const c = await call(cv, 'POST', '/api/v1/rec/intakes', { vehicleId });
    expect(c.status, c.text).toBe(201);
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) {
      const form = new FormData();
      form.set('caption', `Ảnh ${n}-${i}`);
      form.set(
        'file',
        new File([new Uint8Array(jpeg(n * 10 + i))], 'x.jpg', { type: 'image/jpeg' }),
      );
      const r = await h.call('POST', `/api/v1/rec/intakes/${c.json.id}/photos`, {
        cookie: cv,
        form,
        key: key('ph'),
      });
      expect(r.status, r.text).toBe(201);
      ids.push(r.json.id);
    }
    if (opts.hideSecond) {
      const hid = await call(ql, 'POST', `/api/v1/rec/intakes/${c.json.id}/photos/${ids[1]}/hide`, {
        reason: 'Nhầm xe khác',
      });
      expect(hid.status, hid.text).toBe(200);
    }
    const cur = (await call(cv, 'GET', `/api/v1/rec/intakes/${c.json.id}`)).json;
    const p = await call(cv, 'PATCH', `/api/v1/rec/intakes/${c.json.id}`, {
      version: cur.version,
      step: 5,
      km: (odo += 100),
      customerRequest: 'Bảo dưỡng',
      serviceType: 'maintenance',
      promisedDate: '2099-01-01',
    });
    expect(p.status, p.text).toBe(200);
    const done = await call(cv, 'POST', `/api/v1/rec/intakes/${c.json.id}/complete`, {
      version: p.json.version,
    });
    expect(done.status, done.text).toBe(200);
    const created = await call(cv, 'POST', '/api/v1/rec/quotes', { intakeId: c.json.id });
    expect(created.status, created.text).toBe(201);
    const edited = await call(cv, 'PATCH', `/api/v1/rec/quotes/${created.json.id}`, {
      version: created.json.version,
      items: [
        { name: 'Thay dầu', necessity: 'required', lines: [{ kind: 'labor', serviceId: SV_DAU }] },
      ],
    });
    expect(edited.status, edited.text).toBe(200);
    const sent = await call(cv, 'POST', `/api/v1/rec/quotes/${created.json.id}/send`, {
      version: edited.json.version,
    });
    expect(sent.status, sent.text).toBe(200);
    const link = await call(cv, 'POST', `/api/v1/rec/quotes/${created.json.id}/link`, {
      version: sent.json.version,
    });
    expect(link.status, link.text).toBe(201);
    return { quoteId: created.json.id, token: link.json.token, ids, version: sent.json.version };
  }

  beforeAll(async () => {
    h = await createHarness(backend);
    cv = await h.loginAt('u_cv_q7', 'br_q7');
    ql = await h.loginAt('u_ql_q7', 'br_q7');
  });

  it('FR-REC-034: the page lists photo references only; the token serves the bytes with safe headers and an access log', async () => {
    const a = await quoteWithPhotos('veh_an', 1);
    const v = await viewPublicQuote(h.container.rec, a.token, { address: addr() });
    expect(v.photos).toHaveLength(2);
    expect(v.photos[0]).toEqual({ id: a.ids[0], caption: 'Ảnh 1-0', kind: 'intake' });
    expect(JSON.stringify(v.photos)).not.toMatch(/rec-photos|https?:|takenBy|sha256/);
    const r = await photoGet(a.token, a.ids[0]!);
    expect(r.status, r.text).toBe(200);
    expect(r.headers.get('content-type')).toBe('image/jpeg');
    expect(r.headers.get('cache-control')).toBe('private, no-store');
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    // reads are in the audit log (once per link per window), actor = the link, no personal data; photos are information only
    const reads = await photoViews(a.quoteId);
    expect(reads).toHaveLength(1);
    expect(reads[0]!.after).toMatchObject({ photoId: a.ids[0], kind: 'intake', windowMinutes: 10 });
    expect(reads[0]!.actorId).toMatch(/^customer-link:/);
    expect(JSON.stringify(reads[0])).not.toMatch(/0900000|Nguyễn/);
    const q = (await call(cv, 'GET', `/api/v1/rec/quotes/${a.quoteId}`)).json;
    expect(q.status).toBe('sent');
  });

  it("FR-REC-034 / R104: a hidden photo, another quote's photo and an unknown id are all a bare 404", async () => {
    const a = await quoteWithPhotos('veh_an', 2, { hideSecond: true });
    const b = await quoteWithPhotos('veh_biz', 3);
    const v = await viewPublicQuote(h.container.rec, a.token, { address: addr() });
    expect(v.photos.map((p) => p.id)).toEqual([a.ids[0]]);
    const res = [
      await photoGet(a.token, a.ids[1]!), // hidden
      await photoGet(a.token, b.ids[0]!), // belongs to quote B
      await photoGet(a.token, 'ph_nope'),
      await photoGet('x', a.ids[0]!), // malformed token
    ];
    expect(res.map((r) => r.status)).toEqual([404, 404, 404, 404]);
    // same body for every refusal: nothing says why
    expect(new Set(res.map((r) => r.json?.code ?? r.json?.title)).size).toBe(1);
    expect((await photoGet(a.token, a.ids[0]!)).status).toBe(200);
  });

  it('FR-REC-034: a re-created link kills the old one for photos too', async () => {
    const a = await quoteWithPhotos('veh_an', 4);
    expect((await photoGet(a.token, a.ids[0]!)).status).toBe(200);
    const fresh = await call(cv, 'POST', `/api/v1/rec/quotes/${a.quoteId}/link`, {
      version: (await call(cv, 'GET', `/api/v1/rec/quotes/${a.quoteId}`)).json.version,
    });
    expect(fresh.status, fresh.text).toBe(201);
    expect((await photoGet(a.token, a.ids[0]!)).status).toBe(404);
    expect((await photoGet(fresh.json.token, a.ids[0]!)).status).toBe(200);
  });

  it('FR-REC-034 / R38: an expired link shows no photos and serves none', async () => {
    const a = await quoteWithPhotos('veh_an', 5);
    const real = h.clock.now().toISOString();
    try {
      h.clock.set(new Date(h.clock.now().getTime() + 9 * 86_400_000).toISOString());
      const v = await viewPublicQuote(h.container.rec, a.token, { address: addr() });
      expect(v.state).toBe('expired');
      expect(v.photos).toEqual([]);
      expect((await photoGet(a.token, a.ids[0]!)).status).toBe(404);
    } finally {
      h.clock.set(real);
    }
  });

  it('FR-REC-034 / R34: the photo bucket is separate from the page bucket', async () => {
    const a = await quoteWithPhotos('veh_an', 6);
    const real = h.clock.now().toISOString();
    try {
      await configureLimits({
        viewLimit: 5,
        viewWindowSeconds: 600,
        decideLimit: 3,
        decideWindowMinutes: 30,
      });
      advance(3 * 86_400_000);
      const address = '198.51.100.240';
      // 10 photos from one address and one link all load although the page allows only 5 views
      for (let i = 0; i < 10; i++)
        expect((await photoGet(a.token, a.ids[i % 2]!, address)).status).toBe(200);
      const pages: (number | undefined)[] = [];
      for (let i = 0; i < 6; i++)
        pages.push(
          await viewPublicQuote(h.container.rec, a.token, { address }).then(
            () => 200,
            (e: { status?: number }) => e.status,
          ),
        );
      expect(pages).toEqual([200, 200, 200, 200, 200, 429]);
      expect((await photoGet(a.token, a.ids[0]!, address)).status).toBe(200);
    } finally {
      h.clock.set(real);
    }
  });

  it('FR-REC-034: photo reads are limited per token (120 per minute) even from many addresses', async () => {
    const a = await quoteWithPhotos('veh_an', 7);
    const statuses: number[] = [];
    for (let i = 0; i < 121; i++) statuses.push((await photoGet(a.token, a.ids[0]!)).status);
    expect(statuses.slice(0, 120).every((x) => x === 200)).toBe(true);
    expect(statuses[120]).toBe(429);
  });

  it('FR-REC-034: photo reads are limited per address (600 per minute); an unknown token is 404 and consumes it', async () => {
    const address = '198.51.100.251';
    const first = await photoGet('x0', 'ph_nope', address);
    expect(first.status).toBe(404);
    for (let i = 1; i < 600; i++)
      expect((await photoGet(`x${i}`, 'ph_nope', address)).status).toBe(404);
    expect((await photoGet('x-last', 'ph_nope', address)).status).toBe(429);
    // a valid link from the same address is throttled too, another address is not
    const a = await quoteWithPhotos('veh_an', 8);
    expect((await photoGet(a.token, a.ids[0]!, address)).status).toBe(429);
    expect((await photoGet(a.token, a.ids[0]!)).status).toBe(200);
  });

  it('FR-REC-034: photo-view is audited once per link per 10 minutes', async () => {
    const a = await quoteWithPhotos('veh_an', 9);
    const real = h.clock.now().toISOString();
    try {
      for (let i = 0; i < 3; i++) expect((await photoGet(a.token, a.ids[i % 2]!)).status).toBe(200);
      const rows = await photoViews(a.quoteId);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.after.photoId).toBe(a.ids[0]);
      advance(9 * 60_000);
      await photoGet(a.token, a.ids[1]!);
      expect(await photoViews(a.quoteId)).toHaveLength(1);
      advance(2 * 60_000);
      expect((await photoGet(a.token, a.ids[1]!)).status).toBe(200);
      const after = await photoViews(a.quoteId);
      expect(after).toHaveLength(2);
      expect(JSON.stringify(after)).not.toMatch(/0900000|Nguyễn|198\.51/);
    } finally {
      h.clock.set(real);
    }
  });
});
