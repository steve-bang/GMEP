import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEMO_PASSWORD } from '@/infrastructure/seed/demo';
import { createHarness, hasEmulator } from './harness';

/**
 * ADR 0001 §2 / R-12: the browser never talks to Firebase. Security Rules deny every client
 * request (unauthenticated AND authenticated); only the Admin SDK (which bypasses rules) works.
 * Runs against the Emulator Suite over its REST endpoints, so no Firebase client SDK is needed.
 */
const FS = process.env.FIRESTORE_EMULATOR_HOST;
const ST = process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? process.env.STORAGE_EMULATOR_HOST;
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const PROJECT = 'demo-gmep';

describe.runIf(hasEmulator)('firestore.rules: deny all client access', () => {
  let idToken = '';
  beforeAll(async () => {
    await createHarness('firestore'); // seeds users/branches/warehouses
    const res = await fetch(
      `http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=any`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'chu@demo.gmep.test',
          password: DEMO_PASSWORD,
          returnSecureToken: true,
        }),
      },
    );
    idToken = ((await res.json()) as { idToken: string }).idToken;
    expect(idToken).toBeTruthy();
  });

  const doc = (path: string) =>
    `http://${FS}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`;
  const as = (token?: string): Record<string, string> =>
    token ? { authorization: `Bearer ${token}` } : {};

  it('control: the emulator bypass credential can read the seeded document (so denials below are the rules, not missing data)', async () => {
    const res = await fetch(doc('warehouses/wh_br_q7_WH-CHINH'), { headers: as('owner') });
    expect(res.status).toBe(200);
  });

  it.each([
    ['unauthenticated', false],
    ['signed-in as the company owner', true],
  ])('%s client cannot read, list, query or write', async (_label, signedIn) => {
    const headers = { ...as(signedIn ? idToken : undefined), 'content-type': 'application/json' };
    expect((await fetch(doc('warehouses/wh_br_q7_WH-CHINH'), { headers })).status).toBe(403);
    expect((await fetch(doc('warehouses'), { headers })).status).toBe(403);
    expect((await fetch(doc('users/u_owner'), { headers })).status).toBe(403);
    expect((await fetch(doc('auditLogs'), { headers })).status).toBe(403);
    const query = await fetch(
      `http://${FS}/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          structuredQuery: { from: [{ collectionId: 'warehouses' }], limit: 5 },
        }),
      },
    );
    expect(query.status).toBe(403);
    const body = JSON.stringify({ fields: { name: { stringValue: 'x' } } });
    expect(
      (await fetch(doc('warehouses?documentId=hacked'), { method: 'POST', headers, body })).status,
    ).toBe(403);
    expect(
      (
        await fetch(doc('warehouses/wh_br_q7_WH-CHINH?updateMask.fieldPaths=name'), {
          method: 'PATCH',
          headers,
          body,
        })
      ).status,
    ).toBe(403);
    expect(
      (await fetch(doc('warehouses/wh_br_q7_WH-CHINH'), { method: 'DELETE', headers })).status,
    ).toBe(403);
  });

  it('the rules file is deny-all with no exception', () => {
    const rules = readFileSync('firestore.rules', 'utf8');
    expect(rules).toMatch(/allow read, write: if false;/);
    expect(rules.replace(/\/\/.*$/gm, '')).not.toMatch(/if\s+(true|request\.auth)/);
  });
});

describe.runIf(Boolean(ST))('storage.rules: deny all client access', () => {
  const base = `http://${ST}/v0/b/${PROJECT}.appspot.com/o`;
  it('uploads and reads are refused for clients; the Admin bypass works (control)', async () => {
    const admin = { authorization: 'Bearer owner' };
    const up = await fetch(`${base}?name=probe.txt`, {
      method: 'POST',
      headers: { ...admin, 'content-type': 'text/plain' },
      body: 'hello',
    });
    expect(up.status).toBe(200);
    expect((await fetch(`${base}/probe.txt?alt=media`, { headers: admin })).status).toBe(200);
    expect((await fetch(`${base}/probe.txt?alt=media`)).status).toBe(403);
    expect((await fetch(`${base}/probe.txt`)).status).toBe(403);
    expect(
      (
        await fetch(`${base}?name=evil.txt`, {
          method: 'POST',
          headers: { 'content-type': 'text/plain' },
          body: 'x',
        })
      ).status,
    ).toBe(403);
    expect((await fetch(`${base}/probe.txt`, { method: 'DELETE' })).status).toBe(403);
  });
  it('the rules file is deny-all', () => {
    expect(readFileSync('storage.rules', 'utf8')).toMatch(/allow read, write: if false;/);
  });
});
