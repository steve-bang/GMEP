/* Đo tràn ngang và lỗi JS cho các trang nhóm D, E, F (onboarding + account) ở 360, 768, 1280 px, theo từng trạng thái xem thử.
   Chạy:  node design/tenant-signup/account/measure.js            (in kết quả dạng bảng markdown)
          node design/tenant-signup/account/measure.js --states   (đo mọi trạng thái trên thanh "Xem thử trạng thái"; mặc định chỉ trạng thái đầu)
   Cần: playwright (require('playwright')); đặt PLAYWRIGHT_CHROMIUM_PATH nếu Chromium cài ở chỗ khác. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const base = path.resolve(__dirname, '..');
const dirs = ['onboarding', 'account'];
const widths = [[360, 800], [768, 1024], [1280, 800]];
const allStates = process.argv.includes('--states');
const COMMON = ['loading', 'error', 'offline'];

function stateKeys(html, dir) {
  const m = /data-tsu-bar="([^"]*)"/.exec(html);
  const keys = m ? m[1].split('|').map((s) => s.split(':')[0]) : [];
  const first = keys.length ? keys : [''];
  const needCommon = /data-tsu-mode="wizard"/.test(html) || /data-common="1"/.test(html);
  return allStates ? first.concat(needCommon ? COMMON.concat(/data-tsu-mode="wizard"/.test(html) ? ['saving'] : []) : []) : [first[0]];
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
  const rows = [];
  let bad = 0;
  for (const d of dirs) {
    const files = fs.readdirSync(path.join(base, d)).filter((f) => f.endsWith('.html')).sort();
    for (const f of files) {
      const html = fs.readFileSync(path.join(base, d, f), 'utf8');
      for (const st of stateKeys(html, d)) {
        for (const [w, h] of widths) {
          const ctx = await browser.newContext({ viewport: { width: w, height: h } });
          const page = await ctx.newPage();
          const errs = [];
          page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
          page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
          await page.goto('file://' + path.join(base, d, f) + (st ? '#state=' + st : ''));
          await page.waitForTimeout(250);
          const r = await page.evaluate(() => {
            const iw = window.innerWidth, sw = document.documentElement.scrollWidth;
            const offenders = [];
            if (sw > iw) {
              document.querySelectorAll('body *').forEach((el) => {
                const b = el.getBoundingClientRect();
                if (b.width && b.right > iw + 1 && !el.closest('[hidden]') && !el.closest('.table-scroll') && offenders.length < 5) offenders.push(el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0] + ' (' + Math.round(b.right) + 'px)');
              });
            }
            const blank = document.body.innerText.trim().length < 20;
            return { overflow: sw > iw, sw, iw, offenders, blank };
          });
          const ok = !r.overflow && !errs.length && !r.blank;
          if (!ok) bad++;
          rows.push({ file: d + '/' + f, st: st || '(mặc định)', w, ok, r, errs });
          await ctx.close();
        }
      }
    }
  }
  await browser.close();
  console.log('| Trang | Trạng thái | Rộng | Tràn ngang | Lỗi JS/console | Trang trống |');
  console.log('| --- | --- | --- | --- | --- | --- |');
  rows.forEach((x) => console.log(`| ${x.file} | ${x.st} | ${x.w} | ${x.r.overflow ? 'CÓ ' + x.r.sw + '>' + x.r.iw + ' ' + x.r.offenders.join('; ') : 'không'} | ${x.errs.length ? x.errs.join(' / ') : 'không'} | ${x.r.blank ? 'CÓ' : 'không'} |`));
  console.log(`\nTổng ${rows.length} lượt tải, ${bad} lượt có vấn đề.`);
  process.exit(bad ? 1 : 0);
})();
