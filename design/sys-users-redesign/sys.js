// Chỉ chuyển trạng thái xem thử, tab, hộp thoại, thông báo Hoàn tác. Không gọi mạng. Dữ liệu là dữ liệu mẫu.
(function () {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  window.$ = $; window.$$ = $$;
  window.vnd = (n) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' ₫';
  window.fold = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  const chips = $$('[data-view]');
  let current = '';
  function show(v) {
    current = v;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.view === v)));
    $$('[data-v]').forEach((e) => { e.hidden = !e.dataset.v.split(' ').includes(v); });
    $$('[data-nv]').forEach((e) => { e.hidden = e.dataset.nv.split(' ').includes(v); });
    $$('[data-dis-in]').forEach((b) => b.setAttribute('aria-disabled', String(b.dataset.disIn.split(' ').includes(v))));
    document.body.dataset.view = v;
    document.dispatchEvent(new CustomEvent('viewchange', { detail: v }));
  }
  window.curView = () => current;
  chips.forEach((c) => c.addEventListener('click', () => { history.replaceState(null, '', '#' + c.dataset.view); show(c.dataset.view); }));
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (chips.some((c) => c.dataset.view === h)) show(h); });
  // tab: nút [data-tab] điều khiển [data-panel]
  $$('[data-tab]').forEach((t) => t.addEventListener('click', () => {
    $$('[data-tab]', t.parentNode).forEach((x) => x.setAttribute('aria-selected', String(x === t)));
    $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== t.dataset.tab; });
  }));
  document.addEventListener('click', (e) => {
    const dis = e.target.closest('[aria-disabled="true"]');
    if (dis && dis.matches('button, a')) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    const o = e.target.closest('[data-open]'); if (o) { e.preventDefault(); const d = $('#' + o.dataset.open); if (d) d.showModal(); }
    const c = e.target.closest('[data-close]'); if (c) { e.preventDefault(); const d = c.closest('dialog'); if (d) d.close(); }
    const t = e.target.closest('[data-toast]'); if (t && !t.closest('dialog')) toast(t.dataset.toast, t.dataset.undo);
  }, true);
  let timer;
  window.toast = function (msg, undo) {
    $$('.toast').forEach((x) => x.remove());
    const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status');
    el.innerHTML = '<span></span>'; el.firstChild.textContent = msg;
    if (undo) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Hoàn tác (10 giây)';
      b.onclick = () => { el.remove(); window.toast('Đã hoàn tác. Việc hoàn tác cũng được ghi nhật ký.'); };
      el.appendChild(b);
    }
    document.body.appendChild(el); clearTimeout(timer); timer = setTimeout(() => el.remove(), undo ? 10000 : 5000);
  };
  const first = chips[0] && chips[0].dataset.view;
  const h = location.hash.slice(1);
  show(chips.some((c) => c.dataset.view === h) ? h : first || '');
})();
