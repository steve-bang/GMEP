import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEMO_PASSWORD } from '@/infrastructure/seed/demo';
import { dumpCollections } from '../helpers/dump';
import { journey, type Staff } from '../helpers/journey';
import { allRouteFiles, backends, createHarness, type Harness } from './harness';

/**
 * Implementation plan section 8 (security checklist), the rows that a cross-module automated test can prove.
 * The mapping of every row to its test (or to "needs infrastructure") is docs/dev/security-checklist-status.md.
 *  #1  Security Rules deny every client access (static check of the rules files)
 *  #3  every write route goes through api/authed/cron (Origin/CSRF are enforced by the wrapper; behaviour is in platform.test.ts)
 *  #6  roles without the personal-data right never receive the full phone, e-mail or address, across modules
 *  #8  list filters are whitelisted: hostile input is a validation error or an empty result, never a server error
 *  #11 customer-link tokens are never stored raw
 *  #14 audit and access logs never hold the full personal data or a password after a complete scenario
 */

const ROOT = join(__dirname, '..', '..');
const PHONE = '0987654321';
const EMAIL = 'lo.pii@example.test';
const ADDRESS = '99 Đường Bí Mật, Phường 7, Quận 7';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('security checklist #1: Security Rules deny everything to clients', () => {
  it.each(['firestore.rules', 'storage.rules'])(
    '%s allows nothing and denies all reads and writes',
    (file) => {
      const rules = readFileSync(join(ROOT, file), 'utf8').replace(/\/\/.*$/gm, '');
      const allows = rules.match(/allow[^;]*;/g) ?? [];
      expect(allows.length).toBeGreaterThan(0);
      for (const a of allows) expect(a, `${file}: ${a}`).toMatch(/:\s*if\s+false/);
    },
  );
});

describe('security checklist #3: every write route is built with the guarded wrappers', () => {
  it('each route file exporting POST/PUT/PATCH/DELETE uses api(), authed() or cron() from composition/api', () => {
    const offenders: string[] = [];
    for (const r of allRouteFiles()) {
      if (!r.methods.some((m) => m !== 'GET')) continue;
      const src = readFileSync(join(ROOT, r.file), 'utf8');
      for (const m of r.methods.filter((x) => x !== 'GET')) {
        const re = new RegExp(`export\\s+const\\s+${m}\\s*=\\s*(api|authed|cron)\\b`);
        if (!re.test(src)) offenders.push(`${r.file} ${m}`);
      }
    }
    expect(offenders, 'unguarded write handlers (a raw function skips the Origin check)').toEqual(
      [],
    );
  });

  it('no raw `export async function POST|PUT|PATCH|DELETE` exists anywhere under src/app/api', () => {
    const bad = walk(join(ROOT, 'src/app/api'))
      .filter((f) => f.endsWith('route.ts'))
      .filter((f) =>
        /export\s+(async\s+)?function\s+(POST|PUT|PATCH|DELETE)\b/.test(readFileSync(f, 'utf8')),
      );
    expect(bad).toEqual([]);
  });
});

