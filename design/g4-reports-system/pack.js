/* Gói 6 – G4-RPT & G4-SYS. Prototype: ghép Application Shell + tiện ích dùng chung cho 35 màn hình.
   Dùng document.write trong khi trình duyệt đang phân tích trang để mỗi file .html chỉ giữ nội dung nghiệp vụ.
   Sản phẩm thật dùng component shell của framework đã chọn; cấu trúc DOM/class giữ đúng design/foundation/shell.html. */
(function () {
  'use strict';
  var script = document.currentScript;
  var CFG = {
    code: script.getAttribute('data-code') || '',
    menu: script.getAttribute('data-menu') || 'rpt',
    crumbs: (script.getAttribute('data-crumbs') || '').split('|'),
    allow: (script.getAttribute('data-allow') || '').split(' ').filter(Boolean),
    own: (script.getAttribute('data-own') || '').split(' ').filter(Boolean)
  };
  window.G4R_CFG = CFG;

  var ROLE_NAME = { CH: 'Chủ garage', QV: 'Quản lý vùng', QL: 'Quản lý chi nhánh', CV: 'Cố vấn dịch vụ', QD: 'Quản đốc', TH: 'Thợ', TK: 'Thủ kho', TN: 'Thu ngân', KT: 'Kế toán', AD: 'Quản trị hệ thống' };

  /* ---------- Danh mục màn hình (dùng cho điều hướng cài đặt, index) ---------- */
  var SYS_GROUPS = [
    ['Người dùng và phân quyền', ['01', '02', '03', '04', '24']],
    ['Tổ chức', ['05', '06', '15']],
    ['Danh mục, giá và thuế', ['07', '08', '09', '10', '11']],
    ['Mẫu và quy trình', ['12', '13', '14']],
    ['Tích hợp', ['16', '17', '18']],
    ['Dữ liệu và an toàn', ['19', '20', '21', '22', '23']]
  ];
  var SYS_NAMES = {
    '01': 'Người dùng', '02': 'Mời / sửa người dùng', '03': 'Chi tiết người dùng và phiên', '04': 'Vai trò và quyền', '05': 'Cơ cấu tổ chức', '06': 'Cấu hình chi nhánh',
    '07': 'Dịch vụ, giờ chuẩn, đơn giá', '08': 'Gói bảo dưỡng định kỳ', '09': 'Hạn mức giảm giá', '10': 'Thuế suất', '11': 'Chu kỳ nhắc đăng kiểm / bảo dưỡng',
    '12': 'Mẫu chứng từ, mẫu in', '13': 'Quy trình theo loại dịch vụ', '14': 'Mẫu checklist QC', '15': 'Danh mục dùng chung', '16': 'Tích hợp hóa đơn điện tử',
    '17': 'Tích hợp SMS, Zalo, email', '18': 'API và khóa tích hợp', '19': 'Nhật ký thao tác', '20': 'Nhập dữ liệu từ Excel', '21': 'Lịch sử lô nhập', '22': 'Sao lưu và khôi phục',
    '23': 'Chính sách lưu trữ', '24': 'Bảo mật và phiên'
  };

  function ico(id, cls) { return '<svg class="icon' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#' + id + '"/></svg>'; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

  /* ---------- Shell (khớp design/foundation/shell.html) ---------- */
  function navItem(menu, icon, label, href, extra) {
    var cur = CFG.menu === menu ? ' aria-current="page"' : '';
    return '<a class="nav-item" href="' + href + '" data-menu="' + menu + '"' + cur + ' title="' + label + '">' + ico(icon) + '<span class="nav-item__label">' + label + '</span>' + (extra || '') + '</a>';
  }
  var roleItems = Object.keys(ROLE_NAME).map(function (k) {
    return '<button class="menu-item" role="menuitemradio" data-keep-open data-role-switch="' + k + '" data-role-name="' + ROLE_NAME[k] + '" aria-checked="false">' + ROLE_NAME[k] + '</button>';
  }).join('');

  function shellStart() {
    var crumbs = CFG.crumbs.map(function (c, i) {
      if (i === CFG.crumbs.length - 1) return '<span aria-current="page">' + c + '</span>';
      return '<a href="' + (i === 0 && CFG.menu === 'rpt' ? 'g4-rpt-01.html' : (i === 0 && CFG.menu === 'set' ? 'g4-sys-01.html' : '#')) + '">' + c + '</a>' + ico('chevron-right');
    }).join('');
    return [
      '<a class="skip-link" href="#main">Bỏ qua điều hướng, tới nội dung chính</a>',
      '<div class="app" id="app">',
      '<aside class="sidebar" aria-label="Điều hướng chính"><div class="sidebar__brand"><span class="sidebar__logo" aria-hidden="true">' + ico('wrench') + '</span><span class="sidebar__brand-name">GARAGE OS</span><button class="btn-icon menu-btn" data-nav-close aria-label="Đóng menu" style="margin-left:auto">' + ico('x') + '</button></div>',
      '<nav class="sidebar__nav"><div class="sidebar__group">Workspace</div>',
      navItem('dash', 'layout-dashboard', 'Tổng quan', '#'),
      navItem('ro', 'clipboard-list', 'Phiếu sửa chữa', '#'),
      navItem('appt', 'calendar', 'Lịch hẹn', '#'),
      navItem('cust', 'car-front', 'Khách hàng &amp; Xe', '#'),
      '<div class="sidebar__group">Kho &amp; mua hàng</div>',
      navItem('inv', 'warehouse', 'Kho phụ tùng', '#'),
      navItem('pur', 'shopping-cart', 'Mua hàng', '#'),
      '<div class="sidebar__group">Nhân sự &amp; tài chính</div>',
      navItem('hr', 'id-card', 'Nhân sự &amp; Công thợ', '#'),
      navItem('fin', 'wallet', 'Tài chính', '#'),
      navItem('einv', 'receipt', 'Hóa đơn', '#'),
      '<div class="sidebar__group">Phân tích</div>',
      navItem('rpt', 'chart-no-axes-combined', 'Báo cáo', 'g4-rpt-01.html'),
      '</nav><div class="sidebar__footer">',
      navItem('set', 'settings', 'Cài đặt', 'g4-sys-01.html'),
      '<button class="nav-item collapse-btn" data-sidebar-toggle aria-expanded="true" aria-label="Thu gọn thanh bên" style="width:100%" title="Thu gọn / mở rộng">' + ico('panel-left') + '<span class="nav-item__label">Thu gọn</span></button></div></aside>',
      '<div class="drawer-nav-backdrop" data-nav-close></div>',
      '<header class="topbar"><button class="btn-icon menu-btn" data-nav-open aria-label="Mở menu">' + ico('menu') + '</button>',
      '<div class="branch-static" data-branch-static hidden>' + ico('map-pin') + '<span class="branch-static__text"><span class="branch-btn__caption">Chi nhánh của bạn</span><span class="branch-btn__name" data-static-label>Chi nhánh Quận 7</span></span></div>',
      '<div class="dropdown" data-branch-dropdown><button class="branch-btn is-all" aria-haspopup="menu" aria-expanded="false" aria-label="Chọn phạm vi chi nhánh">' + ico('map-pin') + '<span class="branch-btn__text"><span class="branch-btn__caption">Phạm vi dữ liệu</span><span class="branch-btn__name" data-branch-label>Tất cả chi nhánh</span></span>' + ico('chevron-down', 'icon--sm') + '</button>',
      '<div class="dropdown__menu" role="menu" style="min-width:320px">',
      '<div class="menu-label" data-show-roles="CH QV">Hợp nhất</div>',
      '<button class="menu-item" role="menuitemradio" aria-checked="true" data-level="all" data-branch="Tất cả chi nhánh" data-branch-all data-show-roles="CH">' + ico('layout-dashboard') + 'Tất cả chi nhánh<span class="menu-item__hint">toàn chuỗi</span></button>',
      '<button class="menu-item" role="menuitemradio" aria-checked="false" data-level="all" data-branch="Tất cả nhóm được giao" data-branch-all data-show-roles="QV" hidden>' + ico('layout-dashboard') + 'Tất cả nhóm được giao</button>',
      '<div class="menu-sep" data-show-roles="CH QV"></div><div class="menu-label" data-show-roles="CH QV">Nhóm chi nhánh (vùng)</div>',
      '<button class="menu-item menu-item--group" role="menuitemradio" aria-checked="false" data-level="group" data-branch="Nhóm Miền Nam" data-show-roles="CH QV">' + ico('users') + 'Nhóm Miền Nam</button>',
      '<button class="menu-item menu-item--group" role="menuitemradio" aria-checked="false" data-level="group" data-branch="Nhóm Miền Trung" data-show-roles="CH">' + ico('users') + 'Nhóm Miền Trung</button>',
      '<div class="menu-sep" data-show-roles="CH QV"></div><div class="menu-label">Từng chi nhánh</div>',
      '<button class="menu-item menu-item--indent" role="menuitemradio" aria-checked="false" data-level="branch" data-branch="Chi nhánh Quận 1" data-show-roles="CH QV">Chi nhánh Quận 1</button>',
      '<button class="menu-item menu-item--indent" role="menuitemradio" aria-checked="false" data-level="branch" data-branch="Chi nhánh Quận 7" data-show-roles="CH QV QL KT">Chi nhánh Quận 7</button>',
      '<button class="menu-item menu-item--indent" role="menuitemradio" aria-checked="false" data-level="branch" data-branch="Chi nhánh Thủ Đức" data-show-roles="CH QV QL KT">Chi nhánh Thủ Đức</button>',
      '<button class="menu-item menu-item--indent" role="menuitemradio" aria-checked="false" data-level="branch" data-branch="Chi nhánh Biên Hòa" data-show-roles="CH QV">Chi nhánh Biên Hòa</button>',
      '<button class="menu-item menu-item--indent" role="menuitemradio" aria-checked="false" data-level="branch" data-branch="Chi nhánh Đà Nẵng" data-show-roles="CH">Chi nhánh Đà Nẵng</button>',
      '<button class="menu-item menu-item--indent" role="menuitemradio" aria-disabled="true" data-level="branch" data-show-roles="QL KT">' + ico('lock') + 'Chi nhánh Biên Hòa<span class="menu-item__hint">Chưa được cấp quyền</span></button>',
      '<div class="menu-sep"></div><p class="t-body-sm text-secondary" style="padding:8px 12px" data-multi-note hidden>Tài khoản của bạn chỉ xem được các chi nhánh được gán. Xem hợp nhất dành cho Chủ garage và Quản lý vùng.</p></div></div>',
      '<div class="topbar__search">' + ico('search') + '<input class="input" data-global-search type="search" placeholder="Tìm phiếu, biển số, khách, phụ tùng…" aria-label="Tìm kiếm toàn hệ thống"><span class="kbd" aria-hidden="true">Ctrl K</span></div>',
      '<div class="topbar__spacer"></div><button class="btn-icon topbar__search-btn" aria-label="Tìm kiếm">' + ico('search') + '</button>',
      '<div class="dropdown"><button class="btn-icon" aria-haspopup="menu" aria-expanded="false" aria-label="Thông báo, 3 chưa đọc">' + ico('bell') + '<span class="btn-icon__dot" aria-hidden="true">3</span></button>',
      '<div class="dropdown__menu dropdown__menu--right notif-panel" role="menu" data-keep-open><div class="notif-panel__head"><strong>Thông báo</strong></div>',
      '<a class="notif-item is-unread" href="#" style="color:inherit"><span class="notif-item__icon">' + ico('alert-triangle', 'icon--sm') + '</span><div><div style="font-weight:600">Chênh lệch quỹ cuối ngày cần giải trình</div><div class="t-body-sm text-secondary">Chi nhánh Thủ Đức · hôm qua</div></div></a></div></div>',
      '<div class="dropdown"><button class="user-btn" aria-haspopup="menu" aria-expanded="false" aria-label="Menu tài khoản"><span class="avatar avatar--sm">TH</span><span class="user-btn__text"><strong class="t-body-sm" style="line-height:16px">Trần Hoàng Anh</strong><span class="user-btn__role" data-role-label>Chủ garage</span></span>' + ico('chevron-down', 'icon--sm') + '</button>',
      '<div class="dropdown__menu dropdown__menu--right" role="menu" style="min-width:280px"><div class="menu-label">Tài khoản</div>',
      '<button class="menu-item" role="menuitem">' + ico('user') + 'Hồ sơ cá nhân</button><button class="menu-item" role="menuitem">' + ico('log-out') + 'Đăng xuất</button>',
      '<div class="menu-sep"></div><div class="menu-label">Xem thử theo vai trò (chỉ prototype)</div>' + roleItems + '</div></div></header>',
      '<main class="main" id="main"><div class="main__inner">',
      '<div class="alert alert--warning alert--banner net-banner" role="alert">' + ico('wifi-off') + '<div class="alert__body"><span><strong>Mất kết nối.</strong> Bản nháp được lưu trên thiết bị (lúc 09:14). Chưa thể lưu cấu hình, xuất tệp hay nhập lô dữ liệu cho tới khi có mạng.</span></div></div>',
      '<div><nav class="breadcrumb" aria-label="Đường dẫn"><a href="#">GARAGE OS</a>' + ico('chevron-right') + crumbs + '</nav></div>'
    ].join('');
  }

  function shellEnd() {
    return '</div></main><nav class="bottom-nav" aria-label="Điều hướng nhanh">' +
      '<a class="bottom-nav__item" href="#" data-menu="dash">' + ico('layout-dashboard') + 'Tổng quan</a>' +
      '<a class="bottom-nav__item" href="#" data-menu="ro">' + ico('clipboard-list') + 'Phiếu</a>' +
      '<a class="bottom-nav__item" href="#" data-menu="appt">' + ico('calendar') + 'Lịch hẹn</a>' +
      '<a class="bottom-nav__item" href="#" data-menu="inv">' + ico('warehouse') + 'Kho</a>' +
      '<button class="bottom-nav__item" data-nav-open aria-label="Mở toàn bộ menu">' + ico('menu') + 'Thêm</button></nav></div>';
  }

  document.write('<link rel="stylesheet" href="pack.css">');
  document.write(shellStart());

  /* ---------- Trang: tiêu đề, phạm vi, thanh trạng thái ---------- */
  var STATE_LABEL = { data: 'Có dữ liệu', loading: 'Đang tải', empty: 'Trống (lần đầu)', filtered: 'Trống (do lọc)', error: 'Lỗi tải', denied: 'Không có quyền' };
  var PAGE = {};

  window.g4rPage = function (o) {
    PAGE = o;
    var h = '<div class="page-header"><div class="page-header__text"><div class="g4r-code">' + CFG.code + (o.prio ? ' · ' + o.prio : '') + '</div><h1>' + o.title + '</h1><p class="page-header__desc">' + (o.desc || '') + '</p></div><div class="page-header__actions">' + (o.actions || '') + '</div></div>';
    var sc = '<div class="scope-banner" role="status">' + ico('map-pin', 'icon--sm');
    if (o.cfgScope) {
      sc += '<span><strong>Phạm vi cấu hình:</strong> ' + o.cfgScope + '</span>';
    } else if (o.scopeText) {
      sc += '<span><strong>Phạm vi:</strong> ' + o.scopeText + '</span>';
    } else {
      sc += '<span><strong>Phạm vi:</strong> <span data-scope-text>Tất cả chi nhánh – số liệu hợp nhất</span></span>';
    }
    if (o.sample) sc += '<span class="tag tag--neutral">Dữ liệu mẫu minh họa: ' + o.sample + '</span>';
    if (o.period) sc += '<span>· <strong>Thời gian:</strong> ' + o.period + '</span>';
    sc += '<span>· ' + (o.asof || 'Cập nhật lúc 09:15 30/10/2026') + '</span>';
    sc += '<button class="btn btn--ghost btn--sm" style="margin-left:auto" data-toast="info|Đang làm mới|Dữ liệu cập nhật lúc 09:16.">' + ico('refresh', 'icon--sm') + 'Làm mới</button></div>';
    h += sc;
    h += '<div class="alert alert--info g4r-own" role="note">' + ico('info') + '<div class="alert__body">Vai trò của bạn chỉ xem phần dữ liệu của chính mình (ký hiệu Xn); số liệu và danh sách đã được lọc theo quyền.</div></div>';
    if (o.sub === 'sys') {
      h += '<div class="g4r-settings">' + subnav() + '<div class="g4r-settings__body">';
    }
    var states = o.states || ['data', 'loading', 'empty', 'filtered', 'error', 'denied'];
    var bar = '<div class="g4r-statebar"><span class="g4r-statebar__label">Xem thử trạng thái (chỉ prototype):</span><div class="segmented" role="group" aria-label="Chọn trạng thái màn hình">';
    states.forEach(function (s, i) { bar += '<button class="segmented__item" data-state-switch="' + s + '" aria-pressed="' + (i === 0) + '">' + (STATE_LABEL[s] || s) + '</button>'; });
    (o.extraStates || []).forEach(function (s) { bar += '<button class="segmented__item" data-state-switch="' + s[0] + '" aria-pressed="false">' + s[1] + '</button>'; });
    bar += '</div><button class="btn btn--ghost btn--sm" data-toggle-offline>' + ico('wifi-off', 'icon--sm') + 'Thử: mất kết nối</button></div>';
    document.write(h + '<div data-state-group class="' + (o.sub === 'sys' ? 'stack' : 'stack') + '">' + bar + '<div data-state="data" class="stack">');
  };

  /* Vai trò được mở từng màn cài đặt (khớp data-allow của từng trang). Thanh điều hướng chỉ liệt kê màn trong quyền (BA-06 câu 1). */
  var SYS_ALLOW = {
    '01': 'AD CH QL', '02': 'AD CH QL', '03': 'AD CH QL', '04': 'AD CH', '05': 'AD CH', '06': 'AD QL CH', '07': 'AD QL CH KT CV', '08': 'AD QL CH', '09': 'CH QV QL',
    '10': 'KT CH', '11': 'AD QL CH', '12': 'AD KT CH QL', '13': 'AD QL CH', '14': 'AD QD QL CH', '15': 'AD CH', '16': 'AD KT CH', '17': 'AD QL CH', '18': 'AD CH',
    '19': 'AD CH QL KT', '20': 'AD QL KT TK CH', '21': 'AD CH QL', '22': 'AD CH', '23': 'AD CH KT', '24': 'AD CH'
  };
  function subnav() {
    var cur = CFG.code.replace('G4-SYS-', '');
    var out = '<div><nav class="g4r-subnav" aria-label="Mục cài đặt">';
    var sel = '<label class="field g4r-subnav__pick"><span class="field__label">Mục cài đặt</span><select class="select" onchange="location.href=this.value" aria-label="Chuyển mục cài đặt">';
    SYS_GROUPS.forEach(function (g) {
      out += '<div class="g4r-subnav__group" data-g4r-sg>' + g[0] + '</div>';
      sel += '<optgroup label="' + g[0] + '">';
      g[1].forEach(function (n) {
        var f = 'g4-sys-' + n + '.html';
        out += '<a href="' + f + '" data-g4r-roles="' + SYS_ALLOW[n] + '"' + (n === cur ? ' aria-current="page"' : '') + '><span>' + SYS_NAMES[n] + '</span><span class="t-caption text-tertiary">' + n + '</span></a>';
        sel += '<option value="' + f + '" data-g4r-roles="' + SYS_ALLOW[n] + '"' + (n === cur ? ' selected' : '') + '>' + n + ' · ' + SYS_NAMES[n] + '</option>';
      });
      sel += '</optgroup>';
    });
    return out + '</nav>' + sel + '</select></label></div>';
  }
  /* Màn cài đặt đầu tiên vai trò được mở (đích của mục menu “Cài đặt”) */
  function firstSys(role) { var all = [].concat.apply([], SYS_GROUPS.map(function (g) { return g[1]; })); for (var i = 0; i < all.length; i++) { if (SYS_ALLOW[all[i]].split(' ').indexOf(role) >= 0) return 'g4-sys-' + all[i] + '.html'; } return ''; }

  /* Hộp thoại duyệt / từ chối dùng chung cho mọi yêu cầu chờ duyệt (FR-SYS-013: Duyệt và Từ chối, từ chối bắt buộc lý do) */
  function approveDialog() {
    return '<div class="overlay" id="dlg-approve" role="dialog" aria-modal="true" aria-labelledby="ap-t"><div class="dialog dialog--md"><div class="dialog__header"><div class="dialog__icon dialog__icon--warning">' + ico('check') + '</div><div><h2 class="dialog__title" id="ap-t">Duyệt yêu cầu</h2></div><button class="btn-icon dialog__close" data-close aria-label="Đóng">' + ico('x') + '</button></div>' +
      '<div class="dialog__body"><dl class="g4r-kv"><dt>Nội dung</dt><dd id="ap-what"></dd><dt>Người đề xuất</dt><dd id="ap-who"></dd><dt>Thay đổi</dt><dd id="ap-diff" class="g4r-diff"></dd></dl>' +
      '<div class="g4r-diffbox"><strong>Ảnh hưởng</strong><ul class="impact-list" id="ap-imp"></ul></div>' +
      '<label class="check"><input type="checkbox" id="ap-ok"><span class="check__box"><svg class="icon"><use href="#check"/></svg></span><span>Tôi đã xem thay đổi và ảnh hưởng ở trên.</span></label>' +
      '<div class="field" id="ap-pwf" hidden><label class="field__label" for="ap-pw">Nhập lại mật khẩu của bạn để duyệt<span class="field__req">*</span></label><input class="input" id="ap-pw" type="password" autocomplete="current-password"><span class="field__hint">Thao tác rủi ro cao (khôi phục, ẩn danh, hoàn tác lô, môi trường thật, hạ bảo mật, đổi quyền) luôn hỏi lại mật khẩu (D-02).</span></div>' +
      '<div class="field"><label class="field__label" for="ap-rs">Lý do từ chối (bắt buộc khi Từ chối)</label><textarea class="textarea" id="ap-rs" style="min-height:56px" placeholder="Ví dụ: Cần xác nhận lại với kế toán trước khi áp dụng"></textarea></div></div>' +
      '<div class="dialog__footer"><button class="btn btn--secondary" data-close>Để sau</button><button class="btn btn--danger-outline" id="ap-no" disabled data-close data-toast="warning|Đã từ chối yêu cầu|Người đề xuất nhận thông báo kèm lý do.">Từ chối</button><button class="btn btn--primary" id="ap-yes" disabled data-close data-toast="success|Đã duyệt yêu cầu|Có hiệu lực từ ngày hiệu lực; ghi nhật ký.">Duyệt</button></div></div></div>';
  }
  /* Thẻ “Yêu cầu chờ duyệt” (chỉ Chủ garage thấy). items: [{what, who, when, diff}] */
  window.g4rPending = function (items, roles, who) {
    var h = '<section class="table-wrap" data-show-roles="' + (roles || 'CH') + '" aria-label="Yêu cầu chờ duyệt"><div class="table-toolbar"><strong>Yêu cầu chờ ' + (who || 'Chủ garage') + ' duyệt</strong><span class="table-meta">Cùng hàng chờ dùng chung G4-APR-01 lọc theo người duyệt (ánh xạ loại yêu cầu → cấp duyệt ở G4-APR-03)</span><span class="count-pill count-pill--warning">' + items.length + '</span></div><div class="table-scroll"><table class="table table--compact"><caption class="sr-only">Yêu cầu chờ duyệt</caption><thead><tr><th>Nội dung</th><th>Người đề xuất</th><th>Gửi lúc</th><th><span class="sr-only">Thao tác</span></th></tr></thead><tbody>';
    items.forEach(function (x) { h += '<tr><td>' + x.what + '<span class="g4r-formula g4r-diff">' + x.diff + '</span></td><td>' + x.who + '</td><td class="num">' + x.when + '</td><td><button class="btn btn--primary btn--sm" data-g4r-approve="' + esc(x.what) + '|' + esc(x.who) + '|' + esc(x.diff) + '|' + esc(x.imp || '') + '|' + (x.risk ? '1' : '0') + '">Xem và duyệt</button></td></tr>'; });
    document.write(h + '</tbody></table></div></section>');
  };

  window.g4rEnd = function (extra, overlays) {
    var o = PAGE, e = o.empty || {};
    var h = '</div>';  /* đóng data panel */
    h += '<div data-state="loading" hidden aria-busy="true"><div class="table-wrap"><div class="card__body stack"><span class="skeleton skeleton--title"></span><span class="skeleton skeleton--block"></span><span class="skeleton skeleton--text" style="width:90%"></span><span class="skeleton skeleton--text" style="width:75%"></span><span class="skeleton skeleton--text" style="width:82%"></span></div></div><p class="t-body-sm text-secondary" style="margin-top:8px">Đang tải từng khối; khối nào xong trước hiện trước, bố cục không nhảy.</p></div>';
    h += '<div data-state="empty" hidden><div class="table-wrap"><div class="state"><div class="state__icon state__icon--brand">' + ico('inbox', 'icon--lg') + '</div><div class="state__title">' + (e.title || 'Chưa có dữ liệu') + '</div><p class="state__text">' + (e.text || 'Dữ liệu sẽ hiện ở đây khi có phát sinh.') + '</p>' + (e.cta ? '<div class="state__actions">' + e.cta + '</div>' : '') + '</div></div></div>';
    h += '<div data-state="filtered" hidden><div class="table-wrap"><div class="state"><div class="state__icon">' + ico('search', 'icon--lg') + '</div><div class="state__title">Không có kết quả phù hợp</div><p class="state__text">' + (o.filteredText || 'Không có bản ghi nào khớp với bộ lọc đang áp dụng. Thử bỏ bớt bộ lọc hoặc mở rộng khoảng thời gian.') + '</p><div class="state__actions"><button class="btn btn--secondary" data-state-switch="data">Xóa tất cả bộ lọc</button></div></div></div></div>';
    h += '<div data-state="error" hidden><div class="table-wrap"><div class="state"><div class="state__icon state__icon--danger">' + ico('alert-triangle', 'icon--lg') + '</div><div class="state__title">Không tải được dữ liệu</div><p class="state__text">Chưa lấy được dữ liệu. Đây không phải là “không có dữ liệu”. Số liệu cũ (nếu có) không được hiển thị để tránh nhầm. Hãy thử lại; nếu lỗi lặp lại, gửi mã lỗi cho quản trị hệ thống.</p><div class="state__actions"><button class="btn btn--primary" data-state-switch="data">' + ico('refresh') + 'Thử lại</button></div><span class="state__ref">Mã lỗi: ERR-' + (CFG.code.replace('G4-', '').replace('-', '') ) + '-5001</span></div></div></div>';
    var names = CFG.allow.map(function (r) { return ROLE_NAME[r]; }).join(', ');
    h += '<div data-state="denied" hidden><div class="table-wrap"><div class="state"><div class="state__icon state__icon--warning">' + ico('lock', 'icon--lg') + '</div><div class="state__title">Bạn không có quyền xem màn hình này</div><p class="state__text">Màn hình này dành cho: ' + (names || 'vai trò được cấp quyền') + '. Nếu cần xem, gửi yêu cầu cấp quyền cho Chủ garage hoặc Quản trị hệ thống; yêu cầu và người duyệt được ghi nhật ký.</p><div class="state__actions"><button class="btn btn--secondary" data-toast="info|Đã gửi yêu cầu|Yêu cầu cấp quyền được gửi cho Chủ garage.">Gửi yêu cầu cấp quyền</button></div></div></div></div>';
    h += (extra || '');
    h += '</div>';  /* đóng state-group */
    if (o.sub === 'sys') h += '</div></div>';
    h += shellEnd();
    h += (overlays || '') + exportDialog() + approveDialog();
    document.write(h);
    document.write('<script src="../assets/app.js"><\/script>');
  };

  /* ---------- Bộ lọc báo cáo chung (FR-RPT-014) ---------- */
  var OPT = {
    period: ['Hôm nay 30/10/2026', 'Tuần này (26/10 – 30/10/2026)', 'Tháng này (01/10 – 30/10/2026)', 'Tháng trước (01/09 – 30/09/2026)', 'Quý này', 'Tùy chọn…'],
    service: ['Tất cả loại dịch vụ', 'Sửa chữa chung', 'Bảo dưỡng', 'Lốp và mâm', 'Đồng sơn'],
    staff: ['Tất cả nhân viên', 'Nguyễn Văn Bình (CV)', 'Lê Thị Mai (CV)', 'Võ Quốc Cường (Thợ)', 'Đặng Minh Tuấn (Thợ)'],
    status: ['Tất cả trạng thái lệnh', 'Đã duyệt', 'Đang sửa chữa', 'Tạm dừng', 'Chờ QC', 'Sẵn sàng bàn giao', 'Hoàn tất', 'Đã hủy'],
    revgroup: ['Tất cả nhóm doanh thu', 'Công (nhân công)', 'Phụ tùng', 'Dịch vụ khác']
  };
  var LABEL = { period: 'Khoảng thời gian', service: 'Loại dịch vụ', staff: 'Nhân viên', status: 'Trạng thái lệnh', revgroup: 'Nhóm doanh thu' };
  var fid = 0;
  window.g4rFilters = function (o) {
    var h = '<div class="filter-bar" role="search" aria-label="Bộ lọc báo cáo">';
    (o.fields || ['period']).forEach(function (f) {
      fid++;
      var opts = (o.options && o.options[f]) || OPT[f];
      h += '<div class="field"><label class="field__label" for="g4rf' + fid + '">' + (o.labels && o.labels[f] || LABEL[f]) + '</label><select class="select" id="g4rf' + fid + '" style="min-width:200px">' + opts.map(function (x, i) { return '<option' + (i === (o.sel && o.sel[f] || 0) ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div>';
    });
    if (o.branchNote !== false) h += '<div class="field"><span class="field__label">Chi nhánh</span><div class="row" style="min-height:40px"><strong data-branch-label>Tất cả chi nhánh</strong><span class="t-caption text-secondary">(theo Phạm vi dữ liệu ở thanh trên)</span></div></div>';
    if (o.search) { fid++; h += '<div class="field filter-bar__search"><label class="field__label" for="g4rf' + fid + '">' + o.search + '</label><input class="input" id="g4rf' + fid + '" type="search" data-g4r-filter="' + (o.searchTarget || '') + '" placeholder="Gõ có dấu hoặc không dấu"></div>'; }
    h += '<div class="filter-bar__actions"><button class="btn btn--ghost" data-toast="info|Đã đặt lại bộ lọc|Về mặc định: tháng này, tất cả.">Đặt lại</button><button class="btn btn--primary" data-toast="success|Đã áp dụng bộ lọc|Số liệu cập nhật theo bộ lọc.">Áp dụng</button></div></div>';
    if (o.chips) {
      h += '<div class="chip-row" aria-label="Bộ lọc đang áp dụng"><span class="t-body-sm text-secondary">Đang lọc:</span>' + o.chips.map(function (c) { return '<span class="chip">' + c + '<button class="chip__x" aria-label="Bỏ lọc ' + esc(c) + '">' + ico('x') + '</button></span>'; }).join('') + '<button class="btn btn--ghost btn--sm" data-toast="info|Đã xóa bộ lọc|Chỉ còn bộ lọc mặc định.">Xóa tất cả</button></div>';
    }
    document.write(h);
  };

  /* ---------- Hộp thoại xuất dữ liệu (G4-RPT-11), dùng chung cho mọi báo cáo ---------- */
  function exportDialog() {
    return [
      '<div class="overlay" id="dlg-export" role="dialog" aria-modal="true" aria-labelledby="dx-t"><div class="dialog dialog--md">',
      '<div class="dialog__header"><div class="dialog__icon">' + ico('download') + '</div><div><h2 class="dialog__title" id="dx-t">Xuất báo cáo</h2><p class="t-body-sm text-secondary" style="margin:4px 0 0">Tệp xuất ghi sẵn phạm vi và thời điểm ở dòng đầu.</p></div><button class="btn-icon dialog__close" data-close aria-label="Đóng">' + ico('x') + '</button></div>',
      '<div class="dialog__body stack">',
      '<div class="scope-banner scope-banner--branch" role="status" style="margin:0">' + ico('map-pin', 'icon--sm') + '<span><strong>Phạm vi xuất:</strong> <span data-branch-label>Tất cả chi nhánh</span> · 01–30/10/2026 · tại 09:15 30/10/2026</span></div>',
      '<fieldset class="field" style="border:0;padding:0;margin:0"><legend class="field__label">Định dạng</legend><div class="row"><label class="check"><input type="radio" name="g4rfmt" checked><span class="check__box"><svg class="icon"><use href="#check"/></svg></span><span>Excel (.xlsx)</span></label><label class="check"><input type="radio" name="g4rfmt"><span class="check__box"><svg class="icon"><use href="#check"/></svg></span><span>PDF (A4)</span></label><label class="check"><input type="radio" name="g4rfmt"><span class="check__box"><svg class="icon"><use href="#check"/></svg></span><span>CSV</span></label></div></fieldset>',
      '<fieldset class="field" style="border:0;padding:0;margin:0"><legend class="field__label">Cột đưa vào tệp</legend><div class="stack-2">',
      '<label class="check"><input type="checkbox" checked><span class="check__box"><svg class="icon"><use href="#check"/></svg></span><span>Mã chứng từ, biển số, trạng thái, số tiền</span></label>',
      '<label class="check"><input type="checkbox" checked><span class="check__box"><svg class="icon"><use href="#check"/></svg></span><span>Tên khách hàng</span></label>',
      '<label class="check"><input type="checkbox" id="dx-pii" data-g4r-pii><span class="check__box"><svg class="icon"><use href="#check"/></svg></span><span>Số điện thoại, địa chỉ khách (dữ liệu cá nhân)</span></label>',
      '</div><span class="field__hint">Mặc định các cột dữ liệu cá nhân được che (09•• ••• 123). Chỉ vai trò có quyền “Xuất dữ liệu cá nhân” mới chọn được cột đầy đủ.</span></fieldset>',
      '<div class="alert alert--warning" id="dx-warn" hidden>' + ico('alert-triangle') + '<div class="alert__body"><div class="alert__title">Xuất dữ liệu cá nhân</div>Thao tác được ghi nhật ký (người xuất, thời điểm, phạm vi, số dòng). Chỉ dùng cho mục đích công việc; không chia sẻ tệp ra ngoài công ty.<div class="field" style="margin-top:8px"><label class="field__label" for="dx-reason">Lý do xuất<span class="field__req">*</span></label><textarea class="textarea" id="dx-reason" style="min-height:56px" placeholder="Ví dụ: Gửi bảng kê công nợ cho khách"></textarea></div><div class="field" style="margin-top:8px"><label class="field__label" for="dx-pw">Nhập lại mật khẩu của bạn<span class="field__req">*</span></label><input class="input" id="dx-pw" type="password" autocomplete="current-password"><span class="field__hint">Xuất danh sách có dữ liệu cá nhân luôn hỏi lại mật khẩu (D-02).</span></div></div></div>',
      '<p class="t-body-sm text-secondary" style="margin:0">Ước tính 234 dòng (tối đa 50.000 dòng mỗi tệp; tệp lớn xử lý ở nền). Tệp tải về giữ 7 ngày; lịch sử các lần xuất của bạn giữ 12 tháng (hai thời hạn khác nhau).</p>',
      '<div class="alert alert--neutral" role="note" data-g4r-noexport>' + ico('lock') + '<div class="alert__body">Vai trò hiện tại <strong>chưa có quyền xuất dữ liệu</strong> (FR-SYS-013). Hộp thoại này sẽ bị ẩn nút Xuất; xin quyền với Chủ garage.</div></div>',
      '<div class="t-body-sm text-secondary"><strong>Xem trước dòng đầu tệp:</strong><div class="g4r-mono" style="margin-top:4px">GMEP · Phạm vi: <span data-branch-label>Tất cả chi nhánh</span> · Kỳ: 01/10/2026–30/10/2026 · Xuất lúc: 09:15 30/10/2026 · Người xuất: Trần Hoàng Anh</div></div>',
      '<div class="progress progress--info" id="dx-prog" hidden><div class="progress__head"><span>Đang tạo tệp ở nền (tệp lớn)…</span><span class="num">42%</span></div><div class="progress__track" role="progressbar" aria-valuenow="42" aria-valuemin="0" aria-valuemax="100" aria-label="Tiến độ tạo tệp"><span class="progress__bar" style="width:42%"></span></div></div>',
      '</div>',
      '<div class="dialog__footer"><button class="btn btn--secondary" data-close>Hủy</button><button class="btn btn--primary" id="dx-go" data-toast="success|Đang tạo tệp|Tệp lớn được xử lý ở nền, thông báo khi xong.">' + ico('download') + 'Xuất tệp</button></div>',
      '</div></div>',
      /* Hộp thoại lý do xem dữ liệu cá nhân (KT) – dùng chung với cơ chế .pii của app.js */
      '<div class="overlay" id="dlg-reveal" role="alertdialog" aria-modal="true" aria-labelledby="rv-t"><div class="dialog"><div class="dialog__header"><div class="dialog__icon dialog__icon--warning">' + ico('eye') + '</div><div><h2 class="dialog__title" id="rv-t">Hiện thông tin cá nhân của khách</h2></div><button class="btn-icon dialog__close" data-close aria-label="Đóng">' + ico('x') + '</button></div>',
      '<div class="dialog__body"><p>Chọn lý do. Việc xem được ghi nhật ký (người xem, thời điểm, bản ghi, lý do) và tự che lại sau 30 giây.</p><fieldset style="border:0;padding:0;margin:0" class="reason-list"><legend class="sr-only">Lý do xem</legend>',
      '<label class="radio"><input type="radio" name="rv"><span class="radio__box"></span><span>Đối chiếu hóa đơn</span></label><label class="radio"><input type="radio" name="rv"><span class="radio__box"></span><span>Thu hồi công nợ</span></label><label class="radio"><input type="radio" name="rv"><span class="radio__box"></span><span>Lý do khác</span></label></fieldset></div>',
      '<div class="dialog__footer"><button class="btn btn--secondary" data-close>Hủy</button><button class="btn btn--primary" data-reveal-confirm disabled>Hiện và ghi nhật ký</button></div></div></div>'
    ].join('');
  }
  /* Drawer sửa cấu hình có ngày hiệu lực (dùng cho SYS-07…15): trả về HTML, truyền vào tham số overlay của g4rEnd */
  window.g4rDrawer = function (o) {
    var id = o.id, h = '<div class="overlay overlay--drawer" id="' + id + '" role="dialog" aria-modal="true" aria-labelledby="' + id + '-t"><aside class="drawer"' + (o.guard ? ' data-confirm-guard' : '') + '>';
    h += '<div class="card__header"><div><h2 class="card__title" id="' + id + '-t">' + o.title + '</h2>' + (o.sub ? '<div class="card__subtitle">' + o.sub + '</div>' : '') + '</div><button class="btn-icon" data-close aria-label="Đóng">' + ico('x') + '</button></div>';
    h += '<div class="card__body stack" style="overflow:auto">' + (o.fields || []).join('');
    if (!o.noeff) {
      h += '<div class="field"><label class="field__label" for="' + id + '-ef">Ngày hiệu lực<span class="field__req">*</span></label><input class="input" id="' + id + '-ef" value="' + (o.effDate || '01/12/2026') + '" placeholder="dd/MM/yyyy" aria-describedby="' + id + '-efh" inputmode="numeric"><span class="field__hint" id="' + id + '-efh">Chứng từ tạo từ ngày này dùng giá trị mới; chứng từ đã tạo không đổi. Không chọn ngày trong quá khứ.</span><span class="field__error" id="' + id + '-err" hidden>' + ico('alert-triangle', 'icon--sm') + 'Đã có phiên bản hiệu lực từ ngày này. Chọn ngày khác hoặc sửa phiên bản đó.</span></div>';
      h += '<button type="button" class="btn btn--ghost btn--sm" data-g4r-toggle="' + id + '-err" style="align-self:flex-start">Thử lỗi: trùng ngày hiệu lực (prototype)</button>';
    }
    if (o.impact) h += '<div class="g4r-diffbox"><strong>Ảnh hưởng khi lưu</strong><ul class="impact-list">' + o.impact.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>';
    if (o.guard) h += '<div class="field"><label class="field__label" for="' + id + '-rs">Lý do thay đổi<span class="field__req">*</span></label><textarea class="textarea" id="' + id + '-rs" data-confirm-reason style="min-height:56px"></textarea></div>';
    h += '</div><div class="card__footer" style="margin-top:auto"><button class="btn btn--secondary" data-close>Hủy</button><button class="btn btn--primary"' + (o.guard ? ' data-confirm-btn' : '') + ' data-close data-toast="success|' + (o.toast || 'Đã lưu phiên bản mới') + '|' + (o.toastText || 'Có hiệu lực từ ngày đã chọn; lịch sử được giữ.') + '">' + o.cta + '</button></div></aside></div>';
    return h;
  };
  window.g4rExportBtn = function (cls) { return '<button class="btn ' + (cls || 'btn--secondary') + '" data-open="dlg-export" data-g4r-exportbtn>' + ico('download') + 'Xuất báo cáo</button>'; };

  /* ---------- Biểu đồ SVG/CSS thuần (design-system §9) ---------- */
  var cid = 0;
  function vn(n) { var s = Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); return (n < 0 ? '−' : '') + s; }
  function dec(n, d) { return n.toFixed(d).replace('.', ','); }
  window.g4r = { vn: vn, dec: dec };
  /* Đỉnh trục là bội của 4 khoảng đẹp (4 vạch chia) để nhãn trục là số nguyên gọn */
  function nice(max) { var p = Math.pow(10, Math.floor(Math.log(max) / Math.LN10)), f = max / p, S = [1, 1.2, 1.6, 2, 2.4, 2.8, 3.2, 4, 4.8, 6, 8, 10], m = 10; for (var i = 0; i < S.length; i++) { if (f <= S[i] + 1e-9) { m = S[i]; break; } } return m * p; }

  function shell(spec, id, bodyChart, altHead, altRows, legend, altCls) {
    var t = '<table class="table table--compact"><caption class="sr-only">' + esc(spec.title) + ' – bảng số liệu</caption><thead><tr>' + altHead.map(function (x, i) { return '<th' + (i ? ' class="col-num"' : '') + '>' + x + '</th>'; }).join('') + '</tr></thead><tbody>' +
      altRows.map(function (r, ri) { return '<tr class="' + ((altCls && altCls[ri]) || '') + '">' + r.map(function (c, i) { return '<td' + (i ? ' class="col-num"' : '') + '>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
    return '<figure class="g4r-chart" data-g4r-chart><figcaption class="g4r-chart__head"><div><div class="g4r-chart__title" id="' + id + '-t">' + spec.title + '</div><div class="g4r-chart__unit">' + spec.unit + '</div></div>' +
      '<div class="segmented" role="group" aria-label="Cách xem ' + esc(spec.title) + '"><button class="segmented__item" data-g4r-view="chart" aria-pressed="true">Biểu đồ</button><button class="segmented__item" data-g4r-view="table" aria-pressed="false">Bảng số liệu</button></div></figcaption>' +
      '<div data-g4r-pane="chart">' + bodyChart + '</div><div data-g4r-pane="table" hidden><div class="table-scroll">' + t + '</div></div>' +
      (legend ? '<div class="g4r-legend">' + legend + '</div>' : '') + (spec.note ? '<p class="g4r-chart__note">' + spec.note + '</p>' : '') + '<div class="g4r-tip" hidden role="tooltip"></div></figure>';
  }

  var charts = {
    line: function (spec, id) {
      var W = 640, H = 260, L = 64, R = 16, T = 14, B = 34, pw = W - L - R, ph = H - T - B;
      var all = []; spec.series.forEach(function (s) { all = all.concat(s.values); });
      var top = nice(Math.max.apply(null, all) * 1.05), n = spec.labels.length;
      function x(i) { return L + (n === 1 ? pw / 2 : pw * i / (n - 1)); }
      function y(v) { return T + ph - ph * v / top; }
      var svg = '<div class="g4r-chart__scroll"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-labelledby="' + id + '-t" focusable="false">';
      for (var k = 0; k <= 4; k++) {
        var v = top * k / 4, yy = y(v);
        svg += '<line class="g4r-grid-line" x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '"/><text class="g4r-svg-text" x="' + (L - 8) + '" y="' + (yy + 4) + '" text-anchor="end">' + (spec.axisFmt ? spec.axisFmt(v) : vn(v)) + '</text>';
      }
      svg += '<line class="g4r-axis-line" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(0) + '" y2="' + y(0) + '"/>';
      var step = Math.ceil(n / 8);
      spec.labels.forEach(function (lb, i) { if (i % step === 0 || i === n - 1) svg += '<text class="g4r-svg-text" x="' + x(i) + '" y="' + (H - 10) + '" text-anchor="middle">' + lb + '</text>'; });
      spec.series.forEach(function (s, si) {
        var d = s.values.map(function (v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); }).join(' ');
        svg += '<path class="g4r-line g4r-s' + (si + 1) + '" d="' + d + '"' + (s.dash ? ' stroke-dasharray="7 5"' : '') + '/>';
        s.values.forEach(function (v, i) {
          var tip = spec.labels[i] + '\n' + s.name + ': ' + (spec.fmt || vn)(v) + (spec.markLast && i === n - 1 && si === 0 ? '\n(' + spec.markLast + ')' : '');
          var hollow = spec.markLast && i === n - 1 && si === 0;
          svg += '<circle class="g4r-dot g4r-s' + (si + 1) + '" data-g4r-pt="' + si + '" cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="' + (hollow ? 6 : 4) + '" tabindex="' + (i === 0 && si === 0 ? '0' : '-1') + '" data-tip="' + esc(tip) + '"' + (hollow ? ' stroke-dasharray="3 2"' : '') + ' aria-label="' + esc(tip.replace(/\n/g, ', ')) + '"/>';
        });
      });
      svg += '</svg></div>';
      var legend = spec.series.map(function (s, i) { return '<span class="g4r-legend__item"><span class="g4r-legend__sw ' + (s.dash ? 'g4r-legend__sw--dash' : 'g4r-b' + (i + 1)) + '"' + (s.dash ? ' style="border-top-color:var(--chart-series-' + (i + 1) + ')"' : '') + '></span>' + s.name + '</span>'; }).join('') + (spec.markLast ? '<span class="g4r-legend__item">○ Điểm cuối: ' + spec.markLast + '</span>' : '');
      var rows = spec.labels.map(function (lb, i) { return [lb].concat(spec.series.map(function (s) { return (spec.fmt || vn)(s.values[i]); })); });
      return shell(spec, id, svg, ['Mốc'].concat(spec.series.map(function (s) { return s.name; })), rows, legend);
    },
    bar: function (spec, id) {
      var W = 640, H = 260, L = 64, R = 16, T = 20, B = 52, pw = W - L - R, ph = H - T - B, n = spec.labels.length;
      var top = nice(Math.max.apply(null, spec.values.concat(spec.target || 0)) * 1.1), bw = pw / n * .6;
      function y(v) { return T + ph - ph * v / top; }
      var svg = '<div class="g4r-chart__scroll"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-labelledby="' + id + '-t" focusable="false">';
      for (var k = 0; k <= 4; k++) { var v = top * k / 4; svg += '<line class="g4r-grid-line" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="g4r-svg-text" x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + (spec.axisFmt ? spec.axisFmt(v) : vn(v)) + '</text>'; }
      spec.labels.forEach(function (lb, i) {
        var cx = L + pw / n * (i + .5), yy = y(spec.values[i]), tip = lb + ': ' + (spec.fmt || vn)(spec.values[i]) + ' ' + spec.short;
        svg += '<rect class="g4r-bar g4r-f1" x="' + (cx - bw / 2) + '" y="' + yy + '" width="' + bw + '" height="' + (y(0) - yy) + '" rx="3" tabindex="0" data-tip="' + esc(tip) + '" aria-label="' + esc(tip) + '"/>';
        svg += '<text class="g4r-svg-text g4r-svg-text--strong" x="' + cx + '" y="' + (yy - 5) + '" text-anchor="middle">' + (spec.fmt || vn)(spec.values[i]) + '</text>';
        svg += '<text class="g4r-svg-text" x="' + cx + '" y="' + (H - 28) + '" text-anchor="middle">' + lb + '</text>';
      });
      if (spec.target) svg += '<line class="g4r-target" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(spec.target) + '" y2="' + y(spec.target) + '"/><text class="g4r-svg-text" x="' + (W - R) + '" y="' + (y(spec.target) - 5) + '" text-anchor="end">' + spec.targetLabel + '</text>';
      svg += '<line class="g4r-axis-line" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(0) + '" y2="' + y(0) + '"/></svg></div>';
      return shell(spec, id, svg, ['Nhóm', spec.short], spec.labels.map(function (l, i) { return [l, (spec.fmt || vn)(spec.values[i])]; }), spec.target ? '<span class="g4r-legend__item"><span class="g4r-legend__sw g4r-legend__sw--dash"></span>' + spec.targetLabel + '</span>' : '');
    },
    hbar: function (spec, id) {
      var rows = spec.rows.slice(); if (spec.sort !== false) rows.sort(function (a, b) { return b.value - a.value; });
      var max = Math.max.apply(null, rows.map(function (r) { return r.value; })) || 1;
      var h = '<div class="g4r-hbar" role="list" aria-labelledby="' + id + '-t">';
      rows.forEach(function (r) {
        var tip = r.label + ': ' + (spec.fmt || vn)(r.value) + (r.sub ? '\n' + r.sub : '');
        h += '<div class="g4r-hbar__row ' + (r.cls || '') + '" role="listitem" tabindex="0" data-tip="' + esc(tip) + '"><span class="g4r-hbar__label">' + r.label + '</span><span class="g4r-hbar__track"><span class="g4r-hbar__fill g4r-b1" style="width:' + (r.value / max * 100).toFixed(1) + '%"></span></span><span class="g4r-hbar__val">' + (spec.fmt || vn)(r.value) + (r.sub ? ' <span class="g4r-hbar__sub">' + r.sub + '</span>' : '') + '</span></div>';
      });
      h += '</div>';
      return shell(spec, id, h, ['Hạng mục', spec.short || 'Giá trị'], rows.map(function (r) { return [r.label, (spec.fmt || vn)(r.value)]; }), '', rows.map(function (r) { return r.cls || ''; }));
    },
    stack: function (spec, id) {
      var h = '<div class="g4r-stack" role="list" aria-labelledby="' + id + '-t">', max = 0;
      spec.rows.forEach(function (r) { var s = r.parts.reduce(function (a, b) { return a + b; }, 0); r.total = s; if (s > max) max = s; });
      spec.rows.forEach(function (r) {
        var tip = r.label + ' (' + r.total + ')\n' + spec.series.map(function (n, i) { return n + ': ' + r.parts[i]; }).join('\n');
        h += '<div class="g4r-stack__row ' + (r.cls || '') + '" role="listitem"><span class="g4r-hbar__label">' + r.label + '</span><div class="g4r-stack__bar" style="width:' + (r.total / max * 100).toFixed(1) + '%" tabindex="0" data-tip="' + esc(tip) + '" aria-label="' + esc(tip.replace(/\n/g, ', ')) + '">';
        r.parts.forEach(function (p, i) { if (p > 0) h += '<span class="g4r-stack__seg g4r-b' + (i + 1) + '" style="flex:' + p + ' 1 0%">' + p + '</span>'; });
        h += '</div><span class="g4r-stack__total">' + r.total + '</span></div>';
      });
      h += '</div>';
      var legend = spec.series.map(function (s, i) { return '<span class="g4r-legend__item"><span class="g4r-legend__sw g4r-b' + (i + 1) + '"></span>' + s + '</span>'; }).join('');
      return shell(spec, id, h, ['Hạng mục'].concat(spec.series).concat(['Tổng']), spec.rows.map(function (r) { return [r.label].concat(r.parts).concat([r.total]); }), legend, spec.rows.map(function (r) { return r.cls || ''; }));
    }
  };
  /* g4rChart('mã', {type, ...}) ghi vào chỗ gọi (document.write) */
  window.g4rChart = function (spec) {
    cid++; var id = 'g4rc' + cid;
    document.write(charts[spec.type](spec, id));
  };

  /* ---------- Hành vi sau khi tải ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function plain(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); }

  document.addEventListener('click', function (e) {
    var v = e.target.closest('[data-g4r-view]');
    if (v) {
      var fig = v.closest('[data-g4r-chart]'), name = v.getAttribute('data-g4r-view');
      $$('[data-g4r-view]', fig).forEach(function (b) { b.setAttribute('aria-pressed', String(b === v)); });
      $$('[data-g4r-pane]', fig).forEach(function (p) { p.hidden = p.getAttribute('data-g4r-pane') !== name; });
    }
    var go = e.target.closest('[data-g4r-go]');
    if (go) wizardGo(go.closest('[data-g4r-wizard]'), +go.getAttribute('data-g4r-go'));
    var tg = e.target.closest('[data-g4r-toggle]');
    if (tg) { var t = document.getElementById(tg.getAttribute('data-g4r-toggle')); if (t) { t.hidden = !t.hidden; tg.setAttribute('aria-expanded', String(!t.hidden)); } }
    var sec = e.target.closest('[data-g4r-reveal]');
    if (sec) { var el = document.getElementById(sec.getAttribute('data-g4r-reveal')); if (el) { var shown = el.getAttribute('data-shown') === '1'; el.textContent = shown ? el.getAttribute('data-mask') : el.getAttribute('data-real'); el.setAttribute('data-shown', shown ? '0' : '1'); sec.textContent = shown ? 'Hiện' : 'Ẩn'; } }
  });

  /* tooltip biểu đồ: di chuột hoặc focus bàn phím; Esc ẩn */
  function showTip(t) {
    var fig = t.closest('[data-g4r-chart]'); if (!fig) return;
    var tip = $('.g4r-tip', fig), fr = fig.getBoundingClientRect(), r = t.getBoundingClientRect();
    tip.textContent = t.getAttribute('data-tip'); tip.hidden = false;
    var left = r.left - fr.left + r.width / 2 - tip.offsetWidth / 2, top = r.top - fr.top - tip.offsetHeight - 8;
    if (top < 0) top = r.bottom - fr.top + 8;
    tip.style.left = Math.max(0, Math.min(left, fr.width - tip.offsetWidth)) + 'px'; tip.style.top = top + 'px';
  }
  function hideTip(e) { var fig = (e.target.closest && e.target.closest('[data-g4r-chart]')); if (fig) $('.g4r-tip', fig).hidden = true; }
  document.addEventListener('mouseover', function (e) { var t = e.target.closest && e.target.closest('[data-tip]'); if (t) showTip(t); });
  document.addEventListener('mouseout', hideTip);
  document.addEventListener('focusin', function (e) { var t = e.target.closest && e.target.closest('[data-tip]'); if (t) showTip(t); });
  document.addEventListener('focusout', hideTip);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') $$('.g4r-tip').forEach(function (t) { t.hidden = true; }); });

  /* lọc nhanh trong bảng, không phân biệt dấu */
  document.addEventListener('input', function (e) {
    var f = e.target.closest && e.target.closest('[data-g4r-filter]'); if (!f) return;
    var tbl = document.getElementById(f.getAttribute('data-g4r-filter')) || $('table.table'); var q = plain(f.value.trim());
    $$('tbody tr', tbl).forEach(function (tr) { tr.hidden = q && plain(tr.textContent).indexOf(q) < 0; });
  });

  /* wizard (nhập Excel) */
  function wizardGo(w, n) {
    if (!w) return;
    $$('[data-g4r-step]', w).forEach(function (p) { p.hidden = +p.getAttribute('data-g4r-step') !== n; });
    $$('.stepper__step', w).forEach(function (s, i) {
      s.classList.remove('is-done', 'is-current'); s.removeAttribute('aria-current');
      if (i + 1 < n) s.classList.add('is-done'); else if (i + 1 === n) { s.classList.add('is-current'); s.setAttribute('aria-current', 'step'); }
    });
    var f = $('[data-g4r-step]:not([hidden]) h2, [data-g4r-step]:not([hidden]) h3', w); if (f) { f.setAttribute('tabindex', '-1'); f.focus(); }
  }
  window.g4rWizardGo = wizardGo;

  /* cổng quyền: vai trò ngoài danh sách được phép thì chuyển sang trạng thái "Không có quyền" */
  var autoDenied = false;
  function gate() {
    $$('[data-g4r-group]').forEach(function (g) { g.hidden = !$$('.g4r-repcard, .g4r-favrow', g).some(function (c) { return !c.hidden; }); });
    var none = $('#rpt-none'); if (none) none.hidden = $$('.g4r-repcard').some(function (c) { return !c.hidden; });
    var role = document.body.getAttribute('data-role') || 'CH';
    /* Menu “Cài đặt”: app.js (ROLE_MENU, set: full / approve / limited) quyết định hiện hay ẩn và nhãn chế độ.
       Shim còn lại một việc: đặt đích liên kết là màn cài đặt đầu tiên vai trò được mở (app.js trỏ cố định g4-sys-01). */
    var setm = $('[data-menu="set"]'), fs = firstSys(role);
    if (setm && fs) setm.setAttribute('href', fs);
    /* thanh điều hướng cài đặt chỉ liệt kê màn trong quyền; nhóm rỗng thì ẩn */
    $$('[data-g4r-roles]').forEach(function (a) { a.hidden = a.getAttribute('data-g4r-roles').split(' ').indexOf(role) < 0; if (a.tagName === 'OPTION') a.disabled = a.hidden; });
    $$('.g4r-subnav__group').forEach(function (g) { var n = g.nextElementSibling, any = false; while (n && !n.classList.contains('g4r-subnav__group')) { if (!n.hidden) any = true; n = n.nextElementSibling; } g.hidden = !any; });
    $$('.g4r-subnav__pick optgroup').forEach(function (g) { g.hidden = !$$('option', g).some(function (o) { return !o.hidden; }); });
    syncLevel();
    if (!CFG.allow.length) return;
    var ok = CFG.allow.indexOf(role) >= 0;
    var btnDenied = $('[data-state-switch="denied"]'), btnData = $('[data-state-switch="data"]');
    if (!ok && btnDenied) { autoDenied = true; btnDenied.click(); }
    else if (ok && autoDenied && btnData) { autoDenied = false; btnData.click(); }
    /* trường chỉ một số vai trò được sửa: khóa kèm lý do hiển thị (không âm thầm ẩn) */
    $$('[data-edit-roles]').forEach(function (el) {
      if (el._d0 === undefined) el._d0 = el.disabled;   /* giữ trạng thái disabled có sẵn (nút lên/xuống ở đầu/cuối danh sách) */
      var can = el.getAttribute('data-edit-roles').split(' ').indexOf(role) >= 0;
      el.disabled = !can || el._d0; el.setAttribute('aria-disabled', String(!can || el._d0));
    });
    $$('[data-why-roles]').forEach(function (el) { el.hidden = el.getAttribute('data-why-roles').split(' ').indexOf(role) >= 0; });
    /* quyền xuất (BA-06 câu 3): CH QV QL KT xuất báo cáo; AD chỉ xuất nhật ký (SYS-19); cột cá nhân đầy đủ chỉ CH, KT */
    var canExport = ['CH', 'QV', 'QL', 'KT'].indexOf(role) >= 0 || (role === 'AD' && CFG.code === 'G4-SYS-19');
    $$('[data-g4r-noexport]').forEach(function (n) { n.hidden = canExport; });
    var pii = $('#dx-pii'); if (pii) { var piiOk = ['CH', 'KT'].indexOf(role) >= 0; pii.disabled = !piiOk || role === 'AD'; if (!piiOk) { pii.checked = false; var w = $('#dx-warn'); if (w) w.hidden = true; } }
    exportGo(canExport);
    $$('[data-g4r-exportbtn]').forEach(function (b) {
      b.disabled = !canExport; b.setAttribute('aria-disabled', String(!canExport)); b.title = canExport ? '' : 'Vai trò của bạn chưa có quyền xuất dữ liệu. Liên hệ Chủ garage.';
      var nx = b.nextElementSibling; if (nx && nx.classList.contains('g4r-why')) nx.remove();
      if (!canExport) { var s = document.createElement('span'); s.className = 'g4r-why'; s.textContent = 'Chưa có quyền xuất dữ liệu'; b.parentNode.insertBefore(s, b.nextSibling); }
    });
  }
  /* nút Xuất tệp: bật khi có quyền; nếu chọn cột cá nhân thì cần lý do (>= 5 ký tự) và mật khẩu */
  function exportGo(canExport) {
    var go = $('#dx-go'); if (!go) return;
    if (canExport === undefined) canExport = !$('[data-g4r-noexport]') || $('[data-g4r-noexport]').hidden;
    var pii = $('#dx-pii'), need = pii && pii.checked, r = $('#dx-reason'), p = $('#dx-pw');
    var ok = canExport && (!need || ((r.value.trim().length >= 5) && p.value.length > 0));
    go.disabled = !ok; go.setAttribute('aria-disabled', String(!ok));
  }
  /* mức phạm vi: hợp nhất (CH/QV chọn Tất cả/Nhóm) hay theo từng chi nhánh – điều khiển khối .g4r-only-merged/.g4r-only-branch */
  function syncLevel() {
    var role = document.body.getAttribute('data-role') || 'CH', btn = $('.branch-btn');
    var merged = ['CH', 'QV'].indexOf(role) >= 0 && btn && btn.classList.contains('is-all');
    document.body.setAttribute('data-g4r-level', merged ? 'merged' : 'branch');
  }
  document.addEventListener('change', function (e) {
    if (e.target.id === 'dx-pii') { var w = $('#dx-warn'); if (w) w.hidden = !e.target.checked; exportGo(); }
  });
  document.addEventListener('input', function (e) {
    if (e.target.id === 'dx-reason' || e.target.id === 'dx-pw') exportGo();
    /* ô mật khẩu xác nhận lại: bắt buộc trước khi bật nút xác nhận của hộp thoại (app.js chưa kiểm ô này) */
    var g = e.target.closest && e.target.closest('[data-confirm-guard]'); if (!g) return;
    var pw = g.querySelector('[data-g4r-pw]'); if (!pw) return;
    if (e.target === pw) { var tr = g.querySelector('[data-confirm-reason],[data-confirm-input]'); if (tr) { tr.dispatchEvent(new Event('input', { bubbles: true })); return; } }
    var b = g.querySelector('[data-confirm-btn]'); if (b && !pw.value) { b.disabled = true; b.setAttribute('aria-disabled', 'true'); }
  });
  /* duyệt / từ chối yêu cầu chờ duyệt */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-g4r-approve]'); if (!a) return;
    var p = a.getAttribute('data-g4r-approve').split('|');
    $('#ap-what').textContent = p[0]; $('#ap-who').textContent = p[1]; $('#ap-diff').innerHTML = (p[2] || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    /* “Ảnh hưởng” theo loại yêu cầu (các ý ngăn bằng ¦); không truyền thì là cấu hình có ngày hiệu lực */
    var imp = p[3] ? p[3].split('¦') : ['Chỉ áp dụng cho chứng từ tạo từ ngày hiệu lực; chứng từ đã tạo không đổi.', 'Nếu duyệt muộn hơn ngày hiệu lực đã chọn, bạn phải chọn ngày hiệu lực mới (không lùi ngày).'];
    imp.push('Mọi quyết định được ghi nhật ký (người duyệt, thời điểm, lý do).');
    $('#ap-imp').innerHTML = imp.map(function (x) { return '<li>' + x + '</li>'; }).join('');
    var risk = p[4] === '1'; $('#ap-pwf').hidden = !risk; $('#ap-pw').value = ''; $('#ap-pw').setAttribute('data-risk', risk ? '1' : '0');
    $('#ap-ok').checked = false; $('#ap-rs').value = ''; $('#ap-yes').disabled = true; $('#ap-no').disabled = true;
    if (window.gmepOpen) window.gmepOpen('dlg-approve');
  });
  document.addEventListener('input', function (e) { if (e.target.id === 'ap-rs') $('#ap-no').disabled = e.target.value.trim().length < 5; });
  function apCheck() { var pw = $('#ap-pw'), need = pw.getAttribute('data-risk') === '1'; $('#ap-yes').disabled = !($('#ap-ok').checked && (!need || pw.value.length > 0)); }
  document.addEventListener('change', function (e) { if (e.target.id === 'ap-ok') apCheck(); });
  document.addEventListener('input', function (e) { if (e.target.id === 'ap-pw') apCheck(); });
  /* biểu đồ line: một điểm dừng Tab, di chuyển bằng mũi tên */
  document.addEventListener('keydown', function (e) {
    var d = e.target.closest && e.target.closest('.g4r-dot'); if (!d || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End')) return;
    var pts = $$('.g4r-dot[data-g4r-pt="' + d.getAttribute('data-g4r-pt') + '"]', d.closest('svg')), i = pts.indexOf(d);
    var n = e.key === 'ArrowRight' ? pts[i + 1] : e.key === 'ArrowLeft' ? pts[i - 1] : e.key === 'Home' ? pts[0] : pts[pts.length - 1];
    if (n) { e.preventDefault(); pts.forEach(function (x) { x.tabIndex = -1; }); n.tabIndex = 0; n.focus(); }
  });
  document.addEventListener('DOMContentLoaded', function () {
    var q = new URLSearchParams(location.search), st = q.get('state'), rl = q.get('role');
    if (rl && /^(CH|QV|QL|CV|QD|TH|TK|TN|KT|AD)$/.test(rl)) { var b = $('[data-role-switch="' + rl + '"]'); if (b) b.click(); }
    if (st) { var sb = $('[data-state-switch="' + st + '"]'); if (sb) sb.click(); }
    gate();
    /* nhãn phạm vi trong thẻ KPI bám theo bộ chọn chi nhánh (RULE-015) */
    var lbl = $('[data-branch-label]');
    function syncScope() { var name = lbl ? lbl.textContent : ''; $$('[data-scope-label]').forEach(function (el) { if (!el._tpl) el._tpl = el.textContent; el.textContent = el._tpl.replace('Phạm vi theo bộ chọn', name); }); }
    syncScope();
    if (lbl) new MutationObserver(syncScope).observe(lbl, { childList: true, characterData: true, subtree: true });
    if (q.get('open')) { var ov = q.get('open'); if (document.getElementById(ov) && window.gmepOpen) window.gmepOpen(ov); }
    new MutationObserver(gate).observe(document.body, { attributes: true, attributeFilter: ['data-role'] });
    var bb = $('.branch-btn'); if (bb) new MutationObserver(syncLevel).observe(bb, { attributes: true, attributeFilter: ['class'] });
  });
})();
