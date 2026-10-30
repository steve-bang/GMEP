/* GMEP prototype JS – không phụ thuộc, chỉ phục vụ minh họa tương tác (không phải code production).
   Chức năng: nhúng sprite icon, thu gọn sidebar, đổi theme, dialog, dropdown, tab, chọn dòng bảng,
   chuyển chi nhánh, mobile nav, sắp xếp cột (giả lập), toast, đổi trạng thái demo, banner mất kết nối. */
(function () {
  'use strict';

  /* ---------- 1. Sprite icon nhúng (cùng nội dung icons.svg; cần cho file://) ---------- */
  var ICONS = {
    'layout-dashboard': '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    'clipboard-list': '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
    'clipboard-check': '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    'car-front': '<path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8"/><path d="M7 14h.01"/><path d="M17 14h.01"/><rect width="18" height="8" x="3" y="10" rx="2"/><path d="M5 18v2"/><path d="M19 18v2"/>',
    'users': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    'user': '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    'id-card': '<rect width="20" height="14" x="2" y="5" rx="2"/><circle cx="8" cy="11" r="2"/><path d="M14 9h4"/><path d="M14 13h4"/><path d="M5 17c.5-1.5 1.7-2 3-2s2.5.5 3 2"/>',
    'warehouse': '<path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/><rect width="12" height="12" x="6" y="10"/>',
    'wallet': '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    'chart-no-axes-combined': '<path d="M12 16v5"/><path d="M16 14v7"/><path d="M20 10v11"/><path d="m22 3-8.646 8.646a.5.5 0 0 1-.708 0L9.354 8.354a.5.5 0 0 0-.707 0L2 15"/><path d="M4 18v3"/><path d="M8 14v7"/>',
    'settings': '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    'calendar': '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    'wrench': '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    'package': '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    'truck': '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    'shopping-cart': '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    'file-text': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    'receipt': '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
    'bell': '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    'search': '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    'plus': '<path d="M5 12h14"/><path d="M12 5v14"/>',
    'minus': '<path d="M5 12h14"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'chevron-up': '<path d="m18 15-6-6-6 6"/>',
    'chevron-left': '<path d="m15 18-6-6 6-6"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    'chevrons-left': '<path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/>',
    'chevrons-right': '<path d="m6 17 5-5-5-5"/><path d="m13 17 5-5-5-5"/>',
    'chevrons-up-down': '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
    'arrow-up': '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    'arrow-down': '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
    'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    'arrow-left-right': '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
    'filter': '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    'columns': '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M15 3v18"/>',
    'download': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    'upload': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    'printer': '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect width="12" height="8" x="6" y="14" rx="1"/>',
    'check': '<path d="M20 6 9 17l-5-5"/>',
    'x': '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    'circle-check': '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    'circle-x': '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
    'alert-triangle': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    'info': '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    'help-circle': '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    'lock': '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    'eye': '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
    'eye-off': '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
    'mail': '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    'phone': '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    'camera': '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    'qr-code': '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>',
    'menu': '<path d="M4 12h16"/><path d="M4 6h16"/><path d="M4 18h16"/>',
    'ellipsis': '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    'log-out': '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    'map-pin': '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    'moon': '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    'trash': '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    'pencil': '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
    'undo': '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11"/>',
    'clock': '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    'history': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
    'wifi-off': '<path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/>',
    'inbox': '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    'panel-left': '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
    'refresh': '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    'loader': '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
    'send': '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>'
  };
  window.GMEP_ICON_NAMES = Object.keys(ICONS);
  var sprite = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">';
  Object.keys(ICONS).forEach(function (k) { sprite += '<symbol id="' + k + '" viewBox="0 0 24 24">' + ICONS[k] + '</symbol>'; });
  sprite += '</svg>';
  document.body.insertAdjacentHTML('afterbegin', sprite);

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  /* ---------- 2. Theme ---------- */
  var savedTheme = store.get('gmep-theme');
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-theme-toggle]');
    if (!t) return;
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    store.set('gmep-theme', next);
  });

  /* ---------- 3. Sidebar thu gọn + mobile nav ---------- */
  var app = $('.app');
  if (app) {
    if (store.get('gmep-sidebar') === 'collapsed') app.classList.add('is-collapsed');
    document.addEventListener('click', function (e) {
      var c = e.target.closest('[data-sidebar-toggle]');
      if (c) {
        var on = app.classList.toggle('is-collapsed');
        store.set('gmep-sidebar', on ? 'collapsed' : 'expanded');
        c.setAttribute('aria-expanded', String(!on));
      }
      if (e.target.closest('[data-nav-open]')) { app.classList.add('is-nav-open'); }
      if (e.target.closest('[data-nav-close]') || e.target.classList.contains('drawer-nav-backdrop')) { app.classList.remove('is-nav-open'); }
    });
  }

  /* ---------- 4. Dialog / drawer ---------- */
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  function focusables(root) { return $$(FOCUSABLE, root).filter(function (el) { return !el.hidden && el.offsetParent !== null; }); }
  /* Mở overlay: aria-modal, nền inert (không tab/đọc được), focus vào dialog, nhớ nơi gọi để trả focus */
  function openOverlay(id) {
    var o = document.getElementById(id); if (!o) return;
    var rf = document.activeElement, dd = rf && rf.closest ? rf.closest('.dropdown') : null;
    if (dd) rf = $('[aria-haspopup]', dd) || rf;      /* mở từ menu: trả focus về nút mở menu */
    o._returnFocus = rf;
    closeDropdowns();
    o.classList.add('is-open'); o.setAttribute('aria-modal', 'true');
    Array.prototype.forEach.call(document.body.children, function (ch) {
      if (ch === o || ch.tagName === 'SCRIPT' || ch.classList.contains('overlay') || ch.classList.contains('toast-region')) return;
      if (!ch.inert) { ch.inert = true; ch.setAttribute('data-inert-by', id); }
    });
    var f = $('[autofocus]', o) || $('textarea, input, select', o) || focusables(o)[0]; if (f) f.focus();
  }
  function closeOverlay(o) {
    if (!o) return; o.classList.remove('is-open');
    $$('[data-inert-by="' + o.id + '"]').forEach(function (n) { n.inert = false; n.removeAttribute('data-inert-by'); });
    var rf = o._returnFocus; if (rf && rf.focus && document.contains(rf)) rf.focus();
  }
  window.gmepOpen = openOverlay; window.gmepClose = closeOverlay;
  document.addEventListener('click', function (e) {
    var op = e.target.closest('[data-open]');
    if (op) { openOverlay(op.getAttribute('data-open')); return; }
    if (e.target.closest('[data-close]')) { closeOverlay(e.target.closest('.overlay')); return; }
    if (e.target.classList && e.target.classList.contains('overlay')) closeOverlay(e.target);
  });
  /* Focus trap: Tab/Shift+Tab xoay vòng trong dialog đang mở */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var o = $('.overlay.is-open'); if (!o) return;
    var items = focusables(o); if (!items.length) { e.preventDefault(); return; }
    var first = items[0], last = items[items.length - 1];
    if (!o.contains(document.activeElement)) { first.focus(); e.preventDefault(); }
    else if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  });
  /* Xác nhận nguy hiểm: nút chỉ bật khi gõ đúng từ khóa và/hoặc nhập lý do */
  $$('[data-confirm-guard]').forEach(function (g) {
    var word = g.getAttribute('data-confirm-word') || '';
    var btn = $('[data-confirm-btn]', g), typed = $('[data-confirm-input]', g), reason = $('[data-confirm-reason]', g);
    function chk() {
      var ok = (!typed || typed.value.trim() === word) && (!reason || reason.value.trim().length >= 5);
      btn.disabled = !ok; btn.setAttribute('aria-disabled', String(!ok));
    }
    if (typed) typed.addEventListener('input', chk);
    if (reason) reason.addEventListener('input', chk);
    chk();
  });

  /* ---------- 5. Dropdown ---------- */
  function closeDropdowns(except) {
    $$('.dropdown.is-open').forEach(function (d) { if (d !== except) { d.classList.remove('is-open'); var b = $('[aria-haspopup]', d); if (b) b.setAttribute('aria-expanded', 'false'); } });
  }
  function menuItems(d) { return $$('.dropdown__menu a[href], .dropdown__menu button:not([disabled]):not([aria-disabled="true"])', d).filter(function (x) { return !x.hidden && x.offsetParent !== null; }); }
  function openDropdown(d, focusFirst) {
    var trg = $('[aria-haspopup]', d); closeDropdowns(d); d.classList.add('is-open'); trg.setAttribute('aria-expanded', 'true');
    if (focusFirst) { var it = menuItems(d); var cur = it.filter(function (x) { return x.getAttribute('aria-checked') === 'true'; })[0]; (cur || it[0]) && (cur || it[0]).focus(); }
  }
  document.addEventListener('click', function (e) {
    var trg = e.target.closest('.dropdown > [aria-haspopup]');
    if (trg) {
      var d = trg.parentElement;
      if (d.classList.contains('is-open')) { closeDropdowns(); } else { openDropdown(d, e.detail === 0); } /* e.detail===0: kích hoạt bằng bàn phím → focus vào mục đầu */
      return;
    }
    if (!e.target.closest('.dropdown__menu') || (e.target.closest('[data-keep-open]') === null && e.target.closest('.menu-item'))) {
      var openD = $('.dropdown.is-open');
      closeDropdowns();
      if (openD && e.target.closest('.dropdown__menu') && !$('.overlay.is-open')) { var t = $('[aria-haspopup]', openD); if (t) t.focus(); }
    }
  });
  /* Bàn phím cho dropdown/menu: ↓ ↑ Home End, Esc đóng và trả focus, Tab đóng */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var ov = $('.overlay.is-open'); if (ov) { closeOverlay(ov); return; }
      var od = $('.dropdown.is-open'); if (od) { var t = $('[aria-haspopup]', od); closeDropdowns(); if (t) t.focus(); return; }
      if (app) app.classList.remove('is-nav-open');
    }
    var trg = e.target.closest && e.target.closest('.dropdown > [aria-haspopup]');
    if (trg && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); openDropdown(trg.parentElement, true); return; }
    var menu = e.target.closest && e.target.closest('.dropdown__menu');
    if (menu && menu.closest('.dropdown')) {
      var d = menu.closest('.dropdown'), items = menuItems(d), i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); (items[(i + 1) % items.length] || items[0]).focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); (items[(i - 1 + items.length) % items.length] || items[0]).focus(); }
      else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
      else if (e.key === 'Tab') { closeDropdowns(); }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { var s = $('[data-global-search]'); if (s) { e.preventDefault(); s.focus(); } }
  });

  /* ---------- 6. Tabs ---------- */
  document.addEventListener('click', function (e) {
    var tab = e.target.closest('[role="tab"]'); if (!tab || tab.getAttribute('aria-disabled') === 'true') return;
    var list = tab.closest('[role="tablist"]');
    $$('[role="tab"]', list).forEach(function (t) { var on = t === tab; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; var p = document.getElementById(t.getAttribute('aria-controls')); if (p) p.hidden = !on; });
  });
  document.addEventListener('keydown', function (e) {
    var tab = e.target.closest && e.target.closest('[role="tab"]'); if (!tab) return;
    var tabs = $$('[role="tab"]:not([aria-disabled="true"])', tab.closest('[role="tablist"]')), i = tabs.indexOf(tab), n = null;
    if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
    if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
    if (e.key === 'Home') n = tabs[0];
    if (e.key === 'End') n = tabs[tabs.length - 1];
    if (n) { n.focus(); n.click(); e.preventDefault(); }
  });

  /* ---------- 7. Chọn dòng bảng + bulk bar ---------- */
  function syncTable(wrap) {
    var rows = $$('tbody input[data-row-check]', wrap), sel = rows.filter(function (r) { return r.checked; });
    rows.forEach(function (r) { var tr = r.closest('tr'); tr.classList.toggle('is-selected', r.checked); tr.setAttribute('aria-selected', String(r.checked)); });
    var all = $('input[data-select-all]', wrap);
    if (all) { all.checked = sel.length === rows.length && rows.length > 0; all.indeterminate = sel.length > 0 && sel.length < rows.length; }
    var bar = $('.bulk-bar', wrap), tb = $('.table-toolbar', wrap);
    if (bar) { bar.classList.toggle('is-visible', sel.length > 0); var c = $('[data-bulk-count]', bar); if (c) c.textContent = sel.length; if (tb) tb.style.display = sel.length ? 'none' : ''; }
  }
  document.addEventListener('change', function (e) {
    var wrap = e.target.closest('.table-wrap'); if (!wrap) return;
    if (e.target.matches('[data-select-all]')) $$('tbody input[data-row-check]', wrap).forEach(function (r) { r.checked = e.target.checked; });
    if (e.target.matches('[data-select-all],[data-row-check]')) syncTable(wrap);
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-bulk-clear]')) { var w = e.target.closest('.table-wrap'); $$('input[type=checkbox]', w).forEach(function (c) { c.checked = false; }); syncTable(w); }
    var s = e.target.closest('.th-sort');
    if (s) { /* sắp xếp giả lập: chỉ đổi aria-sort */
      var th = s.closest('th'), cur = th.getAttribute('aria-sort'), nx = cur === 'ascending' ? 'descending' : 'ascending';
      $$('th[aria-sort]', th.closest('thead')).forEach(function (x) { x.setAttribute('aria-sort', 'none'); var ic = $('use', x); if (ic) ic.setAttribute('href', '#chevrons-up-down'); });
      th.setAttribute('aria-sort', nx); var u = $('use', th); if (u) u.setAttribute('href', nx === 'ascending' ? '#arrow-up' : '#arrow-down');
    }
  });

  /* ---------- 8. Chuyển chi nhánh (hiển thị trạng thái phạm vi) ---------- */
  /* Ba cấp: (1) Tất cả được phép, (2) Nhóm chi nhánh, (3) Từng chi nhánh. Pháp nhân: bộ lọc phụ, ẩn khi chỉ có 1 pháp nhân. */
  var pendingScope = null;
  function branchCount() { return $$('[data-level="branch"]:not([aria-disabled="true"])').filter(function (x) { return !x.hidden; }).length; }
  function setScope(name, level, quiet) {
    var role = currentRole(), all = level === 'all';
    $$('[data-branch]').forEach(function (x) { x.setAttribute('aria-checked', String(x.getAttribute('data-branch') === name && x.getAttribute('data-level') === level && !x.hidden)); });
    $$('[data-branch-label]').forEach(function (l) { l.textContent = name; });
    $$('.branch-btn').forEach(function (b) { b.classList.toggle('is-all', all || level === 'group'); });
    var text;
    if (level === 'all') text = (role === 'QV' ? 'Tất cả nhóm được giao' : 'Tất cả chi nhánh') + ' (' + branchCount() + ' chi nhánh) – số liệu hợp nhất';
    else if (level === 'group') text = name + ' – gồm các chi nhánh trong nhóm, số liệu hợp nhất';
    else text = 'Chỉ ' + name + ' – không gồm chi nhánh khác';
    $$('[data-scope-text]').forEach(function (l) { l.textContent = text; });
    $$('.scope-banner').forEach(function (b) { b.classList.toggle('scope-banner--branch', level === 'branch'); });
    if (!quiet) toast(level === 'branch' ? 'success' : 'info', 'Đã đổi phạm vi dữ liệu', text + '.');
  }
  document.addEventListener('click', function (e) {
    var it = e.target.closest('[data-branch]'); if (!it || it.getAttribute('aria-disabled') === 'true') return;
    if (document.body.getAttribute('data-draft') === '1') { pendingScope = it; openOverlay('dlg-scope'); return; }   /* D-06: lưu nháp trước khi đổi phạm vi */
    setScope(it.getAttribute('data-branch'), it.getAttribute('data-level') || 'branch');
  });
  document.addEventListener('click', function (e) {
    var tg = e.target.closest('[data-toggle-draft]');
    if (tg) { var on = document.body.getAttribute('data-draft') !== '1'; document.body.setAttribute('data-draft', on ? '1' : '0'); tg.setAttribute('aria-pressed', String(on)); tg.querySelector('span').textContent = on ? 'Đang soạn phiếu (thử)' : 'Thử: đang soạn phiếu'; }
    if (e.target.closest('[data-scope-confirm]') && pendingScope) {
      document.body.setAttribute('data-draft', '0'); var p = pendingScope; pendingScope = null; closeOverlay(document.getElementById('dlg-scope'));
      toast('success', 'Đã lưu nháp', 'Phiếu đang soạn được lưu trước khi đổi phạm vi.');
      setScope(p.getAttribute('data-branch'), p.getAttribute('data-level') || 'branch');
      $$('[data-toggle-draft]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); b.querySelector('span').textContent = 'Thử: đang soạn phiếu'; });
    }
    var lg = e.target.closest('[data-legal-toggle]');
    if (lg) { var multi = lg.getAttribute('aria-checked') !== 'true'; lg.setAttribute('aria-checked', String(multi)); $$('[data-legal]').forEach(function (x) { x.hidden = !multi; }); toast('info', multi ? 'Giả lập: nhiều pháp nhân' : 'Giả lập: một pháp nhân', multi ? 'Bộ lọc Pháp nhân xuất hiện; báo cáo chính thức không cộng gộp giữa các pháp nhân.' : 'Bộ lọc Pháp nhân được ẩn.'); }
  });

  /* ---------- 9. Toast ---------- */
  function toast(kind, title, text) {
    var reg = $('.toast-region'); if (!reg) { reg = document.createElement('div'); reg.className = 'toast-region'; reg.setAttribute('role', 'status'); reg.setAttribute('aria-live', 'polite'); document.body.appendChild(reg); }
    var ic = { success: 'circle-check', danger: 'circle-x', warning: 'alert-triangle', info: 'info' }[kind] || 'info';
    var t = document.createElement('div'); t.className = 'toast toast--' + kind;
    t.innerHTML = '<svg class="icon toast__icon" aria-hidden="true"><use href="#' + ic + '"/></svg><div><div class="toast__title"></div><div class="toast__text"></div></div><button class="btn-icon toast__x" aria-label="Đóng thông báo"><svg class="icon icon--sm"><use href="#x"/></svg></button>';
    $('.toast__title', t).textContent = title; $('.toast__text', t).textContent = text || '';
    reg.appendChild(t);
    var timer = setTimeout(function () { t.remove(); }, 5000);
    $('.toast__x', t).addEventListener('click', function () { clearTimeout(timer); t.remove(); });
  }
  window.gmepToast = toast;
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-toast]'); if (b) { var p = b.getAttribute('data-toast').split('|'); toast(p[0], p[1], p[2]); }
  });

  /* ---------- 10. Demo: loading button, chuyển trạng thái, offline, rating, chip ---------- */
  document.addEventListener('click', function (e) {
    var l = e.target.closest('[data-demo-loading]');
    if (l) { l.classList.add('is-loading'); l.setAttribute('aria-busy', 'true'); setTimeout(function () { l.classList.remove('is-loading'); l.removeAttribute('aria-busy'); }, 1800); }
    var st = e.target.closest('[data-state-switch]');
    if (st) {
      var grp = st.closest('[data-state-group]'), name = st.getAttribute('data-state-switch');
      $$('[data-state-switch]', grp).forEach(function (x) { x.setAttribute('aria-pressed', String(x === st)); });
      $$('[data-state]', grp).forEach(function (p) { p.hidden = p.getAttribute('data-state') !== name; });
    }
    var off = e.target.closest('[data-toggle-offline]');
    if (off) { var nb = $('.net-banner'); if (nb) nb.classList.toggle('is-visible'); }
    var r = e.target.closest('.rating__opt');
    if (r) { $$('.rating__opt', r.parentElement).forEach(function (x) { x.setAttribute('aria-pressed', String(x === r)); }); }
    var ch = e.target.closest('.chip__x'); if (ch) ch.closest('.chip').remove();
    var cf = e.target.closest('.chip-filter[aria-pressed]'); if (cf) cf.setAttribute('aria-pressed', String(cf.getAttribute('aria-pressed') !== 'true'));
    var sw = e.target.closest('[data-role-switch]');
    if (sw) { document.body.setAttribute('data-role', sw.getAttribute('data-role-switch')); applyRole(); }
  });
  document.addEventListener('change', function (e) {
    if (e.target.matches('[data-pii-role]')) { document.body.setAttribute('data-role', e.target.value); applyRole(); }
  });

  /* ---------- 11. Menu theo vai trò (prototype) ---------- */
  /* Khóa vai trò kỹ thuật không dấu: CH QV QL CV QD(Quản đốc, nhãn "QĐ") TH TK TN KT AD.
     Chế độ theo FRD §2: full = tạo/sửa (S) · approve = xem và duyệt (D) · view = chỉ xem (X) · own = chỉ phần của mình (Xn) · sys = chỉ sức khỏe hệ thống.
     Mục nào không có trong bảng của vai trò thì ẩn hẳn (khớp ma trận FRD §2). */
  var ROLE_MENU = {
    /* FRD §2: D (duyệt, kèm xem) = 'approve' "Xem và duyệt"; mục gộp nhiều hàng FRD lấy mức cao nhất (S > D > X > Xn) */
    CH: { dash: 'full', ro: 'view', appt: 'view', cust: 'view', inv: 'approve', pur: 'view', hr: 'view', fin: 'view', einv: 'view', rpt: 'view', set: 'approve' },   /* inv: danh mục phụ tùng D, chuyển kho D; set: người dùng/cấu hình D */
    QV: { dash: 'full', ro: 'view', appt: 'view', cust: 'view', inv: 'approve', pur: 'view', hr: 'view', fin: 'view', einv: 'view', rpt: 'view', set: 'limited' },       /* inv: chuyển kho D */
    QL: { dash: 'full', ro: 'approve', appt: 'full', cust: 'full', inv: 'full', pur: 'approve', hr: 'approve', fin: 'approve', einv: 'view', rpt: 'view', set: 'full' },  /* ro/hr/fin: D; công nợ chỉ X; inv: chuyển kho S */
    CV: { dash: 'full', ro: 'full', appt: 'full', cust: 'full', inv: 'view', hr: 'own', fin: 'view', rpt: 'own', set: 'limited' },
    QD: { dash: 'full', ro: 'full', cust: 'view', hr: 'view', rpt: 'own', set: 'limited' },                                                                              /* ro: phân thợ, QC = S */
    TH: { dash: 'own', ro: 'own', cust: 'own', hr: 'own', rpt: 'own' },
    TK: { dash: 'full', ro: 'view', inv: 'full', pur: 'full', rpt: 'own', set: 'limited' },
    TN: { dash: 'full', ro: 'view', cust: 'view', fin: 'full', einv: 'full', rpt: 'own' },
    KT: { dash: 'full', ro: 'view', cust: 'view', inv: 'view', pur: 'view', hr: 'view', fin: 'full', einv: 'full', rpt: 'view', set: 'limited' },
    /* MH (Mua hàng) và NS (Nhân sự): vai trò riêng, ba-answers-04 Phụ lục C. Không có dashboard riêng (D-09): trang đầu là Mua hàng / Nhân sự */
    MH: { pur: 'full', inv: 'view', rpt: 'own' },
    NS: { hr: 'full', rpt: 'own' },
    AD: { dash: 'sys', set: 'full' }
  };
  var MODE_LABEL = { view: 'Chỉ xem', own: 'Của tôi', sys: 'Hệ thống', limited: 'Danh mục', approve: 'Xem và duyệt' };
  /* Phạm vi chi nhánh theo vai trò: multi = có cấp Tất cả/Nhóm/Chi nhánh; pick = chọn trong vài chi nhánh được gán; single = 1 chi nhánh (tĩnh); none = không gắn chi nhánh */
  var SCOPE_TYPE = { CH: 'multi', QV: 'multi', QL: 'pick', KT: 'pick', MH: 'pick', NS: 'pick', CV: 'single', QD: 'single', TH: 'single', TK: 'single', TN: 'single', AD: 'none' };
  function currentRole() { return document.body.getAttribute('data-role') || 'CH'; }

  function applyRole() {
    var role = currentRole(), cfg = ROLE_MENU[role]; if (!cfg) return;
    $$('[data-menu]').forEach(function (m) {
      var mode = cfg[m.getAttribute('data-menu')];
      m.hidden = !mode;
      var tag = $('.nav-item__mode', m), lab = $('.nav-item__label', m);
      if (m.classList.contains('nav-item') && lab) {
        /* Chế độ quyền là dòng phụ NẰM DƯỚI tên mục (trong .nav-item__label), không còn chip cạnh tên: không tràn ở 248px */
        var nm = lab.getAttribute('data-name') || (lab.firstChild ? lab.firstChild.nodeValue : lab.textContent).trim(); lab.setAttribute('data-name', nm);
        if (tag && tag.parentNode !== lab) { tag.remove(); tag = null; }
        if (MODE_LABEL[mode]) {
          if (!tag) { tag = document.createElement('span'); tag.className = 'nav-item__mode'; lab.appendChild(tag); }
          tag.textContent = MODE_LABEL[mode]; m.setAttribute('aria-label', nm + ' (' + MODE_LABEL[mode].toLowerCase() + ')'); m.setAttribute('title', nm + ' – ' + MODE_LABEL[mode]);
        } else { if (tag) tag.remove(); m.removeAttribute('aria-label'); m.setAttribute('title', nm); }
      }
    });
    $$('[data-role-switch]').forEach(function (x) { x.setAttribute('aria-checked', String(x.getAttribute('data-role-switch') === role)); });
    $$('[data-role-label]').forEach(function (l) { var s = $('[data-role-switch="' + role + '"]'); if (s) l.textContent = s.getAttribute('data-role-name'); });
    /* Ẩn nhóm menu rỗng */
    $$('.sidebar__nav .sidebar__group').forEach(function (g) {
      var n = g.nextElementSibling, any = false;
      while (n && !n.classList.contains('sidebar__group')) { if (n.hasAttribute('data-menu') && !n.hidden) any = true; n = n.nextElementSibling; }
      g.hidden = !any;
    });
    /* Nếu mục đang active bị ẩn (vd. MH/NS không có Tổng quan) thì chuyển active sang mục đầu tiên còn hiện */
    [['.sidebar__nav .nav-item[data-menu]', '.nav-item'], ['.bottom-nav .bottom-nav__item[data-menu]', '.bottom-nav__item']].forEach(function (p) {
      /* Nhớ mục "trang hiện tại" ban đầu (data-home); chỉ di chuyển khi nó bị ẩn, và trả lại khi hiện lại. Không đụng tới trang không có mục active. */
      var items = $$(p[0]), home = items.filter(function (x) { return x.hasAttribute('data-home'); })[0];
      if (!home) { home = items.filter(function (x) { return x.getAttribute('aria-current') === 'page'; })[0]; if (home) home.setAttribute('data-home', '1'); }
      if (!home) return;
      var target = !home.hidden ? home : items.filter(function (x) { return !x.hidden && !x.hasAttribute('data-bn-extra'); })[0] || items.filter(function (x) { return !x.hidden; })[0];
      items.forEach(function (x) { x.removeAttribute('aria-current'); });
      if (target) target.setAttribute('aria-current', 'page');
    });
    /* Bottom nav mobile: Mua hàng / Nhân sự chỉ hiện cho vai trò không có Phiếu sửa chữa (MH, NS) */
    $$('[data-bn-extra]').forEach(function (x) { x.hidden = !!cfg.ro || !cfg[x.getAttribute('data-menu')]; });
    /* Phạm vi chi nhánh */
    $$('[data-show-roles]').forEach(function (x) { x.hidden = x.getAttribute('data-show-roles').split(' ').indexOf(role) < 0; });
    var st = SCOPE_TYPE[role], dd = $('[data-branch-dropdown]'), sta = $('[data-branch-static]');
    if (dd && sta) {
      var pick = st === 'multi' || st === 'pick';
      dd.hidden = !pick; sta.hidden = pick;
      var note = $('[data-multi-note]'); if (note) note.hidden = st === 'multi';
      if (pick) {
        var first = st === 'multi' ? $('[data-level="all"]:not([hidden])') : $('[data-level="branch"]:not([hidden]):not([aria-disabled="true"])');
        if (first) setScope(first.getAttribute('data-branch'), first.getAttribute('data-level'), true);
      } else {
        var nm = st === 'none' ? 'Không gắn chi nhánh' : 'Chi nhánh Quận 7';
        $$('[data-static-label]').forEach(function (l) { l.textContent = nm; });
        $$('[data-scope-text]').forEach(function (l) { l.textContent = st === 'none' ? 'Quản trị hệ thống: không truy cập dữ liệu nghiệp vụ' : 'Chỉ ' + nm + ' (chi nhánh của bạn)'; });
        $$('.scope-banner').forEach(function (b) { b.classList.add('scope-banner--branch'); });
      }
    }
    renderPII();
  }

  /* ---------- 12. Dữ liệu cá nhân che theo vai trò (PII) ----------
     Giá trị đầy đủ KHÔNG nằm trong DOM/thuộc tính. Hàm serverPII mô phỏng API: chỉ trả bản đã che
     trừ khi vai trò được phép (full) hoặc đã bấm Hiện (revealed). Production: gọi API thật + ghi nhật ký. */
  var PII_DB = { c1: { phone: '0903456321', email: 'an.nguyen@example.vn', address: '12 Nguyễn Văn Linh, P. Tân Phong', area: 'Quận 7, TP.HCM' },
                 c2: { phone: '0938127874', email: 'ngoc.tran@example.vn', address: '45 Lê Lợi, P. Bến Nghé', area: 'Quận 1, TP.HCM' } };
  function maskPII(kind, r) {
    if (kind === 'phone') return r.phone.slice(0, 2) + '•• ••• ' + r.phone.slice(-3);
    if (kind === 'email') { var p = r.email.split('@'); return p[0].charAt(0) + '•••@' + p[1]; }
    return '••••, ' + r.area;
  }
  function serverPII(id, kind, revealed, full) {
    var r = PII_DB[id]; if (!r) return '';
    if (revealed || full) return kind === 'address' ? r.address + ', ' + r.area : (kind === 'phone' ? r.phone.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1 $2 $3') : r.email);
    return maskPII(kind, r);
  }
  /* Chính sách theo ba-decisions câu 8 */
  function piiPolicy(role, kind) {
    var fullRoles = ['CV', 'QL', 'TN', 'QD'];
    if (fullRoles.indexOf(role) >= 0) return 'full';
    if (role === 'CH' || role === 'QV') return 'reveal';
    if (role === 'KT') return 'reveal-reason';
    if (role === 'TK') return kind === 'address' ? 'hidden' : 'masked';
    return 'hidden';                                  /* TH, AD */
  }
  var piiTimers = [];
  function renderPII() {
    piiTimers.forEach(clearInterval); piiTimers = [];
    var role = currentRole();
    $$('.pii').forEach(function (el) {
      var id = el.getAttribute('data-pii-id'), kind = el.getAttribute('data-pii-kind') || 'phone', pol = piiPolicy(role, kind);
      el.className = 'pii'; el.innerHTML = '';
      if (pol === 'hidden') { el.classList.add('pii--denied'); el.innerHTML = '<svg class="icon icon--sm" aria-hidden="true"><use href="#lock"/></svg><span>Bạn không có quyền xem ' + (kind === 'phone' ? 'số điện thoại' : kind === 'email' ? 'email' : 'địa chỉ') + '</span>'; return; }
      var v = document.createElement('span'); v.className = 'pii__value'; v.textContent = serverPII(id, kind, false, pol === 'full'); el.appendChild(v);
      if (pol === 'full') { el.title = 'Việc mở hồ sơ khách được ghi nhật ký truy cập'; return; }
      el.classList.add('is-masked');
      if (pol === 'reveal' || pol === 'reveal-reason') {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn--ghost btn--sm'; b.setAttribute('data-reveal', pol);
        b.innerHTML = '<svg class="icon icon--sm" aria-hidden="true"><use href="#eye"/></svg>Hiện'; b.setAttribute('aria-label', 'Hiện ' + (kind === 'phone' ? 'số điện thoại' : kind === 'email' ? 'email' : 'địa chỉ') + ' đầy đủ');
        el.appendChild(b);
      }
    });
  }
  var pendingReveal = null;
  function doReveal(btn, reason) {
    var el = btn.closest('.pii'), id = el.getAttribute('data-pii-id'), kind = el.getAttribute('data-pii-kind') || 'phone', v = $('.pii__value', el);
    btn.disabled = true; btn.textContent = 'Đang tải…';                      /* mô phỏng gọi API (có độ trễ) */
    setTimeout(function () {
      v.textContent = serverPII(id, kind, true); el.classList.remove('is-masked'); btn.remove();
      var t = document.createElement('span'); t.className = 'pii__timer'; var left = 30; t.textContent = 'Tự che sau ' + left + ' giây'; el.appendChild(t);
      var iv = setInterval(function () { left--; if (left <= 0) { clearInterval(iv); renderPII(); } else t.textContent = 'Tự che sau ' + left + ' giây'; }, 1000); piiTimers.push(iv);
      toast('info', 'Đã ghi nhật ký truy cập', 'Ghi: người xem, thời điểm, bản ghi' + (reason ? ', lý do: ' + reason : '') + '.');
    }, 450);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-reveal]');
    if (b) { if (b.getAttribute('data-reveal') === 'reveal-reason' && document.getElementById('dlg-reveal')) { pendingReveal = b; var cf = $('[data-reveal-confirm]'); if (cf) cf.disabled = true; $$('#dlg-reveal input[type=radio]').forEach(function (r) { r.checked = false; }); openOverlay('dlg-reveal'); } else doReveal(b, ''); return; }
    if (e.target.closest('[data-reveal-confirm]') && pendingReveal) {
      var r = $('#dlg-reveal input[type=radio]:checked'); if (!r) return;
      var lab = r.closest('label').textContent.trim(), btn = pendingReveal; pendingReveal = null; closeOverlay(document.getElementById('dlg-reveal')); doReveal(btn, lab);
    }
  });
  document.addEventListener('change', function (e) {
    if (e.target.matches('#dlg-reveal input[type=radio]')) { var cf = $('[data-reveal-confirm]'); if (cf) cf.disabled = false; }
  });

  /* ---------- 13. Tìm không phân biệt dấu, biển số ---------- */
  function fold(s) { var out = ''; for (var i = 0; i < s.length; i++) { var c = s.charAt(i); out += c === 'đ' ? 'd' : c === 'Đ' ? 'd' : c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); } return out; }
  function formatPlate(raw) {
    var c = raw.replace(/[^0-9A-Za-z]/g, '').toUpperCase(), m;
    if ((m = /^(\d{2}[A-Z])(\d{3})(\d{2})$/.exec(c))) return m[1] + '-' + m[2] + '.' + m[3];
    if ((m = /^(\d{2}[A-Z])(\d{4})$/.exec(c))) return m[1] + '-' + m[2];
    if ((m = /^(\d{2})([A-Z]\d)(\d{3})(\d{2})$/.exec(c))) return m[1] + '-' + m[2] + ' ' + m[3] + '.' + m[4];
    return '';
  }
  var CB_DATA = {
    vehicle: [['51H-123.45', 'Toyota Vios 2019 · Nguyễn Văn An'], ['30G-456.78', 'Hyundai Accent 2021 · Trần Thị Bích Ngọc'], ['51K-987.65', 'Mazda CX-5 2020 · Công ty TNHH Vận tải Hòa Phát'], ['59A-111.22', 'Honda City 2018 · Lê Quốc Huy'], ['59-X1 123.45', 'Xe máy Honda Vision · Phạm Thị Hoa']],
    customer: [['Nguyễn Văn An', '09•• ••• 321 · 2 xe'], ['Trần Thị Bích Ngọc', '09•• ••• 874 · 1 xe'], ['Lê Quốc Huy', '09•• ••• 012 · 1 xe'], ['Phạm Thị Hoa', '09•• ••• 560 · 1 xe'], ['Võ Thanh Sơn', '09•• ••• 733 · 3 xe']],
    part: [['Lọc dầu động cơ Vios', 'PT-0001 · Khả dụng 24'], ['Má phanh trước Hyundai Accent', 'PT-0002 · Khả dụng 3'], ['Dầu nhớt 5W-30 (lít)', 'PT-0003 · Khả dụng 0'], ['Bugi Iridium Mazda CX-5', 'PT-0004 · Khả dụng 12'], ['Lốp 205/55R16', 'PT-0005 · Khả dụng 8']]
  };
  function renderCombo(cb) {
    var input = $('input', cb), list = $('.combobox__list', cb), kind = cb.getAttribute('data-combobox'), q = input.value.trim(), fq = fold(q), fqPlate = q.replace(/[^0-9A-Za-z]/g, '').toLowerCase();
    var data = CB_DATA[kind] || [], html = '', n = 0;
    data.forEach(function (d, i) {
      var f = fold(d[0]), idx = f.indexOf(fq), plateHit = kind === 'vehicle' && fqPlate && d[0].replace(/[^0-9A-Za-z]/g, '').toLowerCase().indexOf(fqPlate) >= 0;
      var skuHit = kind === 'part' && fq && fold(d[1]).indexOf(fq) >= 0;
      if (fq && idx < 0 && !plateHit && !skuHit) return;
      var label = d[0]; if (idx >= 0 && fq) label = label.slice(0, idx) + '<mark>' + label.slice(idx, idx + fq.length) + '</mark>' + label.slice(idx + fq.length);
      html += '<div class="combobox__option" role="option" id="' + cb.id + '-o' + i + '" data-value="' + d[0] + '"><div class="combobox__main"><strong>' + label + '</strong><span class="combobox__sub">' + d[1] + '</span></div></div>'; n++;
    });
    var plate = kind === 'vehicle' ? formatPlate(q) : '';
    var hint = plate && plate !== q ? '<div class="combobox__hint"><svg class="icon icon--sm" aria-hidden="true"><use href="#info"/></svg>Gợi ý chuẩn hóa biển số: <strong>' + plate + '</strong></div>' : '';
    if (!n) html = '<div class="combobox__empty">Không tìm thấy ' + (kind === 'vehicle' ? 'xe' : kind === 'customer' ? 'khách' : 'phụ tùng') + ' phù hợp với “' + q.replace(/</g, '&lt;') + '”.</div>';
    if (q && kind !== 'part') html += '<button type="button" class="combobox__create" data-create><svg class="icon icon--sm" aria-hidden="true"><use href="#plus"/></svg>Thêm ' + (kind === 'vehicle' ? 'xe mới' : 'khách mới') + ' “' + (plate || q).replace(/</g, '&lt;') + '”</button>';
    list.innerHTML = hint + html; list.setAttribute('role', 'listbox');
    cb.classList.add('is-open'); input.setAttribute('aria-expanded', 'true');
  }
  function closeCombo(cb) { cb.classList.remove('is-open'); var i = $('input', cb); i.setAttribute('aria-expanded', 'false'); i.removeAttribute('aria-activedescendant'); }
  function setActiveOpt(cb, dir) {
    var opts = $$('.combobox__option', cb); if (!opts.length) return;
    var cur = opts.findIndex(function (o) { return o.classList.contains('is-active'); }), nx = (cur + dir + opts.length) % opts.length;
    opts.forEach(function (o) { o.classList.remove('is-active'); }); opts[nx].classList.add('is-active'); $('input', cb).setAttribute('aria-activedescendant', opts[nx].id); opts[nx].scrollIntoView({ block: 'nearest' });
  }
  function pickOpt(cb, opt) { var i = $('input', cb); i.value = opt.getAttribute('data-value'); $$('.combobox__option', cb).forEach(function (o) { o.setAttribute('aria-selected', String(o === opt)); }); closeCombo(cb); }
  document.addEventListener('input', function (e) { var cb = e.target.closest && e.target.closest('[data-combobox]'); if (cb && e.target.matches('input')) renderCombo(cb); });
  document.addEventListener('focusin', function (e) { var cb = e.target.closest && e.target.closest('[data-combobox]'); if (cb && e.target.matches('input') && !cb.classList.contains('is-static')) renderCombo(cb); });
  document.addEventListener('keydown', function (e) {
    var cb = e.target.closest && e.target.closest('[data-combobox]'); if (!cb || !e.target.matches('input')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!cb.classList.contains('is-open')) renderCombo(cb); setActiveOpt(cb, 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveOpt(cb, -1); }
    else if (e.key === 'Enter') { var a = $('.combobox__option.is-active', cb); if (a) { e.preventDefault(); pickOpt(cb, a); } }
    else if (e.key === 'Escape' && cb.classList.contains('is-open')) { e.stopPropagation(); closeCombo(cb); }
  });
  document.addEventListener('click', function (e) {
    var opt = e.target.closest('.combobox__option'); if (opt) { pickOpt(opt.closest('[data-combobox]'), opt); return; }
    if (e.target.closest('[data-create]')) { var c = e.target.closest('[data-combobox]'); closeCombo(c); toast('info', 'Mở form thêm mới', 'Prototype: bước này mở form tạo nhanh.'); return; }
    $$('[data-combobox].is-open').forEach(function (c) { if (!c.contains(e.target)) closeCombo(c); });
  });

  /* ---------- 14. Date picker (tuần bắt đầu Thứ Hai; "hôm nay" cố định 30/10/2026 để demo) ---------- */
  var DP_TODAY = new Date(2026, 9, 30);
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmt(d) { return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromIso(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function parseVN(s) { var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim()); if (!m) return null; var d = new Date(+m[3], +m[2] - 1, +m[1]); return d.getMonth() === +m[2] - 1 ? d : null; }
  function dpRender(host) {
    var st = host._dp, pop = $('.datepicker', host), y = st.y, m = st.m, first = new Date(y, m, 1), off = (first.getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
    var lock = host.getAttribute('data-lock-until') ? fromIso(host.getAttribute('data-lock-until')) : null, range = host.getAttribute('data-datepicker') === 'range';
    var h = '<div class="datepicker__head"><button type="button" class="btn-icon" data-dp-prev aria-label="Tháng trước"><svg class="icon"><use href="#chevron-left"/></svg></button><div class="datepicker__title" aria-live="polite">Tháng ' + (m + 1) + '/' + y + '</div><button type="button" class="btn-icon" data-dp-next aria-label="Tháng sau"><svg class="icon"><use href="#chevron-right"/></svg></button></div><div class="datepicker__grid" role="grid">';
    ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'].forEach(function (d) { h += '<div class="datepicker__dow" role="columnheader">' + d + '</div>'; });
    for (var i = 0; i < off; i++) { var o = new Date(y, m, 1 - off + i); h += dpDay(o, true, lock, st, range); }
    for (var d = 1; d <= days; d++) h += dpDay(new Date(y, m, d), false, lock, st, range);
    var rest = (7 - ((off + days) % 7)) % 7; for (var j = 1; j <= rest; j++) h += dpDay(new Date(y, m + 1, j), true, lock, st, range);
    h += '</div>';
    if (range) h += '<div class="datepicker__shortcuts"><button type="button" class="chip-filter" data-dp-quick="today">Hôm nay</button><button type="button" class="chip-filter" data-dp-quick="yesterday">Hôm qua</button><button type="button" class="chip-filter" data-dp-quick="7">7 ngày</button><button type="button" class="chip-filter" data-dp-quick="30">30 ngày</button><button type="button" class="chip-filter" data-dp-quick="month">Tháng này</button></div>';
    if (lock) h += '<div class="datepicker__note"><svg class="icon icon--sm" aria-hidden="true"><use href="#lock"/></svg><span>Ngày gạch ngang đã khóa sổ đến ' + fmt(lock) + ', không chọn được (mở lại cần Chủ garage duyệt).</span></div>';
    pop.innerHTML = h;
  }
  function dpDay(d, outside, lock, st, range) {
    var c = 'datepicker__day', dis = false, t = d.getTime(), label = fmt(d);
    if (outside) c += ' is-outside'; if (t === DP_TODAY.getTime()) c += ' is-today';
    if (lock && t <= lock.getTime()) { c += ' is-locked'; dis = true; label += ' – đã khóa sổ'; }
    if (st.a && t === st.a.getTime()) c += range ? ' is-range-start' : ' is-selected';
    if (range && st.a && st.b) { if (t === st.b.getTime()) c += ' is-range-end'; else if (t > st.a.getTime() && t < st.b.getTime()) c += ' is-range'; }
    return '<button type="button" class="' + c + '" role="gridcell" data-date="' + iso(d) + '"' + (dis ? ' disabled aria-disabled="true"' : '') + ' aria-label="' + label + '"' + (st.a && t === st.a.getTime() ? ' aria-selected="true"' : '') + '>' + d.getDate() + '</button>';
  }
  function dpOpen(host) { var pop = $('.datepicker', host); if (!host._dp) { var v = parseVN($('input', host).value.split('–')[0] || '') || DP_TODAY; host._dp = { y: v.getFullYear(), m: v.getMonth(), a: parseVN($('input', host).value.split('–')[0] || ''), b: null }; } dpRender(host); pop.classList.add('is-open'); $('[data-dp-toggle]', host).setAttribute('aria-expanded', 'true'); var t = $('.datepicker__day.is-selected, .datepicker__day.is-today, .datepicker__day:not(:disabled)', pop); if (t) t.focus(); }
  function dpClose(host, ret) { var tg = $('[data-dp-toggle]', host); if (!tg) { dpRender(host); return; } $('.datepicker', host).classList.remove('is-open'); tg.setAttribute('aria-expanded', 'false'); if (ret) tg.focus(); }
  function setIn(host, v) { var i = $('input', host); if (i) i.value = v; }
  document.addEventListener('click', function (e) {
    var tg = e.target.closest('[data-dp-toggle]');
    if (tg) { var h = tg.closest('[data-datepicker]'); if ($('.datepicker', h).classList.contains('is-open')) dpClose(h, true); else dpOpen(h); return; }
    var host = e.target.closest('[data-datepicker]');
    if (host && host._dp) {
      if (e.target.closest('[data-dp-prev]')) { host._dp.m--; if (host._dp.m < 0) { host._dp.m = 11; host._dp.y--; } dpRender(host); $('[data-dp-prev]', host).focus(); return; }
      if (e.target.closest('[data-dp-next]')) { host._dp.m++; if (host._dp.m > 11) { host._dp.m = 0; host._dp.y++; } dpRender(host); $('[data-dp-next]', host).focus(); return; }
      var q = e.target.closest('[data-dp-quick]');
      if (q) { var k = q.getAttribute('data-dp-quick'), a, b = DP_TODAY; if (k === 'today') a = DP_TODAY; else if (k === 'yesterday') { a = b = new Date(2026, 9, 29); } else if (k === 'month') a = new Date(2026, 9, 1); else a = new Date(2026, 9, 30 - (+k - 1)); host._dp.a = a; host._dp.b = b; setIn(host, fmt(a) + ' – ' + fmt(b)); dpClose(host, true); return; }
      var day = e.target.closest('.datepicker__day');
      if (day && !day.disabled) {
        var d = fromIso(day.getAttribute('data-date')), st = host._dp, range = host.getAttribute('data-datepicker') === 'range';
        if (!range) { st.a = d; setIn(host, fmt(d)); dpClose(host, true); }
        else if (!st.a || st.b) { st.a = d; st.b = null; setIn(host, fmt(d) + ' – …'); st.y = d.getFullYear(); st.m = d.getMonth(); dpRender(host); $('[data-date="' + iso(d) + '"]', host).focus(); }
        else { if (d < st.a) { st.b = st.a; st.a = d; } else st.b = d; setIn(host, fmt(st.a) + ' – ' + fmt(st.b)); dpClose(host, true); }
        return;
      }
    }
    $$('.datepicker.is-open').forEach(function (p) { var hh = p.closest('[data-datepicker]'); if (!hh.contains(e.target)) dpClose(hh); });
  });
  document.addEventListener('keydown', function (e) {
    var host = e.target.closest && e.target.closest('[data-datepicker]'); if (!host) return;
    if (e.key === 'Escape' && $('.datepicker', host).classList.contains('is-open')) { e.stopPropagation(); dpClose(host, true); return; }
    var day = e.target.closest('.datepicker__day'); if (!day) return;
    var step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]; if (!step) return;
    e.preventDefault(); var d = fromIso(day.getAttribute('data-date')); d.setDate(d.getDate() + step);
    var nx = $('[data-date="' + iso(d) + '"]', host);
    if (!nx) { host._dp.y = d.getFullYear(); host._dp.m = d.getMonth(); dpRender(host); nx = $('[data-date="' + iso(d) + '"]', host); }
    if (nx) nx.focus();
  });
  $$('.datepicker--static').forEach(function (p) { var h = p.closest('[data-datepicker]'); if (h) { var v = h.getAttribute('data-init') ? fromIso(h.getAttribute('data-init')) : DP_TODAY; h._dp = { y: v.getFullYear(), m: v.getMonth(), a: v, b: null }; dpRender(h); } });

  /* ---------- 15. Số lượng, OTP, tải ảnh ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-qty]'); if (!b) return;
    var q = b.closest('.qty'), i = $('.qty__input', q), min = +(i.min || 0), max = +(i.max || 9999), v = (+i.value || 0) + (b.getAttribute('data-qty') === 'inc' ? 1 : -1);
    v = Math.max(min, Math.min(max, v)); i.value = v; $$('[data-qty]', q).forEach(function (x) { x.disabled = (x.getAttribute('data-qty') === 'dec' && v <= min) || (x.getAttribute('data-qty') === 'inc' && v >= max); });
    q.classList.toggle('is-error', false);
  });
  document.addEventListener('input', function (e) {
    var c = e.target.closest && e.target.closest('.otp__cell'); if (!c) return;
    c.value = c.value.replace(/\D/g, '').slice(-1); var cells = $$('.otp__cell', c.parentElement), i = cells.indexOf(c);
    if (c.value && cells[i + 1]) cells[i + 1].focus();
    if (cells.every(function (x) { return x.value; })) toast('success', 'Đã nhập đủ mã', 'Prototype: mã được gửi đi xác thực.');
  });
  document.addEventListener('keydown', function (e) {
    var c = e.target.closest && e.target.closest('.otp__cell'); if (!c) return;
    var cells = $$('.otp__cell', c.parentElement), i = cells.indexOf(c);
    if (e.key === 'Backspace' && !c.value && cells[i - 1]) { cells[i - 1].focus(); cells[i - 1].value = ''; }
    if (e.key === 'ArrowLeft' && cells[i - 1]) cells[i - 1].focus();
    if (e.key === 'ArrowRight' && cells[i + 1]) cells[i + 1].focus();
  });
  document.addEventListener('paste', function (e) {
    var c = e.target.closest && e.target.closest('.otp__cell'); if (!c) return;
    e.preventDefault(); var txt = (e.clipboardData.getData('text') || '').replace(/\D/g, ''), cells = $$('.otp__cell', c.parentElement);
    cells.forEach(function (x, i) { x.value = txt.charAt(i) || ''; }); (cells[Math.min(txt.length, cells.length - 1)]).focus();
  });
  function addThumb(up, file) {
    var wrap = $('.upload__thumbs', up), t = document.createElement('div'), bad = !/^image\//.test(file.type) || file.size > 10 * 1024 * 1024;
    t.className = 'thumb' + (bad ? ' is-error' : '');
    t.innerHTML = '<div class="thumb__img"><button type="button" class="thumb__remove" aria-label="Xóa ảnh"><svg class="icon icon--sm" aria-hidden="true"><use href="#x"/></svg></button></div><div class="thumb__meta"></div>';
    var box = $('.thumb__img', t), meta = $('.thumb__meta', t), kb = Math.round(file.size / 1024);
    if (bad) { box.insertAdjacentHTML('afterbegin', '<svg class="icon icon--lg" aria-hidden="true"><use href="#alert-triangle"/></svg>'); meta.textContent = file.size > 10 * 1024 * 1024 ? 'Quá 10 MB – chọn ảnh nhỏ hơn' : 'Không phải ảnh'; }
    else {
      var img = document.createElement('img'); img.alt = 'Ảnh ' + file.name; img.src = URL.createObjectURL(file); box.insertBefore(img, box.firstChild);
      box.insertAdjacentHTML('beforeend', '<div class="thumb__bar" role="progressbar" aria-label="Đang tải lên" aria-valuemin="0" aria-valuemax="100"><span style="width:0%"></span></div>');
      var bar = $('.thumb__bar span', box), p = 0; meta.textContent = 'Đang tải… ' + kb + ' KB';
      var iv = setInterval(function () { p += 20; bar.style.width = p + '%'; if (p >= 100) { clearInterval(iv); meta.textContent = 'Đã nén · ' + Math.max(1, Math.round(kb * 0.4)) + ' KB'; var bb = $('.thumb__bar', box); if (bb) bb.remove(); } }, 180);
    }
    wrap.appendChild(t);
  }
  document.addEventListener('change', function (e) {
    var up = e.target.closest && e.target.closest('[data-upload]'); if (!up || e.target.type !== 'file') return;
    Array.prototype.forEach.call(e.target.files, function (f) { addThumb(up, f); }); e.target.value = '';
  });
  document.addEventListener('click', function (e) {
    var rm = e.target.closest('.thumb__remove'); if (rm) { var th = rm.closest('.thumb'), nxt = th.nextElementSibling || th.previousElementSibling; th.remove(); (nxt ? $('.thumb__remove', nxt) : null) && $('.thumb__remove', nxt).focus(); }
    var pick = e.target.closest('[data-upload-pick]'); if (pick) { var inp = $('input[type=file]' + (pick.getAttribute('data-upload-pick') === 'camera' ? '[capture]' : ':not([capture])'), pick.closest('[data-upload]')); if (inp) inp.click(); }
  });
  ['dragover', 'dragleave', 'drop'].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      var up = e.target.closest && e.target.closest('[data-upload]'); if (!up) return;
      e.preventDefault(); up.classList.toggle('is-dragover', ev === 'dragover');
      if (ev === 'drop') Array.prototype.forEach.call(e.dataTransfer.files, function (f) { addThumb(up, f); });
    });
  });

  applyRole();
})();