describe.each(backends)('security checklist (data-driven) [%s]', (backend) => {
  let h: Harness;
  const cookies: Record<string, string> = {};
  const ids: Record<string, string> = {};
  let quoteToken = '';

  beforeAll(async () => {
    h = await createHarness(backend);
    const j = journey(h);
    const staff: Staff = {
      cv: await h.loginAt('u_cv_q7', 'br_q7'),
      qd: await h.loginAt('u_qd_q7', 'br_q7'),
      th: await h.loginAt('u_th_q7', 'br_q7'),
      tn: await h.loginAt('u_tn_q7', 'br_q7'),
      tk: await h.loginAt('u_tk_q7', 'br_q7'),
    };
    Object.assign(cookies, staff, {
      qv: await h.loginAt('u_qv', 'br_q7'),
      ql: await h.loginAt('u_ql_q7', 'br_q7'),
      owner: await h.loginAt('u_owner', 'br_q7'),
      kt: await h.loginAt('u_kt', 'br_q7'),
    });
    // a customer with known personal data, taken through a full order, payment and invoice
    const c = await j.post(staff.cv, '/api/v1/crm/customers', {
      type: 'individual',
      name: 'Khach PIISCAN',
      phone: PHONE,
      email: EMAIL,
      address: ADDRESS,
    });
    expect(c.status, c.text).toBe(201);
    const v = await j.post(staff.cv, '/api/v1/crm/vehicles', {
      customerId: c.json.id,
      plate: '59C-121.21',
      make: 'Kia',
      model: 'Morning',
      year: 2019,
      lastKm: 1000,
    });
    expect(v.status, v.text).toBe(201);
    const ro = await j.readyOrder(staff, v.json.id);
    quoteToken = ro.token;
    await j.payFull(staff.tn, ro.order.id);
    const inv = await j.issueInvoice(staff.tn, ro.order.id);
    Object.assign(ids, {
      customerId: c.json.id,
      orderId: ro.order.id,
      quoteId: ro.quoteId,
      intakeId: ro.intakeId,
      invoiceId: inv.invoiceId,
    });
    // personal-data events that must be audited without their values: reveal, export with the password
    const reveal = await h.call('POST', '/api/v1/sys/pii/reveal', {
      cookie: cookies.owner,
      key: 'sec-reveal-00000001',
      body: { entityType: 'customer', entityId: c.json.id, field: 'phone' },
    });
    expect([200, 422], reveal.text).toContain(reveal.status);
    await h.call('POST', '/api/v1/crm/customers/export', {
      cookie: cookies.owner,
      key: 'sec-export-0000001',
      body: {},
    });
    await h.call('GET', `/api/v1/crm/customers/${c.json.id}`, { cookie: cookies.qv });
  });

  it('#6 roles without the personal-data right (technician, storekeeper, read-only manager) never receive the full phone, e-mail or address from any read route', async () => {
    const paths = [
      '/api/v1/crm/customers?limit=100',
      `/api/v1/crm/customers/${ids.customerId}`,
      '/api/v1/crm/vehicles?limit=100',
      '/api/v1/rec/board',
      '/api/v1/rec/work',
      '/api/v1/rec/orders?limit=100',
      `/api/v1/rec/orders/${ids.orderId}`,
      `/api/v1/rec/quotes/${ids.quoteId}`,
      `/api/v1/rec/intakes/${ids.intakeId}`,
      '/api/v1/rec/quotes?limit=100',
      '/api/v1/rec/intakes?limit=100',
      `/api/v1/acc/orders/${ids.orderId}`,
      '/api/v1/acc/payments?limit=100',
      '/api/v1/ein/invoices?limit=100',
      `/api/v1/ein/invoices/${ids.invoiceId}`,
      '/api/v1/inv/documents?limit=100',
    ];
    let served = 0;
    for (const who of ['th', 'tk', 'qv']) {
      for (const p of paths) {
        const r = await h.call('GET', p, { cookie: cookies[who] });
        expect([200, 403, 404, 409], `${who} ${p} ${r.status}`).toContain(r.status);
        if (r.status === 200) served++;
        for (const secret of [PHONE, EMAIL, ADDRESS])
          expect(r.text.includes(secret), `${who} ${p} exposes ${secret.slice(0, 4)}...`).toBe(
            false,
          );
      }
    }
    expect(served).toBeGreaterThan(5); // the sweep really read data
  });

  it('#6 the advisor, who needs the contact data, does receive the phone (the masking is by role, not blanket)', async () => {
    const r = await h.call('GET', `/api/v1/crm/customers/${ids.customerId}`, {
      cookie: cookies.cv,
    });
    expect(r.status, r.text).toBe(200);
    expect(r.text).toContain(PHONE);
  });

  it('#8 hostile search and filter input is a validation error or an empty result, never a server error', async () => {
    const hostile = [
      '" OR 1=1 --',
      "'; DROP TABLE x;--",
      '$where: 1',
      '../../etc/passwd',
      '%00',
      '{"$ne":null}',
      'a'.repeat(300),
      '‮',
    ];
    const lists = [
      '/api/v1/crm/customers',
      '/api/v1/crm/vehicles',
      '/api/v1/inv/parts',
      '/api/v1/rec/orders',
      '/api/v1/sys/warehouses',
    ];
    for (const base of lists)
      for (const q of hostile) {
        const r = await h.call('GET', `${base}?q=${encodeURIComponent(q)}&limit=10`, {
          cookie: cookies.owner,
        });
        expect([200, 400, 422], `${base} q=${q.slice(0, 20)} -> ${r.status}`).toContain(r.status);
      }
    for (const [base, param] of [
      ['/api/v1/crm/customers', 'type'],
      ['/api/v1/inv/parts', 'status'],
      ['/api/v1/rec/orders', 'status'],
    ] as const) {
      const r = await h.call('GET', `${base}?${param}=__not_a_value__&limit=10`, {
        cookie: cookies.owner,
      });
      expect([200, 400, 422], `${base} ${param}`).toContain(r.status);
      if (r.status === 200)
        expect(r.json.items ?? [], `${base} ${param}=bogus returned rows`).toEqual([]);
    }
  });

  it('#11 the customer-link token is never stored raw in any collection (only its hash)', async () => {
    expect(quoteToken.length).toBeGreaterThanOrEqual(22); // >= 128 bit as base64url
    const all = await dumpCollections(h);
    const holders = Object.entries(all)
      .filter(([, text]) => text.includes(quoteToken))
      .map(([n]) => n);
    expect(holders).toEqual([]);
  });

  it('#14 audit and access logs hold no full phone, e-mail, address or password after a complete scenario', async () => {
    const all = await dumpCollections(h);
    expect(all.auditLogs?.length ?? 0).toBeGreaterThan(100); // the scenario wrote a real trail
    for (const name of ['auditLogs', 'accessLogs']) {
      const text = all[name] ?? '';
      for (const [label, secret] of [
        ['phone', PHONE],
        ['email', EMAIL],
        ['address', ADDRESS],
        ['password', 'valid-password-123'],
        ['demo password', DEMO_PASSWORD],
      ] as const)
        expect(text.includes(secret), `${name} contains the ${label}`).toBe(false);
    }
    // the access to personal data is itself logged (PDPL): the reveal and the export left a trace without the value
    expect((all.accessLogs ?? '').length).toBeGreaterThan(2);
  });
});
