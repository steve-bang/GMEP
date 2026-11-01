import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'Demo!Pass-2026';

export async function login(page: Page, identifier: string, password = PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Email hoặc mã nhân viên').fill(identifier);
  await page.getByLabel('Mật khẩu').fill(password);
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

export async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}
