// Chụp ảnh (-d 1440px, -m 390px, deviceScaleFactor 1), đo tràn ngang và lỗi JS cho mọi .html cùng thư mục.
// Chạy: node design/apr-redesign/measure.js   (đặt PLAYWRIGHT_CHROMIUM_PATH nếu Chromium ở chỗ khác)
// Ngoài trang mặc định, đo thêm các tình huống của request.html qua ?s=<khóa> (xem danh sách SCEN).
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const SCEN = { 'request.html': ['cap1', 'cap2', 'auto', 'reauth', 'conflict', 'expired', 'proxy', 'own', 'store', 'offline', 'urgent'] };
(async () => {
  const dir = __dirname, out = path.join(dir, 'screenshots'); fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
  const rows = [], targets = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.html')).sort()) {
    targets.push([f, '']);
    (SCEN[f] || []).forEach((s) => targets.push([f, '?s=' + s]));
  }
  for (const [f, q] of targets) {
    for (const [sfx, w, h] of [['d', 1440, 900], ['m', 390, 844]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: 'vi-VN' }), page = await ctx.newPage(), errs = [];
      page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
      await page.goto('file://' + path.join(dir, f) + q); await page.waitForTimeout(300);
      const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      const name = f.replace('.html', '') + (q ? '-' + q.slice(3) : '') + '-' + sfx;
      await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true });
      rows.push({ file: f + q, vp: w, overflowPx: Math.max(0, m.sw - m.cw), jsErrors: errs.length, errs: errs.slice(0, 3) }); await ctx.close();
    }
  }
  await browser.close(); console.table(rows.map(({ errs, ...r }) => r));
  rows.filter((r) => r.errs.length).forEach((r) => console.log(r.file, r.vp, r.errs));
})();
