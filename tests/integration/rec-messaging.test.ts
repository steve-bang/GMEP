import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getDb } from '@/infrastructure/firestore/client';
import { businessDate } from '@/platform/format/date';
import { ChannelMessageGateway } from '@/infrastructure/messaging/messageGateway';
import { MessageDeliveryError, type MessageGateway, type OutboundMessage } from '@/modules/sys';
import { viewPublicQuote } from '@/modules/rec';
import { backends, createHarness, type Harness } from './harness';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
let seq = 0;
const key = (p: string) => `${p}-${String(++seq).padStart(6, '0')}-xxxxxxxx`;

const SV_DAU = 'svc_tnt_demo_SV-DAU';
const SV_PHANH = 'svc_tnt_demo_SV-PHANH';
const SV_CAN = 'svc_tnt_demo_SV-CANCHINH';
const P_FILTER = 'part_seed_01';
const CRON_SECRET = 'cron-secret-0123456789-abcdefghijklmnop';

/**
 * A4: message gateway (fake adapters), "send quote link" (FR-REC-008, FR-CRM-010 consent, PDPL), one-time code on the
 * customer approval (QUO-04/05, R27) and the retry job. Money figures use the SAMPLE VAT 8%, not accountant sign-off;
 * the OTP threshold is a test value, not the client's number [Cần xác nhận: Chủ dự án].
 */
