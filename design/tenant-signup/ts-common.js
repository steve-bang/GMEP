/* Gói "Đăng ký tenant và onboarding" – hành vi giả lập dùng chung cho phần công khai (TSU-01..18) và quản trị nền tảng (TSU-60..68).
   Prototype, không phải code production. Mọi kiểm tra máy chủ (MST có thật không, chống bot, đếm hạn mức, gửi email) chỉ mô phỏng.
   Chức năng: thanh "Xem thử trạng thái" (?state=...), các trạng thái chung (đang tải, lỗi máy chủ, mất mạng, 429), kiểm tra biểu mẫu theo bảng V-* của spec,
   khóa nút kèm lý do, chống gửi trùng, mật khẩu (hiện/ẩn, độ mạnh), đếm lùi, tệp đính kèm, kiểm tra người thật, nháp trình duyệt (không lưu mật khẩu). */
(function () {
  'use strict';
  var b = document.body;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function ic(n, c) { return '<svg class="icon' + (c ? ' ' + esc(c) : '') + '" aria-hidden="true"><use href="#' + esc(n) + '"/></svg>'; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  /* Chỉ điều hướng tới địa chỉ cùng nguồn gốc (file: trong bản xem thử), chặn javascript: và trang ngoài */
  function safeGo(u) {
    try {
      var x = new URL(String(u), location.href);
      if (x.protocol === location.protocol && (location.protocol === 'file:' || x.origin === location.origin)) location.href = x.href;
    } catch (err) { /* địa chỉ không hợp lệ: bỏ qua */ }
  }
  function toast(k, t, x) { if (window.gmepToast) window.gmepToast(k, t, x); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function inList(el, attr, v) { var a = el.getAttribute(attr); return a !== null && a.split(' ').indexOf(v) >= 0; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  var view = '', DEF = '', booted = false;
  var main = $('main');
  var COMMON = { skel: 'Đang tải', error: 'Lỗi máy chủ', offline: 'Mất mạng', r429: 'Quá nhiều lần thử (429)' };
  var COMMON_PW = ['1234567890', '0123456789', 'matkhau123', 'matkhau1234', 'password123', 'garage12345', 'garageos123', 'qwertyuiop', '12345678910', 'abcd123456'];
  var DISPOSABLE = ['mailinator.com', 'tempmail.com', '10minutemail.com', 'guerrillamail.com', 'yopmail.com', 'trashmail.com'];

  /* ---------- 1. Thanh xem thử trạng thái ---------- */
  /* Thanh xem thử: trên điện thoại (<= 639 px) thu gọn mặc định, nút "Xem thử" mở ra. Nhãn chỉ dùng chữ tiếng Việt, khóa kỹ thuật chỉ nằm trong thuộc tính data-ts-view. */
  var narrow = !!(window.matchMedia && window.matchMedia('(max-width: 639px)').matches);
  $$('[data-ts-views]').forEach(function (h, n) {
    var items = h.getAttribute('data-ts-views').split('|').filter(Boolean).map(function (s) { var i = s.indexOf(':'); return [s.slice(0, i), s.slice(i + 1)]; });
    (h.getAttribute('data-ts-common') || '').split(' ').filter(Boolean).forEach(function (c) { if (COMMON[c]) items.push([c, COMMON[c]]); });
    if (!DEF) DEF = items[0][0];
    var pid = 'tsp-proto-panel-' + n;
    h.className = (h.className ? h.className + ' ' : '') + 'tsp-proto' + (h.hasAttribute('data-wide') ? ' tsp-proto--wide' : '');
    h.innerHTML = '<div class="tsp-proto__bar"><button type="button" class="btn btn--secondary btn--sm tsp-proto__toggle" data-proto-toggle aria-expanded="' + (!narrow) + '" aria-controls="' + pid + '">' + ic('eye', 'icon--sm') + 'Xem thử</button>' +
      '<span class="tsp-proto__now" data-proto-now>Đang xem: ' + esc(items[0][1]) + '</span></div>' +
      '<div class="tsp-proto__panel" id="' + pid + '"' + (narrow ? ' hidden' : '') + '><span class="tsp-proto__label">Xem thử trạng thái (chỉ prototype)</span><div class="segmented" role="group" aria-label="Trạng thái màn hình để xem thử">' +
      items.map(function (s, i) { return '<button type="button" class="segmented__item" aria-pressed="' + (i === 0) + '" data-ts-view="' + s[0] + '">' + esc(s[1]) + '</button>'; }).join('') + '</div>' +
      (h.getAttribute('data-hint') ? '<span class="tsp-proto__hint">' + esc(h.getAttribute('data-hint')) + '</span>' : '') + '</div><span class="sr-only" role="status" aria-live="polite" data-live-view></span>';
  });
  document.addEventListener('click', function (e) {
    var pt = e.target.closest('[data-proto-toggle]'); if (!pt) return;
    var pn = document.getElementById(pt.getAttribute('aria-controls')), open = pt.getAttribute('aria-expanded') !== 'true';
    pt.setAttribute('aria-expanded', String(open)); if (pn) pn.hidden = !open;
  });
  document.addEventListener('click', function (e) {
    var v = e.target.closest('[data-ts-view],[data-ts-goto]');
    if (v && v.tagName === 'BUTTON') setView(v.getAttribute('data-ts-view') || v.getAttribute('data-ts-goto'));
  });

  /* ---------- 2. Trạng thái chung ---------- */
  function alertsBox() {
    var bx = $('[data-ts-alerts]');
    if (!bx && main) { bx = document.createElement('div'); bx.className = 'tsp-alerts'; bx.setAttribute('data-ts-alerts', ''); bx.hidden = true; main.insertBefore(bx, main.firstChild); }
    return bx;
  }
  function attr(n, d) { return (main && main.getAttribute(n)) || d; }
  function commonAlert(v) {
    if (v === 'error') {
      return '<div class="alert alert--danger" role="alert">' + ic('alert-triangle') + '<div class="alert__body"><span class="alert__title">' + esc(attr('data-error-title', 'Chưa xử lý được yêu cầu')) + '</span><span>' +
        esc(attr('data-error-text', 'Máy chủ gặp sự cố tạm thời. Thông tin bạn đã nhập vẫn được giữ. Hãy thử lại sau ít phút.')) + '</span><span class="tsp-small">Mã tham chiếu: REQ-7K2M9X</span><div class="alert__actions"><button type="button" class="btn btn--secondary btn--sm" data-ts-goto="' + DEF + '">Thử lại</button></div></div></div>';
    }
    if (v === 'offline') {
      return '<div class="alert alert--warning" role="alert">' + ic('wifi-off') + '<div class="alert__body"><span class="alert__title">Mất kết nối mạng</span><span>' +
        esc(attr('data-offline-text', 'Chưa gửi được. Kiểm tra Wi-Fi hoặc 4G rồi thử lại. Thông tin bạn đã nhập vẫn được giữ trên thiết bị này.')) + '</span><div class="alert__actions"><button type="button" class="btn btn--secondary btn--sm" data-ts-goto="' + DEF + '">Thử kết nối lại</button></div></div></div>';
    }
    if (v === 'r429') {
      return '<div class="alert alert--warning" role="alert">' + ic('clock') + '<div class="alert__body"><span class="alert__title">Tạm dừng thử lại</span><span>Bạn đã thử quá nhiều lần. Thử lại sau <strong class="num" data-countdown="60" data-countdown-view="' + DEF + '">01:00</strong>.</span></div></div>';
    }
    return '';
  }
  function ensureSkel() {
    var bodies = $$('[data-ts-body]'); if (!bodies.length || $('[data-ts-skel]')) return;
    var s = document.createElement('div'); s.className = 'tsp-skel'; s.setAttribute('data-ts-skel', ''); s.hidden = true; s.setAttribute('role', 'status'); s.setAttribute('aria-busy', 'true');
    s.innerHTML = '<span class="sr-only">Đang tải…</span><span class="skeleton skeleton--title" aria-hidden="true"></span><span class="skeleton skeleton--text" aria-hidden="true"></span><span class="skeleton skeleton--text" aria-hidden="true"></span><span class="skeleton skeleton--text" aria-hidden="true"></span><span class="skeleton skeleton--block" aria-hidden="true"></span>';
    bodies[0].parentNode.insertBefore(s, bodies[0]);
  }

  /* ---------- 3. Chuyển trạng thái ---------- */
  function setView(v) {
    view = v; b.setAttribute('data-view', v);
    $$('[data-show]').forEach(function (el) { el.hidden = !inList(el, 'data-show', v); });
    $$('[data-hide]').forEach(function (el) { if (inList(el, 'data-hide', v)) el.hidden = true; else if (!el.hasAttribute('data-show')) el.hidden = false; });
    ensureSkel();
    $$('[data-ts-body]').forEach(function (el) { el.hidden = v === 'skel'; });
    var sk = $('[data-ts-skel]'); if (sk) sk.hidden = v !== 'skel';
    var bx = alertsBox(); if (bx) { bx.innerHTML = commonAlert(v); bx.hidden = !bx.innerHTML; }
    $$('[data-disable-in]').forEach(function (el) {
      if (el.hasAttribute('data-submit')) return;
      var off = inList(el, 'data-disable-in', v); el.disabled = off; if (off) el.setAttribute('aria-disabled', 'true'); else el.removeAttribute('aria-disabled');
    });
    $$('[data-fill]').forEach(function (el) {
      var m; try { m = JSON.parse(el.getAttribute('data-fill')); } catch (x) { return; }
      var wipe = booted && !COMMON[v] && !el.hasAttribute('data-fill-keep');   /* trạng thái chung (lỗi, mất mạng, 429) giữ nguyên dữ liệu đã nhập */
      if (el.type === 'radio') { if (v in m) el.checked = !!m[v]; else if (wipe) el.checked = false; }
      else if (v in m) el.value = m[v];
      else if (el.hasAttribute('data-fill-default')) el.value = el.defaultValue;   /* về giá trị đang áp dụng khi thoát trạng thái lỗi */
      else if (wipe) el.value = '';
    });
    if (!COMMON[v]) {
      $$('[data-check-in]').forEach(function (el) { el.checked = inList(el, 'data-check-in', v); });
      $$('[data-bot]').forEach(function (el) { setBot(el, inList(el, 'data-bot-ok-in', v) ? 'ok' : inList(el, 'data-bot-error-in', v) ? 'error' : 'idle'); });
      $$('[data-ts-form]').forEach(function (f) {
        clearErrors(f);
        if (inList(f, 'data-validate-in', v)) validateForm(f);
      });
    }
    $$('[data-pw-policy]').forEach(policy);
    $$('[data-counter-for]').forEach(counter);
    initCountdowns();
    $$('.tsp-proto [data-ts-view]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-ts-view') === v)); });
    var live = $('[data-live-view]'), on = $('[data-ts-view="' + v + '"]'); if (live) live.textContent = on ? 'Đang xem trạng thái: ' + on.textContent : '';
    $$('[data-proto-now]').forEach(function (x) { x.textContent = on ? 'Đang xem: ' + on.textContent : ''; });
    refreshDraftBanner(); refreshSubmit();
    if (typeof window.tsOnView === 'function') window.tsOnView(v);
  }
  window.TS = { setView: setView, getView: function () { return view; }, toast: toast, validateForm: function (f) { return validateForm(f); }, refresh: function () { refreshSubmit(); } };

  /* ---------- 4. Khóa nút kèm lý do ---------- */
  function requiresOk(btn) {
    var ids = (btn.getAttribute('data-requires') || '').split(' ').filter(Boolean);
    var okc = ids.every(function (id) { var el = document.getElementById(id); return el && el.checked; });
    if (!okc) return false;
    /* Kiểm tra người thật chỉ chặn khi nó đang hiện (trạng thái nghi ngờ); gửi form bình thường không cần bấm */
    if (btn.hasAttribute('data-requires-bot')) { var bot = $('[data-bot]'); if (bot && !bot.closest('[hidden]') && bot.getAttribute('data-bot-state') !== 'ok') return false; }
    return true;
  }
  function missingFields(form) {
    var out = [];
    $$('[data-required-field]', form).forEach(function (el) {
      if (el.closest('[hidden]')) return;
      var empty = el.getAttribute('role') === 'radiogroup' ? !$('input:checked', el) : !String(el.value || '').trim();
      if (empty) out.push(el.getAttribute('data-label') || 'trường bắt buộc');
    });
    return out;
  }
  function uploadsOk() {
    var all = $$('[data-upload]').filter(function (u) { return !u.closest('[hidden]'); });
    var busy = $$('.tsp-file.is-uploading, .tsp-file.is-error').some(function (li) { return !li.closest('[hidden]') && !li.hidden; });
    if (busy) return false;
    return all.filter(function (u) { return u.hasAttribute('data-required'); }).every(function (u) {
      return $$('.tsp-file.is-done', u).some(function (li) { return !li.hidden && !li.closest('[hidden]'); });
    });
  }
  function refreshSubmit() {
    var keep = main && main.hasAttribute('data-offline-keep');
    $$('[data-submit]').forEach(function (btn) {
      var form = btn.form || btn.closest('form') || document, why = '', txt = '';
      if (view === 'offline' && !keep) { why = 'offline'; txt = 'Nút tạm khóa vì chưa có mạng. Kết nối lại để tiếp tục.'; }
      else if (view === 'r429') { why = 'r429'; txt = 'Nút tạm khóa vì đã thử quá nhiều lần. Chờ hết thời gian đếm lùi.'; }
      else if (inList(btn, 'data-disable-in', view)) { why = 'page'; txt = btn.getAttribute('data-text-page') || ''; }
      else if (btn.hasAttribute('data-requires-fields') && missingFields(form).length) { why = 'fields'; txt = 'Chưa thể gửi: còn thiếu ' + missingFields(form).join(', ') + '.'; }
      else if (btn.hasAttribute('data-requires') && !requiresOk(btn)) {
        why = 'requires';
        var ids = (btn.getAttribute('data-requires') || '').split(' ').filter(Boolean);
        var boxesOk = ids.every(function (id) { var el = document.getElementById(id); return el && el.checked; });
        txt = (!boxesOk ? btn.getAttribute('data-text-requires') : btn.getAttribute('data-text-bot') || btn.getAttribute('data-text-requires')) || '';
      }
      else if (btn.hasAttribute('data-requires-upload') && !uploadsOk()) { why = 'upload'; txt = btn.getAttribute('data-text-upload') || ''; }
      var loading = inList(btn, 'data-loading-in', view) || !!btn._sending;
      /* Quy tắc khóa nút của spec: aria-disabled, vẫn focus được, có aria-describedby tới lý do hiện sẵn; không dùng thuộc tính disabled */
      if (btn.disabled) btn.disabled = false;
      if (why) btn.setAttribute('aria-disabled', 'true'); else btn.removeAttribute('aria-disabled');
      btn.classList.toggle('is-loading', loading); if (loading) btn.setAttribute('aria-busy', 'true'); else btn.removeAttribute('aria-busy');
      var rid = btn.getAttribute('data-reason-id'), r = rid && document.getElementById(rid);
      if (r) { var t = $('span', r); if (t && txt) t.textContent = txt; r.hidden = !(why && txt); r.setAttribute('tabindex', '-1'); btn.setAttribute('aria-describedby', rid); }
    });
  }

  /* ---------- 5. Kiểm tra biểu mẫu (bảng V-* của spec) ---------- */
  function lbl(i) { return i.getAttribute('data-label') || 'thông tin này'; }
  function msg(i, k, d) { return i.getAttribute('data-msg-' + k) || d; }
  function check(i) {
    var rules = (i.getAttribute('data-rule') || '').split('|').filter(Boolean), grp = i.getAttribute('role') === 'radiogroup';
    var v = grp ? ($('input:checked', i) ? 'x' : '') : i.type === 'checkbox' ? (i.checked ? 'x' : '') : String(i.value).trim();
    for (var n = 0; n < rules.length; n++) {
      var p = rules[n].split(':'), k = p[0], m = '';
      if (k === 'required') { if (!v) m = msg(i, 'required', 'Vui lòng nhập ' + lbl(i) + '.'); }
      else if (k === 'choose') { if (!v) m = msg(i, 'required', 'Vui lòng chọn ' + lbl(i) + '.'); }
      else if (k === 'checked') { if (!v) m = msg(i, 'required', 'Vui lòng tích ô này để tiếp tục.'); }
      else if (k === 'email') {
        if (!v) m = msg(i, 'required', 'Nhập email để chúng tôi gửi liên kết xác thực.');
        else { v = v.toLowerCase(); i.value = v; var dom = v.split('@')[1] || '';
          if (v.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) m = 'Email chưa đúng định dạng. Ví dụ: ten@congty.vn.';
          else if (i.hasAttribute('data-block-disposable') && DISPOSABLE.indexOf(dom) >= 0) m = 'Email này thuộc dịch vụ email tạm thời. Vui lòng dùng email công việc hoặc email thường dùng của bạn.'; }
      }
      else if (k === 'phone') {
        if (!v) m = msg(i, 'required', 'Nhập số điện thoại để chúng tôi liên hệ khi cần.');
        else { var c = v.replace(/[\s.\-]/g, ''); if (!/^(0\d{9}|\+84\d{9})$/.test(c)) m = 'Số điện thoại chưa đúng. Nhập 10 số bắt đầu bằng 0, ví dụ 0912 345 678.'; }
      }
      else if (k === 'mst') {
        if (!v) m = 'Nhập mã số thuế của doanh nghiệp hoặc hộ kinh doanh.';
        else { var s = v.replace(/[\s.\-]/g, ''), lens = (i.getAttribute('data-lens') || '10,12').split(',');
          if (/^\d{13}$/.test(s)) m = 'Đây là mã số thuế của đơn vị phụ thuộc. Hãy nhập mã số thuế 10 số của pháp nhân.';
          else if (!/^\d+$/.test(s) || lens.indexOf(String(s.length)) < 0) m = 'Mã số thuế gồm 10 số (doanh nghiệp) hoặc 12 số (hộ kinh doanh). Chỉ nhập chữ số.';
          else i.value = s; }
      }
      else if (k === 'pass') {
        var min = +(i.getAttribute('data-min') || 10), low = v.toLowerCase();
        if (!v) m = msg(i, 'required', 'Vui lòng nhập mật khẩu.');
        else if (v.length < min) m = 'Mật khẩu cần ít nhất ' + min + ' ký tự.';
        else if (COMMON_PW.indexOf(low) >= 0) m = 'Mật khẩu này quá phổ biến. Hãy chọn mật khẩu khác.';
        else if (avoids(i, low)) m = 'Mật khẩu không nên chứa email hoặc họ tên của bạn.';
      }
      else if (k === 'match') {
        var o = $(p[1]);
        if (!v) m = 'Vui lòng nhập lại mật khẩu.'; else if (o && v !== o.value) m = 'Hai mật khẩu chưa giống nhau.';
      }
      else if (k === 'org') { if (v.length < 2 || v.length > 200) m = 'Nhập tên doanh nghiệp hoặc hộ kinh doanh đúng như giấy đăng ký.'; }
      else if (k === 'name') { if (v.length < 2 || v.length > 100 || !/[A-Za-zÀ-ỹ]/.test(v)) m = 'Nhập họ và tên đầy đủ của người sở hữu.'; }
      else if (k === 'len') { if (v && (v.length < +p[1] || v.length > +p[2])) m = msg(i, 'len', 'Nhập từ ' + p[1] + ' đến ' + p[2] + ' ký tự.'); }
      else if (k === 'date') { if (!v) m = msg(i, 'required', 'Chọn ngày hiệu lực.'); else if (!/^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/.test(v)) m = msg(i, 'date', 'Nhập ngày theo dạng dd/MM/yyyy, ví dụ 12/11/2026.'); }
      else if (k === 'int') { if (v && (!/^\d+$/.test(v) || +v < 1)) m = msg(i, 'int', 'Nhập số nguyên lớn hơn 0.'); }
      if (m) return m;
    }
    return '';
  }
  /* QĐT-39: chuẩn hóa bỏ dấu (kể cả đ), chữ thường, bỏ khoảng trắng, dấu chấm, gạch; máy chủ mới là nơi quyết */
  var PW_NAME_TOKEN_MIN = 4;   /* tham số pw_name_token_min (minh họa) */
  function norm(s) {
    s = String(s || '');
    try { s = s.normalize('NFD'); } catch (x) {}
    return s.replace(/[̀-ͯ]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[\s.\-_]/g, '');
  }
  function avoids(i, low) {
    var pw = norm(low);
    return (i.getAttribute('data-avoid') || '').split(' ').filter(Boolean).some(function (id) {
      var el = document.getElementById(id); if (!el) return false;
      var raw = String(el.value || '').trim(); if (!raw) return false;
      if (el.type === 'email') { var lp = norm(raw.split('@')[0]); return lp.length >= PW_NAME_TOKEN_MIN && pw.indexOf(lp) >= 0; }
      var joined = norm(raw);
      if (joined.length >= PW_NAME_TOKEN_MIN && pw.indexOf(joined) >= 0) return true;
      return raw.split(/\s+/).some(function (w) { var t = norm(w); return t.length >= PW_NAME_TOKEN_MIN && pw.indexOf(t) >= 0; });
    });
  }
  function setErr(i, m) {
    var id = i.id; if (!id) return;
    var er = document.getElementById(id + '-err');
    if (!er) { er = document.createElement('span'); er.className = 'field__error'; er.id = id + '-err'; er.hidden = true; (i.closest('.field') || i.parentNode).appendChild(er); }
    if (i._d0 === undefined) i._d0 = i.getAttribute('aria-describedby') || '';
    if (m) { er.hidden = false; er.innerHTML = ic('alert-triangle') + '<span></span>'; $('span', er).textContent = m; i.setAttribute('aria-invalid', 'true'); i.setAttribute('aria-describedby', (i._d0 + ' ' + id + '-err').trim()); }
    else { er.hidden = true; er.innerHTML = ''; i.removeAttribute('aria-invalid'); if (i._d0) i.setAttribute('aria-describedby', i._d0); else i.removeAttribute('aria-describedby'); }
    var t = i.closest('.tsp-terms'); if (t) t.classList.toggle('is-error', !!$('[aria-invalid="true"]', t));
  }
  function clearErrors(f) {
    $$('[data-rule]', f).forEach(function (i) { setErr(i, ''); });
    var s = $('[data-summary]', f); if (s) s.hidden = true;
  }
  function validateForm(f) {
    var bad = [];
    $$('[data-rule]', f).forEach(function (i) {
      if (i.disabled || i.closest('[hidden]') || i.closest('fieldset:disabled')) return;
      var m = check(i); setErr(i, m); if (m) bad.push({ id: i.id, m: m, el: i });
    });
    var bot = $('[data-bot]', f);
    if (bot && bot.hasAttribute('data-bot-required') && !bot.closest('[hidden]') && bot.getAttribute('data-bot-state') !== 'ok') {
      setBot(bot, 'error'); bad.push({ id: $('[data-bot-btn]', bot).id, m: 'Chưa xác nhận được bạn là người thật. Hãy thử lại hoặc chọn cách khác.', el: $('[data-bot-btn]', bot) });
    }
    var sum = $('[data-summary]', f);
    if (!sum) { sum = document.createElement('div'); sum.className = 'alert alert--danger tsp-summary'; sum.setAttribute('data-summary', ''); sum.setAttribute('role', 'alert'); sum.tabIndex = -1; sum.hidden = true; var host = $('.drawer__body', f) || f; host.insertBefore(sum, host.firstChild); }
    if (bad.length) {
      sum.hidden = false;
      sum.innerHTML = ic('alert-triangle') + '<div class="alert__body"><span class="alert__title">Còn ' + bad.length + ' mục cần sửa trước khi tiếp tục</span><ul>' +
        bad.map(function (x) { return '<li><a href="#' + x.id + '" data-jump="' + x.id + '">' + esc(x.m) + '</a></li>'; }).join('') + '</ul></div>';
      var first = bad[0].el; if (first) { if (first.getAttribute('role') === 'radiogroup') first = $('input', first) || first; first.focus(); }
    } else { sum.hidden = true; sum.innerHTML = ''; }
    return !bad.length;
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-jump]'); if (!a) return; e.preventDefault();
    var el = document.getElementById(a.getAttribute('data-jump')); if (!el) return;
    if (el.getAttribute('role') === 'radiogroup') el = $('input', el) || el; el.focus();
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-ts-form]'); if (!f) return;
    e.preventDefault(); if (f._sending) return;
    var sb = $('[data-submit]', f);
    if (sb && sb.getAttribute('aria-disabled') === 'true') {   /* nút khóa: không gửi, chỉ đưa focus tới lý do */
      var rr = document.getElementById(sb.getAttribute('data-reason-id') || ''); if (rr && !rr.hidden) rr.focus();
      return;
    }
    var keep = main && main.hasAttribute('data-offline-keep');
    if (view === 'offline' && !keep) { toast('warning', 'Chưa có kết nối', 'Kiểm tra mạng rồi thử lại. Thông tin bạn nhập vẫn còn trên màn hình.'); return; }
    if (view === 'r429') return;
    if (!validateForm(f)) return;
    var btn = $('[data-submit]', f);
    f._sending = true; if (btn) btn._sending = true; refreshSubmit();
    setTimeout(function () {
      f._sending = false; if (btn) btn._sending = false;
      if (f.hasAttribute('data-clear-draft')) lsDel('tsu-draft');
      var sv = f.getAttribute('data-success-view');
      var rt = typeof window.tsRoute === 'function' ? window.tsRoute(f) : '';   /* mô phỏng kết quả máy chủ theo giá trị thử */
      if (rt) { if (rt.indexOf('.html') >= 0) safeGo(rt); else { setView(rt); var rf = $('[data-focus-in-' + rt + ']') || $$('[data-alert-focus]').filter(function (x) { return x.offsetParent !== null; })[0]; if (rf) rf.focus(); } refreshSubmit(); return; }
      var sc = f.getAttribute('data-success-close'); if (sc && window.gmepClose) window.gmepClose(document.getElementById(sc));
      if (f.getAttribute('data-success-toast')) { var p = f.getAttribute('data-success-toast').split('|'); toast(p[0], p[1], p[2]); }
      if (sv) { setView(sv); var r = $$('[data-focus-result]').filter(function (x) { return x.offsetParent !== null; })[0]; if (r) r.focus(); }
      else { var nx = f.getAttribute('data-next'); if (nx) setTimeout(function () { safeGo(nx); }, f.getAttribute('data-success-toast') ? 900 : 0); else refreshSubmit(); }
    }, 700);
  });
  document.addEventListener('focusout', function (e) {
    var i = e.target; if (!i.hasAttribute || !i.hasAttribute('data-rule') || i.closest('[data-no-blur]')) return;
    if (i._dirty || String(i.value || '').trim()) setErr(i, check(i));
  });
  function onEdit(e) {
    var i = e.target; if (!i.getAttribute) return;
    if (i.hasAttribute('data-rule')) { i._dirty = true; if (i.getAttribute('aria-invalid') === 'true') setErr(i, check(i)); }
    if (i.type === 'radio' || i.type === 'checkbox') { var g = i.closest('[role="radiogroup"][data-rule]'); if (g && g.getAttribute('aria-invalid') === 'true') setErr(g, check(g)); }
    if (i.hasAttribute('data-pw-policy')) { policy(i); var cf = $('[data-match-of="' + i.id + '"]'); if (cf && cf.value) setErr(cf, check(cf)); }
    if (i.hasAttribute('data-counter-src')) $$('[data-counter-for="' + i.id + '"]').forEach(counter);
    if (i.hasAttribute('data-draft') || i.closest('[data-draft-group]')) saveDraft();
    refreshSubmit();
  }
  document.addEventListener('input', onEdit);
  document.addEventListener('change', onEdit);

  /* ---------- 6. Mật khẩu và bộ đếm ký tự ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-pw-toggle]'); if (!t) return;
    var inp = document.getElementById(t.getAttribute('data-pw-toggle')), show = inp.type === 'password';
    inp.type = show ? 'text' : 'password'; t.setAttribute('aria-pressed', String(show));
    t.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'); $('use', t).setAttribute('href', show ? '#eye-off' : '#eye');
  });
  function policy(inp) {
    var v = inp.value, min = +(inp.getAttribute('data-min') || 10), low = v.toLowerCase();
    /* Điều kiện và thanh độ mạnh chỉ hiện khi bắt đầu gõ; ô trống thì không báo gì (không X đỏ). Mục đạt chuyển xanh dần. */
    var fld = inp.closest('.field');
    if (fld) { $$('.tsp-rules, .tsp-strength-row', fld).forEach(function (x) { x.hidden = !v.length; }); }
    var ok = { len: v.length >= min, common: v.length > 0 && COMMON_PW.indexOf(low) < 0, avoid: v.length > 0 && !avoids(inp, low) };
    $$('.tsp-rules li[data-r]').forEach(function (li) {
      var k = li.getAttribute('data-r'); if (!(k in ok)) return;
      li.classList.toggle('is-ok', ok[k]); $('use', li).setAttribute('href', ok[k] ? '#circle-check' : '#circle-x'); var s = $('.sr-only', li); if (s) s.textContent = ok[k] ? 'Đạt: ' : 'Chưa đạt: ';
    });
    var lvl = !v ? 0 : !(ok.len && ok.common && ok.avoid) ? 1 : (v.length >= 14 || (v.length >= 12 && /[^A-Za-z0-9]/.test(v) && /\d/.test(v))) ? 3 : 2;
    var m = $('.tsp-strength'); if (m) { m.setAttribute('data-level', lvl); var tx = $('[data-strength-text]'); if (tx) tx.textContent = ['Chưa nhập', 'Yếu', 'Trung bình', 'Mạnh'][lvl]; }
  }
  function counter(c) {
    var src = document.getElementById(c.getAttribute('data-counter-for')); if (!src) return;
    c.textContent = src.value.length + '/' + (src.getAttribute('data-max') || src.getAttribute('maxlength') || '');
  }
  document.addEventListener('keyup', function (e) {
    var inp = e.target.closest && e.target.closest('input[type="password"]'); if (!inp || !e.getModifierState) return;
    var w = $('[data-caps]'); if (w) w.hidden = !e.getModifierState('CapsLock');
  });

  /* ---------- 7. Đếm lùi (thời gian thật lấy từ máy chủ; ở đây là số minh họa) ---------- */
  function paintCd(c) { var m = Math.floor(c._left / 60), s = c._left % 60; c.textContent = pad(m) + ':' + pad(s); }
  function initCountdowns() { $$('[data-countdown]').forEach(function (c) { c._left = +c.getAttribute('data-countdown'); paintCd(c); }); }
  setInterval(function () {
    $$('[data-countdown]').forEach(function (c) {
      if (c.offsetParent === null || c._left <= 0) return;
      c._left--; paintCd(c);
      if (c._left === 0) { var v = c.getAttribute('data-countdown-view'); if (v) setView(v); }
    });
  }, 1000);

  /* ---------- 8. Kiểm tra người thật (BotCheckSlot, không chọn nhà cung cấp) ---------- */
  var BOT_TXT = { idle: 'Chưa xác nhận bạn là người thật.', checking: 'Đang kiểm tra…', ok: 'Đã xác nhận bạn là người thật.', error: 'Chưa xác nhận được bạn là người thật. Hãy thử lại hoặc chọn cách khác.' };
  function setBot(el, s) {
    el.setAttribute('data-bot-state', s);
    var t = $('[data-bot-text]', el), u = $('[data-bot-btn]', el), i = $('[data-bot-icon]', el);
    if (t) t.textContent = BOT_TXT[s];
    if (u) { u.hidden = s === 'ok'; u.disabled = s === 'checking'; }
    if (i) i.innerHTML = ic(s === 'ok' ? 'circle-check' : s === 'error' ? 'alert-triangle' : s === 'checking' ? 'loader' : 'info');
    if (s !== 'error') { var er = $('[data-bot-err]', el); if (er) { er.hidden = true; er.textContent = ''; } }
    refreshSubmit();
  }
  document.addEventListener('click', function (e) {
    var bt = e.target.closest('[data-bot-btn]');
    if (bt) { var el = bt.closest('[data-bot]'); setBot(el, 'checking'); setTimeout(function () { setBot(el, 'ok'); }, 700); return; }
    var alt = e.target.closest('[data-bot-alt-toggle]');
    if (alt) { var el2 = alt.closest('[data-bot]'), p = $('[data-bot-alt]', el2), open = p.hidden; p.hidden = !open; alt.setAttribute('aria-expanded', String(open)); if (open) $('input', p).focus(); return; }
    var send = e.target.closest('[data-bot-send]');
    if (send) { toast('info', 'Đã gửi mã xác nhận', 'Mã gồm 6 số đã được gửi qua email (mô phỏng). Nhập mã để tiếp tục.'); return; }
    var cf = e.target.closest('[data-bot-confirm]');
    if (cf) {
      var el3 = cf.closest('[data-bot]'), inp = $('[data-bot-code]', el3), er = $('[data-bot-err]', el3);
      if (!/^\d{6}$/.test(inp.value.trim())) { er.hidden = false; er.textContent = 'Nhập đủ 6 số trong email xác nhận.'; inp.setAttribute('aria-invalid', 'true'); inp.focus(); }
      else { inp.removeAttribute('aria-invalid'); er.hidden = true; $('[data-bot-alt]', el3).hidden = true; setBot(el3, 'ok'); }
    }
  });

  /* ---------- 9. Tệp đính kèm (FileUpload: tải qua máy chủ, mô phỏng) ---------- */
  function sizeTxt(n) { return (n / 1048576).toFixed(1).replace('.', ',') + ' MB'; }
  document.addEventListener('change', function (e) {
    var inp = e.target; if (!inp.matches || !inp.matches('.tsp-up__file-input')) return;
    var up = inp.closest('[data-upload]'), max = +(up.getAttribute('data-max-mb') || 10), mf = +(up.getAttribute('data-max-files') || 3), list = $('[data-files]', up), er = $('[data-up-err]', up), msgs = [];
    Array.prototype.forEach.call(inp.files, function (f) {
      var ext = (f.name.split('.').pop() || '').toLowerCase(), err = '';
      if (['pdf', 'jpg', 'jpeg', 'png'].indexOf(ext) < 0) err = 'Chỉ nhận tệp PDF, JPG hoặc PNG.';
      else if (f.size > max * 1048576) err = 'Tệp lớn hơn ' + max + ' MB. Hãy chọn tệp nhỏ hơn.';
      else if ($$('.tsp-file', list).length >= mf) err = 'Chỉ đính kèm tối đa ' + mf + ' tệp.';
      if (err) { msgs.push(f.name + ': ' + err); return; }
      var li = document.createElement('li'); li.className = 'tsp-file is-uploading';
      li.innerHTML = '<div class="tsp-file__main"><span class="tsp-file__name"></span><span class="tsp-file__meta"></span></div><span class="badge badge--info">Đang tải…</span><button type="button" class="btn-icon" data-file-remove>' + ic('x') + '</button>';
      $('.tsp-file__name', li).textContent = f.name; $('.tsp-file__meta', li).textContent = sizeTxt(f.size);
      $('[data-file-remove]', li).setAttribute('aria-label', 'Xóa tệp ' + f.name);
      list.appendChild(li);
      setTimeout(function () { if (!li.parentNode) return; li.className = 'tsp-file is-done'; $('.badge', li).className = 'badge badge--success'; $('.badge', li).textContent = 'Đã tải lên'; refreshSubmit(); }, 900);
    });
    if (er) { er.hidden = !msgs.length; er.innerHTML = msgs.length ? ic('alert-triangle') + '<span></span>' : ''; if (msgs.length) $('span', er).textContent = msgs.join(' '); }
    inp.value = ''; refreshSubmit();
  });
  document.addEventListener('click', function (e) {
    var rm = e.target.closest('[data-file-remove]');
    if (rm) { var li = rm.closest('.tsp-file'), up = rm.closest('[data-upload]'); li.remove(); var er = $('[data-up-err]', up); if (er) er.hidden = true; var fi = $('.tsp-up__file-input', up); if (fi) fi.focus(); refreshSubmit(); }
    var rt = e.target.closest('[data-file-retry]');
    if (rt) { var l2 = rt.closest('.tsp-file'); l2.className = 'tsp-file is-done'; var bd = $('.badge', l2); if (bd) { bd.className = 'badge badge--success'; bd.textContent = 'Đã tải lên'; } rt.remove(); toast('success', 'Đã tải lại tệp', 'Tệp được tải lên thành công.'); refreshSubmit(); }
  });

  /* ---------- 10. Nháp trong trình duyệt (không lưu mật khẩu) ---------- */
  function readDraft() { try { return JSON.parse(lsGet('tsu-draft') || 'null'); } catch (e) { return null; } }
  function saveDraft() {
    var d = readDraft() || { v: {}, x: {}, t: '' };
    $$('[data-draft]').forEach(function (el) {
      var k = el.name || el.id;
      if (el.type === 'radio') { if (el.checked) { d.v[k] = el.value; d.x[k] = el.getAttribute('data-text') || el.value; } }
      else if (el.tagName === 'SELECT') { d.v[k] = el.value; d.x[k] = el.value ? el.options[el.selectedIndex].text : ''; }
      else { d.v[k] = el.value; d.x[k] = el.value; }
    });
    var n = new Date(); d.t = pad(n.getHours()) + ':' + pad(n.getMinutes());
    lsSet('tsu-draft', JSON.stringify(d));
  }
  function applyDraft(d) {
    $$('[data-draft]').forEach(function (el) {
      var k = el.name || el.id; if (!(k in d.v)) return;
      if (el.type === 'radio') el.checked = el.value === d.v[k]; else el.value = d.v[k];
    });
    refreshSubmit();
  }
  function refreshDraftBanner() {
    var bn = $('[data-draft-banner]'); if (!bn) return;
    var d = readDraft(), show = !bn._dismissed && (view === 'draft' || !!d);
    bn.hidden = !show;
    var t = $('[data-draft-time]', bn); if (t) t.textContent = d && d.t ? d.t : (bn.getAttribute('data-demo-time') || '09:42');
  }
  document.addEventListener('click', function (e) {
    var bn = $('[data-draft-banner]'); if (!bn) return;
    if (e.target.closest('[data-draft-resume]')) {
      var d = readDraft(); if (!d) { try { d = JSON.parse(bn.getAttribute('data-demo')); } catch (x) { d = null; } }
      if (d) applyDraft(d); bn._dismissed = true; bn.hidden = true; toast('success', 'Đã khôi phục bản nháp', 'Mật khẩu không được lưu, bạn cần nhập lại ở bước sau.');
    }
    if (e.target.closest('[data-draft-drop]')) { lsDel('tsu-draft'); bn._dismissed = true; bn.hidden = true; if (view === 'draft') setView(DEF); }
  });
  /* Tóm tắt ở TSU-04 và email che ở TSU-05 */
  function fillSums() {
    var d = readDraft();
    $$('[data-sum]').forEach(function (el) {
      var k = el.getAttribute('data-sum'), v = d && d.x && d.x[k]; el.textContent = v || el.getAttribute('data-sample') || '';
    });
    $$('[data-sum-mask]').forEach(function (el) {
      var v = (d && d.x && d.x[el.getAttribute('data-sum-mask')]) || el.getAttribute('data-sample') || '', p = v.split('@');
      el.textContent = p.length === 2 ? p[0].charAt(0) + '***@' + p[1] : v;
    });
  }

  /* ---------- 11. Khác: sao chép, điền sẵn từ địa chỉ ---------- */
  document.addEventListener('click', function (e) {
    var c = e.target.closest('[data-copy]'); if (!c) return;
    var src = document.getElementById(c.getAttribute('data-copy')), txt = src ? src.textContent.trim() : '';
    try { if (navigator.clipboard) navigator.clipboard.writeText(txt).catch(function () {}); } catch (x) {}
    var lab = $('[data-copy-label]', c), old = lab ? lab.textContent : '';
    if (lab) { lab.textContent = 'Đã sao chép'; setTimeout(function () { lab.textContent = old; }, 2500); }
    toast('success', 'Đã sao chép', txt);
  });

  /* ---------- Khởi động ---------- */
  var q = /[?&]state=([a-z0-9-]+)/.exec(location.search);
  $$('[data-prefill]').forEach(function (el) {
    var m = new RegExp('[?&]' + el.getAttribute('data-prefill') + '=([^&]+)').exec(location.search); if (m) el.value = decodeURIComponent(m[1]);
  });
  fillSums();
  setView(q && $('[data-ts-view="' + q[1] + '"]') ? q[1] : (DEF || 'default'));
  booted = true;
  var dr = readDraft(); if (dr && $('[data-draft-banner]')) refreshDraftBanner();
  var ff = $('[data-first-focus]'); if (ff && ff.offsetParent !== null && !b.hasAttribute('data-no-autofocus')) ff.focus();
})();
