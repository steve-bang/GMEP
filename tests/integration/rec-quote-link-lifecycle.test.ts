import { beforeAll, describe, expect, it } from 'vitest';
import { businessDate } from '@/platform/format/date';
import {
  MessageDeliveryError,
  type MessageGateway,
  type OutboundMessage,
  type MessageChannel,
} from '@/modules/sys';
import { tokenHashOf, viewPublicQuote } from '@/modules/rec';
import { createHarness, type Harness } from './harness';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
let seq = 0;
const key = (p: string) => `${p}-${String(++seq).padStart(6, '0')}-xxxxxxxx`;
const SV_DAU = 'svc_tnt_demo_SV-DAU';
const CRON_SECRET = 'cron-secret-0123456789-abcdefghijklmnop';

/**
 * WP-A (review findings 1, 6, 7): the quote-link delivery lifecycle (FR-REC-008, FR-CRM-010). Memory DocStore only:
 * some cases edit the store directly (orphan queue entry, expired queue item). Money is not involved.
 */
describe('REC quote-link delivery lifecycle [memory]', () => {
  let h: Harness;
  let cv: string;
  let odo = 700_000;
  let ip = 0;
  const tokenOf = (link: string) => link.split('/b/')[1]!;
  const col = (name: string) => h.container.memory!.db.col(name);
  const rows = (name: string): Row[] =>
    [...col(name).entries()].map(([id, v]) => ({ id, ...v })) as Row[];
  const call = (cookie: string, method: string, path: string, body?: unknown, k = key('lc')) =>
    h.call(method, path, { cookie, key: k, ...(body !== undefined ? { body } : {}) });
  const addr = () => ({ address: `198.51.100.${(ip++ % 200) + 10}` });
  const view = (token: string) => viewPublicQuote(h.container.rec, token, addr());
  const cron = async () =>
    (
      await h.call('POST', '/api/v1/internal/cron/run-due', {
        origin: null,
        headers: { 'x-cron-secret': CRON_SECRET },
      })
    ).json.branches.find((b: Row) => b.branchId === 'br_q7').messageRetry as Row;
  const advance = async (minutes: number) => {
    h.clock.set(new Date(h.clock.now().getTime() + minutes * 60_000).toISOString());
    cv = await h.loginAt('u_cv_q7', 'br_q7');
  };
  const consent = (customerId: string, channel: string) =>
    call(cv, 'POST', `/api/v1/crm/customers/${customerId}/consents`, {
      purpose: 'service',
      channel,
      basis: 'contract',
      evidenceKind: 'paper-slip',
      evidence: 'Phiếu giấy mẫu',
    });

  async function sentQuote(): Promise<Row> {
    const c = await call(cv, 'POST', '/api/v1/rec/intakes', { vehicleId: 'veh_an' });
    const p = await call(cv, 'PATCH', `/api/v1/rec/intakes/${c.json.id}`, {
      version: c.json.version,
      step: 5,
      km: (odo += 100),
      customerRequest: 'Bảo dưỡng định kỳ',
      serviceType: 'maintenance',
      promisedDate: '2099-01-01',
    });
    const done = await call(cv, 'POST', `/api/v1/rec/intakes/${c.json.id}/complete`, {
      version: p.json.version,
    });
    const created = await call(cv, 'POST', '/api/v1/rec/quotes', { intakeId: done.json.id });
    const edited = await call(cv, 'PATCH', `/api/v1/rec/quotes/${created.json.id}`, {
      version: created.json.version,
      items: [
        {
          name: 'Thay dầu',
          necessity: 'required',
          lines: [{ kind: 'labor', serviceId: SV_DAU }],
        },
      ],
    });
    const sent = await call(cv, 'POST', `/api/v1/rec/quotes/${created.json.id}/send`, {
      version: edited.json.version,
    });
    expect(sent.status, sent.text).toBe(200);
    return (await call(cv, 'GET', `/api/v1/rec/quotes/${created.json.id}`)).json;
  }
  /** staff "Sao chép liên kết": returns the raw token */
  async function copyLink(q: Row): Promise<string> {
    const r = await call(cv, 'POST', `/api/v1/rec/quotes/${q.id}/link`, { version: q.version });
    expect(r.status, r.text).toBe(201);
    return r.json.token as string;
  }
  const sendLink = (q: Row, channel: string, k = key('snd')) =>
    call(cv, 'POST', `/api/v1/rec/quotes/${q.id}/send-link`, { version: q.version, channel }, k);
  const versionOf = (q: Row): Row => rows('quoteVersions').find((v) => v.quoteId === q.id)!;
  const deliveryOf = (q: Row): Row => rows('messageDeliveries').find((d) => d.quoteId === q.id)!;
  const linkOf = (hash: string): Row => rows('quoteLinks').find((l) => l.id === hash)!;

  /** wraps the gateway: `onSend` decides per quote-link message; restore() puts the real one back */
  function wrapGateway(onSend: (m: OutboundMessage) => Promise<void> | void) {
    const real = h.container.sys.messages;
    const sys = h.container.sys as unknown as { messages: MessageGateway };
    sys.messages = {
      availableChannels: () => real.availableChannels(),
      isSimulated: (c: MessageChannel) => real.isSimulated(c),
      async send(m: OutboundMessage) {
        if (m.template === 'quote-link') await onSend(m);
        return real.send(m);
      },
    };
    return { restore: () => (sys.messages = real) };
  }
  const down = (seen: string[] = []) =>
    wrapGateway((m) => {
      seen.push(m.vars.link!);
      throw new MessageDeliveryError(m.channel);
    });

  beforeAll(async () => {
    h = await createHarness('memory', {
      env: { MESSAGE_DEV_CHANNELS: 'sms,zalo', CRON_SECRET, CRON_TENANT_ID: 'tnt_demo' },
    });
    cv = await h.loginAt('u_cv_q7', 'br_q7');
    expect((await consent('cus_an', 'sms')).status).toBe(201);
    expect((await consent('cus_an', 'email')).status).toBe(201);
  });

  it('FR-REC-008: a gateway outage keeps the link the customer already has (current link, sentVia untouched)', async () => {
    const q = await sentQuote();
    const t0 = await copyLink(q);
    const h0 = tokenHashOf(t0);
    const g = down();
    try {
      const r = await sendLink(q, 'sms');
      expect(r.status, r.text).toBe(202);
      expect(r.json.status).toBe('pending');
    } finally {
      g.restore();
    }
    await expect(view(t0)).resolves.toMatchObject({ state: 'open' });
    expect(versionOf(q)).toMatchObject({ linkHash: h0, sentVia: 'link' });
    expect(linkOf(h0).revokedAt).toBeUndefined();
    // the undelivered attempt link exists as an additional live link
    const del = deliveryOf(q);
    expect(del.linkHashes).toHaveLength(1);
    expect(linkOf(del.linkHashes[0]).revokedAt).toBeUndefined();
    expect(linkOf(del.linkHashes[0]).deliveryId).toBe(del.id);
  });

  it('FR-REC-008: a retry that succeeds activates its link, revokes the older current one and sets sentVia', async () => {
    const q = await sentQuote();
    const t0 = await copyLink(q);
    const h0 = tokenHashOf(t0);
    const g = down();
    try {
      expect((await sendLink(q, 'sms')).json.status).toBe('pending');
    } finally {
      g.restore();
    }
    await advance(3);
    // an earlier test may have left another pending delivery in the branch queue
    expect(await cron()).toMatchObject({ dead: 0, failed: 0 });
    const del0 = deliveryOf(q);
    const msg = rows('messageOutbox').find((m) => m.id === del0.id)!;
    const token = tokenOf(msg.vars.link);
    const del = deliveryOf(q);
    expect(del).toMatchObject({ status: 'sent', attempts: 2 });
    expect(del.linkHashes).toHaveLength(2);
    expect(versionOf(q)).toMatchObject({ linkHash: tokenHashOf(token), sentVia: 'sms' });
    expect(linkOf(h0)).toMatchObject({ revokedReason: 'replaced' });
    await expect(view(token)).resolves.toMatchObject({ state: 'open' });
    await expect(view(t0)).rejects.toMatchObject({ status: 404 });
    const audits = rows('auditLogs').filter((a) => a.entityId === q.id);
    expect(audits.filter((a) => a.action === 'quote.link_issue').at(-1)!.after).toMatchObject({
      replaced: true,
      via: 'sms',
    });
    expect(audits.filter((a) => a.action === 'quote.link_sent')).toHaveLength(1);
  });

  it('FR-REC-008: a dead delivery leaves the old link intact; attempts never revoke each other', async () => {
    const q = await sentQuote();
    const t0 = await copyLink(q);
    const h0 = tokenHashOf(t0);
    const max = h.container.rec.rec.delivery.maxAttempts;
    h.container.rec.rec.delivery.maxAttempts = 3;
    const g = down();
    try {
      expect((await sendLink(q, 'sms')).json.status).toBe('pending');
      await advance(3);
      expect(await cron()).toMatchObject({ due: 1, retryLater: 1 });
      const mid = deliveryOf(q);
      expect(mid.linkHashes).toHaveLength(mid.attempts);
      await advance(60);
      expect(await cron()).toMatchObject({ due: 1, dead: 1 });
    } finally {
      g.restore();
      h.container.rec.rec.delivery.maxAttempts = max;
    }
    const del = deliveryOf(q);
    expect(del).toMatchObject({ status: 'dead', attempts: 3 });
    expect(del.linkHashes).toHaveLength(del.attempts);
    for (const hash of del.linkHashes) expect(linkOf(hash).revokedAt).toBeUndefined();
    await expect(view(t0)).resolves.toMatchObject({ state: 'open' });
    expect(versionOf(q)).toMatchObject({ linkHash: h0, sentVia: 'link' });
  });

  it('FR-REC-008: a link copied by staff after the send is not revoked when the delivery link is activated', async () => {
    const q = await sentQuote();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let entered!: () => void;
    const inside = new Promise<void>((r) => (entered = r));
    const g = wrapGateway(async () => {
      entered();
      await gate;
    });
    try {
      const pending = sendLink(q, 'sms');
      await inside;
      // later than the delivery link (the clock is frozen otherwise)
      h.clock.set(new Date(h.clock.now().getTime() + 60_000).toISOString());
      const copied = await copyLink(q);
      release();
      const r = await pending;
      expect(r.json.status).toBe('sent');
      const del = deliveryOf(q);
      expect(versionOf(q).linkHash).toBe(del.linkHashes[0]);
      expect(linkOf(tokenHashOf(copied)).revokedAt).toBeUndefined();
      await expect(view(copied)).resolves.toMatchObject({ state: 'open' });
    } finally {
      release();
      g.restore();
    }
  });

  it('FR-REC-009: the customer can approve through the link of a failed attempt (approval.linkId matches it)', async () => {
    const q = await sentQuote();
    const seen: string[] = [];
    const g = down(seen);
    try {
      expect((await sendLink(q, 'sms')).json.status).toBe('pending');
    } finally {
      g.restore();
    }
    const token = tokenOf(seen[0]!);
    const r = await h.call('POST', '/api/v1/rec/public/quote/approve', {
      body: { token, selectedItemNos: [1], declines: [] },
      key: key('pub'),
      headers: { 'x-forwarded-for': addr().address },
    });
    expect(r.status, r.text).toBe(200);
    expect(versionOf(q).approval.linkId).toBe(tokenHashOf(token).slice(0, 16));
    expect(linkOf(tokenHashOf(token)).usedAt).toBeDefined();
  });

  it('finding 6: an orphan queue entry (delivery gone) is removed by the next run and starves nothing', async () => {
    const qa = await sentQuote();
    const g = down();
    try {
      expect((await sendLink(qa, 'sms')).json.status).toBe('pending');
      const orphan = deliveryOf(qa).id;
      col('messageDeliveries').delete(orphan);
      const qb = await sentQuote();
      expect((await sendLink(qb, 'sms')).json.status).toBe('pending');
      g.restore();
      await advance(3);
      expect(Object.keys(rows('messageQueues').find((x) => x.id === 'br_q7')!.items)).toContain(
        orphan,
      );
      expect(await cron()).toMatchObject({ failed: 0, sent: 1, skipped: 1 });
      expect(Object.keys(rows('messageQueues').find((x) => x.id === 'br_q7')!.items)).not.toContain(
        orphan,
      );
      expect(deliveryOf(qb).status).toBe('sent');
    } finally {
      g.restore();
    }
  });

  it('finding 6: expired queue items are pruned and do not count toward queueMax; live ones still give 429', async () => {
    // start from an empty queue of the branch
    await advance(120);
    await cron();
    const d = h.container.rec.rec.delivery;
    const max = d.queueMax;
    const q = await sentQuote();
    const g = down();
    try {
      const live = Object.keys(rows('messageQueues').find((x) => x.id === 'br_q7')?.items ?? {});
      d.queueMax = live.length + 1;
      expect((await sendLink(q, 'sms')).json.status).toBe('pending');
      const full = await sendLink(q, 'sms');
      expect(full.status).toBe(429);
      // the item expires: it is pruned from the count and from the stored queue
      const queue = col('messageQueues').get('br_q7')!;
      const itemId = Object.keys(queue.items).find((k) => !live.includes(k))!;
      queue.items[itemId].expiresAt = new Date(h.clock.now().getTime() - 1000);
      const again = await sendLink(q, 'sms');
      expect(again.status, again.text).toBe(202);
      const stored = rows('messageQueues').find((x) => x.id === 'br_q7')!.items;
      expect(Object.keys(stored)).not.toContain(itemId);
      expect(Object.keys(stored)).toHaveLength(live.length + 1);
    } finally {
      g.restore();
      d.queueMax = max;
    }
    // the cron job prunes too
    const queue = col('messageQueues').get('br_q7')!;
    for (const i of Object.values(queue.items) as Row[]) i.expiresAt = new Date(0);
    await cron();
    expect(Object.keys(rows('messageQueues').find((x) => x.id === 'br_q7')!.items)).toHaveLength(0);
  });

  it('finding 7: a send through a dev adapter is marked simulated in the delivery, the audit and the response', async () => {
    const q = await sentQuote();
    const r = await sendLink(q, 'sms');
    expect(r.status, r.text).toBe(200);
    expect(r.json).toMatchObject({ status: 'sent', simulated: true });
    expect(deliveryOf(q).simulated).toBe(true);
    const sent = rows('auditLogs').find(
      (a) => a.entityId === q.id && a.action === 'quote.link_sent',
    )!;
    expect(sent.after).toMatchObject({ channel: 'sms', simulated: true });
    // email without SMTP goes to the dev outbox too
    const e = await sendLink(await sentQuote(), 'email');
    expect(e.json).toMatchObject({ status: 'sent', simulated: true });
    expect(businessDate(h.clock.now())).toBeTruthy();
  });
});
