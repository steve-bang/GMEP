import { beforeAll, describe, expect, it } from 'vitest';
import { getDb } from '@/infrastructure/firestore/client';
import { businessDate } from '@/platform/format/date';
import { allBranchesScope } from '@/platform/scope/scope';
import { readCookie, SESSION_COOKIE } from '@/platform/http/cookies';
import { resolveSession } from '@/modules/sys';
import {
  allocateRepairOrderNumber,
  approveViaLink,
  getApprovedQuote,
  getServiceWorkflow,
  rejectViaLink,
  viewPublicQuote,
} from '@/modules/rec';
import { backends, createHarness, type Harness } from './harness';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
let seq = 0;
const key = (p: string) => `${p}-${String(++seq).padStart(6, '0')}-xxxxxxxx`;

const SV_DAU = 'svc_tnt_demo_SV-DAU'; // 30 min = 150.000 at 300.000/h
const SV_PHANH = 'svc_tnt_demo_SV-PHANH'; // 90 min = 450.000
const SV_CAN = 'svc_tnt_demo_SV-CANCHINH'; // 60 min = 300.000
const P_FILTER = 'part_seed_01'; // list 130.000
const VEH_AN = 'veh_an';
const VEH_BIZ = 'veh_biz';

/**
 * Slice 1.5 approval: FR-REC-008 (customer link), FR-REC-009 and FR-REC-026 (approval evidence, counter),
 * FR-REC-023 (versions, locked content), FR-REC-030 (order code), FR-REC-031 (price snapshot), FR-REC-032
 * (workflow per service type); RULE-005/007; NFR-ISO-01. Sample VAT 8% (800 bp) is NOT accountant sign-off.
 */
