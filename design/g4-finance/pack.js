/* GMEP – Gói 5 (G4 Tài chính & hóa đơn): dựng Application Shell dùng chung, bộ chuyển trạng thái xem thử,
   khóa hành động theo vai trò / mất kết nối, khóa chống bấm đúp, wizard. Chỉ phục vụ prototype (không phải code production).
   Mỗi trang khai báo window.G4F_PAGE trước khi nạp file này, và đặt nội dung trong <div id="g4f-body">. Nạp TRƯỚC ../assets/app.js. */
(function () {
  'use strict';
  var P = window.G4F_PAGE || {};
  var body = document.body;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function ic(n, c) { return '<svg class="icon' + (c ? ' ' + c : '') + '" aria-hidden="true"><use href="#' + n + '"/></svg>'; }

  var ROLES = [['CH', 'Chủ garage'], ['QV', 'Quản lý vùng'], ['QL', 'Quản lý chi nhánh'], ['CV', 'Cố vấn dịch vụ'], ['QD', 'Quản đốc'], ['TH', 'Thợ'], ['TK', 'Thủ kho'], ['TN', 'Thu ngân'], ['KT', 'Kế toán'], ['AD', 'Quản trị hệ thống']];
  var ROLE_NAME = {}; ROLES.forEach(function (r) { ROLE_NAME[r[0]] = r[1]; });
  var saved = null; try { saved = sessionStorage.getItem('g4f-role'); } catch (e) {}
  var role = saved || P.role || 'KT';
  body.setAttribute('data-role', role);

  /* ---------- Điều hướng con (module Tài chính / Phê duyệt / Hóa đơn) ---------- */
  var SUB = [
    { k: 'acc', label: 'Thu tiền', href: 'g4-acc-02.html', roles: 'CH QV QL CV KT TN', ids: ['acc-01', 'acc-02', 'acc-03', 'acc-07'] },
    { k: 'cash', label: 'Sổ quỹ và chi', href: 'g4-acc-04.html', roles: 'CH QV QL KT TN', ids: ['acc-04', 'acc-05', 'acc-06'] },
    { k: 'debt', label: 'Công nợ', href: 'g4-acc-10.html', roles: 'CH QV QL CV KT', ids: ['acc-10', 'acc-11', 'acc-12', 'acc-13'] },
    { k: 'close', label: 'Chốt ca, ngày, kỳ', href: 'g4-acc-08.html', roles: 'CH QV QL KT TN', ids: ['acc-08', 'acc-09', 'acc-17'] },
    { k: 'profit', label: 'Giá vốn và lãi lỗ', href: 'g4-acc-14.html', roles: 'CH QV QL KT', ids: ['acc-14', 'acc-15', 'acc-19', 'acc-20'] },
    { k: 'bank', label: 'Ngân hàng và kết xuất', href: 'g4-acc-16.html', roles: 'KT CH QV', ids: ['acc-16', 'acc-18'] },
    { k: 'apr', label: 'Phê duyệt', href: 'g4-apr-01.html', roles: 'CH QV QL KT TN CV TK', ids: ['apr-01', 'apr-02', 'apr-03'], pill: '7' },
    { k: 'ein', label: 'Hóa đơn điện tử', href: 'g4-ein-01.html', roles: 'CH QV QL KT TN AD', ids: ['ein-01', 'ein-02', 'ein-03', 'ein-04', 'ein-05', 'ein-06', 'ein-07', 'ein-08'] }
  ];
  var curId = (P.code || '').replace(/^G4-/i, '').toLowerCase();
  function subnavHTML() {
    return '<nav class="g4f-subnav" aria-label="Nhóm màn hình Tài chính và Hóa đơn">' + SUB.map(function (s) {
      var on = s.ids.indexOf(curId) >= 0;
      return '<a href="' + s.href + '" data-roles="' + s.roles + '"' + (on ? ' aria-current="page"' : '') + '>' + esc(s.label) + (s.pill ? '<span class="count-pill count-pill--warning" aria-label="' + s.pill + ' yêu cầu chờ duyệt">' + s.pill + '</span>' : '') + '</a>';
    }).join('') + '</nav>';
  }

  /* ---------- Shell ---------- */
  function navItem(menu, icon, label, href, extra) {
    return '<a class="nav-item" href="' + href + '" data-menu="' + menu + '" title="' + esc(label) + '"' + (P.menu === menu ? ' aria-current="page"' : '') + '>' + ic(icon) + '<span class="nav-item__label">' + esc(label) + '</span>' + (extra || '') + '</a>';
  }
  var roleItems = ROLES.map(function (r) { return '<button class="menu-item" role="menuitemradio" data-keep-open data-role-switch="' + r[0] + '" data-role-name="' + r[1] + '" aria-checked="' + (r[0] === role) + '">' + r[1] + '</button>'; }).join('');
  var shell =
    '<div class="app" id="app">' +
    '<aside class="sidebar" aria-label="Điều hướng chính"><div class="sidebar__brand"><span class="sidebar__logo" aria-hidden="true">' + ic('wrench') + '</span><span class="sidebar__brand-name">GARAGE OS</span><button class="btn-icon menu-btn" data-nav-close aria-label="Đóng menu" style="margin-left:auto">' + ic('x') + '</button></div>' +
    '<nav class="sidebar__nav"><div class="sidebar__group">Workspace</div>' +
    navItem('dash', 'layout-dashboard', 'Tổng quan', '../foundation/shell.html') + navItem('ro', 'clipboard-list', 'Phiếu sửa chữa', '#') + navItem('appt', 'calendar', 'Lịch hẹn', '#') + navItem('cust', 'car-front', 'Khách hàng & Xe', '#') +
    '<div class="sidebar__group">Kho &amp; mua hàng</div>' + navItem('inv', 'warehouse', 'Kho phụ tùng', '#') + navItem('pur', 'shopping-cart', 'Mua hàng', '#') +
    '<div class="sidebar__group">Nhân sự &amp; tài chính</div>' + navItem('hr', 'id-card', 'Nhân sự & Công thợ', '#') +
    navItem('fin', 'wallet', 'Tài chính', 'g4-acc-02.html', '<span class="count-pill count-pill--warning" aria-label="7 yêu cầu chờ duyệt" title="7 yêu cầu chờ duyệt">7</span><span class="nav-item__dot" aria-hidden="true"></span>') +
    navItem('einv', 'receipt', 'Hóa đơn', 'g4-ein-01.html', '<span class="count-pill count-pill--danger" aria-label="2 hóa đơn lỗi phát hành" title="2 hóa đơn lỗi phát hành">2</span><span class="nav-item__dot" aria-hidden="true"></span>') +
    '<div class="sidebar__group">Phân tích</div>' + navItem('rpt', 'chart-no-axes-combined', 'Báo cáo', '#') + '</nav>' +
    '<div class="sidebar__footer">' + navItem('set', 'settings', 'Cài đặt', '#') +
    '<button class="nav-item collapse-btn" data-sidebar-toggle aria-expanded="true" aria-label="Thu gọn thanh bên" style="width:100%" title="Thu gọn / mở rộng">' + ic('panel-left') + '<span class="nav-item__label">Thu gọn</span></button></div></aside>' +
    '<div class="drawer-nav-backdrop" data-nav-close></div>' +
    '<header class="topbar"><button class="btn-icon menu-btn" data-nav-open aria-label="Mở menu">' + ic('menu') + '</button>' +
    '<div class="branch-static" data-branch-static hidden>' + ic('map-pin') + '<span class="branch-static__text"><span class="branch-btn__caption">Chi nhánh của bạn</span><span class="branch-btn__name" data-static-label>Chi nhánh Quận 7</span></span></div>' +
    '<div class="dropdown" data-branch-dropdown><button class="branch-btn is-all" aria-haspopup="menu" aria-expanded="false" aria-label="Chọn phạm vi chi nhánh">' + ic('map-pin') + '<span class="branch-btn__text"><span class="branch-btn__caption">Phạm vi dữ liệu</span><span class="branch-btn__name" data-branch-label>Tất cả chi nhánh</span></span>' + ic('chevron-down', 'icon--sm') + '</button>' +
    '<div class="dropdown__menu" role="menu" style="min-width:320px">' +
    '<div class="menu-label" data-show-roles="CH QV">Hợp nhất</div>' +
    '<button class="menu-item" role="menuitemradio" aria-checked="true" data-level="all" data-branch="Tất cả chi nhánh" data-branch-all data-show-roles="CH">' + ic('layout-dashboard') + 'Tất cả chi nhánh<span class="menu-item__hint">toàn chuỗi</span></button>' +
    '<button class="menu-item" role="menuitemradio" aria-checked="false" data-level="all" data-branch="Tất cả nhóm được giao" data-branch-all data-show-roles="QV" hidden>' + ic('layout-dashboard') + 'Tất cả nhóm được giao</button>' +
    '<div class="menu-sep" data-show-roles="CH QV"></div><div class="menu-label" data-show-roles="CH QV">Nhóm chi nhánh (vùng)</div>' +
    '<button class="menu-item menu-item--group" role="menuitemradio" aria-checked="false" data-level="group" data-branch="Nhóm Miền Nam" data-show-roles="CH QV">' + ic('users') + 'Nhóm Miền Nam</button>' +
    '<button class="menu-item menu-item--group" role="menuitemradio" aria-checked="false" data-level="group" data-branch="Nhóm Miền Trung" data-show-roles="CH">' + ic('users') + 'Nhóm Miền Trung</button>' +
    '<div class="menu-sep" data-show-roles="CH QV"></div><div class="menu-label">Từng chi nhánh</div>' +
    ['Quận 1:CH QV', 'Quận 7:CH QV QL KT', 'Thủ Đức:CH QV QL KT', 'Biên Hòa:CH QV', 'Đà Nẵng:CH'].map(function (b) { var p = b.split(':'); return '<button class="menu-item menu-item--indent" role="menuitemradio" aria-checked="false" data-level="branch" data-branch="Chi nhánh ' + p[0] + '" data-show-roles="' + p[1] + '">Chi nhánh ' + p[0] + '</button>'; }).join('') +
    '<button class="menu-item menu-item--indent" role="menuitemradio" aria-disabled="true" data-level="branch" data-show-roles="QL KT">' + ic('lock') + 'Chi nhánh Biên Hòa<span class="menu-item__hint">Chưa được cấp quyền</span></button>' +
    '<div class="legal-filter" data-legal hidden><div class="field"><label class="field__label" for="legal">Pháp nhân</label><select id="legal" class="select"><option>Tất cả pháp nhân được xem</option><option>Công ty TNHH Garage A</option><option>Công ty TNHH Garage B</option></select><span class="field__hint">Báo cáo chính thức không cộng gộp số liệu giữa các pháp nhân.</span></div></div>' +
    '<div class="menu-sep"></div><p class="t-body-sm text-secondary" style="padding:8px 12px" data-multi-note hidden>Tài khoản của bạn chỉ xem được các chi nhánh được gán. Xem hợp nhất dành cho Chủ garage và Quản lý vùng. Đổi phạm vi khi đang soạn chứng từ sẽ hỏi lưu nháp trước.</p></div></div>' +
    '<div class="topbar__search">' + ic('search') + '<input class="input" data-global-search type="search" placeholder="Tìm phiếu thu, hóa đơn, khách, lệnh…" aria-label="Tìm kiếm toàn hệ thống"><span class="kbd" aria-hidden="true">Ctrl K</span></div>' +
    '<div class="topbar__spacer"></div><button class="btn-icon topbar__search-btn" aria-label="Tìm kiếm">' + ic('search') + '</button>' +
    '<a class="btn btn--secondary btn--sm" href="g4-apr-01.html" data-show-roles="CH QV QL KT TN CV TK" style="margin-right:4px">' + ic('clipboard-check', 'icon--sm') + 'Chờ duyệt<span class="count-pill count-pill--warning">7</span></a>' +
    '<button class="btn-icon" data-theme-toggle aria-label="Đổi giao diện sáng/tối (bản nháp, không thuộc phạm vi phát hành)" title="Dark mode: bản nháp, chưa phát hành">' + ic('moon') + '</button>' +
    '<div class="dropdown"><button class="btn-icon" aria-haspopup="menu" aria-expanded="false" aria-label="Thông báo, 3 chưa đọc">' + ic('bell') + '<span class="btn-icon__dot" aria-hidden="true">3</span></button>' +
    '<div class="dropdown__menu dropdown__menu--right notif-panel" role="menu" data-keep-open><div class="notif-panel__head"><strong>Thông báo</strong><button class="btn btn--ghost btn--sm">Đánh dấu đã đọc</button></div>' +
    '<a class="notif-item is-unread" href="g4-apr-01.html" style="color:inherit"><span class="notif-item__icon">' + ic('alert-triangle', 'icon--sm') + '</span><div><div style="font-weight:600">Cần xử lý: chênh lệch quỹ ca sáng −150.000 ₫</div><div class="t-body-sm text-secondary">Chi nhánh Quận 7 · 10 phút trước</div></div></a>' +
    '<a class="notif-item is-unread" href="g4-ein-06.html" style="color:inherit"><span class="notif-item__icon">' + ic('receipt', 'icon--sm') + '</span><div><div style="font-weight:600">Cần xử lý: 2 yêu cầu phát hành hóa đơn bị lỗi</div><div class="t-body-sm text-secondary">Chi nhánh Quận 7 · 25 phút trước</div></div></a>' +
    '<a class="notif-item is-unread" href="g4-apr-01.html" style="color:inherit"><span class="notif-item__icon">' + ic('wallet', 'icon--sm') + '</span><div><div style="font-weight:600">Cần xử lý: đề xuất hoàn tiền chờ duyệt</div><div class="t-body-sm text-secondary">Chi nhánh Quận 7 · 1 giờ trước</div></div></a>' +
    '<div style="padding:8px 16px"><a href="#">Xem tất cả thông báo</a></div></div></div>' +
    '<div class="dropdown"><button class="user-btn" aria-haspopup="menu" aria-expanded="false" aria-label="Menu tài khoản"><span class="avatar avatar--sm">ĐH</span><span class="user-btn__text"><strong class="t-body-sm" style="line-height:16px">Đặng Thu Hà</strong><span class="user-btn__role" data-role-label>' + ROLE_NAME[role] + '</span></span>' + ic('chevron-down', 'icon--sm') + '</button>' +
    '<div class="dropdown__menu dropdown__menu--right" role="menu" style="min-width:280px"><div class="menu-label">Tài khoản</div>' +
    '<button class="menu-item" role="menuitem">' + ic('user') + 'Hồ sơ cá nhân</button><button class="menu-item" role="menuitem">' + ic('history') + 'Nhật ký truy cập của tôi</button><button class="menu-item" role="menuitem">' + ic('log-out') + 'Đăng xuất</button>' +
    '<div class="menu-sep"></div><div class="menu-label">Giả lập (chỉ prototype)</div>' +
    '<button class="menu-item" role="menuitemcheckbox" data-keep-open data-legal-toggle aria-checked="false">' + ic('settings') + 'Nhiều pháp nhân (hiện bộ lọc Pháp nhân)</button>' +
    '<div class="menu-label">Xem thử theo vai trò</div>' + roleItems + '</div></div></header>' +
    '<main class="main" id="main"><div class="main__inner" id="g4f-main"></div></main>' +
    '<nav class="bottom-nav" aria-label="Điều hướng nhanh"><a class="bottom-nav__item" href="../foundation/shell.html" data-menu="dash">' + ic('layout-dashboard') + 'Tổng quan</a>' +
    '<a class="bottom-nav__item" href="g4-acc-02.html" data-menu="fin"' + (P.menu === 'fin' ? ' aria-current="page"' : '') + '>' + ic('wallet') + 'Tài chính</a>' +
    '<a class="bottom-nav__item" href="g4-ein-01.html" data-menu="einv"' + (P.menu === 'einv' ? ' aria-current="page"' : '') + '>' + ic('receipt') + 'Hóa đơn</a>' +
    '<a class="bottom-nav__item" href="#" data-menu="rpt">' + ic('chart-no-axes-combined') + 'Báo cáo</a>' +
    '<button class="bottom-nav__item" data-nav-open aria-label="Mở toàn bộ menu">' + ic('menu') + 'Thêm</button></nav></div>';

  var skip = '<a class="skip-link" href="#main">Bỏ qua điều hướng, tới nội dung chính</a>';
  body.insertAdjacentHTML('afterbegin', skip + shell);

  /* ---------- Nội dung trang ---------- */
  var src = document.getElementById('g4f-body'), main = document.getElementById('g4f-main');
  var actions = src ? $('[data-g4f-actions]', src) : null, actionsHTML = actions ? actions.innerHTML : '';
  if (actions) actions.remove();
  var crumbGroup = P.menu === 'einv' ? 'Hóa đơn' : 'Tài chính';
  var timeTxt = P.time || 'hôm nay 30/10/2026';
  var head =
    '<div class="alert alert--warning alert--banner net-banner" role="alert">' + ic('wifi-off') + '<div class="alert__body"><span><strong>Mất kết nối.</strong> Bản nháp được lưu trên thiết bị (lúc 09:14). <strong>Chưa thể ghi nhận thanh toán, chi tiền, chốt ca/ngày hoặc phát hành hóa đơn</strong>: các nút này tạm khóa để tránh ghi trùng. Xem số liệu cũ vẫn được, ghi “Cập nhật lúc 09:15”.</span></div></div>' +
    '<div><nav class="breadcrumb" aria-label="Đường dẫn"><a href="../foundation/shell.html">GARAGE OS</a>' + ic('chevron-right') + '<a href="' + (P.menu === 'einv' ? 'g4-ein-01.html' : 'g4-acc-02.html') + '">' + crumbGroup + '</a>' + ic('chevron-right') + '<span aria-current="page">' + esc(P.title) + '</span></nav></div>' +
    '<div class="page-header"><div class="page-header__text"><h1>' + esc(P.title) + '</h1><p class="page-header__desc">' + esc(P.desc || '') + (P.code ? ' <span class="t-caption text-tertiary">(' + esc(P.code) + ')</span>' : '') + '</p></div><div class="page-header__actions">' + actionsHTML + '</div></div>' +
    subnavHTML() +
    '<div class="scope-banner" role="status">' + ic('map-pin', 'icon--sm') + '<span><strong>Phạm vi:</strong> <span data-scope-text>Tất cả chi nhánh</span></span><span data-legal hidden>· <strong>Pháp nhân:</strong> Tất cả pháp nhân được xem (không cộng gộp trong báo cáo chính thức)</span><span>· <strong>Thời gian:</strong> ' + esc(timeTxt) + '</span><span>· Cập nhật lúc ' + esc(P.updated || '09:15') + '</span>' + (P.scopeExtra ? '<span>· ' + P.scopeExtra + '</span>' : '') + '<button class="btn btn--ghost btn--sm" style="margin-left:auto" data-toast="info|Đang làm mới|Dữ liệu cập nhật lúc 09:16.">' + ic('refresh', 'icon--sm') + 'Làm mới</button></div>' +
    '<div class="alert alert--neutral g4f-rolenote" id="g4f-rolenote" role="status" hidden>' + ic('lock') + '<div class="alert__body"><span class="alert__title" id="g4f-rolenote-t"></span><span id="g4f-rolenote-x"></span></div></div>';
  main.innerHTML = head;

  /* Bộ chuyển trạng thái */
  var LABEL = { data: 'Có dữ liệu', loading: 'Đang tải', empty: 'Trống (lần đầu)', filtered: 'Trống (do lọc)', error: 'Lỗi tải', denied: 'Không có quyền' };
  var states = P.states || null;
  var host = document.createElement('div'); host.className = 'stack'; host.setAttribute('data-state-group', '');
  main.appendChild(host);
  var panels = {};
  if (src && states) {
    $$(':scope > [data-state]', src).forEach(function (p) { panels[p.getAttribute('data-state')] = p; p.remove(); });
    var dataPanel = document.createElement('div'); dataPanel.setAttribute('data-state', 'data'); dataPanel.className = 'stack';
    while (src.firstChild) dataPanel.appendChild(src.firstChild);
    panels.data = dataPanel;
    var E = P.empty || {};
    var skRows = '';
    for (var i = 0; i < 4; i++) skRows += '<tr class="skeleton-row"><td><span class="skeleton skeleton--text" style="width:110px"></span></td><td><span class="skeleton skeleton--text" style="width:140px"></span></td><td><span class="skeleton skeleton--text" style="width:96px;height:24px"></span></td><td><span class="skeleton skeleton--text" style="width:100px;margin-left:auto"></span></td></tr>';
    var auto = {
      loading: '<div class="table-wrap" aria-busy="true"><div class="table-scroll"><table class="table"><thead><tr><th>Mã</th><th>Nội dung</th><th>Trạng thái</th><th class="col-num">Số tiền</th></tr></thead><tbody>' + skRows + '</tbody></table></div></div><p class="t-body-sm text-secondary">Đang tải dữ liệu… Các thẻ khác của trang vẫn dùng được.</p>',
      empty: '<div class="table-wrap"><div class="state"><div class="state__icon state__icon--brand">' + ic(E.icon || 'inbox', 'icon--lg') + '</div><div class="state__title">' + esc(E.title || 'Chưa có dữ liệu') + '</div><p class="state__text">' + esc(E.text || '') + '</p>' + (E.cta ? '<div class="state__actions"><a class="btn btn--primary" href="' + (E.href || '#') + '">' + ic('plus') + esc(E.cta) + '</a></div>' : '') + '</div></div>',
      filtered: '<div class="table-wrap"><div class="state"><div class="state__icon">' + ic('search', 'icon--lg') + '</div><div class="state__title">Không tìm thấy kết quả phù hợp</div><p class="state__text">' + esc(P.filteredText || 'Không có bản ghi nào khớp bộ lọc hiện tại. Thử bỏ bớt bộ lọc hoặc mở rộng khoảng thời gian.') + '</p><div class="state__actions"><button class="btn btn--secondary" data-g4f-clear>Xóa tất cả bộ lọc</button></div></div></div>',
      error: '<div class="table-wrap"><div class="state"><div class="state__icon state__icon--danger">' + ic('alert-triangle', 'icon--lg') + '</div><div class="state__title">Không tải được dữ liệu</div><p class="state__text">Đây là lỗi tải, không phải “chưa có dữ liệu”. Số liệu trên màn hình trước đó có thể đã cũ. Kiểm tra mạng rồi thử lại; nếu vẫn lỗi, báo mã tham chiếu cho quản trị hệ thống.</p><div class="state__actions"><button class="btn btn--primary" data-g4f-retry>' + ic('refresh') + 'Thử lại</button></div><div class="state__ref">Mã tham chiếu: ERR-G4F-' + esc((P.code || 'G4').replace(/[^A-Z0-9]/gi, '')) + '-20261030-0915</div></div></div>',
      denied: '<div class="table-wrap"><div class="state"><div class="state__icon state__icon--warning">' + ic('lock', 'icon--lg') + '</div><div class="state__title">Bạn không có quyền xem màn hình này</div><p class="state__text" id="g4f-denied-text"></p><div class="state__actions"><a class="btn btn--secondary" href="../foundation/shell.html">Về Tổng quan</a></div></div></div>'
    };
    states.forEach(function (n) {
      if (!panels[n]) { var d = document.createElement('div'); d.setAttribute('data-state', n); d.innerHTML = auto[n] || ''; panels[n] = d; }
    });
    var bar = '<div class="g4f-demo" role="group" aria-label="Xem thử trạng thái màn hình (chỉ prototype)"><span class="g4f-demo__label">XEM THỬ TRẠNG THÁI (prototype)</span><div class="segmented" role="group" aria-label="Trạng thái">' +
      states.map(function (n, ix) { var p = panels[n]; return '<button class="segmented__item" data-state-switch="' + n + '" aria-pressed="' + (ix === 0) + '">' + esc(p.getAttribute('data-label') || (n === 'data' && P.dataLabel) || LABEL[n] || n) + '</button>'; }).join('') +
      '</div><button class="btn btn--ghost btn--sm" data-toggle-offline>' + ic('wifi-off', 'icon--sm') + 'Thử: mất kết nối</button></div>';
    host.insertAdjacentHTML('beforeend', bar);
    states.forEach(function (n, ix) { var p = panels[n]; if (ix > 0) p.hidden = true; host.appendChild(p); });
  } else if (src) {
    host.className = 'stack';
    while (src.firstChild) host.appendChild(src.firstChild);
    if (P.offlineToggle) host.insertAdjacentHTML('afterbegin', '<div class="g4f-demo"><span class="g4f-demo__label">XEM THỬ (prototype)</span><button class="btn btn--ghost btn--sm" data-toggle-offline>' + ic('wifi-off', 'icon--sm') + 'Thử: mất kết nối</button></div>');
  }
  if (src) src.remove();

  /* Nâng ô ngày thường thành Date Picker chuẩn (lịch, tuần bắt đầu Thứ 2, nhập tay luôn được) */
  $$('.input-group.date-field').forEach(function (g) {
    if (g.closest('[data-datepicker]')) return;
    var host = document.createElement('div'); host.className = 'datepicker-host'; host.setAttribute('data-datepicker', 'single');
    g.parentNode.insertBefore(host, g); host.appendChild(g);
    var old = $('svg.icon', g); if (old) old.remove();
    g.insertAdjacentHTML('beforeend', '<button type="button" class="btn-icon input-group__btn" data-dp-toggle aria-expanded="false" aria-label="Mở lịch chọn ngày" style="right:2px;width:40px;height:36px"><svg class="icon" style="position:static;color:inherit"><use href="#calendar"/></svg></button>');
    host.insertAdjacentHTML('beforeend', '<div class="datepicker" role="dialog" aria-label="Chọn ngày"></div>');
  });

  /* Hộp thoại “Hiện dữ liệu cá nhân” khi trang có .pii */
  if ($('.pii') && !document.getElementById('dlg-reveal')) {
    body.insertAdjacentHTML('beforeend', '<div class="overlay" id="dlg-reveal" role="alertdialog" aria-modal="true" aria-labelledby="rv-t"><div class="dialog"><div class="dialog__header"><div class="dialog__icon dialog__icon--warning">' + ic('eye') + '</div><div><h2 class="dialog__title" id="rv-t">Hiện thông tin cá nhân của khách</h2></div><button class="btn-icon dialog__close" data-close aria-label="Đóng">' + ic('x') + '</button></div><div class="dialog__body"><p>Chọn lý do. Việc xem được ghi nhật ký (người xem, thời điểm, bản ghi, lý do) và tự che lại sau 30 giây.</p><fieldset style="border:0;padding:0;margin:0" class="reason-list"><legend class="sr-only">Lý do xem</legend><label class="radio"><input type="radio" name="rv"><span class="radio__box"></span><span>Đối chiếu hóa đơn</span></label><label class="radio"><input type="radio" name="rv"><span class="radio__box"></span><span>Thu hồi công nợ</span></label><label class="radio"><input type="radio" name="rv"><span class="radio__box"></span><span>Lý do khác</span></label></fieldset></div><div class="dialog__footer"><button class="btn btn--secondary" data-close>Hủy</button><button class="btn btn--primary" data-reveal-confirm disabled>Hiện và ghi nhật ký</button></div></div></div>');
  }

  /* ---------- Quyền theo vai trò, mất kết nối ---------- */
  function curRole() { return body.getAttribute('data-role') || 'KT'; }
  function applyAccess() {
    var r = curRole(), forcedDenied = false;
    $$('.g4f-subnav a[data-roles]').forEach(function (a) { a.hidden = a.getAttribute('data-roles').split(' ').indexOf(r) < 0; });
    $$('[data-g4f-roles]').forEach(function (el) { el.hidden = el.getAttribute('data-g4f-roles').split(' ').indexOf(r) < 0; });
    if (P.allow && states && states.indexOf('denied') >= 0) {
      var ok = P.allow.indexOf(r) >= 0, grp = $('[data-state-group]');
      var dt = document.getElementById('g4f-denied-text');
      if (dt) dt.textContent = 'Vai trò “' + ROLE_NAME[r] + '” không có quyền với màn hình này. Vai trò được xem: ' + P.allow.map(function (x) { return ROLE_NAME[x]; }).join(', ') + '. Liên hệ Quản lý chi nhánh hoặc Chủ garage nếu cần quyền.';
      if (!ok) { forcedDenied = true; body.setAttribute('data-g4f-forced', '1'); pick('denied'); }
      else if (body.getAttribute('data-g4f-forced') === '1') { body.removeAttribute('data-g4f-forced'); pick('data'); }
      $$('[data-state-switch]', grp).forEach(function (b) { if (b.getAttribute('data-state-switch') !== 'denied') b.disabled = forcedDenied; });
    }
    var why = [];
    $$('[data-g4f-need]').forEach(function (el) {
      var allowed = el.getAttribute('data-g4f-need').split(' ').indexOf(r) >= 0;
      if (!allowed) {
        el.setAttribute('data-g4f-keep', '1');
        var w = el.getAttribute('data-g4f-why'); if (w && why.indexOf(w) < 0) why.push(w);
      } else el.removeAttribute('data-g4f-keep');
      refreshBtn(el);
    });
    $$('.user-btn__text strong').forEach(function (s) { s.textContent = USER[r] || ''; });
    var note = document.getElementById('g4f-rolenote');
    if (note) {
      note.hidden = !(why.length && !forcedDenied);
      document.getElementById('g4f-rolenote-t').textContent = 'Bạn đang xem với vai trò “' + ROLE_NAME[r] + '”: một số nút bị khóa';
      document.getElementById('g4f-rolenote-x').textContent = why.join(' · ');
    }
    applyNet();
  }
  function pick(name) {
    var grp = $('[data-state-group]'); if (!grp) return;
    $$('[data-state-switch]', grp).forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-state-switch') === name)); });
    $$('[data-state]', grp).forEach(function (p) { p.hidden = p.getAttribute('data-state') !== name; });
  }
  function applyNet() {
    var off = !!$('.net-banner.is-visible');
    $$('[data-g4f-online]').forEach(function (el) {
      if (off) el.setAttribute('data-g4f-net', '1'); else el.removeAttribute('data-g4f-net');
      refreshBtn(el);
    });
  }
  /* Một nơi duy nhất quyết định nút có bật không: AND của (hợp lệ theo trang, biến thể, cổng xác nhận) và NOT (khóa vai trò, mất mạng, đã gửi) */
  function refreshBtn(el) {
    var keep = el.hasAttribute('data-g4f-keep'), net = el.hasAttribute('data-g4f-net'), lk = el.hasAttribute('data-g4f-keep-lock');
    var dis = el._ok === false || el._ov === false || el._gate === false || keep || net || lk;
    el.disabled = dis; if (dis) el.setAttribute('aria-disabled', 'true'); else el.removeAttribute('aria-disabled');
    if (keep) el.title = el.getAttribute('data-g4f-why') || ''; else if (net) el.title = 'Mất kết nối: thao tác ghi tiền/hóa đơn tạm khóa để tránh ghi trùng.'; else if (el._t) el.removeAttribute('title');
    el._t = keep || net;
  }
  function setEnabled(el, ok) { el._ok = !!ok; refreshBtn(el); }
  /* Quyền duyệt theo (loại yêu cầu, vai trò) và người lập khác người duyệt (F5-02). Cấp duyệt thật lấy từ G4-APR-03. */
  var APPR = { disc: ['QL CH QV', 'Quản lý chi nhánh trở lên'], diff: ['QL CH QV', 'Quản lý chi nhánh trở lên'], refund: ['QL CH QV', 'Quản lý chi nhánh (CH/QV khi vượt hạn mức)'], spend: ['QV CH', 'Quản lý vùng hoặc Chủ garage (vượt hạn mức cấp Quản lý)'], cancel: ['QL CH QV', 'Quản lý chi nhánh'], inv: ['KTT CH', 'Kế toán trưởng (cờ quyền) hoặc Chủ garage'], reopen: ['CH', 'Chủ garage'] };
  function canApprove(type, role, proposer) {
    var cfg = APPR[type]; if (!cfg) return { ok: false, why: 'Loại yêu cầu chưa có trong ma trận.' };
    if (proposer && proposer === USER[role]) return { ok: false, why: 'Bạn là người đề xuất yêu cầu này; người lập không tự duyệt.' };
    var roles = cfg[0].split(' ');
    if (roles.indexOf(role) >= 0) return { ok: true };
    if (role === 'KT' && roles.indexOf('KTT') >= 0 && window.G4F && G4F.ktt) return { ok: true };
    return { ok: false, why: 'Vai trò “' + ROLE_NAME[role] + '” không duyệt loại này. Cấp duyệt: ' + cfg[1] + '.' };
  }
  document.addEventListener('click', function (e) {
    var sw = e.target.closest('[data-role-switch]');
    if (sw) { try { sessionStorage.setItem('g4f-role', sw.getAttribute('data-role-switch')); } catch (x) {} setTimeout(applyAccess, 0); }
    if (e.target.closest('[data-toggle-offline]')) setTimeout(applyAccess, 0);
    if (e.target.closest('[data-g4f-retry]')) { var g = $('[data-state-switch="loading"]'); if (g) { g.click(); setTimeout(function () { var d = $('[data-state-switch="data"]'); if (d) d.click(); }, 900); } }
    if (e.target.closest('[data-g4f-clear]')) { var d2 = $('[data-state-switch="data"]'); if (d2) d2.click(); if (window.gmepToast) window.gmepToast('info', 'Đã xóa bộ lọc', 'Hiển thị lại toàn bộ kết quả trong phạm vi hiện tại.'); }
    if (e.target.closest('[data-g4f-print]')) {
      var pa = $('.overlay.is-open .g4f-print-area:not([hidden])') || $('.g4f-print-area:not([hidden])');
      $$('.g4f-pa-anc').forEach(function (x) { x.classList.remove('g4f-pa-anc'); });
      if (pa) { for (var n = pa.parentElement; n && n !== document.documentElement; n = n.parentElement) n.classList.add('g4f-pa-anc'); body.classList.add('g4f-printing'); }
      window.print();
    }
  });

  window.addEventListener('afterprint', function () { body.classList.remove('g4f-printing'); $$('.g4f-pa-anc').forEach(function (x) { x.classList.remove('g4f-pa-anc'); }); });
  /* Liên kết bị khóa (a[aria-disabled]) không được điều hướng */
  document.addEventListener('click', function (e) { var a = e.target.closest('a[aria-disabled="true"]'); if (a) { e.preventDefault(); e.stopPropagation(); } }, true);

  /* ---------- Khóa chống bấm đúp khi ghi tiền / phát hành (idempotent) ---------- */
  document.addEventListener('click', function (e) {
    var s = e.target.closest('[data-g4f-submit]'); if (!s || s.disabled) return;
    var ov = s.closest('.overlay'); if (ov && window.gmepClose) window.gmepClose(ov);
    var tgt = s.getAttribute('data-lock') ? $(s.getAttribute('data-lock')) : null;
    var label = tgt ? tgt.innerHTML : '';
    if (tgt) { tgt.setAttribute('aria-busy', 'true'); tgt.setAttribute('data-g4f-keep-lock', '1'); refreshBtn(tgt); tgt.innerHTML = '<svg class="icon spin" aria-hidden="true"><use href="#loader"/></svg>' + esc(s.getAttribute('data-busy') || 'Đang xử lý…'); }
    var live = document.getElementById('g4f-live'); if (!live) { live = document.createElement('div'); live.id = 'g4f-live'; live.className = 'sr-only'; live.setAttribute('role', 'status'); body.appendChild(live); }
    live.textContent = s.getAttribute('data-busy') || 'Đang xử lý';
    setTimeout(function () {
      if (tgt) { tgt.removeAttribute('aria-busy'); tgt.innerHTML = s.getAttribute('data-done-label') ? ic('check') + esc(s.getAttribute('data-done-label')) : label; }
      var t = (s.getAttribute('data-done-toast') || '').split('|'); if (t[0] && window.gmepToast) window.gmepToast(t[0], t[1], t[2]);
      var show = s.getAttribute('data-done-show'); if (show) $$(show).forEach(function (x) { x.hidden = false; });
      var hide = s.getAttribute('data-done-hide'); if (hide) $$(hide).forEach(function (x) { x.hidden = true; });
      live.textContent = s.getAttribute('data-done-toast') ? s.getAttribute('data-done-toast').split('|').slice(1).join('. ') : 'Hoàn tất';
    }, 1300);
  });
  /* Cổng xác nhận bằng ô tích (dùng cho hộp thoại tiền không cần gõ mã) */
  document.addEventListener('change', function (e) {
    var c = e.target.closest('[data-g4f-gate-check]'); if (!c) return;
    var box = c.closest('[data-g4f-gate]'); $$('[data-g4f-gate-btn]', box).forEach(function (b) { b._gate = c.checked; refreshBtn(b); });
  });
  /* Mở hộp thoại có cổng: luôn bỏ tích và khóa nút xác nhận lại */
  document.addEventListener('click', function (e) {
    var op = e.target.closest('[data-open]'); if (!op) return; var d = document.getElementById(op.getAttribute('data-open')); if (!d) return;
    $$('[data-g4f-gate]', d).forEach(function (g) { $$('[data-g4f-gate-check]', g).forEach(function (c) { c.checked = false; }); $$('[data-g4f-gate-btn]', g).forEach(function (b) { b._gate = false; refreshBtn(b); }); });
  });
  $$('[data-g4f-gate-btn]').forEach(function (b) { b._gate = false; refreshBtn(b); });

  /* ---------- Tiện ích dùng chung ---------- */
  function fmt(n) { var neg = n < 0; n = Math.round(Math.abs(n)); return (neg ? '−' : '') + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' ₫'; }
  function num(v) { var d = String(v == null ? '' : v).replace(/[^\d]/g, ''); return d ? parseInt(d, 10) : 0; }
  document.addEventListener('input', function (e) {
    var m = e.target.closest('input[data-money]'); if (!m) return;
    var n = num(m.value); m.value = n ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
  });
  function wizard(root, opts) {
    opts = opts || {};
    var steps = $$('[data-g4f-step]', root), ind = $$('.stepper__step', root), cur = 0;
    function show(i) {
      cur = i;
      steps.forEach(function (s, k) { s.hidden = k !== i; });
      ind.forEach(function (li, k) { li.classList.toggle('is-done', k < i); li.classList.toggle('is-current', k === i); if (k === i) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); var n = $('.stepper__num', li); if (n) n.innerHTML = k < i ? '<svg class="icon icon--sm" style="width:14px;height:14px"><use href="#check"/></svg>' : String(k + 1); });
      $$('[data-g4f-prev]', root).forEach(function (b) { b.hidden = i === 0; });
      $$('[data-g4f-next]', root).forEach(function (b) { b.hidden = i === steps.length - 1; });
      $$('[data-g4f-final]', root).forEach(function (b) { b.hidden = i !== steps.length - 1; });
      if (opts.onShow) opts.onShow(i);
      var h = $('h2, h3', steps[i]); if (h && started) { h.setAttribute('tabindex', '-1'); h.focus(); }
    }
    var started = false;
    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-g4f-next]')) {
        var r = opts.canNext ? opts.canNext(cur) : { ok: true };
        if (r && r.ok === false) { if (window.gmepToast) window.gmepToast('warning', 'Chưa sang bước tiếp được', r.msg || ''); return; }
        show(Math.min(cur + 1, steps.length - 1));
      }
      if (e.target.closest('[data-g4f-prev]')) show(Math.max(cur - 1, 0));
    });
    show(0); started = true;
    return { show: show, cur: function () { return cur; } };
  }
  /* Biến thể trong một trang: nút [data-g4f-var][data-vg] đổi phần tử [data-vg][data-v] */
  function applyVar(group, v) {
    $$('[data-vg="' + group + '"]').forEach(function (el) {
      if (el.hasAttribute('data-v')) el.hidden = el.getAttribute('data-v').split(' ').indexOf(v) < 0;
      if (el.hasAttribute('data-v-not')) el.hidden = el.getAttribute('data-v-not').split(' ').indexOf(v) >= 0;
      if (el.hasAttribute('data-v-off')) { var off = el.getAttribute('data-v-off').split(' ').indexOf(v) >= 0; el.disabled = off; if (off) el.setAttribute('aria-disabled', 'true'); else el.removeAttribute('aria-disabled'); }
    });
    $$('[data-g4f-var][data-vg="' + group + '"]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-g4f-var') === v)); });
    document.dispatchEvent(new CustomEvent('g4f:var', { detail: { group: group, v: v } }));
    applyAccess();
  }
  document.addEventListener('click', function (e) { var b = e.target.closest('button[data-g4f-var]'); if (b) applyVar(b.getAttribute('data-vg'), b.getAttribute('data-g4f-var')); });
  document.addEventListener('DOMContentLoaded', function () { $$('[data-g4f-var-init]').forEach(function (g) { applyVar(g.getAttribute('data-g4f-var-init'), g.getAttribute('data-g4f-var-default')); }); });

  window.G4F = { fmt: fmt, num: num, wizard: wizard, applyVar: applyVar, refresh: applyAccess, $: $, $$: $$ };
  applyAccess();
})();
