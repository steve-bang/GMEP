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
  var lastFocus = null;
  function openOverlay(id) {
    var o = document.getElementById(id); if (!o) return;
    lastFocus = document.activeElement;
    o.classList.add('is-open');
    var f = $('[autofocus], input, button, [href]', o); if (f) f.focus();
  }
  function closeOverlay(o) {
    if (!o) return; o.classList.remove('is-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.addEventListener('click', function (e) {
    var op = e.target.closest('[data-open]');
    if (op) { openOverlay(op.getAttribute('data-open')); return; }
    if (e.target.closest('[data-close]')) { closeOverlay(e.target.closest('.overlay')); return; }
    if (e.target.classList && e.target.classList.contains('overlay')) closeOverlay(e.target);
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
  document.addEventListener('click', function (e) {
    var trg = e.target.closest('.dropdown > [aria-haspopup]');
    if (trg) {
      var d = trg.parentElement, open = !d.classList.contains('is-open');
      closeDropdowns(d); d.classList.toggle('is-open', open); trg.setAttribute('aria-expanded', String(open));
      return;
    }
    if (!e.target.closest('.dropdown__menu') || e.target.closest('[data-keep-open]') === null && e.target.closest('.menu-item')) closeDropdowns();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var ov = $('.overlay.is-open'); if (ov) { closeOverlay(ov); return; }
      closeDropdowns(); if (app) app.classList.remove('is-nav-open');
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
    if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length]; if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
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
  document.addEventListener('click', function (e) {
    var it = e.target.closest('[data-branch]'); if (!it) return;
    var name = it.getAttribute('data-branch'), all = it.hasAttribute('data-branch-all');
    $$('[data-branch]').forEach(function (x) { x.setAttribute('aria-checked', String(x === it)); });
    $$('[data-branch-label]').forEach(function (l) { l.textContent = name; });
    $$('.branch-btn').forEach(function (b) { b.classList.toggle('is-all', all); });
    $$('[data-scope-text]').forEach(function (l) { l.textContent = all ? 'Tất cả chi nhánh (8 chi nhánh) – số liệu hợp nhất' : 'Chỉ ' + name + ' – không gồm chi nhánh khác'; });
    $$('.scope-banner').forEach(function (b) { b.classList.toggle('scope-banner--branch', !all); });
    toast(all ? 'info' : 'success', 'Đã đổi phạm vi dữ liệu', all ? 'Đang xem hợp nhất tất cả chi nhánh.' : 'Đang xem riêng: ' + name + '.');
  });

  /* ---------- 9. Toast ---------- */
  function toast(kind, title, text) {
    var reg = $('.toast-region'); if (!reg) { reg = document.createElement('div'); reg.className = 'toast-region'; reg.setAttribute('role', 'status'); reg.setAttribute('aria-live', 'polite'); document.body.appendChild(reg); }
    var ic = { success: 'circle-check', danger: 'circle-x', warning: 'alert-triangle', info: 'info' }[kind] || 'info';
    var t = document.createElement('div'); t.className = 'toast toast--' + kind;
    t.innerHTML = '<svg class="icon toast__icon" aria-hidden="true"><use href="#' + ic + '"/></svg><div><div class="toast__title"></div><div class="toast__text"></div></div><button class="btn-icon toast__x" aria-label="Đóng thông báo" style="margin-left:auto;width:32px;height:32px"><svg class="icon icon--sm"><use href="#x"/></svg></button>';
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
    var mask = e.target.closest('[data-reveal]');
    if (mask) { var v = $('[data-masked]', mask.parentElement); if (v) { var shown = mask.getAttribute('aria-pressed') === 'true'; v.textContent = shown ? v.getAttribute('data-masked') : v.getAttribute('data-clear'); mask.setAttribute('aria-pressed', String(!shown)); toast('info', 'Đã ghi nhật ký truy cập', 'Việc xem số điện thoại đầy đủ được lưu vết (đề xuất, cần BA xác nhận).'); } }
    var sw = e.target.closest('[data-role-switch]');
    if (sw) { document.body.setAttribute('data-role', sw.getAttribute('data-role-switch')); applyRole(); }
  });

  /* ---------- 11. Menu theo vai trò (prototype) ---------- */
  var ROLE_MENU = {
    CH: ['dash','ro','appt','cust','inv','pur','hr','fin','einv','rpt','set'],
    QV: ['dash','ro','appt','cust','inv','pur','hr','fin','einv','rpt'],
    QL: ['dash','ro','appt','cust','inv','pur','hr','fin','einv','rpt','set'],
    CV: ['dash','ro','appt','cust','rpt'],
    QD: ['dash','ro','hr','rpt'],
    TH: ['dash','ro'],
    TK: ['dash','ro','inv','pur','rpt'],
    TN: ['dash','ro','cust','fin','einv','rpt'],
    KT: ['dash','ro','cust','inv','pur','hr','fin','einv','rpt'],
    AD: ['set']
  };
  function applyRole() {
    var role = document.body.getAttribute('data-role'); if (!role || !ROLE_MENU[role]) return;
    var allowed = ROLE_MENU[role];
    $$('[data-menu]').forEach(function (m) { m.hidden = allowed.indexOf(m.getAttribute('data-menu')) < 0; });
    $$('[data-role-switch]').forEach(function (x) { x.setAttribute('aria-checked', String(x.getAttribute('data-role-switch') === role)); });
    $$('[data-role-label]').forEach(function (l) { var s = $('[data-role-switch="' + role + '"]'); if (s) l.textContent = s.getAttribute('data-role-name'); });
    /* Ẩn nhóm menu rỗng */
    $$('.sidebar__nav .sidebar__group').forEach(function (g) {
      var n = g.nextElementSibling, any = false;
      while (n && !n.classList.contains('sidebar__group')) { if (n.hasAttribute('data-menu') && !n.hidden) any = true; n = n.nextElementSibling; }
      g.hidden = !any;
    });
    /* Chỉ Chủ garage / Quản lý vùng được xem hợp nhất; vai trò khác phải chọn một chi nhánh */
    var multi = role === 'CH' || role === 'QV';
    $$('[data-multi-only]').forEach(function (m) { m.hidden = !multi; });
    $$('[data-multi-note]').forEach(function (m) { m.hidden = multi; });
    var btn = $('.branch-btn');
    if (!multi && btn && btn.classList.contains('is-all')) { var first = $('[data-branch]:not([data-branch-all])'); if (first) first.click(); }
  }
  applyRole();
})();