describe.each(backends)('REC quote approval [%s]', (backend) => {
  let h: Harness;
  let cv: string;
  let ql: string;
  let qlTd: string;
  let th: string;
  let kt: string;
  let owner: string;
  const today = () => businessDate(h.clock.now());

  const rows = async (name: string): Promise<Row[]> =>
    backend === 'memory'
      ? ([...h.container.memory!.db.col(name).entries()].map(([id, v]) => ({ id, ...v })) as Row[])
      : ((await getDb(h.container.env).collection(name).get()).docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Row[]);
  const call = (cookie: string, method: string, path: string, body?: unknown, k = key('apr')) =>
    h.call(method, path, { cookie, key: k, ...(body !== undefined ? { body } : {}) });
  let ip = 0;
  const pub = (
    path: string,
    body: unknown,
    k = key('pub'),
    address = `203.0.113.${(ip++ % 200) + 10}`,
  ) =>
    h.call('POST', path, {
      body,
      key: k,
      headers: { 'x-forwarded-for': address },
    });

  // the odometer only goes up between visits of the same vehicle (FR-REC-003), so every intake reads higher
  let odo = 200_000;
  async function completedIntake(cookie: string, vehicleId: string, km0: number): Promise<Row> {
    void km0;
    const km = (odo += 100);
    const c = await call(cookie, 'POST', '/api/v1/rec/intakes', { vehicleId });
    expect(c.status, c.text).toBe(201);
    const p = await call(cookie, 'PATCH', `/api/v1/rec/intakes/${c.json.id}`, {
      version: c.json.version,
      step: 5,
      km,
      customerRequest: 'Bảo dưỡng và kiểm tra phanh',
      serviceType: 'maintenance',
      promisedDate: '2099-01-01',
    });
    expect(p.status, p.text).toBe(200);
    const done = await call(cookie, 'POST', `/api/v1/rec/intakes/${c.json.id}/complete`, {
      version: p.json.version,
    });
    expect(done.status, done.text).toBe(200);
    return done.json as Row;
  }

  /** 4 items like UAT-17: 2 required (oil+filter, brakes), 2 optional (alignment asked by the customer, a spare filter) */
  const fourItems = () => [
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
      customerRequested: true,
      lines: [{ kind: 'labor', serviceId: SV_CAN }],
    },
    {
      name: 'Lọc dự phòng',
      necessity: 'optional',
      lines: [{ kind: 'part', partId: P_FILTER, qty: 1 }],
    },
  ];

  /** a quote that is sent (frozen) and has a customer link; returns the raw token */
  async function sentQuote(
    cookie: string,
    vehicleId: string,
    km: number,
    items: Row[] = fourItems(),
  ): Promise<{ q: Row; token: string }> {
    const i = await completedIntake(cookie, vehicleId, km);
    const created = await call(cookie, 'POST', '/api/v1/rec/quotes', { intakeId: i.id });
    expect(created.status, created.text).toBe(201);
    const edited = await call(cookie, 'PATCH', `/api/v1/rec/quotes/${created.json.id}`, {
      version: created.json.version,
      items,
    });
    expect(edited.status, edited.text).toBe(200);
    const sent = await call(cookie, 'POST', `/api/v1/rec/quotes/${created.json.id}/send`, {
      version: edited.json.version,
    });
    expect(sent.status, sent.text).toBe(200);
    const link = await call(cookie, 'POST', `/api/v1/rec/quotes/${created.json.id}/link`, {
      version: sent.json.version,
    });
    expect(link.status, link.text).toBe(201);
    const q = (await call(cookie, 'GET', `/api/v1/rec/quotes/${created.json.id}`)).json;
    return { q, token: link.json.token };
  }
  const actorOf = async (cookie: string) =>
    (await resolveSession(h.container.sys, readCookie(cookie, SESSION_COOKIE))).actor;
  const reasonFor = (...nos: number[]) => nos.map((itemNo) => ({ itemNo, reasonCode: 'later' }));

  beforeAll(async () => {
    h = await createHarness(backend);
    cv = await h.loginAt('u_cv_q7', 'br_q7');
    ql = await h.loginAt('u_ql_q7', 'br_q7');
    qlTd = await h.loginAt('u_ql_td', 'br_td');
    th = await h.loginAt('u_th_q7', 'br_q7');
    kt = await h.login('u_kt');
    owner = await h.login('u_owner');
  });

  describe('customer link (FR-REC-008)', () => {
    it('FR-REC-008: only a sent version gets a link; the token is >= 128 bit and only its hash is stored', async () => {
      const i = await completedIntake(cv, VEH_AN, 70000);
      const created = await call(cv, 'POST', '/api/v1/rec/quotes', { intakeId: i.id });
      const draftLink = await call(cv, 'POST', `/api/v1/rec/quotes/${created.json.id}/link`, {
        version: created.json.version,
      });
      expect(draftLink.status).toBe(409);
      const { token } = await sentQuote(cv, VEH_BIZ, 31500);
      expect(Buffer.from(token, 'base64url').length).toBeGreaterThanOrEqual(16);
      // nothing in any collection holds the raw token (secrets are never stored or logged)
      for (const c of [
        'quoteLinks',
        'quoteVersions',
        'quotes',
        'auditLogs',
        'idempotencyKeys',
        'notifications',
      ])
        expect(JSON.stringify(await rows(c)), c).not.toContain(token);
      expect((await rows('quoteLinks')).every((l) => /^[0-9a-f]{64}$/.test(l.id))).toBe(true);
    });

    it('FR-REC-008: the page shows the quote without an account and with minimal personal data', async () => {
      const { token } = await sentQuote(cv, VEH_AN, 71000);
      const v = await viewPublicQuote(h.container.rec, token, { address: '203.0.113.1' });
      expect(v).toMatchObject({ state: 'open', plate: '51H-123.45', customerGivenName: 'An' });
      expect(v.items).toHaveLength(4);
      // required items and the optional one the customer asked for start ticked; the other optional does not
      expect(v.items.map((x) => x.defaultSelected)).toEqual([true, true, true, false]);
      const raw = JSON.stringify(v);
      expect(raw).not.toContain('Nguyễn Văn An'); // given name only
      expect(raw).not.toMatch(/0900000|@demo|cost|available|advisor/i);
    });

    it('FR-REC-008: unknown, malformed and replaced tokens all look the same (404)', async () => {
      const { q, token } = await sentQuote(cv, VEH_AN, 72000);
      for (const bad of ['x', 'a'.repeat(43), `${token}x`])
        await expect(
          viewPublicQuote(h.container.rec, bad, { address: '203.0.113.2' }),
        ).rejects.toMatchObject({ status: 404 });
      // issuing again replaces the link: the old one stops working at once
      const fresh = await call(cv, 'POST', `/api/v1/rec/quotes/${q.id}/link`, {
        version: (await call(cv, 'GET', `/api/v1/rec/quotes/${q.id}`)).json.version,
      });
      expect(fresh.status).toBe(201);
      await expect(
        viewPublicQuote(h.container.rec, token, { address: '203.0.113.2' }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        viewPublicQuote(h.container.rec, fresh.json.token, { address: '203.0.113.2' }),
      ).resolves.toMatchObject({ state: 'open' });
    });

    it('FR-REC-008: a link is rate limited per address and per token', async () => {
      const { token } = await sentQuote(cv, VEH_AN, 73000);
      let limited = 0;
      for (let i = 0; i < 70; i++)
        await viewPublicQuote(h.container.rec, token, { address: '203.0.113.77' }).catch(
          (e: { status?: number }) => {
            if (e.status === 429) limited++;
          },
        );
      expect(limited).toBeGreaterThan(0);
    });

    it('FR-REC-008: issuing a link needs quote:update in the branch (TH, KT refused; other branch 404)', async () => {
      const { q } = await sentQuote(cv, VEH_AN, 73500);
      const body = { version: q.version };
      expect((await call(th, 'POST', `/api/v1/rec/quotes/${q.id}/link`, body)).status).toBe(403);
      expect((await call(kt, 'POST', `/api/v1/rec/quotes/${q.id}/link`, body)).status).toBe(403);
      expect((await call(qlTd, 'POST', `/api/v1/rec/quotes/${q.id}/link`, body)).status).toBe(404);
    });
  });

  describe('approval through the link (FR-REC-009, RULE-005)', () => {
    it('FR-REC-009 / UAT-17: partial approval recomputes tax on the approved set, keeps evidence and locks the content', async () => {
      const { q, token } = await sentQuote(cv, VEH_AN, 74000);
      // net: item1 150.000+130.000=280.000, item2 450.000, item3 300.000, item4 130.000 -> 1.160.000; VAT 8%
      expect(q.shown.totals).toMatchObject({ subtotalVnd: 1_160_000, totalVnd: 1_252_800 });
      const k = key('lnk');
      const r = await pub(
        '/api/v1/rec/public/quote/approve',
        {
          token,
          selectedItemNos: [1, 3],
          declines: [...reasonFor(2), { itemNo: 4 }],
        },
        k,
      );
      expect(r.status, r.text).toBe(200);
      // approved net 280.000 + 300.000 = 580.000; tax 46.400; total 626.400 (not prorated from the original)
      expect(r.json).toMatchObject({
        state: 'approved',
        mode: 'partial',
        approvedTotalVnd: 626_400,
        approvedTaxVnd: 46_400,
        itemNos: [1, 3],
        repeated: false,
      });
      const after = (await call(cv, 'GET', `/api/v1/rec/quotes/${q.id}`)).json;
      expect(after.status).toBe('approved_partial');
      expect(after.approvedTotalVnd).toBe(626_400);
      expect(after.shown.approval).toMatchObject({
        method: 'link',
        mode: 'partial',
        recordedBy: null,
        approvedItemNos: [1, 3],
        exception: false,
      });
      expect(after.shown.approval.hash).toMatch(/^[0-9a-f]{64}$/);
      // the refused REQUIRED item carries the safety flag for the reminder list; the optional one does not
      const [d2, d4] = after.shown.approval.declined;
      expect(d2).toMatchObject({
        itemNo: 2,
        necessity: 'required',
        safety: true,
        reasonCode: 'later',
      });
      expect(d4).toMatchObject({ itemNo: 4, necessity: 'optional', safety: false });
      // content locked: no edit, no new version, no second send (RULE-005 / FR-REC-023)
      const edit = await call(cv, 'PATCH', `/api/v1/rec/quotes/${q.id}`, {
        version: after.version,
        items: fourItems(),
      });
      expect(edit.status).toBe(409);
      expect(edit.json.code).toBe('quote_locked');
      const resend = await call(cv, 'POST', `/api/v1/rec/quotes/${q.id}/send`, {
        version: after.version,
      });
      expect(resend.status).toBe(409);
    });

    it('FR-REC-009: a repeated tap is idempotent (same key replays; another key with the same choice is a no-op)', async () => {
      const { q, token } = await sentQuote(cv, VEH_AN, 75000);
      const k = key('dbl');
      const body = { token, selectedItemNos: [1, 2, 3, 4] };
      const a = await pub('/api/v1/rec/public/quote/approve', body, k);
      expect(a.status).toBe(200);
      expect(a.json).toMatchObject({ mode: 'full', repeated: false });
      const same = await pub('/api/v1/rec/public/quote/approve', body, k);
      expect(same.headers.get('idempotent-replayed')).toBe('true');
      const other = await pub('/api/v1/rec/public/quote/approve', body, key('dbl'));
      expect(other.status).toBe(200);
      expect(other.json.repeated).toBe(true);
      const audit = (await rows('auditLogs')).filter(
        (x) => x.entityId === q.id && x.action === 'quote.approve_link',
      );
      expect(audit).toHaveLength(1);
      expect(audit[0]!.actorId).toMatch(/^customer-link:/);
      // a different choice on the decided version is a conflict, never a second approval
      const diff = await pub(
        '/api/v1/rec/public/quote/approve',
        { token, selectedItemNos: [1] },
        key('dbl'),
      );
      expect(diff.status).toBe(409);
      expect(diff.json.code).toBe('quote_already_decided');
    });

    it('FR-REC-009: full approval needs no reason; ticking nothing is refused (use "reject")', async () => {
      const { token } = await sentQuote(cv, VEH_AN, 76000);
      const none = await pub('/api/v1/rec/public/quote/approve', { token, selectedItemNos: [] });
      expect(none.status).toBe(422);
      const bad = await pub('/api/v1/rec/public/quote/approve', { token, selectedItemNos: [9] });
      expect(bad.status).toBe(422);
    });

    it('ba-answers-03 Câu 2: refusing a required item needs a reason from the catalogue ("khác" also a note)', async () => {
      const { token } = await sentQuote(cv, VEH_AN, 77000);
      const noReason = await pub('/api/v1/rec/public/quote/approve', {
        token,
        selectedItemNos: [1, 3],
      });
      expect(noReason.status).toBe(422);
      const fake = await pub('/api/v1/rec/public/quote/approve', {
        token,
        selectedItemNos: [1, 3],
        declines: [{ itemNo: 2, reasonCode: 'nope' }],
      });
      expect(fake.status).toBe(422);
      const noNote = await pub('/api/v1/rec/public/quote/approve', {
        token,
        selectedItemNos: [1, 3],
        declines: [{ itemNo: 2, reasonCode: 'other' }],
      });
      expect(noNote.status).toBe(422);
      const ok = await pub('/api/v1/rec/public/quote/approve', {
        token,
        selectedItemNos: [1, 3],
        declines: [
          { itemNo: 2, reasonCode: 'other', reasonNote: 'Sẽ sửa ở gara quen' },
          { itemNo: 4 },
        ],
      });
      expect(ok.status, ok.text).toBe(200);
    });

    it('FR-REC-009: the whole quote can be refused through the link and then cannot be approved', async () => {
      const { q, token } = await sentQuote(cv, VEH_AN, 78000);
      const r = await pub('/api/v1/rec/public/quote/reject', { token, reason: 'Giá cao' });
      expect(r.status, r.text).toBe(200);
      expect(r.json).toMatchObject({ state: 'rejected', repeated: false });
      expect((await call(cv, 'GET', `/api/v1/rec/quotes/${q.id}`)).json.status).toBe('rejected');
      const again = await pub('/api/v1/rec/public/quote/reject', { token }, key('pub'));
      expect(again.json.repeated).toBe(true);
      const late = await pub('/api/v1/rec/public/quote/approve', { token, selectedItemNos: [1] });
      expect(late.status).toBe(409);
      const v = await viewPublicQuote(h.container.rec, token, { address: '203.0.113.3' });
      expect(v.state).toBe('rejected');
      expect(v.items).toEqual([]);
    });

    it('FR-REC-023: a new version supersedes the link of the old one; the customer always approves one version', async () => {
      const { q, token } = await sentQuote(cv, VEH_AN, 79000);
      const head = (await call(cv, 'GET', `/api/v1/rec/quotes/${q.id}`)).json;
      const revised = await call(cv, 'PATCH', `/api/v1/rec/quotes/${q.id}`, {
        version: head.version,
        items: fourItems().slice(0, 2),
      });
      expect(revised.status, revised.text).toBe(200);
      expect(revised.json.currentN).toBe(2);
      const v = await viewPublicQuote(h.container.rec, token, { address: '203.0.113.4' });
      expect(v.state).toBe('superseded');
      expect(v.items).toEqual([]);
      const r = await pub('/api/v1/rec/public/quote/approve', { token, selectedItemNos: [1] });
      expect(r.status).toBe(409);
      expect(r.json.code).toBe('quote_superseded');
    });

    it('R10 / R38 / FR-REC-011: an expired quote cannot be approved by link or at the counter; the expired link is read-only (no approve, no refuse)', async () => {
      const { q, token } = await sentQuote(cv, VEH_AN, 80000);
      const real = h.clock.now().toISOString();
      try {
        h.clock.set(new Date(h.clock.now().getTime() + 9 * 86_400_000).toISOString());
        const v = await viewPublicQuote(h.container.rec, token, { address: '203.0.113.5' });
        expect(v.state).toBe('expired');
        // R38: a decision through an expired link looks exactly like an unknown link (404, same body)
        const r = await pub('/api/v1/rec/public/quote/approve', { token, selectedItemNos: [1] });
        expect(r.status).toBe(404);
        const unknown = await pub('/api/v1/rec/public/quote/approve', {
          token: 'u'.repeat(43),
          selectedItemNos: [1],
        });
        expect(unknown.status).toBe(404);
        expect({ code: r.json.code, title: r.json.title, detail: r.json.detail }).toEqual({
          code: unknown.json.code,
          title: unknown.json.title,
          detail: unknown.json.detail,
        });
        // sessions are time bound too: sign in again on the advanced clock
        const cv2 = await h.loginAt('u_cv_q7', 'br_q7');
        const head = (await call(cv2, 'GET', `/api/v1/rec/quotes/${q.id}`)).json;
        expect(head.status).toBe('expired');
        expect(head.allowed).not.toContain('approve');
        const c = await call(cv2, 'POST', `/api/v1/rec/quotes/${q.id}/approve`, {
          version: head.version,
          method: 'counter_signature',
          selectedItemNos: [1, 2, 3, 4],
          signerName: 'Nguyễn Văn An',
        });
        expect(c.status).toBe(409);
        expect(c.json.code).toBe('quote_expired');
        // R38: the customer cannot refuse through the expired link either; staff record the refusal for them
        const no = await pub('/api/v1/rec/public/quote/reject', { token });
        expect(no.status, no.text).toBe(404);
        const staff = await call(cv2, 'POST', `/api/v1/rec/quotes/${q.id}/reject`, {
          version: head.version,
          reason: 'Khách báo không làm nữa',
        });
        expect(staff.status, staff.text).toBe(200);
      } finally {
        h.clock.set(real);
      }
    });

    it('FR-REC-009: the advisor and the branch manager are told, without personal data; the audit names the link, not a person', async () => {
      const { q, token } = await sentQuote(cv, VEH_AN, 81000);
      const ok = await pub('/api/v1/rec/public/quote/approve', {
        token,
        selectedItemNos: [1, 2, 3, 4],
      });
      expect(ok.status).toBe(200);
      for (const who of ['u_cv_q7', 'u_ql_q7']) {
        const n = await h.call('GET', '/api/v1/sys/notifications', { as: who });
        const hit = n.json.items.find(
          (x: { titleKey: string; link: string }) =>
            x.titleKey === 'notifications.quoteApprovedFull' && x.link === `/rec/quotes/${q.id}`,
        );
        expect(hit, who).toMatchObject({ link: `/rec/quotes/${q.id}` });
        expect(JSON.stringify(hit)).not.toMatch(/Nguyễn|0900000|@demo/);
      }
      const noOne = await h.call('GET', '/api/v1/sys/notifications', { as: 'u_th_q7' });
      expect(JSON.stringify(noOne.json)).not.toContain(q.number);
    });
  });

  describe('counter approval (FR-REC-009, FR-REC-026)', () => {
    it('FR-REC-026: a signature records who signed, who recorded it and how; the order lines carry the immutable lineKey', async () => {
      const { q, token } = await sentQuote(cv, VEH_AN, 82000);
      const ok = await call(cv, 'POST', `/api/v1/rec/quotes/${q.id}/approve`, {
        version: q.version,
        method: 'counter_signature',
        selectedItemNos: [1, 3],
        declines: [...reasonFor(2), { itemNo: 4 }],
        signerName: 'Nguyễn Văn An',
        evidenceRef: 'PHIEU-0001',
      });
      expect(ok.status, ok.text).toBe(200);
      expect(ok.json).toMatchObject({ status: 'approved_partial', approvedTotalVnd: 626_400 });
      const a = (await call(ql, 'GET', `/api/v1/rec/quotes/${q.id}`)).json.shown.approval;
      expect(a).toMatchObject({
        method: 'counter_signature',
        recordedBy: 'u_cv_q7',
        signerName: 'Nguyễn Văn An',
        evidenceRef: 'PHIEU-0001',
        exception: false,
      });
      // the link of that version stops working once staff decide at the counter
      await expect(
        viewPublicQuote(h.container.rec, token, { address: '203.0.113.6' }),
      ).rejects.toMatchObject({ status: 404 });
      // the second recording is refused
      const dup = await call(cv, 'POST', `/api/v1/rec/quotes/${q.id}/approve`, {
        version: ok.json ? (await call(cv, 'GET', `/api/v1/rec/quotes/${q.id}`)).json.version : 1,
        method: 'counter_signature',
        selectedItemNos: [1],
        declines: reasonFor(2, 3, 4),
        signerName: 'Nguyễn Văn An',
      });
      expect(dup.status).toBe(409);
    });

    it('FR-REC-026: a signature needs the signer; a verbal approval needs a note, the read-back tick and is an exception', async () => {
      const { q } = await sentQuote(cv, VEH_AN, 83000);
      const base = { version: q.version, selectedItemNos: [1, 2, 3, 4] };
      const noSigner = await call(cv, 'POST', `/api/v1/rec/quotes/${q.id}/approve`, {
        ...base,
        method: 'counter_signature',
      });
      expect(noSigner.status).toBe(422);
      expect(noSigner.json.errors[0].field).toBe('signerName');
      const shortNote = await call(cv, 'POST', `/api/v1/rec/quotes/${q.id}/approve`, {
        ...base,
        method: 'counter_verbal',
        note: 'ngắn',
        readBack: true,
      });
      expect(shortNote.status).toBe(422);
      const noTick = await call(cv, 'POST', `/api/v1/rec/quotes/${q.id}/approve`, {
        ...base,
        method: 'counter_verbal',
        note: 'Khách nghe đọc từng hạng mục và đồng ý bằng lời',
      });
      expect(noTick.status).toBe(422);
      const ok = await call(cv, 'POST', `/api/v1/rec/quotes/${q.id}/approve`, {
        ...base,
        method: 'counter_verbal',
        note: 'Khách nghe đọc từng hạng mục và đồng ý bằng lời',
        readBack: true,
      });
      expect(ok.status, ok.text).toBe(200);
      const a = (await call(cv, 'GET', `/api/v1/rec/quotes/${q.id}`)).json.shown.approval;
      expect(a).toMatchObject({ method: 'counter_verbal', exception: true, readBack: true });
      // the manager is told it is an exception; the advisor who recorded it is not notified of their own act
      const n = await h.call('GET', '/api/v1/sys/notifications', { as: 'u_ql_q7' });
      expect(
        n.json.items.some(
          (x: { titleKey: string }) => x.titleKey === 'notifications.quoteApprovedVerbal',
        ),
      ).toBe(true);
    });

    it('FR-REC-009: counter approval is idempotent and optimistic-locked', async () => {
      const { q } = await sentQuote(cv, VEH_AN, 84000);
      const k = key('cnt');
      const body = {
        version: q.version,
        method: 'counter_signature',
        selectedItemNos: [1, 2, 3, 4],
        signerName: 'Nguyễn Văn An',
      };
      const a = await call(cv, 'POST', `/api/v1/rec/quotes/${q.id}/approve`, body, k);
      const b = await call(cv, 'POST', `/api/v1/rec/quotes/${q.id}/approve`, body, k);
      expect(a.status).toBe(200);
      expect(b.headers.get('idempotent-replayed')).toBe('true');
      expect(b.json).toEqual(a.json);
      const stale = await call(cv, 'POST', `/api/v1/rec/quotes/${q.id}/approve`, body);
      expect(stale.status).toBe(409);
      expect(stale.json.code).toBe('version_conflict');
    });

    it('permissions: CV and QL may record; TH, KT, owner without working branch are refused; another branch gets 404 (NFR-ISO-01)', async () => {
      const { q } = await sentQuote(cv, VEH_AN, 85000);
      const body = {
        version: q.version,
        method: 'counter_signature',
        selectedItemNos: [1, 2, 3, 4],
        signerName: 'Nguyễn Văn An',
      };
      expect((await call(th, 'POST', `/api/v1/rec/quotes/${q.id}/approve`, body)).status).toBe(403);
      expect((await call(kt, 'POST', `/api/v1/rec/quotes/${q.id}/approve`, body)).status).toBe(403);
      expect((await call(owner, 'POST', `/api/v1/rec/quotes/${q.id}/approve`, body)).status).toBe(
        403,
      );
      expect((await call(qlTd, 'POST', `/api/v1/rec/quotes/${q.id}/approve`, body)).status).toBe(
        404,
      );
      expect((await call(ql, 'POST', `/api/v1/rec/quotes/${q.id}/approve`, body)).status).toBe(200);
    });

    it('a draft or a rejected quote cannot be approved (state machine)', async () => {
      const i = await completedIntake(cv, VEH_BIZ, 20000);
      const created = await call(cv, 'POST', '/api/v1/rec/quotes', { intakeId: i.id });
      const r = await call(cv, 'POST', `/api/v1/rec/quotes/${created.json.id}/approve`, {
        version: created.json.version,
        method: 'counter_signature',
        selectedItemNos: [1],
        signerName: 'Nguyễn Văn An',
      });
      expect(r.status).toBe(409);
      expect(r.json.code).toBe('state_invalid');
    });
  });

  describe('hand-over to the repair order (RULE-005, RULE-007, I20)', () => {
    it('only approved lines flow on, each with lineKey, price version and tax key; branch scope applies', async () => {
      const { q, token } = await sentQuote(cv, VEH_AN, 86000);
      const sendRes = await pub('/api/v1/rec/public/quote/approve', {
        token,
        selectedItemNos: [1, 2],
        declines: [{ itemNo: 3 }, { itemNo: 4 }],
      });
      expect(sendRes.status).toBe(200);
      const ap = await call(ql, 'GET', `/api/v1/rec/quotes/${q.id}/approved`);
      expect(ap.status, ap.text).toBe(200);
      expect(ap.json.lines).toHaveLength(3); // labor + part of item 1, labor of item 2
      expect(ap.json.lines.map((l: Row) => l.itemNo).sort()).toEqual([1, 1, 2]);
      for (const l of ap.json.lines) {
        expect(l.lineKey).toBe(`${q.id}__v1_${l.itemNo}_${l.lineNo}`);
        expect(l.taxKey).toBe('vat');
        expect(l.taxVersionId).toBeTruthy();
        expect(l.priceVersionId).toBeTruthy();
      }
      expect(ap.json.lines.find((l: Row) => l.kind === 'part').priceVersionId).toMatch(
        /^price-item__STD~LOC-DAU-TY01__/,
      );
      expect(ap.json).toMatchObject({
        mode: 'partial',
        approvedSubtotalVnd: 730_000,
        approvedTotalVnd: 788_400,
      });
      expect(ap.json.declined.map((d: Row) => d.itemNo)).toEqual([3, 4]);
      // the same through the module API
      const direct = await getApprovedQuote(h.container.rec, await actorOf(ql), q.id);
      expect(direct.lines).toHaveLength(3);
      expect((await call(qlTd, 'GET', `/api/v1/rec/quotes/${q.id}/approved`)).status).toBe(404);
      const draft = await completedIntake(cv, VEH_BIZ, 21000);
      const dq = await call(cv, 'POST', '/api/v1/rec/quotes', { intakeId: draft.id });
      expect((await call(cv, 'GET', `/api/v1/rec/quotes/${dq.json.id}/approved`)).status).toBe(409);
    });

    it('FR-REC-031: a price change after sending does not change the sent or the approved quote', async () => {
      const { q, token } = await sentQuote(cv, VEH_AN, 87000);
      // a new list price takes effect tomorrow-and-later in config; the sent quote keeps the version it read
      const d = new Date(h.clock.now().getTime() + 86_400_000).toISOString().slice(0, 10);
      const p = await call(owner, 'POST', '/api/v1/sys/config/price-item', {
        scopeKey: 'STD:LOC-DAU-TY01',
        effectiveFrom: d,
        payload: { name: 'Lọc dầu Toyota', costVnd: 90000, listPriceVnd: 150000 },
        reason: 'Đổi bảng giá',
      });
      expect(p.status, p.text).toBe(201);
      const dec = await call(
        owner,
        'POST',
        `/api/v1/sys/config/price-item/${encodeURIComponent(p.json.id)}/decide`,
        { decision: 'approve', reauthPassword: 'Demo!Pass-2026' },
      );
      expect(dec.status, dec.text).toBe(200);
      const ok = await pub('/api/v1/rec/public/quote/approve', {
        token,
        selectedItemNos: [1, 2, 3, 4],
      });
      expect(ok.status).toBe(200);
      const ap = (await call(ql, 'GET', `/api/v1/rec/quotes/${q.id}/approved`)).json;
      const part = ap.lines.find((l: Row) => l.kind === 'part' && l.itemNo === 1);
      expect(part.unitVnd).toBe(130_000);
      expect(part.priceVersionId).not.toContain(d);
    });
  });

  describe('order code and workflow (FR-REC-030, FR-REC-032)', () => {
    it('FR-REC-030: order codes are unique per company, branch-prefixed and idempotent per request key', async () => {
      const rec = h.container.rec;
      const all = allBranchesScope('tnt_demo');
      const q7 = await h.container.sys.branches.get(all, 'br_q7');
      const td = await h.container.sys.branches.get(all, 'br_td');
      const alloc = (branch: typeof q7, orderId: string, requestKey: string) =>
        rec.sys.uow.run((tx) =>
          allocateRepairOrderNumber(rec, tx, {
            branch: branch!,
            orderId,
            businessDate: today(),
            requestKey,
          }),
        );
      const results = await Promise.all(
        Array.from({ length: 8 }, (_, i) => alloc(q7, `ro_t${i}`, `req-ro-${i}-xxxxxxxx`)),
      );
      expect(new Set(results).size).toBe(8);
      for (const n of results) expect(n).toMatch(/^RO-Q7-\d{4}-\d{5}$/);
      expect(await alloc(q7, 'ro_t0', 'req-ro-0-xxxxxxxx')).toBe(results[0]);
      expect(await alloc(td, 'ro_td1', 'req-ro-td-xxxxxxxx')).toMatch(/^RO-TD-/);
    });

    it('FR-REC-032: two service types have two different step sets, effective-dated config', async () => {
      const list = await call(cv, 'GET', '/api/v1/rec/service-workflows');
      expect(list.status).toBe(200);
      const by = Object.fromEntries(
        list.json.items.map((x: Row) => [x.serviceType, x.steps.map((s: Row) => s.code)]),
      );
      expect(by.maintenance).toEqual(['inspect', 'service', 'qc']);
      expect(by.tire_wheel).toEqual(['remove', 'balance', 'qc']);
      expect(by.maintenance).not.toEqual(by.tire_wheel);
      // R36: general repair and the MINIMAL body & paint sample (waiting for the workshop survey)
      expect(by.general_repair).toEqual(['diagnose', 'repair', 'qc']);
      expect(by.body_paint).toEqual([
        'assess',
        'bodywork',
        'prime',
        'paint',
        'cure',
        'polish',
        'qc',
      ]);
      const bp = await getServiceWorkflow(h.container.rec, await actorOf(cv), 'body_paint');
      expect(bp!.steps.every((s) => s.countsTowardLabor === false)).toBe(true);
      expect(bp!.steps.find((s) => s.code === 'paint')!.expectedDays).toBe(2);
      // nothing is assumed for a type without a workflow
      expect(
        await getServiceWorkflow(h.container.rec, await actorOf(cv), 'unknown_type'),
      ).toBeNull();
      expect((await h.call('GET', '/api/v1/rec/service-workflows', { as: 'u_th_q7' })).status).toBe(
        403,
      );
    });
  });

  it('every new REC write route is covered by the shared Origin test and rejects unauthenticated callers', async () => {
    const r = await h.call('POST', '/api/v1/rec/quotes/x1/approve', {
      body: {},
      key: key('anon'),
    });
    expect(r.status).toBe(401);
    // the public routes need no session but still the Origin check and an Idempotency-Key
    const noKey = await h.call('POST', '/api/v1/rec/public/quote/approve', {
      body: { token: 'x' },
    });
    expect(noKey.status).toBe(400);
    void approveViaLink;
    void rejectViaLink;
  });
});

