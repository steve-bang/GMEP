/* Đo tràn ngang và lỗi JS cho gói design/tenant-signup (nhóm công khai A, B, C và quản trị nền tảng G).
   Chạy:  node design/tenant-signup/measure-overflow.js [public|platform-admin|all]
   Cần Playwright (require('playwright')) và Chromium cài sẵn; nếu Chromium ở chỗ khác, đặt PLAYWRIGHT_CHROMIUM_PATH.
   Với mỗi trang và mỗi độ rộng 360, 768, 1280: tải trang, rồi bấm lần lượt từng nút trong thanh "Xem thử trạng thái"
   và đo document.documentElement.scrollWidth so với clientWidth. Ghi lại mọi pageerror và console.error.
   Kết quả in ra dạng bảng markdown để dán vào overflow-report-public.md. */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const root = __dirname;
const which = process.argv[2] || 'all';
const dirs = which === 'all' ? ['public', 'platform-admin'] : [which];
const widths = [360, 768, 1280];

(async () => {
  const exe = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const rows = [];
  let bad = 0;
  for (const d of dirs) {
    const files = fs.readdirSync(path.join(root, d)).filter((f) => /^ts[ux]-\d+\.html$/.test(f)).sort();
    for (const f of files) {
      for (const w of widths) {
        const ctx = await browser.newContext({ viewport: { width: w, height: 800 } });
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
        page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
        await page.goto('file://' + path.join(root, d, f));
        await page.waitForTimeout(150);
        const states = await page.$$eval('[data-ts-view]', (els) => els.map((e) => e.getAttribute('data-ts-view')));
        const over = [];
        const measure = async (label) => {
          const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
          if (m.sw > m.cw) over.push(label + ' (' + m.sw + ' > ' + m.cw + ')');
        };
        await measure('mặc định');
        // Thanh "Xem thử" thu gọn mặc định ở điện thoại: mở ra để bấm được các trạng thái.
        const tg = await page.$('[data-proto-toggle][aria-expanded="false"]');
        if (tg) await tg.click();
        for (const s of states) {
          // Hộp thoại lớp phủ làm nền inert: đóng bằng Esc trước khi chọn trạng thái kế tiếp.
          await page.keyboard.press('Escape');
          await page.click('[data-ts-view="' + s + '"]', { timeout: 2000 }).catch(() => {});
          await page.waitForTimeout(80);
          await measure('trạng thái ' + s);
        }
        const ok = !over.length && !errors.length;
        if (!ok) bad++;
        rows.push('| ' + d + '/' + f + ' | ' + w + ' | ' + (over.length ? 'TRÀN: ' + over.join('; ') : 'sạch') + ' | ' + (errors.length ? errors.join('; ') : 'không') + ' |');
        await ctx.close();
      }
    }
  }
  await browser.close();
  console.log('| Trang | Rộng (px) | Tràn ngang | Lỗi JS |\n| --- | --- | --- | --- |\n' + rows.join('\n'));
  console.log('\nTổng số tổ hợp có vấn đề: ' + bad);
  process.exit(bad ? 1 : 0);
})();
