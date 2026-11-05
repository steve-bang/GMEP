import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'Demo!Pass-2026';

export async function login(page: Page, identifier: string, password = PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Email hoặc mã nhân viên').fill(identifier);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
}

/** Login that must succeed: waits for the post-login navigation so later steps do not race it. */
export async function loginOk(page: Page, identifier: string) {
  await login(page, identifier);
  await page.waitForURL((u) => u.pathname === '/');
}

/** Reads the dev email outbox of the Firestore emulator (no mail is ever sent). */
export async function outboxLinks(template: string, to: string): Promise<string[]> {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  const res = await fetch(
    `http://${host}/v1/projects/demo-gmep/databases/(default)/documents/emailOutbox?pageSize=300`,
    { headers: { authorization: 'Bearer owner' } },
  );
  const body = (await res.json()) as {
    documents?: {
      fields: Record<
        string,
        { stringValue?: string; mapValue?: { fields: Record<string, { stringValue: string }> } }
      >;
      createTime: string;
    }[];
  };
  return (body.documents ?? [])
    .filter((d) => d.fields.template?.stringValue === template && d.fields.to?.stringValue === to)
    .sort((a, b) => a.createTime.localeCompare(b.createTime))
    .map((d) => d.fields.vars!.mapValue!.fields.link!.stringValue);
}

/**
 * Reads the dev short-message outbox of the Firestore emulator (collection `messageOutbox`, written by the sms/zalo dev
 * adapter when the server runs with MESSAGE_DEV_CHANNELS; nothing is ever sent). `to` is compared on its last nine
 * digits so "0900000211", "+84900000211" and "84900000211" match. Oldest first.
 */
export interface OutboxMessage {
  channel: string;
  to: string;
  template: string;
  text: string;
  vars: Record<string, string>;
}
export async function messageOutbox(template: string, to: string): Promise<OutboxMessage[]> {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  const res = await fetch(
    `http://${host}/v1/projects/demo-gmep/databases/(default)/documents/messageOutbox?pageSize=300`,
    { headers: { authorization: 'Bearer owner' } },
  );
  type Str = { stringValue?: string };
  const body = (await res.json()) as {
    documents?: {
      fields: Record<string, Str & { mapValue?: { fields?: Record<string, Str> } }>;
      createTime: string;
    }[];
  };
  const tail = (v: string) => v.replace(/\D/g, '').slice(-9);
  return (body.documents ?? [])
    .filter(
      (d) =>
        d.fields.template?.stringValue === template &&
        tail(d.fields.to?.stringValue ?? '') === tail(to),
    )
    .sort((a, b) => a.createTime.localeCompare(b.createTime))
    .map((d) => ({
      channel: d.fields.channel?.stringValue ?? '',
      to: d.fields.to?.stringValue ?? '',
      template,
      text: d.fields.text?.stringValue ?? '',
      vars: Object.fromEntries(
        Object.entries(d.fields.vars?.mapValue?.fields ?? {}).map(([k, v]) => [
          k,
          v.stringValue ?? '',
        ]),
      ),
    }));
}

export async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}