/** The strict policy: the branch locks required items (Câu 2: "Cho phép khách bỏ hạng mục bắt buộc" = off). */
describe.each(backends)('REC approval policy per branch [%s]', (backend) => {
  let h: Harness;
  let cv: string;
  let owner: string;
  const today = () => businessDate(h.clock.now());
  const call = (cookie: string, method: string, path: string, body?: unknown, k = key('pol')) =>
    h.call(method, path, { cookie, key: k, ...(body !== undefined ? { body } : {}) });

  beforeAll(async () => {
    h = await createHarness(backend);
    cv = await h.loginAt('u_cv_q7', 'br_q7');
    owner = await h.login('u_owner');
  });

  it('Câu 2: with the branch override off a required item cannot be refused separately (409), optional ones can', async () => {
    const p = await call(owner, 'POST', '/api/v1/sys/config/quote-approval', {
      scopeKey: 'branch:br_q7',
      effectiveFrom: today(),
      payload: { allowDeclineRequired: false, verbalApproval: false, otpMode: 'off' },
      reason: 'Công đi kèm phụ tùng không tách được',
    });
    expect(p.status, p.text).toBe(201);
    const d = await call(
      owner,
      'POST',
      `/api/v1/sys/config/quote-approval/${encodeURIComponent(p.json.id)}/decide`,
      { decision: 'approve', reauthPassword: 'Demo!Pass-2026' },
    );
    expect(d.status, d.text).toBe(200);
    const c = await call(cv, 'POST', '/api/v1/rec/intakes', { vehicleId: VEH_AN });
    const pt = await call(cv, 'PATCH', `/api/v1/rec/intakes/${c.json.id}`, {
      version: c.json.version,
      step: 5,
      km: 90000,
      customerRequest: 'Bảo dưỡng',
      serviceType: 'maintenance',
      promisedDate: '2099-01-01',
    });
    const done = await call(cv, 'POST', `/api/v1/rec/intakes/${c.json.id}/complete`, {
      version: pt.json.version,
    });
    const q = await call(cv, 'POST', '/api/v1/rec/quotes', { intakeId: done.json.id });
    const e = await call(cv, 'PATCH', `/api/v1/rec/quotes/${q.json.id}`, {
      version: q.json.version,
      items: [
        { name: 'Bắt buộc', necessity: 'required', lines: [{ kind: 'labor', serviceId: SV_DAU }] },
        { name: 'Tùy chọn', necessity: 'optional', lines: [{ kind: 'labor', serviceId: SV_CAN }] },
      ],
    });
    const s = await call(cv, 'POST', `/api/v1/rec/quotes/${q.json.id}/send`, {
      version: e.json.version,
    });
    const l = await call(cv, 'POST', `/api/v1/rec/quotes/${q.json.id}/link`, {
      version: s.json.version,
    });
    const pol = await viewPublicQuote(h.container.rec, l.json.token, { address: '203.0.113.50' });
    expect(pol.policy.allowDeclineRequired).toBe(false);
    const locked = await h.call('POST', '/api/v1/rec/public/quote/approve', {
      body: {
        token: l.json.token,
        selectedItemNos: [2],
        declines: [{ itemNo: 1, reasonCode: 'later' }],
      },
      key: key('pol'),
    });
    expect(locked.status).toBe(409);
    expect(locked.json.code).toBe('required_item_locked');
    const verbal = await call(cv, 'POST', `/api/v1/rec/quotes/${q.json.id}/approve`, {
      version: (await call(cv, 'GET', `/api/v1/rec/quotes/${q.json.id}`)).json.version,
      method: 'counter_verbal',
      selectedItemNos: [1, 2],
      note: 'Khách đồng ý bằng lời tại quầy',
      readBack: true,
    });
    expect(verbal.status).toBe(409);
    expect(verbal.json.code).toBe('verbal_approval_disabled');
    const ok = await h.call('POST', '/api/v1/rec/public/quote/approve', {
      body: { token: l.json.token, selectedItemNos: [1], declines: [{ itemNo: 2 }] },
      key: key('pol'),
    });
    expect(ok.status, ok.text).toBe(200);
    expect(ok.json.mode).toBe('partial');
  });
});
