import { expect, test } from '@playwright/test';
import { as } from './acc-helpers';
import { noHorizontalOverflow } from './helpers';

/** A date far enough ahead and spread out so a re-run on a kept database does not hit an occupied slot. */
function farDay() {
  const d = new Date(Date.now() + (400 + Math.floor(Math.random() * 3000)) * 86_400_000);
  const iso = d.toISOString().slice(0, 10);
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/** FR-SYS-004, FR-REC-044..046: the appointment policy form leaves the five optional boxes out of the payload when empty. */
test('appointment-policy form: optional boxes may stay empty, version is pending with a readable value', async ({
  browser,
}) => {
  const owner = await as(browser, 'chu');
  const page = owner.page;
  try {
    await page.goto('/sys/config/appointment-policy');
    const form = page.getByTestId('config-form');
    await expect(form).toBeVisible();
    const date = farDay();
    await form.getByLabel('Hiệu lực từ').fill(date);
    await form.getByLabel('Nhận lịch hẹn').selectOption('true');
    await form.getByLabel(/^Công suất xưởng/).fill('12');
    // two optional boxes filled, three left empty
    await form.getByLabel(/^Lịch hẹn tồn đọng sau/).fill('20');
    await form.getByLabel(/^Số lần dời hẹn tối đa/).fill('2');
    // an empty optional box says what the system uses instead
    await expect(form.getByLabel(/^Châm chước trễ hẹn/)).toHaveValue('');
    await expect(form).toContainText('Để trống thì dùng mặc định');
    await form.getByLabel('Lý do').fill('kiểm thử form phẳng');
    await form.getByRole('button', { name: 'Gửi đề xuất' }).click();
    const row = page.getByRole('row').filter({ hasText: date });
    await expect(row).toContainText('Chờ duyệt');
    await expect(row).toContainText('Toàn công ty');
    await expect(row).toContainText('Sức chứa 12 xe mỗi ngày');
    await expect(row).toContainText('Lịch tồn đọng sau 20 ngày');
    await expect(row).not.toContainText('undefined');
    // a required box left empty is refused next to the field and nothing is sent
    await form.getByLabel(/^Công suất xưởng/).fill('');
    await form.getByLabel('Hiệu lực từ').fill(farDay());
    await form.getByRole('button', { name: 'Gửi đề xuất' }).click();
    await expect(page.locator('.field__error').first()).toBeVisible();
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/sys/config/appointment-policy');
    await noHorizontalOverflow(page);
  } finally {
    await owner.ctx.close();
  }
});
