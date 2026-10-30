/* G1 – hành vi giả lập cho trang xác thực / lỗi / hồ sơ (prototype, không phải code production).
   Chức năng: bộ chuyển trạng thái xem thử (?state=...), kiểm tra biểu mẫu với lỗi nêu cách sửa, hiện/ẩn mật khẩu, chính sách mật khẩu,
   đếm lùi, wizard nhiều bước, PIN pad, chọn chi nhánh, chọn mục. Mọi mật khẩu/mã trong prototype chỉ để minh họa luồng. */
(function () {
  'use strict';
  var b = document.body;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function ic(n, c) { return '<svg class="icon' + (c ? ' ' + c : '') + '" aria-hidden="true"><use href="#' + n + '"/></svg>'; }
  function toast(k, t, x) { if (window.gmepToast) window.gmepToast(k, t, x); }
  var view = 'default';
  var COMMON = ['1234567890', '0123456789', 'matkhau123', 'matkhau1234', 'password123', 'garage12345', 'garageos123', 'qwertyuiop'];

  /* ---------- 1. Trạng thái xem thử ---------- */
  function inList(el, attr, v) { var a = el.getAttribute(attr); return a !== null && a.split(' ').indexOf(v) >= 0; }
  function setView(v) {
    view = v; b.setAttribute('data-view', v);
    $$('[data-show]').forEach(function (el) { el.hidden = !inList(el, 'data-show', v); });
    $$('[data-hide]').forEach(function (el) { if (inList(el, 'data-hide', v)) el.hidden = true; else if (!el.hasAttribute('data-show')) el.hidden = false; });
    $$('[data-disable-in]').forEach(function (el) {
      var off = inList(el, 'data-disable-in', v); el.disabled = off; if (off) el.setAttribute('aria-disabled', 'true'); else el.removeAttribute('aria-disabled');
    });
    $$('[data-loading-in]').forEach(function (el) { var on = inList(el, 'data-loading-in', v); el.classList.toggle('is-loading', on); if (on) el.setAttribute('aria-busy', 'true'); else el.removeAttribute('aria-busy'); });
    $$('.g1-proto [data-g1-view]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-g1-view') === v)); });
    $$('[data-countdown]').forEach(function (c) { c._left = +c.getAttribute('data-countdown'); paintCd(c); });
    var live = $('[data-live-view]'); if (live) { var on = $('[data-g1-view="' + v + '"]'); live.textContent = on ? 'Đang xem trạng thái: ' + on.textContent : ''; }
  }
  $$('[data-g1-views]').forEach(function (h) {
    var items = h.getAttribute('data-g1-views').split('|').map(function (s) { return s.split(':'); });
    h.className = (h.className ? h.className + ' ' : '') + 'g1-proto';
    h.innerHTML = '<span class="g1-proto__label">Xem thử trạng thái (chỉ prototype)</span><div class="segmented" role="group" aria-label="Trạng thái màn hình để xem thử">' +
      items.map(function (s) { return '<button type="button" class="segmented__item" aria-pressed="' + (s[0] === 'default') + '" data-g1-view="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</div>' +
      (h.getAttribute('data-hint') ? '<span>' + h.getAttribute('data-hint') + '</span>' : '') + '<span class="sr-only" role="status" aria-live="polite" data-live-view></span>';
  });
  document.addEventListener('click', function (e) {
    var v = e.target.closest('[data-g1-view],[data-g1-goto]');
    if (v && v.tagName === 'BUTTON') setView(v.getAttribute('data-g1-view') || v.getAttribute('data-g1-goto'));
  });

  /* ---------- 2. Biểu mẫu ---------- */
  function fieldErr(inp, msg) {
    var id = inp.id, er = document.getElementById(id + '-err');
    if (!er) return;
    if (msg) { er.hidden = false; er.innerHTML = ic('alert-triangle') + '<span>' + msg + '</span>'; inp.setAttribute('aria-invalid', 'true'); inp.setAttribute('aria-describedby', id + '-err'); }
    else { er.hidden = true; er.innerHTML = ''; inp.removeAttribute('aria-invalid'); }
  }
  function validate(inp) {
    var rules = (inp.getAttribute('data-rule') || '').split('|'), v = inp.value.trim(), msg = '';
    rules.forEach(function (r) {
      if (msg || !r) return;
      var p = r.split(':'), k = p[0];
      if (k === 'required' && !v) msg = inp.getAttribute('data-msg-required');
      else if (k === 'minlen' && v && v.length < +p[1]) msg = inp.getAttribute('data-msg-minlen');
      else if (k === 'match' && v !== $(p[1]).value) msg = inp.getAttribute('data-msg-match');
      else if (k === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) msg = inp.getAttribute('data-msg-email');
      else if (k === 'notcommon' && v && COMMON.indexOf(v.toLowerCase()) >= 0) msg = inp.getAttribute('data-msg-notcommon');
      else if (k === 'digits' && v && !new RegExp('^\\d{' + p[1] + '}$').test(v)) msg = inp.getAttribute('data-msg-digits');
    });
    fieldErr(inp, msg); return !msg;
  }
  function routeValue(f) {
    var id = f.getAttribute('data-route-field');
    if (id === 'otp') return $$('.otp__cell', f).map(function (c) { return c.value; }).join('');
    var el = id && document.getElementById(id); return el ? el.value : '';
  }
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-g1-form]'); if (!f) return;
    e.preventDefault();
    var bad = null;
    $$('[data-rule]', f).forEach(function (i) { if (!i.disabled && !validate(i) && !bad) bad = i; });
    if (f.getAttribute('data-route-field') === 'otp' && !bad) {
      var code = routeValue(f), cells = $$('.otp__cell', f), og = $('.otp', f), oe = $('#otp-err');
      if (code.length < 6) { bad = cells[code.length] || cells[0]; if (oe) { oe.hidden = false; oe.innerHTML = ic('alert-triangle') + '<span>Nhập đủ 6 số. Ví dụ: 4 8 2 0 1 5.</span>'; } if (og) og.classList.add('is-error'); }
      else { if (oe) oe.hidden = true; if (og) og.classList.remove('is-error'); }
    }
    if (bad) { bad.focus(); return; }
    if (view === 'offline') { toast('warning', 'Chưa có kết nối', 'Kiểm tra mạng rồi thử lại. Thông tin bạn nhập vẫn còn trên màn hình.'); return; }
    var routes = (f.getAttribute('data-routes') || '').split(';').filter(Boolean), val = routeValue(f), act = null, wild = null;
    routes.forEach(function (r) { var kv = r.split('='); if (kv[0] === '*') wild = kv[1]; else if (kv[0] === val) act = kv[1]; });
    act = act || wild || ('go:' + (f.getAttribute('data-next') || '#'));
    var kind = act.split(':'), t = kind.slice(1).join(':');
    if (kind[0] === 'view') { setView(t); var first = $('[data-first-focus]'); if (first) first.focus(); if (t === 'error') $$('.otp__cell', f).forEach(function (c) { c.value = ''; }); return; }
    var sub = $('[type="submit"]', f); if (sub) { sub.classList.add('is-loading'); sub.setAttribute('aria-busy', 'true'); }
    setTimeout(function () { location.href = t; }, 700);
  });
  document.addEventListener('input', function (e) { var i = e.target; if (i.hasAttribute && i.hasAttribute('data-rule') && i.getAttribute('aria-invalid') === 'true') validate(i); });
  document.addEventListener('blur', function (e) { var i = e.target; if (i.hasAttribute && i.hasAttribute('data-rule') && i.value.trim()) validate(i); }, true);

  /* ---------- 3. Mật khẩu ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-pw-toggle]'); if (!t) return;
    var inp = document.getElementById(t.getAttribute('data-pw-toggle')), show = inp.type === 'password';
    inp.type = show ? 'text' : 'password'; t.setAttribute('aria-pressed', String(show));
    t.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'); $('use', t).setAttribute('href', show ? '#eye-off' : '#eye');
  });
  document.addEventListener('keyup', function (e) {
    var inp = e.target.closest && e.target.closest('input[type="password"],input[data-pw]'); if (!inp || !e.getModifierState) return;
    var w = $('[data-caps]'); if (w) w.hidden = !e.getModifierState('CapsLock');
  });
  function policy(inp) {
    var v = inp.value, ok = { len: v.length >= 10, common: v.length > 0 && COMMON.indexOf(v.toLowerCase()) < 0 };
    $$('.g1-rules li[data-r]').forEach(function (li) {
      var k = li.getAttribute('data-r'); if (!(k in ok)) return;
      li.classList.toggle('is-ok', ok[k]); $('use', li).setAttribute('href', ok[k] ? '#circle-check' : '#circle-x'); var s = $('.sr-only', li); if (s) s.textContent = ok[k] ? 'Đạt: ' : 'Chưa đạt: ';
    });
    var lvl = !v ? 0 : !ok.len || !ok.common ? 1 : Math.min(4, 2 + (v.length >= 14 ? 1 : 0) + (/[^A-Za-z0-9]/.test(v) && /\d/.test(v) ? 1 : 0));
    var m = $('.g1-strength'); if (m) { m.setAttribute('data-level', lvl); var tx = $('[data-strength-text]'); if (tx) tx.textContent = ['Chưa nhập', 'Yếu', 'Đạt yêu cầu', 'Khá', 'Mạnh'][lvl]; }
    return ok.len && ok.common;
  }
  document.addEventListener('input', function (e) { if (e.target.hasAttribute && e.target.hasAttribute('data-pw-policy')) policy(e.target); });

  /* ---------- 4. Đếm lùi ---------- */
  function paintCd(c) { var m = Math.floor(c._left / 60), s = c._left % 60; c.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
  $$('[data-countdown]').forEach(function (c) { c._left = +c.getAttribute('data-countdown'); paintCd(c); });
  setInterval(function () {
    $$('[data-countdown]').forEach(function (c) {
      if (c.offsetParent === null || c._left <= 0) return;
      c._left--; paintCd(c);
      if (c._left === 0) {
        var v = c.getAttribute('data-countdown-view'); if (v) setView(v);
        var en = c.getAttribute('data-countdown-enable'); if (en) { var bt = $(en); if (bt) { bt.disabled = false; bt.removeAttribute('aria-disabled'); } var tx = $('[data-cd-text]'); if (tx) tx.hidden = true; }
      }
    });
  }, 1000);

  /* ---------- 5. Wizard ---------- */
  function goStep(w, n) {
    $$('[data-step]', w).forEach(function (p) { p.hidden = p.getAttribute('data-step') !== String(n); });
    $$('.stepper__step', w).forEach(function (s, i) {
      s.classList.toggle('is-done', i + 1 < n); s.classList.toggle('is-current', i + 1 === n);
      if (i + 1 === n) s.setAttribute('aria-current', 'step'); else s.removeAttribute('aria-current');
      var num = $('.stepper__num', s); if (num) num.innerHTML = i + 1 < n ? ic('check', 'icon--sm') : String(i + 1);
    });
    var h = $('[data-step="' + n + '"] [data-step-title]', w); if (h) h.focus();
  }
  document.addEventListener('click', function (e) {
    var g = e.target.closest('[data-step-go]'); if (!g) return;
    var w = g.closest('[data-wizard]'), n = +g.getAttribute('data-step-go');
    if (g.hasAttribute('data-validate')) {
      var badIn = null;
      $$('[data-rule]', g.closest('[data-step]')).forEach(function (i) { if (!validate(i) && !badIn) badIn = i; });
      if (badIn) { badIn.focus(); return; }
    }
    if (g.hasAttribute('data-otp-check')) {
      var code = $$('.otp__cell', w).map(function (c) { return c.value; }).join(''), er = $('#otp-err'), og = $('.otp', w);
      if (code.length < 6 || code === '000000') { er.hidden = false; er.innerHTML = ic('alert-triangle') + '<span>' + (code.length < 6 ? 'Nhập đủ 6 số hiển thị trong ứng dụng xác thực.' : 'Mã chưa đúng hoặc đã hết hạn. Đợi mã mới trong ứng dụng (đổi mỗi 30 giây) rồi nhập lại; kiểm tra giờ trên điện thoại đã đặt tự động.') + '</span>'; og.classList.add('is-error'); (code.length < 6 ? $$('.otp__cell', w)[code.length] : $('.otp__cell', w)).focus(); return; }
      er.hidden = true; og.classList.remove('is-error');
    }
    goStep(w, n);
  });
  document.addEventListener('change', function (e) {
    $$('[data-requires]').forEach(function (btn) {
      var ids = btn.getAttribute('data-requires').split(' '), ok = ids.every(function (id) { var el = document.getElementById(id); return el && el.checked; });
      btn.disabled = !ok; if (ok) btn.removeAttribute('aria-disabled'); else btn.setAttribute('aria-disabled', 'true');
    });
  });
  $$('[data-requires]').forEach(function (btn) { btn.disabled = true; btn.setAttribute('aria-disabled', 'true'); });

  /* ---------- 6. PIN pad & chọn mục ---------- */
  var pin = '';
  function paintPin() { $$('.g1-pin-dots span').forEach(function (s, i) { s.classList.toggle('is-on', i < pin.length); }); }
  document.addEventListener('click', function (e) {
    var k = e.target.closest('[data-pin]');
    if (k) {
      var key = k.getAttribute('data-pin'); if (view === 'locked' || view === 'offline') return;
      if (key === 'back') pin = pin.slice(0, -1); else if (key === 'clear') pin = ''; else if (pin.length < 6) pin += key;
      $('.g1-pin-dots').classList.remove('is-error'); paintPin();
      var live = $('[data-pin-live]'); if (live) live.textContent = 'Đã nhập ' + pin.length + ' trên 6 số';
      if (pin.length === 6) {
        setTimeout(function () { if (pin === '000000') { pin = ''; paintPin(); setView('error'); $('.g1-pin-dots').classList.add('is-error'); } else location.href = 'g1-dsh-07.html'; }, 250);
      }
    }
    var w = e.target.closest('[data-worker]');
    if (w) {
      $$('[data-worker]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === w)); });
      var nm = $('[data-worker-name]'); if (nm) nm.textContent = w.getAttribute('data-worker'); pin = ''; paintPin();
      $('[data-pin-step]').hidden = false; $('[data-pin-step]').scrollIntoView({ block: 'nearest' }); if (view === 'error' && e.isTrusted) setView('default');
    }
    var bc = e.target.closest('[data-branch-card]');
    if (bc && bc.getAttribute('aria-disabled') !== 'true') {
      $$('[data-branch-card]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === bc)); });
      var go = $('[data-branch-go]'); if (go) { go.disabled = false; go.removeAttribute('aria-disabled'); go.setAttribute('data-next', bc.getAttribute('data-next')); }
    }
    var gb = e.target.closest('[data-branch-go]');
    if (gb && !gb.disabled) { gb.classList.add('is-loading'); setTimeout(function () { location.href = gb.getAttribute('data-next'); }, 600); }
    var lk = e.target.closest('[data-branch-card][aria-disabled="true"]'); if (lk) toast('info', 'Chi nhánh chỉ xem', 'Chi nhánh này đang khóa sổ hoặc bạn chưa được cấp quyền thao tác. Liên hệ quản lý để được hỗ trợ.');
  });

  var q = /[?&]state=([a-z0-9-]+)/.exec(location.search);
  setView(q && $('[data-g1-view="' + q[1] + '"]') ? q[1] : 'default');
})();
