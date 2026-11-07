// Chụp ảnh (-d 1440px, -m 390px, deviceScaleFactor 1), đo tràn ngang và lỗi JS cho mọi .html cùng thư mục.
// Mỗi tab (data-tab), mỗi trạng thái xem thử (data-view) và mỗi hộp thoại (<dialog id>) là một ảnh:
//   <tên>.png (mặc định), <tên>--tab-<khóa>, <tên>--view-<khóa>, <tên>--dlg-<id>, hậu tố -d / -m.
// Địa chỉ dùng: #tab=<khóa>&view=<khóa>&dlg=<id> (xem ops.js).
// Chạy: node design/sys-ops-redesign/measure.js   (đặt PLAYWRIGHT_CHROMIUM_PATH nếu Chromium ở chỗ khác)
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
(async () => {
  const dir = __dirname, out = path.join(dir, 'screenshots'); fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
  const rows = [], uniq = (a) => [...new Set(a)];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.html')).sort()) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const tabs = uniq([...src.matchAll(/data-tab="([^"]+)"/g)].map((m) => m[1]));
    const views = uniq([...src.matchAll(/data-view="([^"]+)"/g)].map((m) => m[1]));
    const dlgs = uniq([...src.matchAll(/<dialog id="([^"]+)"/g)].map((m) => m[1]));
    const targets = [['', '']];
    tabs.forEach((t) => targets.push(['--tab-' + t, '#tab=' + t]));
    views.forEach((v) => targets.push(['--view-' + v, '#view=' + v]));
    dlgs.forEach((d) => targets.push(['--dlg-' + d, '#dlg=' + d]));
    for (const [label, hash] of targets) {
      for (const [sfx, w, h] of [['d', 1440, 900], ['m', 390, 844]]) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: 'vi-VN', reducedMotion: 'reduce' }), page = await ctx.newPage(), errs = [];
        page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
        await page.goto('file://' + path.join(dir, f) + hash); await page.waitForTimeout(300);
        // đo cả khung trang lẫn hộp thoại đang mở; bỏ qua phần tử trong .tblwrap (cuộn ngang có chủ ý) và phần tử ẩn
        const m = await page.evaluate(() => {
          const cw = document.documentElement.clientWidth;
          const wide = [...document.querySelectorAll('body *')].filter((e) => !e.closest('[hidden]') && !e.closest('.tblwrap') && !e.closest('.tabsline') && !e.closest('script') && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().right > cw + 1).slice(0, 4).map((e) => e.tagName + '.' + (e.className || e.id));
          const dlg = document.querySelector('dialog[open]'); const dOver = dlg ? Math.max(0, dlg.scrollWidth - dlg.clientWidth) : 0;
          const tbl = [...document.querySelectorAll('.tblwrap')].filter((e) => !e.closest('[hidden]') && e.scrollWidth > e.clientWidth + 1).length;
          return { sw: document.documentElement.scrollWidth, cw, wide, dOver, tbl };
        });
        await page.screenshot({ path: path.join(out, f.replace('.html', '') + label + '-' + sfx + '.png'), fullPage: true });
        rows.push({ file: f + hash, vp: w, overflowPx: Math.max(0, m.sw - m.cw), dialogOverflowPx: m.dOver, tablesScrolling: m.tbl, wide: m.wide.join(' | '), jsErrors: errs.length, errs: errs.slice(0, 3) });
        await ctx.close();
      }
    }
  }
  await browser.close(); console.table(rows.map(({ errs, ...r }) => r));
  const bad = rows.filter((r) => r.overflowPx || r.dialogOverflowPx || r.jsErrors);
  console.log(bad.length ? 'CẦN SỬA: ' + bad.length + ' trường hợp tràn ngang hoặc lỗi JS' : 'Không có tràn ngang hoặc lỗi JS.');
  rows.filter((r) => r.errs.length).forEach((r) => console.log(r.file, r.vp, r.errs));
})();