describe.each(backends)('REC messaging and approval code [%s]', (backend) => {
  let h: Harness;
  let cv: string;
  let qlTd: string;
  let owner: string;
  const today = () => businessDate(h.clock.now());

  const rows = async (name: string): Promise<Row[]> =>
    backend === 'memory'
      ? ([...h.container.memory!.db.col(name).entries()].map(([id, v]) => ({ id, ...v })) as Row[])
      : ((await getDb(h.container.env).collection(name).get()).docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Row[]);
  const call = (cookie: string, method: string, path: string, body?: unknown, k = key('msg')) =>
    h.call(method, path, { cookie, key: k, ...(body !== undefined ? { body } : {}) });
  let ip = 0;
  const pub = (path: string, body: unknown, k = key('pub')) =>
    h.call('POST', path, {
      body,
      key: k,
      headers: { 'x-forwarded-for': `198.51.100.${(ip++ % 200) + 10}` },
    });
  /** a stored date as milliseconds: Date (memory) or Firestore Timestamp */
  const ms = (v: unknown): number =>
    typeof v === 'object' && v !== null && 'toMillis' in v
      ? (v as { toMillis(): number }).toMillis()
      : +(v as Date);
  /**
   * The test clock stands still, so several outbox rows share one `createdAt`, and Firestore returns equal rows in
   * document-id order, not in insertion order. The order rows were first SEEN is therefore kept here (every read
   * registers the new rows before anything else is done), so `.at(-1)` is the newest message on both backends.
   */
  const seenOrder = new Map<string, number>();
  const smsOutbox = async (template: string) => {
    const all = (await rows('messageOutbox')).filter((r) => r.channel === 'sms');
    for (const r of all
      .filter((x) => !seenOrder.has(x.id))
      .sort((a, b) => ms(a.createdAt) - ms(b.createdAt)))
      seenOrder.set(r.id, seenOrder.size);
    return all
      .filter((r) => r.template === template)
      .sort((a, b) => seenOrder.get(a.id)! - seenOrder.get(b.id)!);
  };
  const emailOutbox = async () =>
    (await rows('emailOutbox')).filter((r) => r.template === 'quote-link');
  const tokenOf = (link: string) => link.split('/b/')[1]!;

  let odo = 300_000;
  async function sentQuote(cookie: string, vehicleId: string, items?: Row[]): Promise<Row> {
    const km = (odo += 100);
    const c = await call(cookie, 'POST', '/api/v1/rec/intakes', { vehicleId });
    const p = await call(cookie, 'PATCH', `/api/v1/rec/intakes/${c.json.id}`, {
      version: c.json.version,
      step: 5,
      km,
      customerRequest: 'Bảo dưỡng và kiểm tra phanh',
      serviceType: 'maintenance',
      promisedDate: '2099-01-01',
    });
    const done = await call(cookie, 'POST', `/api/v1/rec/intakes/${c.json.id}/complete`, {
      version: p.json.version,
    });
    const created = await call(cookie, 'POST', '/api/v1/rec/quotes', { intakeId: done.json.id });
    const edited = await call(cookie, 'PATCH', `/api/v1/rec/quotes/${created.json.id}`, {
      version: created.json.version,
      items: items ?? [
        {
          name: 'Thay dầu và lọc',
          necessity: 'required',
          lines: [
            { kind: 'labor', serviceId: SV_DAU },
            { kind: 'part', partId: P_FILTER, qty: 1 },
          ],
        },
        {
          name: 'Thay má phanh',
          necessity: 'required',
          lines: [{ kind: 'labor', serviceId: SV_PHANH }],
        },
        {
          name: 'Cân chỉnh góc đặt bánh',
          necessity: 'optional',
          lines: [{ kind: 'labor', serviceId: SV_CAN }],
        },
        {
          name: 'Lọc dự phòng',
          necessity: 'optional',
          lines: [{ kind: 'part', partId: P_FILTER, qty: 1 }],
        },
      ],
    });
    const sent = await call(cookie, 'POST', `/api/v1/rec/quotes/${created.json.id}/send`, {
      version: edited.json.version,
    });
    expect(sent.status, sent.text).toBe(200);
    return (await call(cookie, 'GET', `/api/v1/rec/quotes/${created.json.id}`)).json;
  }
  const sendLink = (cookie: string, q: Row, channel: string, k = key('snd')) =>
    call(
      cookie,
      'POST',
      `/api/v1/rec/quotes/${q.id}/send-link`,
      { version: q.version, channel },
      k,
    );
  const consent = (cookie: string, customerId: string, channel: string) =>
    call(cookie, 'POST', `/api/v1/crm/customers/${customerId}/consents`, {
      purpose: 'service',
      channel,
      basis: 'contract',
      evidenceKind: 'paper-slip',
      evidence: 'Phiếu giấy mẫu',
    });
  const withdraw = (cookie: string, c: Row) =>
    call(cookie, 'POST', `/api/v1/crm/consents/${c.id}/withdraw`, {
      reason: 'Khách yêu cầu',
      version: c.version,
    });
  const cron = () =>
    h.call('POST', '/api/v1/internal/cron/run-due', {
      origin: null,
      headers: { 'x-cron-secret': CRON_SECRET },
    });

  beforeAll(async () => {
    h = await createHarness(backend, {
      env: {
        MESSAGE_DEV_CHANNELS: 'sms,zalo',
        CRON_SECRET,
        CRON_TENANT_ID: 'tnt_demo',
      },
    });
    cv = await h.loginAt('u_cv_q7', 'br_q7');
    qlTd = await h.loginAt('u_ql_td', 'br_td');
    owner = await h.login('u_owner');
  });

  describe('send the quote link (FR-REC-008, FR-CRM-010)', () => {
    it('channels come from configuration: email and the dev sms/zalo adapters', () => {
      expect(h.container.sys.messages.availableChannels()).toEqual(['sms', 'zalo', 'email']);
    });

    it('FR-REC-008: sends once to the contact on file, audits with a masked recipient, sets sentVia', async () => {
      expect((await consent(cv, 'cus_an', 'sms')).status).toBe(201);
      const q = await sentQuote(cv, 'veh_an');
      const k = key('snd');
      const r = await sendLink(cv, q, 'sms', k);
      expect(r.status, r.text).toBe(200);
      expect(r.json).toMatchObject({ channel: 'sms', status: 'sent' });
      expect(r.json.recipient).not.toContain('0900000211');
      const out = (await smsOutbox('quote-link')).filter((m) => m.to === '0900000211');
      expect(out).toHaveLength(1);
      expect(out[0]!.vars.link).toMatch(/\/b\/[A-Za-z0-9_-]{40,}$/);
      // the link the customer got works, and only its hash is stored
      expect((await rows('quoteVersions')).find((v) => v.quoteId === q.id)!.sentVia).toBe('sms');
      const token = tokenOf(out[0]!.vars.link);
      expect(JSON.stringify(await rows('quoteLinks'))).not.toContain(token);
      // audit: channel and masked recipient, never the phone number
      const audits = (await rows('auditLogs')).filter((a) => a.entityId === q.id);
      const sent = audits.filter((a) => a.action === 'quote.link_sent');
      expect(sent).toHaveLength(1);
      expect(sent[0]!.after).toMatchObject({ channel: 'sms', to: r.json.recipient });
      expect(JSON.stringify(audits)).not.toMatch(/0900000211|an\.demo@example\.test/);
      expect(JSON.stringify(audits)).not.toContain(token);
    });

    it('FR-REC-008: the same Idempotency-Key sends exactly once (replay returns the same result)', async () => {
      const q = await sentQuote(cv, 'veh_an');
      const before = (await smsOutbox('quote-link')).length;
      const k = key('snd');
      const a = await sendLink(cv, q, 'sms', k);
      const b = await sendLink(cv, q, 'sms', k);
      expect(a.status).toBe(200);
      expect(b.status).toBe(200);
      expect(b.headers.get('idempotent-replayed')).toBe('true');
      expect(b.json.id).toBe(a.json.id);
      expect((await smsOutbox('quote-link')).length).toBe(before + 1);
    });

    it('FR-CRM-010: without any service consent the send is refused (409) and nothing is sent', async () => {
      const q = await sentQuote(cv, 'veh_biz');
      const before = (await rows('messageOutbox')).length;
      const r = await sendLink(cv, q, 'zalo');
      expect(r.status).toBe(409);
      expect(r.json.code).toBe('message_no_consent');
      expect(r.json.detail).toContain('đồng ý');
      expect((await rows('messageOutbox')).length).toBe(before);
      // a withdrawn consent counts as none (FR-CRM-010)
      const g = await consent(cv, 'cus_biz', 'zalo');
      const w = await withdraw(cv, g.json);
      expect(w.status, w.text).toBe(200);
      expect((await sendLink(cv, q, 'zalo')).json.code).toBe('message_no_consent');
      expect((await sendLink(cv, q, 'sms')).json.code).toBe('message_no_consent');
    });

    it('FR-CRM-010: a service consent given in person lets the link go by sms; a withdrawal for one channel stops only that channel', async () => {
      // cus_biz has only the withdrawn zalo consent of the test above
      expect((await consent(cv, 'cus_biz', 'in_person')).status).toBe(201);
      const q = await sentQuote(cv, 'veh_biz');
      const before = (await smsOutbox('quote-link')).length;
      const ok = await sendLink(cv, q, 'sms');
      expect(ok.status, ok.text).toBe(200);
      expect(ok.json).toMatchObject({ channel: 'sms', status: 'sent' });
      expect((await smsOutbox('quote-link')).length).toBe(before + 1);
      // zalo was withdrawn explicitly and not granted again: refused, nothing sent
      const zalo = await sendLink(cv, q, 'zalo');
      expect(zalo.status).toBe(409);
      expect(zalo.json.code).toBe('message_no_consent');
      expect((await smsOutbox('quote-link')).length).toBe(before + 1);
    });

    it('PDPL: a customer without a usable contact for the channel is refused (409)', async () => {
      // cus_biz has a phone but no e-mail
      expect((await consent(cv, 'cus_biz', 'email')).status).toBe(201);
      const q = await sentQuote(cv, 'veh_biz');
      const r = await sendLink(cv, q, 'email');
      expect(r.status).toBe(409);
      expect(r.json.code).toBe('message_no_contact');
    });

    it('a channel without an adapter is refused (422); the email channel reuses the email outbox', async () => {
      expect((await consent(cv, 'cus_an', 'email')).status).toBe(201);
      const q = await sentQuote(cv, 'veh_an');
      const email = await sendLink(cv, q, 'email');
      expect(email.json.status).toBe('sent');
      const mails = (await emailOutbox()).filter((m) => m.to === 'an.demo@example.test');
      expect(mails.length).toBeGreaterThanOrEqual(1);
      const gw = h.container.sys.messages;
      const sys = h.container.sys as unknown as { messages: MessageGateway };
      try {
        sys.messages = new ChannelMessageGateway({});
        const off = await sendLink(cv, q, 'sms');
        expect(off.status).toBe(422);
        expect(off.json.code).toBe('message_channel_unavailable');
      } finally {
        sys.messages = gw;
      }
    });

    it('NFR-ISO-01: a quote of another branch is 404 and sends nothing', async () => {
      const q = await sentQuote(cv, 'veh_an');
      const before = (await rows('messageOutbox')).length;
      const r = await sendLink(qlTd, q, 'sms');
      expect(r.status).toBe(404);
      expect((await rows('messageOutbox')).length).toBe(before);
    });

    it('sending needs a session (401)', async () => {
      const r = await h.call('POST', '/api/v1/rec/quotes/nope/send-link', {
        body: { version: 1, channel: 'sms' },
        key: key('snd'),
      });
      expect(r.status).toBe(401);
    });
  });

  describe('retry job (messageRetry)', () => {
    /** fails the first `failures` sends of the sms channel, then lets them through */
    function flaky(failures: number) {
      const real = h.container.sys.messages;
      const sys = h.container.sys as unknown as { messages: MessageGateway };
      let left = failures;
      let calls = 0;
      sys.messages = {
        availableChannels: () => real.availableChannels(),
        isSimulated: (c) => real.isSimulated(c),
        async send(m: OutboundMessage) {
          calls++;
          if (m.template === 'quote-link' && left-- > 0) throw new MessageDeliveryError(m.channel);
          return real.send(m);
        },
      };
      return { calls: () => calls, restore: () => (sys.messages = real) };
    }
    /** moves the clock; sessions idle out, so staff log in again */
    const advance = async (minutes: number) => {
      h.clock.set(new Date(h.clock.now().getTime() + minutes * 60_000).toISOString());
      cv = await h.loginAt('u_cv_q7', 'br_q7');
      owner = await h.login('u_owner');
    };

    it('a refused delivery stays pending and the job sends it once, later runs do nothing', async () => {
      const q = await sentQuote(cv, 'veh_an');
      const before = (await smsOutbox('quote-link')).length;
      const f = flaky(1);
      try {
        const r = await sendLink(cv, q, 'sms');
        expect(r.status).toBe(202);
        expect(r.json.status).toBe('pending');
        expect((await smsOutbox('quote-link')).length).toBe(before);
        // not due yet: nothing happens
        const early = (await cron()).json.branches.find((b: Row) => b.branchId === 'br_q7');
        expect(early.messageRetry).toMatchObject({ due: 0, sent: 0 });
        await advance(3);
        const run = (await cron()).json.branches.find((b: Row) => b.branchId === 'br_q7');
        expect(run.messageRetry).toMatchObject({ due: 1, sent: 1, dead: 0 });
        expect((await smsOutbox('quote-link')).length).toBe(before + 1);
        const again = (await cron()).json.branches.find((b: Row) => b.branchId === 'br_q7');
        expect(again.messageRetry).toMatchObject({ due: 0, sent: 0 });
        expect((await smsOutbox('quote-link')).length).toBe(before + 1);
        // the link in the retried message is a live one (the first, undelivered link was replaced)
        const last = (await smsOutbox('quote-link')).at(-1)!;
        await expect(
          viewPublicQuote(h.container.rec, tokenOf(last.vars.link), { address: '198.51.100.250' }),
        ).resolves.toMatchObject({ state: 'open' });
        const del = (await rows('messageDeliveries')).find((d) => d.quoteId === q.id)!;
        expect(del).toMatchObject({ status: 'sent', attempts: 2 });
        expect(del.recipientMasked).not.toContain('0900000211');
        const q2 = (await rows('messageQueues')).find((x) => x.id === 'br_q7')!;
        expect(Object.keys(q2.items)).not.toContain(del.id);
      } finally {
        f.restore();
      }
    });

    it('attempts are bounded: after the last one the delivery is dead and audited, never sent', async () => {
      const q = await sentQuote(cv, 'veh_an');
      const max = h.container.rec.rec.delivery.maxAttempts;
      h.container.rec.rec.delivery.maxAttempts = 2;
      const before = (await smsOutbox('quote-link')).length;
      const f = flaky(99);
      try {
        expect((await sendLink(cv, q, 'sms')).json.status).toBe('pending');
        await advance(3);
        const run = (await cron()).json.branches.find((b: Row) => b.branchId === 'br_q7');
        expect(run.messageRetry).toMatchObject({ due: 1, sent: 0, dead: 1 });
        await advance(60);
        const after = (await cron()).json.branches.find((b: Row) => b.branchId === 'br_q7');
        expect(after.messageRetry).toMatchObject({ due: 0 });
        expect(f.calls()).toBe(2);
        expect((await smsOutbox('quote-link')).length).toBe(before);
        const del = (await rows('messageDeliveries')).find((d) => d.quoteId === q.id)!;
        expect(del).toMatchObject({ status: 'dead', deadReason: 'attempts_exhausted' });
        const failed = (await rows('auditLogs')).filter(
          (a) => a.entityId === q.id && a.action === 'quote.link_send_failed',
        );
        expect(failed).toHaveLength(1);
      } finally {
        f.restore();
        h.container.rec.rec.delivery.maxAttempts = max;
      }
    });

    it('PDPL: consent withdrawn before the retry stops the delivery (dead, no_consent)', async () => {
      const g = await consent(cv, 'cus_an', 'zalo');
      const q = await sentQuote(cv, 'veh_an');
      const f = flaky(1);
      try {
        const sys = h.container.sys as unknown as { messages: MessageGateway };
        const real = sys.messages;
        // zalo is flaky only through the wrapper installed above (template quote-link)
        expect((await sendLink(cv, q, 'zalo')).json.status).toBe('pending');
        sys.messages = real;
        await withdraw(cv, g.json);
        await advance(3);
        const run = (await cron()).json.branches.find((b: Row) => b.branchId === 'br_q7');
        expect(run.messageRetry).toMatchObject({ due: 1, sent: 0, dead: 1 });
        const del = (await rows('messageDeliveries')).find((d) => d.quoteId === q.id)!;
        expect(del).toMatchObject({ status: 'dead', deadReason: 'no_consent' });
      } finally {
        f.restore();
      }
    });
  });

  describe('one-time code on approval (QUO-04/05, R27)', () => {
    const THRESHOLD = 500_000;
    const all = [1, 2, 3, 4];
    const decl = (nos: number[]) => nos.map((itemNo) => ({ itemNo, reasonCode: 'later' }));

    beforeAll(async () => {
      cv = await h.loginAt('u_cv_q7', 'br_q7');
      owner = await h.login('u_owner');
      const p = await call(owner, 'POST', '/api/v1/sys/config/quote-approval', {
        scopeKey: 'branch:br_q7',
        effectiveFrom: today(),
        payload: {
          allowDeclineRequired: true,
          verbalApproval: true,
          otpMode: 'above_threshold',
          otpThresholdVnd: THRESHOLD,
        },
        reason: 'Thử OTP khi giá trị lớn',
      });
      expect(p.status, p.text).toBe(201);
      const d = await call(
        owner,
        'POST',
        `/api/v1/sys/config/quote-approval/${encodeURIComponent(p.json.id)}/decide`,
        { decision: 'approve', reauthPassword: 'Demo!Pass-2026' },
      );
      expect(d.status, d.text).toBe(200);
      h.container.rec.rec.otp.maxAttempts = 3;
      // the hard lock is exercised by its own tests; the others must not reach it
      h.container.rec.rec.otp.maxFailedTotal = 100;
    });

    /** a sent quote with a link that reached the customer by sms; returns the raw token */
    async function linkedQuote(): Promise<{ q: Row; token: string }> {
      cv = await h.loginAt('u_cv_q7', 'br_q7'); // earlier tests may have moved the clock
      const q = await sentQuote(cv, 'veh_an');
      const before = (await smsOutbox('quote-link')).length;
      expect((await sendLink(cv, q, 'sms')).json.status).toBe('sent');
      const out = await smsOutbox('quote-link');
      expect(out.length).toBe(before + 1);
      return { q, token: tokenOf(out.at(-1)!.vars.link) };
    }
    const approve = (token: string, nos: number[], otp?: string) =>
      pub('/api/v1/rec/public/quote/approve', {
        token,
        selectedItemNos: nos,
        declines: decl(all.filter((n) => !nos.includes(n))),
        ...(otp ? { otp } : {}),
      });
    const ask = (token: string, nos: number[]) =>
      pub('/api/v1/rec/public/quote/otp', {
        token,
        selectedItemNos: nos,
        declines: decl(all.filter((n) => !nos.includes(n))),
      });
    const lastCode = async () => (await smsOutbox('approval-otp')).at(-1)!.vars.code as string;
    const wrong = async () => {
      const c = await lastCode();
      return c === '000000' ? '111111' : '000000';
    };

    it('above the threshold the approval needs a code, sent to the phone on file; the right code approves and the evidence notes it', async () => {
      const { q, token } = await linkedQuote();
      const no = await approve(token, all);
      expect(no.status).toBe(428);
      expect(no.json.code).toBe('otp_required');
      const before = (await smsOutbox('approval-otp')).length;
      const asked = await ask(token, all);
      expect(asked.status, asked.text).toBe(200);
      expect(asked.json).toMatchObject({ required: true, sent: true, channel: 'sms' });
      expect(asked.json.destination).not.toContain('0900000211');
      const sms = await smsOutbox('approval-otp');
      expect(sms.length).toBe(before + 1);
      expect(sms.at(-1)!.to).toBe('0900000211'); // the contact on file, not anything from the request
      const code = await lastCode();
      expect(code).toMatch(/^\d{6}$/);
      // only a hash of the code is stored; nothing else holds it
      const stored = (await rows('quoteOtps'))[0]!;
      expect(JSON.stringify(stored)).not.toContain(code);
      expect(stored.codeHash).toMatch(/^[0-9a-f]{64}$/);
      for (const c of ['auditLogs', 'quoteVersions', 'idempotencyKeys'])
        expect(JSON.stringify(await rows(c)), c).not.toContain(`"${code}"`);

      const bad = await approve(token, all, await wrong());
      expect(bad.status).toBe(422);
      expect(bad.json.code).toBe('otp_invalid');
      expect((await rows('quoteOtps'))[0]!.attempts).toBe(1); // survives the failing request

      const ok = await approve(token, all, code);
      expect(ok.status, ok.text).toBe(200);
      expect(ok.json.state).toBe('approved');
      const v = (await rows('quoteVersions')).find((x) => x.quoteId === q.id)!;
      expect(v.approval.otp).toMatchObject({ channel: 'sms' });
      expect(v.approval.hash).toMatch(/^[0-9a-f]{64}$/);
      const audit = (await rows('auditLogs')).find(
        (a) => a.entityId === q.id && a.action === 'quote.approve_link',
      )!;
      expect(audit.after).toMatchObject({ otpVerified: true, otpChannel: 'sms' });
      expect(JSON.stringify(await rows('auditLogs'))).not.toContain(`"${code}"`);
      // a double tap after the approval needs no code and repeats nothing
      const again = await approve(token, all, code);
      expect(again.status).toBe(200);
      expect(again.json.repeated).toBe(true);
    });

    it('below the threshold no code is needed', async () => {
      const { token } = await linkedQuote();
      const before = (await smsOutbox('approval-otp')).length;
      const asked = await ask(token, [4]);
      expect(asked.json).toEqual({ required: false });
      const r = await approve(token, [4]);
      expect(r.status, r.text).toBe(200);
      expect((await smsOutbox('approval-otp')).length).toBe(before);
    });

    it('a code asked twice inside the cooldown is sent once; another selection waits (429)', async () => {
      const { token } = await linkedQuote();
      const before = (await smsOutbox('approval-otp')).length;
      expect((await ask(token, all)).json.sent).toBe(true);
      const dup = await ask(token, all);
      expect(dup.status).toBe(200);
      expect(dup.json.sent).toBe(false);
      expect((await smsOutbox('approval-otp')).length).toBe(before + 1);
      const other = await ask(token, [1, 2, 3]);
      expect(other.status).toBe(429);
      expect(other.json.code).toBe('otp_cooldown');
      expect(other.json.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('a code for one selection does not approve another', async () => {
      const { token } = await linkedQuote();
      await ask(token, all);
      const code = await lastCode();
      const r = await approve(token, [1, 2, 3], code);
      expect(r.status).toBe(428);
      expect(r.json.code).toBe('otp_required');
    });

    it('an expired code is refused (422) and a new one can be asked for after the cooldown', async () => {
      const { token } = await linkedQuote();
      await ask(token, all);
      const old = await lastCode();
      h.clock.set(new Date(h.clock.now().getTime() + 6 * 60_000).toISOString());
      const r = await approve(token, all, old);
      expect(r.status).toBe(422);
      expect(r.json.code).toBe('otp_expired');
      const fresh = await ask(token, all);
      expect(fresh.json.sent).toBe(true);
      const code = await lastCode();
      expect(code).not.toBe('');
      // the old code no longer works, the new one does
      expect((await approve(token, all, old === code ? await wrong() : old)).status).toBe(422);
      expect((await approve(token, all, code)).status).toBe(200);
    });

    it('too many wrong codes lock it (423), even the right one is refused afterwards', async () => {
      const { token } = await linkedQuote();
      await ask(token, all);
      const code = await lastCode();
      const w = await wrong();
      expect((await approve(token, all, w)).json.code).toBe('otp_invalid');
      expect((await approve(token, all, w)).json.code).toBe('otp_invalid');
      const third = await approve(token, all, w);
      expect(third.status).toBe(423);
      expect(third.json.code).toBe('otp_locked');
      expect((await approve(token, all, code)).status).toBe(423);
      // a locked link cannot request fresh codes right away either
      expect((await ask(token, all)).status).toBe(423);
    });

    describe('race, soft lock and hard lock (A4 hardening)', () => {
      const otpCfg = () => h.container.rec.rec.otp;
      const adv = (ms: number) => h.clock.set(new Date(h.clock.now().getTime() + ms).toISOString());
      const otpRow = async (quoteId: string) =>
        (await rows('quoteOtps')).find((r) => r.quoteId === quoteId)!;
      /** settings overridden for one test and restored */
      async function withCfg(over: Partial<ReturnType<typeof otpCfg>>, fn: () => Promise<void>) {
        const saved = { ...otpCfg() };
        Object.assign(otpCfg(), over);
        try {
          await fn();
        } finally {
          Object.assign(otpCfg(), saved);
        }
      }
      /** 4 wrong tries on each of 3 codes (limit 12 in total); returns the response of the last wrong try */
      async function wrongOnThreeCodes(token: string) {
        let last: Awaited<ReturnType<typeof approve>> | undefined;
        for (let round = 0; round < 3; round++) {
          if (round > 0) adv(16 * 60_000); // past the cooldown and the per-link decision limiter window
          expect((await ask(token, all)).json.sent).toBe(true);
          for (let i = 0; i < 4; i++) last = await approve(token, all, await wrong());
          if (round < 2) expect(last!.json.code).toBe('otp_invalid');
        }
        return last!;
      }

      it('FR-REC-008: two concurrent requests for one link and selection send one message; its code approves', async () => {
        const { q, token } = await linkedQuote();
        const before = (await smsOutbox('approval-otp')).length;
        // hold both requests before the transaction, so both pass the early check and race for the write
        const sys = h.container.sys as unknown as {
          limiter: { hit: (...a: unknown[]) => unknown };
        };
        const real = sys.limiter;
        let arrived = 0;
        let release!: () => void;
        const gate = new Promise<void>((r) => (release = r));
        sys.limiter = {
          ...real,
          hit: async (...a: unknown[]) => {
            if (a[0] === 'quote-otp-send' && ++arrived === 2) release();
            if (a[0] === 'quote-otp-send') await gate;
            return real.hit(...a);
          },
        };
        let res: Awaited<ReturnType<typeof ask>>[];
        try {
          res = await Promise.all([ask(token, all), ask(token, all)]);
        } finally {
          sys.limiter = real;
        }
        expect(res.map((r) => r.status)).toEqual([200, 200]);
        expect(res.filter((r) => r.json.sent === true)).toHaveLength(1);
        expect(res.filter((r) => r.json.sent === false)).toHaveLength(1);
        const out = await smsOutbox('approval-otp');
        expect(out.length).toBe(before + 1);
        const ok = await approve(token, all, await lastCode());
        expect(ok.status, ok.text).toBe(200);
        expect((await otpRow(q.id)).attempts).toBe(0); // no wrong try was counted
      });

      it('a gateway failure drops the code only while the record is still the one this request wrote', async () => {
        const { q, token } = await linkedQuote();
        const sys = h.container.sys as unknown as { messages: MessageGateway };
        const real = sys.messages;
        const failing = (beforeFail?: () => Promise<void>): MessageGateway => ({
          availableChannels: () => real.availableChannels(),
          isSimulated: (c) => real.isSimulated(c),
          async send(m: OutboundMessage) {
            if (m.template !== 'approval-otp') return real.send(m);
            await beforeFail?.();
            throw new MessageDeliveryError(m.channel);
          },
        });
        try {
          // a concurrent request replaced the code meanwhile: the record stays
          sys.messages = failing(async () => {
            await h.container.rec.sys.uow.run(async (tx) => {
              h.container.rec.otps.update(tx, (await otpRow(q.id)).id, {
                codeHash: 'f'.repeat(64),
              });
            });
          });
          const a = await ask(token, all);
          expect(a.status).toBe(502);
          expect((await otpRow(q.id)).codeHash).toBe('f'.repeat(64));
          // a plain failure removes its own record: the next request is not held by the cooldown
          await h.container.rec.sys.uow.run(async (tx) => {
            h.container.rec.otps.delete(tx, (await otpRow(q.id)).id);
          });
          sys.messages = failing();
          expect((await ask(token, all)).status).toBe(502);
          expect((await rows('quoteOtps')).find((r) => r.quoteId === q.id)).toBeUndefined();
        } finally {
          sys.messages = real;
        }
        expect((await ask(token, all)).json.sent).toBe(true);
      });

      it('FR-REC-008: wrong tries survive a new code; the third code ends in a hard lock (423 otp_link_locked)', async () => {
        const { q, token } = await linkedQuote();
        await withCfg({ maxAttempts: 5, maxFailedTotal: 12 }, async () => {
          const last = await wrongOnThreeCodes(token);
          expect(last.status).toBe(423);
          expect(last.json.code).toBe('otp_link_locked');
          const row = await otpRow(q.id);
          expect(row.failedTotal).toBe(12);
          expect(row.hardLockedAt).toBeTruthy();
          // the right code and a new code are refused too
          const right = await approve(token, all, await lastCode());
          expect(right.status).toBe(423);
          expect(right.json.code).toBe('otp_link_locked');
          adv(3_600_000);
          const again = await ask(token, all);
          expect(again.status).toBe(423);
          expect(again.json.code).toBe('otp_link_locked');
          const audit = (await rows('auditLogs')).filter(
            (a) => a.entityId === q.id && a.action === 'quote.otp_locked',
          );
          expect(audit.at(-1)!.after).toMatchObject({ hard: true, failedTotal: 12 });
        });
      });

      it('a new link from staff starts with a clean budget', async () => {
        const { q, token } = await linkedQuote();
        await withCfg({ maxAttempts: 5, maxFailedTotal: 12 }, async () => {
          expect((await wrongOnThreeCodes(token)).json.code).toBe('otp_link_locked');
          cv = await h.loginAt('u_cv_q7', 'br_q7'); // the session idled while the clock moved
          expect((await sendLink(cv, q, 'sms')).json.status).toBe('sent');
          const fresh = tokenOf((await smsOutbox('quote-link')).at(-1)!.vars.link);
          expect(fresh).not.toBe(token);
          expect((await ask(fresh, all)).json.sent).toBe(true);
          const code = await lastCode();
          expect((await approve(fresh, all, await wrong())).json.code).toBe('otp_invalid');
          expect((await approve(fresh, all, code)).status).toBe(200);
        });
      });

      it('the soft lock lasts lockMs, not the limiter window', async () => {
        const { token } = await linkedQuote();
        await withCfg({ sendWindowMs: 2 * 60_000, lockMs: 10 * 60_000 }, async () => {
          await ask(token, all);
          const w = await wrong();
          for (let i = 0; i < 2; i++)
            expect((await approve(token, all, w)).json.code).toBe('otp_invalid');
          expect((await approve(token, all, w)).json.code).toBe('otp_locked');
          adv(3 * 60_000); // past the window, inside the lock
          const early = await ask(token, all);
          expect(early.status).toBe(423);
          expect(early.json.code).toBe('otp_locked');
          adv(8 * 60_000); // 11 minutes after the lock
          const later = await ask(token, all);
          expect(later.status, later.text).toBe(200);
          expect(later.json.sent).toBe(true);
        });
      });

      it('the hard lock survives the code TTL: the record is kept for failureMemoryMs', async () => {
        const { q, token } = await linkedQuote();
        await withCfg({ maxAttempts: 5, maxFailedTotal: 12 }, async () => {
          await wrongOnThreeCodes(token);
          const row = await otpRow(q.id);
          const thirtyDays = 30 * 24 * 3_600_000;
          expect(ms(row.expiresAt)).toBeGreaterThanOrEqual(h.clock.now().getTime() + thirtyDays);
          // far past the code expiry + 1 day the lock still answers
          adv(2 * 24 * 3_600_000);
          expect((await approve(token, all, await lastCode())).json.code).toBe('otp_link_locked');
        });
      });
    });

    it('a malformed code is a validation error, and rejecting the quote never needs a code', async () => {
      const { token } = await linkedQuote();
      const bad = await approve(token, all, '12ab');
      expect(bad.status).toBe(422);
      const rej = await pub('/api/v1/rec/public/quote/reject', {
        token,
        reason: 'Giá cao hơn dự kiến',
      });
      expect(rej.status, rej.text).toBe(200);
    });

    it('the code request of an unknown link is 404 like the page', async () => {
      const r = await ask('a'.repeat(43), all);
      expect(r.status).toBe(404);
    });

    /**
     * otpMode 'always' (QUO-04/05): the code is required whatever the total. The config is branch-wide and shared,
     * so 'always' is an effective-dated entry for tomorrow, the clock moves there, and a later entry restores
     * 'above_threshold' for the day after; the clock ends past it so nothing after this block sees 'always'.
     */
    describe("otpMode 'always'", () => {
      const DAY = 24 * 3_600_000;
      const addDays = (n: number) => businessDate(new Date(h.clock.now().getTime() + n * DAY));
      const publish = async (effectiveFrom: string, otpMode: string) => {
        const p = await call(owner, 'POST', '/api/v1/sys/config/quote-approval', {
          scopeKey: 'branch:br_q7',
          effectiveFrom,
          payload: {
            allowDeclineRequired: true,
            verbalApproval: true,
            otpMode,
            otpThresholdVnd: THRESHOLD,
          },
          reason: 'Thử OTP luôn bắt buộc',
        });
        expect(p.status, p.text).toBe(201);
        const d = await call(
          owner,
          'POST',
          `/api/v1/sys/config/quote-approval/${encodeURIComponent(p.json.id)}/decide`,
          { decision: 'approve', reauthPassword: 'Demo!Pass-2026' },
        );
        expect(d.status, d.text).toBe(200);
      };
      const auditCount = async (quoteId: string) =>
        (await rows('auditLogs')).filter(
          (a) => a.entityId === quoteId && a.action === 'quote.approve_link',
        ).length;

      beforeAll(async () => {
        owner = await h.login('u_owner');
        await publish(addDays(1), 'always');
        await publish(addDays(2), 'above_threshold');
        h.clock.set(new Date(h.clock.now().getTime() + DAY).toISOString()); // 'always' is in force
      });
      afterAll(() => {
        h.clock.set(new Date(h.clock.now().getTime() + DAY).toISOString()); // restored default in force
      });

      it('always: even a small total needs a code', async () => {
        const { token } = await linkedQuote();
        const before = (await smsOutbox('approval-otp')).length;
        const no = await approve(token, [4]);
        expect(no.status).toBe(428);
        expect(no.json.code).toBe('otp_required');
        const asked = await ask(token, [4]);
        expect(asked.json).toMatchObject({ required: true, sent: true, channel: 'sms' });
        expect((await smsOutbox('approval-otp')).length).toBe(before + 1);
      });

      it('always: the right code approves and the evidence records the channel', async () => {
        const { q, token } = await linkedQuote();
        expect((await ask(token, [4])).json.sent).toBe(true);
        const code = await lastCode();
        const ok = await approve(token, [4], code);
        expect(ok.status, ok.text).toBe(200);
        expect(ok.json.state).toBe('approved');
        const v = (await rows('quoteVersions')).find((x) => x.quoteId === q.id)!;
        expect(v.approval.otp).toMatchObject({ channel: 'sms' });
        const audit = (await rows('auditLogs')).find(
          (a) => a.entityId === q.id && a.action === 'quote.approve_link',
        )!;
        expect(audit.after).toMatchObject({ otpVerified: true, otpChannel: 'sms' });
      });

      it('always: a code asked for another selection does not approve this one', async () => {
        const { q, token } = await linkedQuote();
        await ask(token, [4]);
        const code = await lastCode();
        const r = await approve(token, [3], code);
        expect(r.status).toBe(428);
        expect(r.json.code).toBe('otp_required');
        expect(await auditCount(q.id)).toBe(0);
      });

      it('always: approving twice with the same code never approves a second time', async () => {
        const { q, token } = await linkedQuote();
        await ask(token, [4]);
        const code = await lastCode();
        expect((await approve(token, [4], code)).status).toBe(200);
        const again = await approve(token, [4], code);
        // like any decided quote: a repeat answer or a refusal, never another approval
        expect([200, 409, 422, 428]).toContain(again.status);
        if (again.status === 200) expect(again.json.repeated).toBe(true);
        expect(await auditCount(q.id)).toBe(1);
        expect(
          (await rows('quoteVersions')).filter((x) => x.quoteId === q.id && x.approval),
        ).toHaveLength(1);
      });
    });
  });
});
