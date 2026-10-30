// Chụp ảnh toàn bộ màn hình prototype bằng Playwright/Chromium.
// Dùng: node scripts/screenshot-all.js <thư-mục-gói> [<thư-mục-gói> ...]
//   ví dụ: node scripts/screenshot-all.js g1-auth-dashboard foundation
// Không truyền tham số: chụp tất cả các gói trong design/.
// Ảnh JPEG full-page lưu vào docs/ui-ux/screenshots/<gói>/<màn>.jpg
// Viewport: 1440x900 (desktop); màn thợ tablet g2-tec-*: 1024x768; trang khách g2-quo-06: 390x844.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const repo = path.resolve(__dirname, '..');
const root = path.join(repo, 'design');
const out = path.join(repo, 'docs/ui-ux/screenshots');
const wanted = process.argv.slice(2);
const dirs = fs.readdirSync(root).sort().filter(d => d !== 'assets' && fs.statSync(path.join(root, d)).isDirectory() && (!wanted.length || wanted.includes(d)));
const viewport = f => /g2-tec-/.test(f) ? [1024, 768] : /g2-quo-06/.test(f) ? [390, 844] : [1440, 900];
(async () => {
  const b = await chromium.launch();
  let ok = 0; const fail = [];
  for (const d of dirs) {
    const files = fs.readdirSync(path.join(root, d)).filter(f => f.endsWith('.html')).sort();
    fs.mkdirSync(path.join(out, d), { recursive: true });
    for (const f of files) {
      const [w, h] = viewport(f);
      const ctx = await b.newContext({ viewport: { width: w, height: h } });
      const pg = await ctx.newPage();
      try {
        await pg.goto('file://' + path.join(root, d, f), { waitUntil: 'load', timeout: 20000 });
        await pg.waitForTimeout(350);
        await pg.screenshot({ path: path.join(out, d, f.replace('.html', '.jpg')), type: 'jpeg', quality: 82, fullPage: true });
        ok++;
      } catch (e) { fail.push(`${d}/${f}: ${e.message.slice(0, 80)}`); }
      await ctx.close();
    }
  }
  await b.close();
  console.log(`dirs=${dirs.join(',')} captured=${ok} failed=${fail.length}`);
  fail.forEach(x => console.log('FAIL', x));
})();
