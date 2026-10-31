/* G5 – Bộ chọn phạm vi chi nhánh (ScopePicker) – hành vi giả lập cho prototype g5-scp-01.html.
   Không phải code production. Mọi nội dung hiển thị được dựng bằng DOM API (textContent), không nối chuỗi HTML.
   Mô phỏng: người dùng theo gán chi nhánh, chế độ Một chi nhánh / Hợp nhất, tìm không dấu, bàn phím (roving tabindex),
   hộp thoại nháp chưa lưu (dùng .overlay của app.js: nền inert + vòng Tab), mất kết nối, chi nhánh khóa sổ, bảng trượt trên điện thoại. */
(function () {
  'use strict';
  var trigger = document.getElementById('g5-trigger');
  if (!trigger) return;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function ic(name, cls) {
    var ns = 'http://www.w3.org/2000/svg', s = document.createElementNS(ns, 'svg'), u = document.createElementNS(ns, 'use');
    s.setAttribute('class', 'icon' + (cls ? ' ' + cls : '')); s.setAttribute('aria-hidden', 'true'); u.setAttribute('href', '#' + name); s.appendChild(u); return s;
  }
  function fold(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); }
  function vnd(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' ₫'; }
  function toast(k, t, x) { if (window.gmepToast) window.gmepToast(k, t, x); }
  var phone = window.matchMedia('(max-width: 639px)');

  /* ----- Dữ liệu mẫu (không phải dữ liệu thật) ----- */
  var BR = {
    q1: { name: 'Chi nhánh Quận 1', rev: 42300000, jobs: 9, wait: 2 }, q7: { name: 'Chi nhánh Quận 7', rev: 58700000, jobs: 14, wait: 3 },
    td: { name: 'Chi nhánh Thủ Đức', rev: 31200000, jobs: 8, wait: 1 }, bh: { name: 'Chi nhánh Biên Hòa', rev: 24900000, jobs: 6, wait: 2 },
    bd: { name: 'Chi nhánh Bình Dương', rev: 27500000, jobs: 7, wait: 1 }, ct: { name: 'Chi nhánh Cần Thơ', rev: 19800000, jobs: 5, wait: 0 },
    dn: { name: 'Chi nhánh Đà Nẵng', rev: 33100000, jobs: 8, wait: 2 }, hp: { name: 'Chi nhánh Hải Phòng', rev: 22400000, jobs: 5, wait: 1 }
  };
  var GROUPS = { south: { name: 'Nhóm Miền Nam', m: ['q1', 'q7', 'td', 'bh', 'bd', 'ct'] }, north: { name: 'Nhóm Miền Trung và Bắc', m: ['dn', 'hp'] } };
  function map(ids, role) { var o = {}; ids.forEach(function (i) { o[i] = role; }); return o; }
  var ALL8 = ['q1', 'q7', 'td', 'bh', 'bd', 'ct', 'dn', 'hp'];
  var USERS = {
    ql: { who: 'Nguyễn Thị Thu Hà', role: 'Quản lý chi nhánh', br: map(['q7', 'td', 'bh'], 'Quản lý chi nhánh'), locked: {}, merged: false, groups: [], def: 'single:q7' },
    ch: { who: 'Trần Hoàng Anh', role: 'Chủ garage', br: map(ALL8, 'Chủ garage'), locked: {}, merged: true, groups: ['south', 'north'], def: 'all' },
    qv: { who: 'Lê Minh Quân', role: 'Quản lý vùng', br: map(GROUPS.south.m, 'Quản lý vùng'), locked: {}, merged: true, groups: ['south'], def: 'all' },
    lock: { who: 'Nguyễn Thị Thu Hà', role: 'Quản lý chi nhánh', br: map(['q7', 'td', 'bh'], 'Quản lý chi nhánh'), locked: { td: 'Khóa sổ cuối kỳ' }, closing: { bh: 'Ngừng nhận lệnh mới' }, merged: false, groups: [], def: 'single:td' },
    one: { who: 'Phạm Quốc Bảo', role: 'Cố vấn dịch vụ', br: map(['q7'], 'Cố vấn dịch vụ'), locked: {}, merged: false, groups: [], def: 'single:q7' },
    none: { who: 'Võ Thị Hạnh', role: 'Chưa gán vai trò', br: {}, locked: {}, merged: false, groups: [], def: null }
  };
  var userKey = 'ql', U = USERS.ql, scope = U.def, pending = scope, mode = 'single', lastSingle = 'single:q7', draft = false, offline = false, filter = '';

  /* ----- Phần tử ----- */
  var panel = $('#g5-panel'), backdrop = $('#g5-backdrop'), statEl = $('#g5-static'), modeBox = $('#g5-mode'), search = $('#g5-search'), searchBox = $('#g5-searchbox'),
      list = $('#g5-list'), sum = $('#g5-psum'), apply = $('#g5-apply'), why = $('#g5-modewhy'), live = $('#g5-live'), bar = $('#g5-bar'),
      none = $('#g5-none'), mainBox = $('#g5-main'), gPhint = $('#g5-phint');

  /* ----- Hàm dẫn xuất ----- */
  function kMode(k) { return k && k.indexOf('single:') === 0 ? 'single' : 'merged'; }
  function ids(k) {
    var all = Object.keys(U.br);
    if (!k) return [];
    if (k.indexOf('single:') === 0) return [k.slice(7)];
    if (k === 'all') return all;
    var g = GROUPS[k.slice(6)]; return g ? g.m.filter(function (i) { return U.br[i]; }) : [];
  }
  function label(k) {
    if (!k) return 'Chưa có phạm vi';
    if (k.indexOf('single:') === 0) return BR[k.slice(7)].name;
    if (k === 'all') return (U.role === 'Quản lý vùng' ? 'Tất cả nhóm được giao' : 'Tất cả chi nhánh') + ' (' + ids(k).length + ')';
    return GROUPS[k.slice(6)].name;
  }
  function isLocked(k) { return !!(k && k.indexOf('single:') === 0 && U.locked[k.slice(7)]); }
  /* Trạng thái chi nhánh theo BA (docs/dev/ba-answers-for-dev.md §5): active | closing (ngừng nhận lệnh mới) | locked (khóa hoàn toàn, chỉ đọc) */
  function isClosing(k) { return !!(k && k.indexOf('single:') === 0 && U.closing && U.closing[k.slice(7)]); }
  function branchCount() { return Object.keys(U.br).length; }
  function say(t) { live.textContent = ''; setTimeout(function () { live.textContent = t; }, 30); }

  /* ----- Nút mở + thanh phạm vi + nội dung mẫu ----- */
  function renderTop() {
    var n = branchCount();
    none.hidden = n !== 0; mainBox.hidden = n === 0;
    trigger.parentNode.hidden = n < 2;
    statEl.hidden = n !== 1;
    if (n === 1) {
      var id = Object.keys(U.br)[0];
      $('[data-static-name]', statEl).textContent = BR[id].name + (U.locked[id] ? ' (chỉ xem)' : '');
    }
    $('#g5-user').textContent = U.who + ' · ' + U.role;
    if (n < 2) return;
    $('[data-trigger-name]', trigger).textContent = label(scope);
    trigger.classList.toggle('is-all', kMode(scope) === 'merged');
    trigger.setAttribute('aria-label', 'Phạm vi dữ liệu hiện tại: ' + label(scope) + '. Mở bộ chọn phạm vi');
  }
  function renderBar() {
    bar.textContent = '';
    if (!scope) { bar.hidden = true; return; }
    bar.hidden = false;
    var merged = kMode(scope) === 'merged', k = ids(scope).length;
    bar.classList.toggle('scope-banner--branch', !merged);
    bar.appendChild(ic('map-pin', 'icon--sm'));
    var s = el('span'); s.appendChild(el('strong', null, 'Phạm vi:')); s.appendChild(document.createTextNode(' ' +
      (merged ? (scope === 'all' ? label(scope).replace(/ \(\d+\)$/, '') + ', ' + k + ' chi nhánh' : label(scope) + ', ' + k + ' chi nhánh') + ' – số liệu cộng gộp' : 'Chỉ ' + label(scope) + ' – không gồm chi nhánh khác')));
    bar.appendChild(s);
    var t = el('span'); t.appendChild(document.createTextNode('· ')); t.appendChild(el('strong', null, 'Thời gian:')); t.appendChild(document.createTextNode(' hôm nay 31/10/2026')); bar.appendChild(t);
    bar.appendChild(el('span', null, '· Cập nhật lúc 09:15'));
    if (isLocked(scope)) { var lk = el('span', 'tag tag--warning'); lk.appendChild(ic('lock', 'icon--sm')); lk.appendChild(document.createTextNode('Chi nhánh khóa: chỉ xem')); bar.appendChild(lk); }
    else if (isClosing(scope)) { var cl = el('span', 'tag tag--warning'); cl.appendChild(ic('clock', 'icon--sm')); cl.appendChild(document.createTextNode('Ngừng nhận lệnh mới')); bar.appendChild(cl); }
  }
  function renderContent() {
    var sel = ids(scope), rev = 0, jobs = 0, wait = 0;
    sel.forEach(function (i) { rev += BR[i].rev; jobs += BR[i].jobs; wait += BR[i].wait; });
    var vals = [vnd(rev), String(jobs), String(wait)];
    $$('[data-kpi]').forEach(function (k, i) {
      $('.kpi__value', k).textContent = vals[i];
      $('.kpi__scope', k).textContent = 'Phạm vi: ' + label(scope) + ' · hôm nay 31/10/2026';
    });
    var merged = kMode(scope) === 'merged', lk = isLocked(scope), cl = isClosing(scope), btn = $('#g5-create'), rs = $('#g5-createwhy');
    var blocked = merged || lk || cl;
    btn.disabled = false; btn.setAttribute('aria-disabled', String(blocked));
    rs.textContent = '';
    if (merged) { rs.appendChild(ic('info', 'icon--sm')); rs.appendChild(document.createTextNode('Chọn một chi nhánh để tạo báo giá. Mỗi chứng từ gắn với đúng một chi nhánh.')); }
    else if (lk) { rs.appendChild(ic('lock', 'icon--sm')); rs.appendChild(document.createTextNode('Chi nhánh đã khóa: chỉ xem lịch sử, không tạo hay sửa chứng từ (FR-SYS-011).')); }
    else if (cl) { rs.appendChild(ic('clock', 'icon--sm')); rs.appendChild(document.createTextNode('Chi nhánh đang ngừng nhận lệnh mới: không tạo được báo giá mới; vẫn xử lý được các lệnh đang mở.')); }
    var dt = $('#g5-draft'), dBtn = $('[data-g5-toggle="draft"]');
    dt.hidden = !draft;
    if (draft) $('#g5-draftbr').textContent = label(scope);
    dBtn.setAttribute('aria-disabled', String(blocked)); dBtn.setAttribute('aria-pressed', String(draft));
    var nb = $('#g5-net'); nb.hidden = !offline;
  }
  function renderAll() { renderTop(); renderBar(); renderContent(); }

  /* ----- Bảng chọn ----- */
  function visibleOpts() { return $$('.g5-opt', list); }
  function optRows() {
    var rows = [];
    if (mode === 'single') {
      Object.keys(U.br).forEach(function (i) {
        if (filter && fold(BR[i].name).indexOf(fold(filter)) < 0) return;
        var cls = U.closing && U.closing[i];
        rows.push({ key: 'single:' + i, name: BR[i].name, sub: 'Vai trò của bạn: ' + U.br[i] + (U.locked[i] ? ' · ' + U.locked[i] : cls ? ' · ' + cls : ''), locked: !!U.locked[i], closing: !!cls });
      });
    } else {
      rows.push({ key: 'all', name: label('all'), sub: 'Cộng gộp mọi chi nhánh bạn được xem · không tạo được chứng từ mới ở phạm vi này' });
      U.groups.forEach(function (g) { rows.push({ key: 'group:' + g, name: GROUPS[g].name, sub: ids('group:' + g).length + ' chi nhánh trong nhóm · số liệu hợp nhất' }); });
    }
    return rows;
  }
  function renderPanel() {
    var hasMerge = U.merged;
    $$('[role="radio"]', modeBox).forEach(function (b) {
      var m = b.getAttribute('data-mode'); b.setAttribute('aria-checked', String(m === mode));
      b.tabIndex = m === mode ? 0 : -1;
      if (m === 'merged') b.setAttribute('aria-disabled', String(!hasMerge));
    });
    why.hidden = hasMerge;
    searchBox.hidden = !(mode === 'single' && branchCount() >= 6);
    if (searchBox.hidden) { filter = ''; search.value = ''; }
    list.setAttribute('aria-label', mode === 'single' ? 'Chọn một chi nhánh' : 'Chọn phạm vi hợp nhất');
    list.textContent = '';
    var rows = optRows();
    if (!rows.length) list.appendChild(el('div', 'g5-empty', 'Không có chi nhánh nào khớp “' + filter + '” trong các chi nhánh bạn được gán.'));
    var anyChecked = rows.some(function (r) { return r.key === pending; });
    rows.forEach(function (r, idx) {
      var b = el('button', 'g5-opt'); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('data-key', r.key);
      var on = r.key === pending; b.setAttribute('aria-checked', String(on)); b.tabIndex = on || (!anyChecked && idx === 0) ? 0 : -1;
      b.appendChild(el('span', 'g5-opt__dot')); b.lastChild.setAttribute('aria-hidden', 'true');
      var m = el('span', 'g5-opt__main'); m.appendChild(el('span', 'g5-opt__name', r.name)); m.appendChild(el('span', 'g5-opt__sub', r.sub)); b.appendChild(m);
      if (r.key === scope) b.appendChild(el('span', 'tag tag--info', 'Đang dùng'));
      if (r.locked) { var t = el('span', 'tag tag--warning'); t.appendChild(ic('lock', 'icon--sm')); t.appendChild(document.createTextNode('Chỉ xem')); b.appendChild(t); }
      else if (r.closing) { var t2 = el('span', 'tag tag--warning'); t2.appendChild(ic('clock', 'icon--sm')); t2.appendChild(document.createTextNode('Ngừng nhận lệnh mới')); b.appendChild(t2); }
      list.appendChild(b);
    });
    gPhint.textContent = 'Bạn được gán ' + branchCount() + ' chi nhánh. Chi nhánh khác không hiện trong danh sách.';
    var changed = pending !== scope, text;
    if (offline) text = 'Đang mất kết nối: chưa đổi được phạm vi vì số liệu không tải được. Phạm vi hiện tại được giữ nguyên.';
    else if (!changed) text = 'Chưa thay đổi so với phạm vi hiện tại.';
    else text = 'Sẽ xem: ' + label(pending) + (kMode(pending) === 'merged' ? ' (hợp nhất)' : '') + (draft ? '. Bạn đang soạn nháp, sẽ hỏi lưu trước.' : '.');
    sum.textContent = text;
    var dis = !changed || offline; apply.setAttribute('aria-disabled', String(dis));
  }

  function openPanel() {
    if (branchCount() < 2) return;
    pending = scope; mode = kMode(scope); filter = ''; if (search) search.value = '';
    panel.hidden = false; backdrop.hidden = false; trigger.setAttribute('aria-expanded', 'true');
    panel.setAttribute('aria-modal', String(phone.matches));
    renderPanel();
    var f = $('.g5-opt[aria-checked="true"]', list) || $('.g5-opt', list) || $('[role="radio"][tabindex="0"]', modeBox);
    if (f) f.focus();
  }
  function closePanel(restore) {
    if (panel.hidden) return;
    panel.hidden = true; backdrop.hidden = true; trigger.setAttribute('aria-expanded', 'false');
    if (restore !== false) trigger.focus();
  }
  function setMode(m) {
    if (m === 'merged' && !U.merged) { say('Hợp nhất chưa dùng được. ' + why.textContent.trim()); return false; }
    if (m === mode) return true;
    if (mode === 'single' && pending.indexOf('single:') === 0) lastSingle = pending;
    mode = m; filter = ''; if (search) search.value = '';
    pending = m === 'merged' ? 'all' : (U.br[lastSingle.slice(7)] ? lastSingle : 'single:' + Object.keys(U.br)[0]);
    renderPanel(); return true;
  }
  function commit(k) {
    scope = k; if (kMode(k) === 'merged' || isLocked(k) || isClosing(k)) draft = false;
    renderAll(); toast(kMode(k) === 'single' ? 'success' : 'info', 'Đã đổi phạm vi dữ liệu', label(k) + (kMode(k) === 'merged' ? ' – số liệu hợp nhất.' : ' – không gồm chi nhánh khác.'));
    say('Đã đổi phạm vi dữ liệu sang ' + label(k));
  }
  function doApply() {
    if (offline || pending === scope) { if (offline) say(sum.textContent); return; }
    if (draft) {
      closePanel(true);
      $('#g5-dlg-from').textContent = label(scope); $('#g5-dlg-to').textContent = label(pending);
      if (window.gmepOpen) window.gmepOpen('g5-dlg-draft');
      return;
    }
    closePanel(true); commit(pending);
  }

  /* ----- Sự kiện ----- */
  trigger.addEventListener('click', function () { if (panel.hidden) openPanel(); else closePanel(true); });
  trigger.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown' && panel.hidden) { e.preventDefault(); openPanel(); } });
  backdrop.addEventListener('click', function () { closePanel(true); });
  $('#g5-cancel').addEventListener('click', function () { closePanel(true); });
  apply.addEventListener('click', doApply);
  search.addEventListener('input', function () { filter = search.value.trim(); renderPanel(); });
  search.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown') { e.preventDefault(); var f = visibleOpts()[0]; if (f) f.focus(); } });

  modeBox.addEventListener('click', function (e) { var b = e.target.closest('[role="radio"]'); if (b && setMode(b.getAttribute('data-mode'))) b.focus(); });
  modeBox.addEventListener('keydown', function (e) {
    var items = $$('[role="radio"]', modeBox), i = items.indexOf(document.activeElement), n = null;
    if (i < 0) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = items[(i + 1) % items.length];
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = items[(i - 1 + items.length) % items.length];
    else if (e.key === 'Home') n = items[0]; else if (e.key === 'End') n = items[items.length - 1];
    if (!n) return; e.preventDefault();
    if (setMode(n.getAttribute('data-mode'))) { var again = $$('[role="radio"]', modeBox); again[items.indexOf(n)].focus(); } else { n.tabIndex = 0; items.forEach(function (x) { if (x !== n) x.tabIndex = -1; }); n.focus(); }
  });
  list.addEventListener('click', function (e) { var b = e.target.closest('.g5-opt'); if (!b) return; pending = b.getAttribute('data-key'); renderPanel(); var again = $('.g5-opt[data-key="' + pending + '"]', list); if (again) again.focus(); });
  list.addEventListener('keydown', function (e) {
    var items = visibleOpts(), i = items.indexOf(document.activeElement); if (i < 0) return;
    if (e.key === 'Enter') { e.preventDefault(); pending = document.activeElement.getAttribute('data-key'); renderPanel(); doApply(); return; }
    var n = null;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = items[Math.min(i + 1, items.length - 1)];
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { if (i === 0 && !searchBox.hidden) { e.preventDefault(); search.focus(); return; } n = items[Math.max(i - 1, 0)]; }
    else if (e.key === 'Home') n = items[0]; else if (e.key === 'End') n = items[items.length - 1];
    if (!n) return; e.preventDefault();
    pending = n.getAttribute('data-key'); renderPanel(); var again = $('.g5-opt[data-key="' + pending + '"]', list); if (again) again.focus();
  });
  document.addEventListener('keydown', function (e) {
    if (panel.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); closePanel(true); return; }
    if (e.key !== 'Tab') return;
    var f = $$('button:not([disabled]), input:not([disabled]), [tabindex="0"]', panel).filter(function (x) { return !x.hidden && x.offsetParent !== null && x.tabIndex >= 0; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (!panel.contains(document.activeElement)) { first.focus(); e.preventDefault(); }
    else if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  });
  phone.addEventListener('change', function () { panel.setAttribute('aria-modal', String(phone.matches)); });

  /* Hộp thoại nháp chưa lưu */
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-g5-confirm]')) {
      draft = false; if (window.gmepClose) window.gmepClose($('#g5-dlg-draft'));
      toast('success', 'Đã lưu nháp', 'Báo giá nháp được lưu vào ' + $('#g5-dlg-from').textContent + ' trước khi đổi phạm vi.');
      commit(pending);
    }
    var u = e.target.closest('[data-g5-user]');
    if (u) {
      userKey = u.getAttribute('data-g5-user'); U = USERS[userKey]; scope = U.def; pending = scope; draft = false; closePanel(false);
      if (scope && scope.indexOf('single:') === 0) lastSingle = scope;
      $$('[data-g5-user]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === u)); });
      renderAll(); say('Đang xem thử: ' + u.textContent);
    }
    var t = e.target.closest('[data-g5-toggle]');
    if (t) {
      var w = t.getAttribute('data-g5-toggle');
      if (w === 'draft') {
        if (t.getAttribute('aria-disabled') === 'true') { toast('info', 'Chưa soạn được nháp', 'Nháp chỉ có ở phạm vi một chi nhánh đang mở.'); return; }
        draft = !draft; t.setAttribute('aria-pressed', String(draft));
      } else { offline = !offline; t.setAttribute('aria-pressed', String(offline)); }
      $$('[data-g5-toggle="draft"]').forEach(function (x) { x.setAttribute('aria-pressed', String(draft)); });
      renderContent(); if (!panel.hidden) renderPanel();
    }
    var c = e.target.closest('#g5-create');
    if (c) {
      if (c.getAttribute('aria-disabled') === 'true') toast('info', 'Chưa tạo được báo giá', kMode(scope) === 'merged' ? 'Đang xem hợp nhất. Chọn một chi nhánh để tạo báo giá.' : isClosing(scope) ? 'Chi nhánh đang ngừng nhận lệnh mới.' : 'Chi nhánh đã khóa.');
      else toast('info', 'Mở form báo giá', 'Trong sản phẩm thật, nút này mở form tạo báo giá cho ' + label(scope) + '.');
    }
  });

  renderAll();
})();
