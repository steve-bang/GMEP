import { expect, test } from '@playwright/test';
import { as } from './acc-helpers';
import { noHorizontalOverflow } from './helpers';

/** FR-SYS-004: /sys/config groups every config type by business area; search ignores diacritics; the left menu marks the open type. */
test('config index: groups, diacritic-free search, open a type, left menu current item', async ({
  browser,
}) => {
  const owner = await as(browser, 'chu');
  const page = owner.page;
  try {
    await page.goto('/sys/config');
    await expect(
      page.getByRole('heading', { name: 'Cấu hình có hiệu lực', level: 1 }),
    ).toBeVisible();
    for (const name of [
      'Thuế và giá',
      'Dịch vụ và quy trình',
      'Lịch hẹn và bảo hành',
      'Nhân công',
      'Tài chính và phê duyệt',
      'Kho',
      'Chứng từ, hệ thống',
    ])
      await expect(page.getByRole('heading', { name, level: 2 })).toBeVisible();

    await page.getByLabel('Tìm loại cấu hình').fill('thue');
    const list = page.getByTestId('config-group-pricing');
    await expect(list.getByRole('link', { name: /Thuế/ }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Nhân công', level: 2 })).toHaveCount(0);

    await list.getByRole('link', { name: /Thuế/ }).first().click();
    await expect(page).toHaveURL(/\/sys\/config\/[a-z-]+$/);
    const type = new URL(page.url()).pathname.split('/').pop()!;
    const current = page.locator('.g4r-subnav a[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveAttribute('href', `/sys/config/${type}`);

    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/sys/config');
    await noHorizontalOverflow(page);
  } finally {
    await owner.ctx.close();
  }
});
