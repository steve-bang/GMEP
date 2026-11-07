/* Tiện ích dùng chung cho prototype: định dạng vi-VN, biểu đồ cột HTML, tooltip, trạng thái từng khối. Không gọi mạng. */
const vnd = (n) => (n < 0 ? '−' : '') + String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' ₫';
const num = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const dec = (n, d = 1) => n.toFixed(d).replace('.', ',');
const pct = (n, d = 1) => dec(n, d) + '%';
const tr = (n) => dec(n / 1e6, n % 1e6 === 0 ? 0 : 1) + ' tr';

/* cols(el, { series:[{name, cls}], data:[{label, vals:[...], prov, tip}], max, unit })
   el là .plot; trục bắt đầu từ 0; max làm tròn lên để lưới 0, 50%, 100% có nhãn đẹp. */
function cols(el, o) {
  const tot = (d) => d.vals.reduce((a, b) => a + b, 0);
  const max = o.max || Math.max(...o.data.map(tot));
  const top = o.niceTo ? Math.ceil(max / o.niceTo) * o.niceTo : max;
  el.innerHTML = `<div class="yax" aria-hidden="true"><span>0</span><span>${o.fmtAxis(top / 2)}</span><span>${o.fmtAxis(top)}</span></div>
    <div class="cols" role="list">${o.data.map((d, i) => `<div class="col ${d.prov ? 'prov' : ''}" role="listitem" tabindex="0" data-i="${i}" aria-label="${d.tip.replace(/<br>/g, ', ')}">${d.vals.map((v, k) => `<i class="${o.series[k].cls}" style="height:${(v / top) * 100}%"></i>`).join('')}</div>`).join('')}</div>
    <div class="xax" aria-hidden="true">${o.data.map((d) => `<span>${d.label}</span>`).join('')}</div><div class="tip" hidden></div>`;
  const tip = el.querySelector('.tip');
  const show = (c) => {
    tip.innerHTML = o.data[+c.dataset.i].tip; tip.hidden = false;
    const r = c.getBoundingClientRect(), p = el.getBoundingClientRect();
    let x = r.left - p.left + r.width / 2 - tip.offsetWidth / 2; x = Math.max(0, Math.min(x, el.clientWidth - tip.offsetWidth));
    tip.style.left = x + 'px'; tip.style.top = Math.max(0, r.top - p.top + r.height * (1 - tot(o.data[+c.dataset.i]) / top) - tip.offsetHeight - 6) + 'px';
  };
  el.querySelectorAll('.col').forEach((c) => { c.addEventListener('mouseenter', () => show(c)); c.addEventListener('focus', () => show(c)); c.addEventListener('mouseleave', () => (tip.hidden = true)); c.addEventListener('blur', () => (tip.hidden = true)); });
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') tip.hidden = true; });
}

/* Trạng thái từng khối: ok | loading | error. Mỗi .blk có sk (khung xương) và er (lỗi + thử lại). */
function blocks(root = document) {
  root.querySelectorAll('.blk').forEach((b) => {
    if (!b.querySelector('.sk')) b.insertAdjacentHTML('beforeend', '<div class="sk" aria-hidden="true"></div><div class="er" role="alert"><p>Không tải được khối này. Mã lỗi ERR-RPT-503 (mẫu).</p><button class="b b--secondary" type="button" data-retry>Thử lại</button></div>');
    b.dataset.s = 'ok';
  });
  root.addEventListener('click', (e) => { if (e.target.closest('[data-retry]')) setState('ok'); });
}
function setState(s) {
  document.querySelectorAll('.blk').forEach((b) => (b.dataset.s = s));
  document.querySelectorAll('[data-demo]').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.demo === s)));
}
document.addEventListener('click', (e) => { const c = e.target.closest('[data-demo]'); if (c) setState(c.dataset.demo); });

let toastTm;
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.innerHTML = `<span>${msg}</span>`; t.hidden = false; clearTimeout(toastTm); toastTm = setTimeout(() => (t.hidden = true), 5000);
}
