import { expect, test } from '@playwright/test';
import { loginOk, noHorizontalOverflow } from './helpers';
import { makeLink, sentQuote } from './rec-quote-helpers';

/** FR-REC-034 (A3): photos on the customer quote page. Odometer range 3.200.000+ of veh_an. */
test.describe('REC public quote: photos', () => {
  test('thumbnails load, a tap opens the dialog, Escape closes it and returns focus; a revoked link shows no photos', async ({
    page,
    browser,
  }) => {
    await loginOk(page, 'cv.q7@demo.gmep.test');
    const sent = await sentQuote(page.request, { km: 3_200_100, photos: 3 });
    const link = await makeLink(page.request, sent.id);

    const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
    const cust = await ctx.newPage();
    await cust.goto(link.path);
    const thumbs = cust.getByTestId('pub-photo');
    await expect(thumbs).toHaveCount(3);
    // every thumbnail is a decoded image (lazy: scroll each into view first)
    for (let i = 0; i < 3; i++) {
      const img = thumbs.nth(i).locator('img');
      await img.scrollIntoViewIfNeeded();
      await expect
        .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
        .toBe(true);
    }
    await expect(cust.getByTestId('pub-photo-failed')).toHaveCount(0);
    await noHorizontalOverflow(cust);

    // tap: the larger view opens in a modal dialog; Escape closes it and focus returns to the thumbnail
    const first = thumbs.first();
    const photoUrl = await first.locator('img').getAttribute('src');
    await first.click();
    const dialog = cust.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('img')).toBeVisible();
    await cust.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(first).toBeFocused();

    // a new link revokes the old one: the old page explains that the link is no longer valid, its photo URL is a plain 404, no photo is shown
    const fresh = await makeLink(page.request, sent.id);
    expect(fresh.path).not.toBe(link.path);
    await cust.goto(link.path);
    await expect(cust.getByRole('heading', { name: 'Liên kết không còn hiệu lực' })).toBeVisible();
    await expect(cust.getByTestId('pub-photo')).toHaveCount(0);
    expect((await cust.request.get(photoUrl!)).status()).toBe(404);
    await noHorizontalOverflow(cust);
    await ctx.close();
  });
});
