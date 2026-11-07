// Chụp ảnh (-d 1440px, -m 390px, deviceScaleFactor 1), đo tràn ngang và lỗi JS cho mọi .html cùng thư mục.
// Mỗi trạng thái xem thử (chip data-view, không trùng) là một ảnh: <tên>--<trạng thái>-d.png / -m.png.
// Mỗi <dialog id> mở thêm một ảnh ở trạng thái mặc định: <tên>--dlg-<id>-d.png / -m.png (đo tràn ngang trong hộp thoại).
// Chạy: node design/sys-users-redesign/measure.js   (Playwright đã cài sẵn; đặt PLAYWRIGHT_CHROMIUM_PATH nếu Chromium ở chỗ khác)
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const measure = () => ({
  sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  wide: [...document.querySelectorAll('body *')].filter((e) => !e.closest('[hidden]') && !e.closest('.tblwrap') && !e.closest('.tabsline') && !e.closest('.sr') && !e.classList.contains('sr') && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).slice(0, 3).map((e) => e.tagName + '.' + e.className),
});
(async () => {
  const dir = __dirname, out = path.join(dir, 'screenshots'); fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
  const rows = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.html')).sort()) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const views = [...new Set([...src.matchAll(/<button[^>]*class="chip"[^>]*data-view="([^"]+)"/g)].map((m) => m[1]))];
    const dlgs = [...src.matchAll(/<dialog id="([^"]+)"/g)].map((m) => m[1]);
    const jobs = (views.length ? views : ['']).map((v) => ({ v, dlg: '' })).concat(dlgs.map((id) => ({ v: '', dlg: id })));
    for (const job of jobs) {
      for (const [sfx, w, h] of [['d', 1440, 900], ['m', 390, 844]]) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: 'vi-VN', reducedMotion: 'reduce' }), page = await ctx.newPage(), errs = [];
        page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
        await page.goto('file://' + path.join(dir, f) + (job.v ? '#' + job.v : '')); await page.waitForTimeout(300);
        if (job.dlg) { await page.evaluate((id) => document.getElementById(id).showModal(), job.dlg); await page.waitForTimeout(150); }
        const m = await page.evaluate(measure);
        const dlgBox = job.dlg ? await page.evaluate((id) => { const e = document.getElementById(id); return e.scrollWidth - e.clientWidth; }, job.dlg) : 0;
        const tag = job.dlg ? '--dlg-' + job.dlg : job.v ? '--' + job.v : '';
        await page.screenshot({ path: path.join(out, f.replace('.html', '') + tag + '-' + sfx + '.png'), fullPage: !job.dlg });
        rows.push({ file: f, view: job.v || (job.dlg ? 'dialog ' + job.dlg : ''), vp: w, overflowPx: Math.max(0, m.sw - m.cw, dlgBox), wide: m.wide.join(' | '), jsErrors: errs.length, errs: errs.slice(0, 3) }); await ctx.close();
      }
    }
  }
  await browser.close(); console.table(rows.map(({ errs, ...r }) => r));
  rows.filter((r) => r.errs.length).forEach((r) => console.log(r.file, r.view, r.vp, r.errs));
})();
