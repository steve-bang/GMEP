/* TSU nhóm D, E, F: khung wizard onboarding, thanh "Xem thử trạng thái", banner trạng thái tenant, kiểm form, hộp thoại wizard.
   Chạy SAU ../../g1-auth-dashboard/g1-shell.js (trang mode "app") và TRƯỚC ../../assets/app.js (app.js gắn dialog, theme, toast).
   Thuộc tính <body>:
     data-tsu-mode  "wizard" | "simple" | "app" (app: dùng khung G1 từ g1-shell.js)
     data-step      0..9 (chỉ wizard)         data-statuses  "done,done,doing,todo,..." (tùy chọn)
     data-nosteps   ẩn danh sách bước          data-common    "1": thêm trạng thái chung (đang tải, lỗi, mất mạng)
     data-top-label / data-top-href  liên kết góc phải (mặc định "Trang chủ" về account/tsu-40.html)
     data-strip     văn bản dải thông tin dưới thanh trên (simple)
   Nội dung trang nằm trong <div id="tsu-content" hidden> (wizard/simple). Chỉ là prototype, không phải code production. */
(function () {
  'use strict';
  var D = document, B = D.body;
  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function ic(n, c) { return '<svg class="icon' + (c ? ' ' + c : '') + '" aria-hidden="true"><use href="#' + n + '"/></svg>'; }
  function list(v) { return (v || '').split(/\s+/).filter(Boolean); }

  var mode = B.getAttribute('data-tsu-mode') || 'app';
  var inOnb = /\/onboarding\//.test(location.pathname);
  var P_ONB = inOnb ? '' : '../onboarding/';
  var P_ACC = inOnb ? '../account/' : '';
  var G1P = '../../g1-auth-dashboard/';
  var T = window.TSU = { first: 'default', dirty: false };

  /* ---------- 9 bước wizard (TSU-21..29) ---------- */
  var STEPS = [
    { n: 'Công ty', t: 'Bắt buộc', req: true, m: 3, f: 'tsu-21.html', why: 'cần có hồ sơ pháp nhân để kích hoạt' },
    { n: 'Chi nhánh đầu tiên', t: 'Bắt buộc', req: true, m: 2, f: 'tsu-22.html', why: 'cần ít nhất một chi nhánh để kích hoạt' },
    { n: 'Kho', t: 'Bắt buộc', req: true, m: 2, f: 'tsu-23.html', why: 'cần ít nhất một kho để kích hoạt' },
    { n: 'Vai trò và mời người dùng', t: 'Nên làm', req: false, m: 5, f: 'tsu-24.html', def: 'chưa mời ai, bạn mời sau trong Cài đặt' },
    { n: 'Dịch vụ và bảng giá mẫu', t: 'Nên làm', req: false, m: 4, f: 'tsu-25.html', def: 'danh mục dịch vụ để trống, bạn thêm sau trong Cài đặt' },
    { n: 'Thuế, đánh số, mẫu in', t: 'Nên làm (có mặc định)', req: false, m: 3, f: 'tsu-26.html', def: 'thuế suất theo danh mục của GMEP, số chứng từ và mẫu in mặc định' },
    { n: 'Nhà cung cấp hóa đơn điện tử', t: 'Bắt buộc chọn một', req: true, m: 4, f: 'tsu-27.html', why: 'cần khai nhà cung cấp hoặc chọn chạy thử' },
    { n: 'Nhập Excel', t: 'Tùy chọn', req: false, m: 10, f: 'tsu-28.html', def: 'chưa nhập dữ liệu, bạn nhập sau ở Hệ thống' },
    { n: 'Kiểm tra trước kích hoạt', t: 'Bắt buộc', req: true, m: 2, f: 'tsu-29.html', why: 'cần có để kích hoạt' }
  ];
  var ST = { done: 'Xong', doing: 'Đang làm', todo: 'Chưa làm', skip: 'Đã bỏ qua', err: 'Có lỗi' };
  T.STEPS = STEPS;
  var statuses = [];
  var step = parseInt(B.getAttribute('data-step') || '0', 10) || 0;
  var nextHref = '', prevHref = '';

  /* ---------- Trạng thái xem thử ---------- */
  var stateItems = [];
  function labelOf(name) { for (var i = 0; i < stateItems.length; i++) if (stateItems[i][0] === name) return stateItems[i][1]; return name; }
  var COMMON_KEYS = ['loading', 'error', 'offline', 'saving'];
  function hit(attr, act) { var l = list(attr); return act.some(function (a) { return l.indexOf(a) >= 0; }); }
  function setState(name, silent) {
    B.setAttribute('data-tsu-state', name);
    var common = COMMON_KEYS.indexOf(name) >= 0;
    if (!common || !T.pageState) T.pageState = common ? T.first : name;
    var act = common ? [name, T.pageState] : [name];
    /* Trạng thái chung (đang tải, lỗi, mất mạng, đang lưu) giữ nguyên trạng thái riêng của trang đang chọn */
    $$('[data-on]').forEach(function (el) { el.hidden = !hit(el.getAttribute('data-on'), act); });
    $$('[data-off]').forEach(function (el) { el.hidden = hit(el.getAttribute('data-off'), act); });
    $$('[data-invalid-on]').forEach(function (el) {
      if (hit(el.getAttribute('data-invalid-on'), act)) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
    });
    $$('[data-disable-in]').forEach(function (el) {
      var on = hit(el.getAttribute('data-disable-in'), [name]);
      if (on) { el.setAttribute('aria-disabled', 'true'); el.classList.add('is-disabled'); } else { el.removeAttribute('aria-disabled'); el.classList.remove('is-disabled'); }
    });
    $$('[data-tsu-set]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-tsu-set') === name)); });
    if (!common) {
      /* data-fill: giá trị điền sẵn; data-blank-in: các trạng thái để trống. data-validate-in (body): trạng thái tự chạy kiểm lỗi */
      $$('[data-fill]').forEach(function (el) { el.value = hit(el.getAttribute('data-blank-in') || '', [name]) ? '' : (hit(el.getAttribute('data-alt-in') || '', [name]) ? el.getAttribute('data-alt') : el.getAttribute('data-fill')); });
      $$('[data-check-in]').forEach(function (el) { el.checked = hit(el.getAttribute('data-check-in'), [name]); });
      $$('[data-rule]').forEach(function (el) { showErr(el, ''); });
      var sm = $('#tsu-summary'); if (sm) sm.remove();
      if (list(B.getAttribute('data-validate-in')).indexOf(name) >= 0) { var er = validateAll(); showSummary(er, true); }
    }
    var lv = $('#tsu-live'); if (lv && !silent) lv.textContent = 'Đang xem trạng thái: ' + labelOf(name);
    D.dispatchEvent(new CustomEvent('tsu:state', { detail: name }));
  }
  T.setState = setState;

  function barHtml(items) {
    return '<div class="tsu-proto" role="group" aria-label="Xem thử trạng thái (prototype)"><span class="tsu-proto__label">Xem thử trạng thái</span><div class="tsu-proto__btns">' +
      items.map(function (it) { return '<button type="button" class="tsu-st" data-tsu-set="' + esc(it[0]) + '" aria-pressed="false">' + esc(it[1]) + '</button>'; }).join('') +
      '</div><span class="tsu-proto__note">Chỉ là prototype: dữ liệu mô phỏng, máy chủ quyết định thật.</span></div><span class="sr-only" role="status" id="tsu-live"></span>';
  }
  function parseSpec(spec) {
    return spec ? spec.split('|').map(function (s) { var i = s.indexOf(':'); return [s.slice(0, i), s.slice(i + 1)]; }) : [];
  }
  var COMMON = [['loading', 'Đang tải'], ['error', 'Lỗi máy chủ'], ['offline', 'Mất mạng']];
  var COMMON_WZ = COMMON.concat([['saving', 'Đang lưu']]);

  /* Khối trạng thái chung: skeleton, lỗi, mất mạng */
  function commonBlocks() {
    return '<div class="tsu-sk" data-on="loading" role="status" aria-label="Đang tải nội dung"><div class="skeleton skeleton--text" style="width:40%"></div><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton skeleton--text" style="width:65%"></div></div>' +
      '<div class="alert alert--danger" role="alert" data-on="error">' + ic('alert-triangle') + '<div class="alert__body"><span class="alert__title">Không tải được nội dung này</span><span>Hệ thống đang gặp sự cố, không phải do bạn. Thông tin bạn đã nhập vẫn được giữ. Thử lại sau ít phút. Nếu vẫn lỗi, báo hỗ trợ kèm mã tham chiếu <span class="code">REQ-4C81D2</span>.</span><div class="alert__actions"><button type="button" class="btn btn--secondary btn--sm" data-tsu-retry>Thử lại</button></div></div></div>' +
      '<div class="alert alert--warning" role="alert" data-on="offline">' + ic('wifi-off') + '<div class="alert__body"><span class="alert__title">Mất kết nối</span><span>Bản nháp được giữ trên thiết bị (lúc 09:42). Chưa thể lưu lên hệ thống cho đến khi có mạng. Đang thử kết nối lại…</span></div></div>';
  }

  /* ---------- Hộp thoại wizard (TSU-31) ---------- */
  function dlg(id, tone, icon, title, body, footer) {
    return '<div class="overlay" id="' + id + '" role="alertdialog" aria-modal="true" aria-labelledby="' + id + '-t" aria-describedby="' + id + '-b"><div class="dialog"><div class="dialog__header"><div class="dialog__icon' + (tone ? ' dialog__icon--' + tone : '') + '">' + ic(icon) + '</div><div><h2 class="dialog__title" id="' + id + '-t">' + title + '</h2></div></div><div class="dialog__body" id="' + id + '-b">' + body + '</div><div class="dialog__footer">' + footer + '</div></div></div>';
  }
  function buildDialogs() {
    var cfg = step > 0 ? STEPS[step - 1] : null;
    var name = esc(cfg ? cfg.n : (B.getAttribute('data-step-name') || 'Dịch vụ và bảng giá mẫu'));
    var def = esc(cfg && cfg.def ? cfg.def : (B.getAttribute('data-skip-default') || 'danh mục dịch vụ để trống, bạn thêm sau trong Cài đặt'));
    var nStep = step > 0 ? step : 5;
    var next = nextHref || (P_ONB + 'tsu-26.html');
    var home = P_ACC + 'tsu-40.html';
    var h =
      dlg('dlg-skip', 'warning', 'undo', 'Bỏ qua bước “' + name + '”?', '<p>Bạn có thể quay lại làm sau. Bước này sẽ hiện trong danh sách việc cần làm ở trang chủ. Nếu bỏ qua, hệ thống dùng thiết lập mặc định: ' + def + '.</p>',
        '<button type="button" class="btn btn--secondary" data-close>Ở lại</button><button type="button" class="btn btn--primary" data-go="' + esc(next) + '">Bỏ qua bước</button>') +
      dlg('dlg-required', 'warning', 'lock', 'Không thể bỏ qua', '<p id="dlg-required-text">Bước này cần có để kích hoạt: ' + esc(cfg && cfg.why ? cfg.why : 'cần có ít nhất một chi nhánh') + '.</p>',
        '<button type="button" class="btn btn--primary" data-close id="dlg-required-btn">Quay lại bước</button>') +
      dlg('dlg-exit', '', 'clock', 'Lưu và thoát?', '<p>Tiến độ đã lưu lúc <span class="num">09:42</span>. Bạn có thể tiếp tục từ bước ' + nStep + ' khi đăng nhập lại.</p>',
        '<button type="button" class="btn btn--secondary" data-close>Ở lại</button><button type="button" class="btn btn--primary" data-go="' + esc(home) + '">Lưu và thoát</button>') +
      dlg('dlg-leave', 'warning', 'pencil', 'Có thay đổi chưa lưu', '<p>Bạn vừa sửa thông tin ở bước này. Lưu nháp trước khi rời đi?</p>',
        '<button type="button" class="btn btn--ghost" data-close>Ở lại</button><button type="button" class="btn btn--secondary" data-go="' + esc(home) + '">Rời không lưu</button><button type="button" class="btn btn--primary" data-go="' + esc(home) + '">Lưu nháp và rời</button>') +
      dlg('dlg-resume', '', 'history', 'Tiếp tục thiết lập?', '<p>Bạn đang dở bước ' + nStep + ' (' + name + '), lưu lúc <span class="num">09:42</span>.</p>',
        '<button type="button" class="btn btn--secondary" data-close data-toast="info|Bắt đầu lại|Prototype: dữ liệu nháp sẽ được xóa sau khi bạn xác nhận ở bước thật.">Bắt đầu lại</button><button type="button" class="btn btn--primary" data-close>Tiếp tục</button>');
    var wrap = D.createElement('div'); wrap.innerHTML = h;
    var ref = null;
    Array.prototype.some.call(B.children, function (c) { if (c.tagName === 'SCRIPT') { ref = c; return true; } return false; });
    while (wrap.firstChild) B.insertBefore(wrap.firstChild, ref);
  }

  /* ---------- Khung wizard / simple ---------- */
  function buildShell() {
    var content = $('#tsu-content');
    var nosteps = B.hasAttribute('data-nosteps') || mode === 'simple';
    var cfg = step > 0 ? STEPS[step - 1] : null;
    var i, s;
    var given = list((B.getAttribute('data-statuses') || '').replace(/,/g, ' '));
    for (i = 0; i < 9; i++) {
      s = given[i] || (step > 0 ? (i < step - 1 ? 'done' : i === step - 1 ? 'doing' : 'todo') : 'todo');
      statuses.push(s);
    }
    nextHref = step >= 1 && step < 9 ? STEPS[step].f : (step === 9 ? 'tsu-30.html' : STEPS[0].f);
    prevHref = step > 1 ? STEPS[step - 2].f : 'tsu-20.html';

    /* Thanh xem thử trạng thái */
    var holder = $('[data-tsu-bar]', content);
    var items = parseSpec(holder ? holder.getAttribute('data-tsu-bar') : '');
    if (!items.length) items = [['default', 'Mặc định']];
    var withCommon = !B.hasAttribute('data-nocommon') && (mode === 'wizard' || B.getAttribute('data-common') === '1');
    if (withCommon) items = items.concat(mode === 'wizard' && !nosteps ? COMMON_WZ : COMMON);
    stateItems = items; T.first = items[0][0];
    if (holder) holder.remove();

    /* Đường đi */
    var topLabel = B.getAttribute('data-top-label') || 'Trang chủ';
    var topHref = B.getAttribute('data-top-href') || (P_ACC + 'tsu-40.html');
    var topIcon = B.getAttribute('data-top-icon') || 'layout-dashboard';

    var top = '<header class="tsu-top"><a class="tsu-brand" href="' + esc(P_ACC + 'tsu-40.html') + '"><span class="tsu-brand__logo" aria-hidden="true">' + ic('wrench') + '</span><span>GARAGE OS</span></a><span class="tsu-top__sp"></span>' +
      '<a class="btn btn--ghost btn--sm tsu-top__home" href="' + esc(topHref) + '" data-tsu-home aria-label="' + esc(topLabel) + '">' + ic(topIcon) + '<span class="tsu-top__homelabel">' + esc(topLabel) + '</span></a>' +
      '<button type="button" class="btn-icon" data-theme-toggle aria-label="Đổi giao diện sáng hoặc tối">' + ic('moon') + '</button></header>';

    var stripTxt = B.getAttribute('data-strip');
    var strip = '';
    if (mode === 'wizard' && !B.hasAttribute('data-nostrip')) {
      strip = '<div class="tsu-strip"><div class="tsu-strip__txt" role="status">' + ic('info', 'icon--sm') + '<span>Bạn đang trong giai đoạn thiết lập. Hóa đơn điện tử chạy thử và dữ liệu thử có thể xóa.</span></div>' +
        '<div class="tsu-draft" role="status" aria-live="polite">' +
        '<span class="tsu-draft__ok" data-off="saving offline error">' + ic('circle-check', 'icon--sm') + ' Đã lưu nháp lúc <span class="num">09:42</span></span>' +
        '<span data-on="saving">' + ic('loader', 'icon--sm') + ' Đang lưu…</span>' +
        '<span class="tsu-draft--bad" data-on="offline">' + ic('wifi-off', 'icon--sm') + ' Chưa lưu lên máy chủ, nháp giữ trên thiết bị</span>' +
        '<span class="tsu-draft--bad" data-on="error">' + ic('alert-triangle', 'icon--sm') + ' Chưa lưu được, thử lại</span></div></div>';
    } else if (stripTxt) {
      strip = '<div class="tsu-strip"><div class="tsu-strip__txt" role="status">' + ic('info', 'icon--sm') + '<span>' + esc(stripTxt) + '</span></div></div>';
    }

    /* Danh sách bước */
    var stepsHtml = '';
    if (!nosteps) {
      var frontier = 9;
      for (i = 0; i < 9; i++) { if (statuses[i] !== 'done' && statuses[i] !== 'skip') { frontier = i; break; } }
      var doneN = statuses.filter(function (x) { return x === 'done' || x === 'skip'; }).length;
      var lis = STEPS.map(function (st, k) {
        var s2 = statuses[k];
        var num = s2 === 'done' ? ic('check') : s2 === 'err' ? ic('alert-triangle') : s2 === 'skip' ? ic('minus') : String(k + 1);
        var locked = k > frontier;
        var meta = st.t + ' · ' + ST[s2] + ' · ' + st.m + ' phút (minh họa)';
        var inner = '<span class="tsu-step__num" aria-hidden="true">' + num + '</span><span class="tsu-step__txt"><span class="tsu-step__name">' + (k + 1) + '. ' + st.n + (st.req ? '<span class="tsu-req" aria-hidden="true">*</span>' : '') + '</span><span class="tsu-step__meta">' + (locked ? st.t + ' · Hoàn tất hoặc bỏ qua bước trước' : meta) + '</span></span>';
        var cur = (k === step - 1) ? ' aria-current="step"' : '';
        var el = locked
          ? '<button type="button" class="tsu-step__link" aria-disabled="true" data-lock="' + k + '" data-open="dlg-required">' + inner + '</button>'
          : '<a class="tsu-step__link" href="' + st.f + '"' + cur + '>' + inner + '</a>';
        return '<li class="tsu-step is-' + s2 + '">' + el + '</li>';
      }).join('');
      var label = step > 0 ? 'Bước ' + step + '/9 · ' + STEPS[step - 1].n : 'Lộ trình 9 bước';
      stepsHtml = '<nav class="tsu-steps" aria-label="Các bước thiết lập"><button type="button" class="tsu-steps__toggle" aria-expanded="false" aria-controls="tsu-steps-list"><span>' + label + '</span>' + ic('chevron-down') + '</button>' +
        '<ol class="tsu-steps__list" id="tsu-steps-list">' + lis + '</ol>' +
        '<div class="progress tsu-steps__prog"><div class="progress__head"><span>Tiến độ thiết lập</span><span>' + doneN + '/9 bước</span></div><div class="progress__track" aria-hidden="true"><div class="progress__bar" style="width:' + Math.round(doneN / 9 * 100) + '%"></div></div></div>' +
        '<p class="tsu-sub" style="margin:var(--space-3) 0 0"><span class="tsu-req" aria-hidden="true">*</span> Bước bắt buộc để kích hoạt</p></nav>';
    }

    /* Đầu trang + nội dung */
    var head = '';
    if (cfg) {
      head = '<div class="tsu-head"><h1 id="tsu-h1" tabindex="-1">Bước ' + step + '/9: ' + esc(cfg.n) + '</h1><div class="tsu-head__tags"><span class="badge badge--' + labClass(cfg.t) + ' badge--nodot">' + esc(cfg.t) + '</span><span class="tsu-sub">Khoảng ' + cfg.m + ' phút (minh họa)</span></div></div>';
    }

    /* Chân trang dính */
    var foot = '';
    var custom = $('[data-tsu-foot]', content);
    if (custom) { custom.parentNode.removeChild(custom); foot = custom.outerHTML; }
    else if (step >= 1 && step <= 8) {
      var skip = !cfg.req ? '<button type="button" class="btn btn--secondary" data-open="dlg-skip" data-disable-in="loading saving">Bỏ qua bước này</button>' : '';
      foot = '<div class="tsu-foot" role="group" aria-label="Điều hướng bước"><a class="btn btn--secondary" href="' + prevHref + '">Quay lại</a>' +
        '<button type="button" class="btn btn--ghost" data-open="dlg-exit">Lưu nháp và thoát</button><span class="tsu-foot__sp"></span>' + skip +
        '<button type="button" class="btn btn--primary tsu-foot__primary" data-tsu-next data-disable-in="offline loading saving"><span>Lưu và tiếp tục</span></button>' +
        '<p class="tsu-foot__reason" data-on="offline">' + ic('wifi-off', 'icon--sm') + 'Đang mất kết nối: thao tác này cần mạng. Nháp được giữ trên thiết bị.</p></div>';
    }

    var tmp = D.createElement('div'); tmp.innerHTML = content.innerHTML;
    var bodyNodes = tmp.innerHTML;
    var barBlock = barHtml(items);
    var shell = '<div class="tsu-wz">' + top + strip +
      '<div class="tsu-wz__body' + (nosteps ? ' tsu-wz__body--simple' : '') + '">' + stepsHtml +
      '<main class="tsu-wz__main" id="main" tabindex="-1"><div class="tsu-wz__content">' + barBlock + (withCommon ? commonBlocks() : '') + '<div class="tsu-body"' + (withCommon ? ' data-off="loading error"' : '') + '>' + head + bodyNodes + '</div></div>' + foot + '</main></div></div>';
    var root = D.createElement('div'); root.innerHTML = shell;
    var skipLink = D.createElement('a'); skipLink.className = 'skip-link'; skipLink.href = '#main'; skipLink.textContent = 'Bỏ qua điều hướng, tới nội dung chính';
    B.insertBefore(root.firstChild, B.firstChild); B.insertBefore(skipLink, B.firstChild);
    content.remove();
    /* Overlay trong nội dung chuyển ra body để app.js đặt inert đúng */
    var ref = null;
    Array.prototype.some.call(B.children, function (c) { if (c.tagName === 'SCRIPT') { ref = c; return true; } return false; });
    $$('.tsu-wz .overlay').forEach(function (o) { B.insertBefore(o, ref); });
  }

  /* ---------- Chế độ app (khung G1) ---------- */
  function buildApp() {
    var inner = $('#g1-inner');
    var bs = $('[data-tsu-banners]');
    if (bs && inner) {
      bs.classList.add('tsu-banner-stack');
      inner.insertBefore(bs, inner.children[1] || null);
    }
    var holder = $('[data-tsu-bar]');
    var items = parseSpec(holder ? holder.getAttribute('data-tsu-bar') : '');
    if (!items.length) items = [['default', 'Mặc định']];
    if (B.getAttribute('data-common') === '1') items = items.concat(COMMON);
    stateItems = items; T.first = items[0][0];
    if (holder) { holder.insertAdjacentHTML('afterend', barHtml(items)); holder.remove(); }
    var main = $('[data-tsu-main]');
    if (main && B.getAttribute('data-common') === '1') {
      main.classList.add('tsu-body'); main.setAttribute('data-off', 'loading error');
      var w = D.createElement('div'); w.className = 'tsu-stack'; w.innerHTML = commonBlocks();
      main.parentNode.insertBefore(w, main);
    }
    /* Liên kết sang trang G1 từ thư mục tenant-signup/... */
    $$('a[href^="g1-"]').forEach(function (a) { a.setAttribute('href', G1P + a.getAttribute('href')); });
  }

  /* ---------- Banner trạng thái tenant (TSU-50) ---------- */
  var BAN = {
    'BAN-01': { lv: 'info', role: 'status', icon: 'info', close: true, t: 'Bạn đang trong giai đoạn thiết lập. Hóa đơn điện tử chạy thử và dữ liệu thử có thể xóa.', b: ['Tiếp tục thiết lập', P_ONB + 'tsu-20.html'], lab: 'Thông tin' },
    'BAN-02': { lv: 'warning', role: 'status', icon: 'clock', t: 'Dùng thử còn {n} ngày (hết hạn {date}). Dữ liệu của bạn không bị xóa khi hết dùng thử.', b: ['Xem gói', P_ACC + 'tsu-41.html'], lab: 'Cảnh báo' },
    'BAN-03': { lv: 'warning', role: 'alert', icon: 'alert-triangle', t: 'Dùng thử đã hết. Bạn vẫn xem được dữ liệu, tải hóa đơn và hoàn tất các lệnh đang mở. Chọn gói để tiếp tục tạo mới.', tNV: 'Dùng thử của công ty đã hết. Liên hệ chủ garage.', b: ['Chọn gói', P_ACC + 'tsu-42.html'], onlyCH: true, lab: 'Cảnh báo' },
    'BAN-04': { lv: 'warning', role: 'status', icon: 'alert-triangle', t: 'Khoản phí kỳ {period} quá hạn từ {date}. Công ty được tiếp tục dùng đến {grace}.', b: ['Xem chi tiết', P_ACC + 'tsu-41.html'], lab: 'Cảnh báo (giữ chỗ B2)' },
    'BAN-05': { lv: 'warning', role: 'alert', icon: 'alert-triangle', t: 'Tài khoản đang bị hạn chế: {reason}. Bạn vẫn thu tiền, giao xe và hoàn tất lệnh đang mở; chưa thể tạo mới {list}.', tNV: 'Công ty đang bị hạn chế tạo mới. Việc đang làm vẫn hoàn tất được.', b: ['Xem lý do', '#', 'info|Lý do hạn chế|Lý do chọn từ danh mục hiển thị cho tenant (TSU-66 mở rộng), không nêu chi tiết an ninh.'], bNV: ['Liên hệ chủ garage', '#', 'info|Liên hệ chủ garage|Hãy báo cho chủ garage của công ty bạn.'], lab: 'Hạn chế' },
    'BAN-06': { lv: 'warning', role: 'status', icon: 'alert-triangle', t: 'Bạn đã dùng {x}/{y} chi nhánh ({p}%).', b: ['Xem gói', P_ACC + 'tsu-41.html'], lab: 'Cảnh báo' },
    'BAN-07': { lv: 'danger', role: 'alert', icon: 'lock', t: 'Tài khoản đang tạm ngưng. Bạn chỉ xem và tải dữ liệu được.', b: ['Xuất dữ liệu', P_ACC + 'tsu-55.html'], onlyBtnCH: true, lab: 'Chặn' },
    'BAN-08': { lv: 'danger', role: 'alert', icon: 'lock', t: 'Dịch vụ đang trong giai đoạn chấm dứt. Hãy tải dữ liệu trước {date}.', b: ['Xuất dữ liệu', P_ACC + 'tsu-55.html'], lab: 'Chặn' },
    'BAN-09': { lv: 'warning', role: 'status', icon: 'file-text', t: 'Điều khoản dịch vụ phiên bản {v} có hiệu lực từ {date}. Hãy đọc và đồng ý.', b: ['Đọc và đồng ý', '#', 'info|Điều khoản mới|Mở màn TSU-18 (gói đăng ký, nhóm C) để chấp nhận phiên bản mới.'], lab: 'Cảnh báo' },
    'BAN-10': { lv: 'info', role: 'status', icon: 'info', close: true, t: 'Hóa đơn thật chưa dùng được vì doanh nghiệp chưa hoàn tất xác minh.', b: ['Xem trạng thái', '#', 'info|Trạng thái xác minh|Mở màn theo dõi xác minh (TSU-08, gói đăng ký).'], lab: 'Thông tin' }
  };
  var BDEF = { n: '9', date: '14/11/2026', period: '10/2026', grace: '21/11/2026', reason: 'Quá hạn thanh toán', list: 'lệnh sửa chữa, chi nhánh và người dùng', x: '8', y: '10', p: '80', v: '1.2' };
  function renderBanner(el) {
    var code = el.getAttribute('data-tsu-banner'), d = BAN[code]; if (!d) return;
    var nv = el.getAttribute('data-view') === 'NV';
    var vars = {}; Object.keys(BDEF).forEach(function (k) { vars[k] = el.getAttribute('data-' + k) || BDEF[k]; });
    var txt = (nv && d.tNV) ? d.tNV : d.t;
    txt = txt.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined ? '<span class="num">' + esc(vars[k]) + '</span>' : m; });
    var b = (nv && d.bNV) ? d.bNV : d.b;
    var showBtn = !(nv && (d.onlyCH || d.onlyBtnCH)) && !(nv && d.tNV && !d.bNV && d.onlyCH);
    var btn = '';
    if (showBtn && b) btn = '<a class="btn btn--secondary btn--sm" href="' + esc(b[0] === 'Xuất dữ liệu' || b[1] !== '#' ? b[1] : '#') + '"' + (b[2] ? ' data-toast="' + esc(b[2]) + '"' : '') + '>' + esc(b[0]) + '</a>';
    var close = d.close ? '<button type="button" class="btn-icon" data-tsu-close aria-label="Đóng thông báo">' + ic('x') + '</button>' : '';
    var out = D.createElement('div');
    out.className = 'alert alert--' + d.lv + ' tsu-banner';
    out.setAttribute('role', d.role); out.setAttribute('data-code', code);
    ['data-on', 'data-off'].forEach(function (a) { if (el.hasAttribute(a)) out.setAttribute(a, el.getAttribute(a)); });
    out.innerHTML = ic(d.icon) + '<div class="alert__body"><span><strong class="tsu-bancode">' + esc(d.lab) + ' · ' + code + '.</strong> ' + txt + '</span></div><div class="tsu-banner__act">' + btn + close + '</div>';
    el.parentNode.replaceChild(out, el);
  }
  T.banners = BAN;

  /* ---------- Kiểm form (V-xx trong spec) ---------- */
  var FMT = {
    phone: function (v) { return /^(0\d{9}|\+84\d{9})$/.test(v.replace(/[\s.\-]/g, '')); },
    email: function (v) { return v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }
  };
  function fieldMsg(inp) {
    var rules = list((inp.getAttribute('data-rule') || '').replace(/,/g, ' '));
    var v = (inp.value || '').trim(), label = inp.getAttribute('data-label') || 'thông tin này';
    if (rules.indexOf('req') >= 0 && !v) return inp.getAttribute('data-msg-req') || ('Vui lòng nhập ' + label + '.');
    if (!v) return '';
    if (rules.indexOf('phone') >= 0 && !FMT.phone(v)) return 'Số điện thoại chưa đúng. Nhập 10 số bắt đầu bằng 0, ví dụ 0912 345 678.';
    if (rules.indexOf('email') >= 0 && !FMT.email(v)) return 'Email chưa đúng định dạng. Ví dụ: ten@congty.vn.';
    var mn = parseInt(inp.getAttribute('data-min') || '0', 10), mx = parseInt(inp.getAttribute('data-max') || '0', 10);
    if ((mn && v.length < mn) || (mx && v.length > mx)) return inp.getAttribute('data-msg-fmt') || (label.charAt(0).toUpperCase() + label.slice(1) + ' cần từ ' + mn + ' đến ' + mx + ' ký tự.');
    var eq = inp.getAttribute('data-equals');
    if (eq && v !== eq) return inp.getAttribute('data-msg-eq') || 'Giá trị chưa khớp.';
    var md = inp.getAttribute('data-mindate');
    if (md) {
      var pm = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v), pn = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(md);
      if (!pm) return 'Nhập ngày theo dạng dd/MM/yyyy. Ví dụ: 31/12/2026.';
      if (pn && new Date(+pm[3], +pm[2] - 1, +pm[1]) < new Date(+pn[3], +pn[2] - 1, +pn[1])) return 'Ngày không được trước ' + md + '.';
    }
    var pat = inp.getAttribute('data-pattern');
    if (pat && !new RegExp(pat).test(v)) return inp.getAttribute('data-msg-fmt') || 'Giá trị chưa đúng định dạng.';
    return '';
  }
  function showErr(inp, msg) {
    var f = inp.closest('.field'); if (!f) return;
    if (!inp.id) inp.id = 'f' + Math.random().toString(36).slice(2, 7);
    var er = $('.field__error[data-auto]', f);
    var desc = list(inp.getAttribute('aria-describedby'));
    if (msg) {
      if (!er) { er = D.createElement('span'); er.className = 'field__error'; er.id = inp.id + '-err'; er.setAttribute('data-auto', ''); f.appendChild(er); }
      er.innerHTML = ic('alert-triangle') + '<span></span>'; er.lastChild.textContent = msg;
      inp.setAttribute('aria-invalid', 'true');
      if (desc.indexOf(er.id) < 0) { desc.push(er.id); inp.setAttribute('aria-describedby', desc.join(' ')); }
    } else {
      if (er) { desc = desc.filter(function (x) { return x !== er.id; }); er.remove(); if (desc.length) inp.setAttribute('aria-describedby', desc.join(' ')); else inp.removeAttribute('aria-describedby'); }
      if (!inp.hasAttribute('data-invalid-on')) inp.removeAttribute('aria-invalid');
    }
  }
  function visible(el) { return !el.closest('[hidden]') && el.offsetParent !== null; }
  function validateAll() {
    var errs = [];
    $$('[data-rule]').forEach(function (inp) {
      if (!visible(inp) || inp.disabled || inp.readOnly) return;
      var m = fieldMsg(inp); showErr(inp, m);
      if (m) errs.push({ inp: inp, msg: m });
    });
    return errs;
  }
  function showSummary(errs, quiet) {
    var s = $('#tsu-summary');
    if (!errs.length) { if (s) s.remove(); return; }
    if (!s) {
      s = D.createElement('div'); s.id = 'tsu-summary'; s.className = 'alert alert--danger'; s.setAttribute('role', 'alert'); s.tabIndex = -1;
      var host = $('.tsu-body') || $('[data-tsu-main]') || $('main');
      var head = $('.tsu-head', host);
      if (head && head.nextSibling) host.insertBefore(s, head.nextSibling); else host.insertBefore(s, host.firstChild);
    }
    s.innerHTML = ic('alert-triangle') + '<div class="alert__body"><span class="alert__title">Có ' + errs.length + ' mục cần sửa trước khi lưu</span><ul class="tsu-sum">' +
      errs.map(function (e) { return '<li><a href="#' + e.inp.id + '" data-tsu-jump="' + e.inp.id + '">' + esc(e.inp.getAttribute('data-label') || 'Thông tin') + '</a>: ' + esc(e.msg) + '</li>'; }).join('') + '</ul></div>';
    if (!quiet) s.focus();
  }
  T.validate = function () { var e = validateAll(); showSummary(e); if (e.length) { e[0].inp.focus(); } return e.length === 0; };

  /* ---------- Sự kiện ---------- */
  D.addEventListener('click', function (e) {
    var dis = e.target.closest('[data-disable-in][aria-disabled="true"]');
    if (dis) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  D.addEventListener('click', function (e) {
    var t = e.target;
    var set = t.closest('[data-tsu-set]'); if (set) { setState(set.getAttribute('data-tsu-set')); return; }
    var gs = t.closest('[data-tsu-go]'); if (gs) { setState(gs.getAttribute('data-tsu-go')); return; }
    if (t.closest('[data-tsu-retry]')) { setState(T.first); return; }
    var tg = t.closest('.tsu-steps__toggle');
    if (tg) { var nav = tg.closest('.tsu-steps'); var on = nav.classList.toggle('is-open'); tg.setAttribute('aria-expanded', String(on)); return; }
    var cl = t.closest('[data-tsu-close]'); if (cl) { var bn = cl.closest('.tsu-banner'); if (bn) bn.hidden = true; return; }
    var j = t.closest('[data-tsu-jump]'); if (j) { e.preventDefault(); var f = D.getElementById(j.getAttribute('data-tsu-jump')); if (f) f.focus(); return; }
    var lk = t.closest('[data-lock]');
    if (lk) {
      var idx = parseInt(lk.getAttribute('data-lock'), 10), pend = -1, req = -1, k;
      for (k = 0; k < idx; k++) { if (statuses[k] !== 'done' && statuses[k] !== 'skip') { if (pend < 0) pend = k; if (STEPS[k].req && req < 0) req = k; } }
      var tt = $('#dlg-required-t'), tx = $('#dlg-required-text'), bt = $('#dlg-required-btn');
      var pick = req >= 0 ? req : pend;
      if (pick >= 0) {
        tt.textContent = req >= 0 ? 'Không thể bỏ qua' : 'Chưa mở được bước này';
        tx.textContent = req >= 0 ? 'Bước “' + STEPS[req].n + '” cần có để kích hoạt: ' + STEPS[req].why + '.' : 'Hãy hoàn tất hoặc bỏ qua bước “' + STEPS[pend].n + '” trước khi sang bước này.';
        bt.setAttribute('data-go', STEPS[pick].f); bt.textContent = 'Quay lại bước ' + (pick + 1);
      }
      return;
    }
    var home = t.closest('[data-tsu-home]');
    if (home && mode === 'wizard' && T.dirty && window.gmepOpen) { e.preventDefault(); window.gmepOpen('dlg-leave'); return; }
    var go = t.closest('[data-go]'); if (go) { location.href = go.getAttribute('data-go'); return; }
    var nx = t.closest('[data-tsu-next]');
    if (nx) {
      e.preventDefault();
      if (!nx.hasAttribute('data-no-validate') && !T.validate()) return;
      var dest = nx.getAttribute('data-href') || nextHref;
      setState('saving'); setTimeout(function () { location.href = dest; }, 700);
    }
  });
  D.addEventListener('focusout', function (e) {
    var inp = e.target; if (inp && inp.matches && inp.matches('[data-rule]') && visible(inp)) showErr(inp, fieldMsg(inp));
  });
  D.addEventListener('input', function (e) {
    var inp = e.target; T.dirty = true;
    if (inp && inp.matches && inp.matches('[data-rule][aria-invalid="true"]')) showErr(inp, fieldMsg(inp));
  });

  /* ---------- OnboardingChecklist (dùng ở TSU-20, 29, 30, 40) ---------- */
  function labClass(t) { return t.indexOf('Bắt buộc') === 0 ? 'warning' : t.indexOf('Nên') === 0 ? 'info' : 'neutral'; }
  var ACT = { todo: 'Bắt đầu', doing: 'Tiếp tục', done: 'Xem lại', skip: 'Làm bước này', err: 'Sửa lỗi' };
  T.checklist = function (sts, o) {
    o = o || {};
    var out = STEPS.map(function (st, k) {
      var s = sts[k] || 'todo';
      if (o.pendingOnly && (s === 'done')) return '';
      var icon = s === 'done' ? ic('check') : s === 'err' ? ic('alert-triangle') : s === 'skip' ? ic('minus') : s === 'doing' ? ic('pencil') : String(k + 1);
      var href = (o.base !== undefined ? o.base : P_ONB) + st.f;
      var act = o.noAct ? '' : '<div class="tsu-cl__act"><a class="btn btn--secondary btn--sm" href="' + href + '" aria-label="' + ACT[s] + ' bước ' + (k + 1) + ': ' + esc(st.n) + '">' + ACT[s] + '</a>' + (o.hide && st.t === 'Tùy chọn' ? '<button type="button" class="btn btn--ghost btn--sm" data-toast="info|Đã ẩn mục này|Mục này không còn hiện ở trang chủ của bạn. Mục bắt buộc không ẩn được." aria-label="Ẩn cho tôi bước ' + (k + 1) + ': ' + esc(st.n) + '">Ẩn cho tôi</button>' : '') + '</div>';
      return '<li class="tsu-cl__item is-' + s + '"><span class="tsu-cl__ic" aria-hidden="true">' + icon + '</span><div class="tsu-cl__main"><span class="tsu-cl__name">' + (k + 1) + '. ' + esc(st.n) + (st.req ? '<span class="tsu-req" aria-hidden="true">*</span>' : '') + '</span><span class="tsu-cl__meta"><span class="badge badge--' + labClass(st.t) + ' badge--nodot">' + esc(st.t) + '</span><span>' + ST[s] + '</span><span>· ' + st.m + ' phút (minh họa)</span></span></div>' + act + '</li>';
    }).join('');
    return '<ol class="tsu-cl">' + out + '</ol>';
  };

  /* ---------- Khởi động ---------- */
  if (mode === 'wizard' || mode === 'simple') { buildShell(); if (mode === 'wizard' || B.hasAttribute('data-tsu-dialogs')) buildDialogs(); }
  else { buildApp(); if (B.hasAttribute('data-tsu-dialogs')) buildDialogs(); }
  $$('[data-tsu-banner]').forEach(renderBanner);
  var h = /state=([\w-]+)/.exec(location.hash || '');
  var init = (h && stateItems.some(function (i) { return i[0] === h[1]; })) ? h[1] : T.first;
  if (stateItems.length) setState(init, true);
  D.addEventListener('DOMContentLoaded', function () { if (stateItems.length) setState(init, true); });
})();
