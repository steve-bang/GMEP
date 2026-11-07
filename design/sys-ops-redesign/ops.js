// Chỉ chuyển trạng thái xem thử, mở/đóng hộp thoại, mở khóa nút theo ô tích; không gọi mạng.
// Địa chỉ: #tab=<khóa>&view=<khóa>&dlg=<id hộp thoại>
(function () {
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var tabs = $$('[data-tab]'), views = $$('[data-view]');
  var st = { tab: tabs.length ? tabs[0].dataset.tab : '', view: views.length ? views[0].dataset.view : '', dlg: '' };
  location.hash.replace(/^#/, '').split('&').forEach(function (p) { var kv = p.split('='); if (kv[0] in st && kv[1]) st[kv[0]] = kv[1]; });
  function has(list, v) { return (list || '').split(' ').indexOf(v) > -1; }
  function apply() {
    tabs.forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === st.tab)); });
    views.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.view === st.view)); });
    $$('[data-t],[data-tx],[data-v],[data-vx]').forEach(function (e) {
      var d = e.dataset, show = true;
      if (d.t !== undefined && !has(d.t, st.tab)) show = false;
      if (d.tx !== undefined && has(d.tx, st.tab)) show = false;
      if (d.v !== undefined && !has(d.v, st.view)) show = false;
      if (d.vx !== undefined && has(d.vx, st.view)) show = false;
      e.hidden = !show;
    });
  }
  function toast(msg) {
    var t = document.getElementById('toast'); if (!t) return;
    t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(function () { t.hidden = true; }, 3500);
  }
  // nút bị chặn không làm gì (vẫn tới được bằng bàn phím và đọc được lý do)
  document.addEventListener('click', function (e) {
    var d = e.target.closest('[aria-disabled="true"]'); if (d) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-tab]'); if (t) { st.tab = t.dataset.tab; apply(); return; }
    var v = e.target.closest('[data-view]'); if (v) { st.view = v.dataset.view; apply(); return; }
    var g = e.target.closest('[data-view-go]'); if (g) { st.view = g.dataset.viewGo; apply(); return; }
    var tg = e.target.closest('[data-tab-go]'); if (tg) { st.tab = tg.dataset.tabGo; apply(); return; }
    var o = e.target.closest('[data-open]'); if (o) { var dl = document.getElementById(o.dataset.open); if (dl && dl.showModal) dl.showModal(); return; }
    var c = e.target.closest('[data-close]'); if (c) { var p = c.closest('dialog'); if (p) p.close(); var m = c.dataset.close; if (m) toast(m); return; }
    var m2 = e.target.closest('[data-toast]'); if (m2) { toast(m2.dataset.toast); }
  });
  // ô tích mở khóa nút: <input type=checkbox data-gates="id"> và <button id="id" aria-disabled="true">
  $$('[data-gates]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      var b = document.getElementById(cb.dataset.gates); if (!b) return;
      b.setAttribute('aria-disabled', String(!cb.checked));
      var w = document.getElementById(cb.dataset.gates + '-why'); if (w) w.hidden = cb.checked;
    });
  });
  apply();
  if (st.dlg) { var d = document.getElementById(st.dlg); if (d && d.showModal) d.showModal(); }
})();
