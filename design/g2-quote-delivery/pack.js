/* GMEP – Gói 3: helper prototype (không phải code production).
   Nạp ở đầu <body> để dựng Application Shell chuẩn (cùng class với design/foundation/shell.html) bằng document.write,
   và sau app.js (sự kiện DOMContentLoaded) để khởi tạo "biến thể/trạng thái xem thử", mở hộp thoại tự động, tham số URL.
   Tham số URL: ?role=CV|QL|QD|TH|... đổi vai trò · ?v=<biến thể> chọn trạng thái xem thử · ?<khóa>=<biến thể> cho vùng có data-key. */
(function () {
  'use strict';
  var g = window.g2q = {};
  var Q = new URLSearchParams(location.search);
  var USERS = {
    /* Tên khớp gói 2 (g2-rec-04): CV Nguyễn Hoàng Yến, Quản đốc Phạm Quốc Bảo, thợ Lê Minh Tuấn / Trần Văn Hậu, thu ngân Mai Thu Thảo */
    CH: ['Chủ garage', 'Trần Hoàng Anh', 'TA'], QV: ['Quản lý vùng', 'Lê Minh Quân', 'LQ'], QL: ['Quản lý chi nhánh', 'Nguyễn Thị Thu Hà', 'NH'],
    CV: ['Cố vấn dịch vụ', 'Nguyễn Hoàng Yến', 'NY'], QD: ['Quản đốc', 'Phạm Quốc Bảo', 'PB'], TH: ['Thợ', 'Lê Minh Tuấn', 'LT'],
    TK: ['Thủ kho', 'Hoàng Thị Lan', 'HL'], TN: ['Thu ngân', 'Mai Thu Thảo', 'MT'], KT: ['Kế toán', 'Đặng Thu Trang', 'ĐT'], MH: ['Nhân viên mua hàng', 'Lý Thanh Bình', 'LB'], NS: ['Nhân sự', 'Phùng Thị Ngọc', 'PN'], AD: ['Quản trị hệ thống', 'Ngô Quang Huy', 'NH']
  };
  var w = function (s) { document.write(s); };
  var ic = g.ic = function (n, c) { return '<svg class="icon' + (c ? ' ' + c : '') + '" aria-hidden="true"><use href="#' + n + '"/></svg>'; };
  g.fmt = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' ₫'; };

  function nav(key, icon, label, href, active, pill) {
    return '<a class="nav-item" href="' + (href || '#') + '" data-menu="' + key + '" title="' + label + '"' + (active === key ? ' aria-current="page"' : '') + '>' + ic(icon) +
      '<span class="nav-item__label">' + label + '</span>' + (pill || '') + '</a>';
  }

  /* ---------------- Application Shell (đóng ở g.end) ---------------- */
  /* LƯU Ý HANDOFF (F3-36): shell dựng bằng document.write chỉ để prototype không lặp ~150 dòng mỗi trang.
     Sản phẩm thật dùng component của framework (giữ nguyên class/cấu trúc), không sao chép document.write, và nên chạy được với CSP nghiêm ngặt (không script inline). */
  var techMode = false;
  /* Shell rút gọn cho thiết bị xưởng (F3-11): thợ không có tìm kiếm toàn hệ thống, không có menu khách/báo cáo/cài đặt,
     thông báo chỉ gồm việc mới, QC trả lại, phát sinh được duyệt, phụ tùng sẵn sàng; không có menu "xem thử theo vai trò". */
  function techShell(h, active) {
    h = h.replace(/<div class="sidebar__group">Workspace<\/div>[\s\S]*?(?=<\/nav><div class="sidebar__footer">)/,
      '<div class="sidebar__group">Thiết bị xưởng</div>' + nav('ro', 'clipboard-list', 'Việc của tôi', 'g2-tec-01.html', active) + nav('hr', 'id-card', 'Công của tôi', 'g2-tec-05.html', active));
    h = h.replace(/<a class="nav-item" href="#" data-menu="set"[\s\S]*?<\/a>(?=<button class="nav-item collapse-btn")/, '');
    h = h.replace('<div class="branch-static" data-branch-static hidden>', '<div class="branch-static" data-branch-static>');
    h = h.replace(/<div class="dropdown" data-branch-dropdown>[\s\S]*?(?=<div class="topbar__search">)/, '');
    h = h.replace(/<div class="topbar__search">[\s\S]*?(?=<div class="topbar__spacer">)/, '');
    h = h.replace(/<button class="btn-icon topbar__search-btn"[\s\S]*?<\/button>/, '');
    h = h.replace(/<a class="notif-item is-unread" href="g2-quo-03\.html"[\s\S]*?<\/a><a class="notif-item is-unread" href="g2-quo-07\.html"[\s\S]*?<\/a>/,
      '<a class="notif-item is-unread" href="g2-tec-01.html" style="color:inherit"><span class="notif-item__icon">' + ic('undo', 'icon--sm') + '</span><div><div style="font-weight:600">QC trả lại: xiết lại lực xiết bánh sau (51G-765.43)</div><div class="t-body-sm text-secondary">08:40 · Cần xử lý</div></div></a>' +
      '<a class="notif-item is-unread" href="g2-tec-01.html" style="color:inherit"><span class="notif-item__icon">' + ic('wrench', 'icon--sm') + '</span><div><div style="font-weight:600">Việc mới: thay bugi (4 cái) (59A-111.22)</div><div class="t-body-sm text-secondary">09:10 · Thông tin</div></div></a>');
    h = h.replace(/<div class="menu-sep"><\/div><div class="menu-label">Xem thử theo vai trò[\s\S]*?(?=<\/div><\/div><\/header>)/, '');
    return h;
  }
  g.begin = function (role, active) {
    var r = Q.get('role'); if (r && USERS[r]) role = r;
    document.body.setAttribute('data-role', role);
    var u = USERS[role];
    techMode = (role === 'TH');
    var html = ('<a class="skip-link" href="#main">Bỏ qua điều hướng, tới nội dung chính</a><div class="app" id="app">' +
      '<aside class="sidebar" aria-label="Điều hướng chính"><div class="sidebar__brand"><span class="sidebar__logo" aria-hidden="true">' + ic('wrench') + '</span><span class="sidebar__brand-name">GARAGE OS</span>' +
      '<button class="btn-icon menu-btn" data-nav-close aria-label="Đóng menu" style="margin-left:auto">' + ic('x') + '</button></div><nav class="sidebar__nav">' +
      '<div class="sidebar__group">Workspace</div>' +
      nav('dash', 'layout-dashboard', 'Tổng quan', '#', active) +
      nav('ro', 'clipboard-list', 'Phiếu sửa chữa', role === 'TH' ? 'g2-tec-01.html' : 'g2-quo-01.html', active, '<span class="count-pill count-pill--warning" aria-label="8 báo giá chờ khách duyệt" title="8 báo giá chờ khách duyệt">8</span>') +
      nav('appt', 'calendar', 'Lịch hẹn', '#', active) + nav('cust', 'car-front', 'Khách hàng &amp; Xe', '#', active) +
      '<div class="sidebar__group">Kho &amp; mua hàng</div>' + nav('inv', 'warehouse', 'Kho phụ tùng', '#', active) + nav('pur', 'shopping-cart', 'Mua hàng', '#', active) +
      '<div class="sidebar__group">Nhân sự &amp; tài chính</div>' + nav('hr', 'id-card', 'Nhân sự &amp; Công thợ', 'g2-tec-05.html', active) + nav('fin', 'wallet', 'Tài chính', '#', active) + nav('einv', 'receipt', 'Hóa đơn', '#', active) +
      '<div class="sidebar__group">Phân tích</div>' + nav('rpt', 'chart-no-axes-combined', 'Báo cáo', '#', active) +
      '</nav><div class="sidebar__footer">' + nav('set', 'settings', 'Cài đặt', '#', active) +
      '<button class="nav-item collapse-btn" data-sidebar-toggle aria-expanded="true" aria-label="Thu gọn thanh bên" style="width:100%" title="Thu gọn / mở rộng">' + ic('panel-left') + '<span class="nav-item__label">Thu gọn</span></button></div></aside>' +
      '<div class="drawer-nav-backdrop" data-nav-close></div>' +
      '<header class="topbar"><button class="btn-icon menu-btn" data-nav-open aria-label="Mở menu">' + ic('menu') + '</button>' +
      '<div class="branch-static" data-branch-static hidden>' + ic('map-pin') + '<span class="branch-static__text"><span class="branch-btn__caption">Chi nhánh của bạn</span><span class="branch-btn__name" data-static-label>Chi nhánh Quận 7</span></span></div>' +
      '<div class="dropdown" data-branch-dropdown><button class="branch-btn is-all" aria-haspopup="menu" aria-expanded="false" aria-label="Chọn phạm vi chi nhánh">' + ic('map-pin') +
      '<span class="branch-btn__text"><span class="branch-btn__caption">Phạm vi dữ liệu</span><span class="branch-btn__name" data-branch-label>Tất cả chi nhánh</span></span>' + ic('chevron-down', 'icon--sm') + '</button>' +
      '<div class="dropdown__menu" role="menu" style="min-width:320px">' +
      '<div class="menu-label" data-show-roles="CH QV">Hợp nhất</div>' +
      '<button class="menu-item" role="menuitemradio" aria-checked="true" data-level="all" data-branch="Tất cả chi nhánh" data-branch-all data-show-roles="CH">' + ic('layout-dashboard') + 'Tất cả chi nhánh<span class="menu-item__hint">toàn chuỗi</span></button>' +
      '<button class="menu-item" role="menuitemradio" aria-checked="false" data-level="all" data-branch="Tất cả nhóm được giao" data-branch-all data-show-roles="QV" hidden>' + ic('layout-dashboard') + 'Tất cả nhóm được giao</button>' +
      '<div class="menu-sep" data-show-roles="CH QV"></div><div class="menu-label" data-show-roles="CH QV">Nhóm chi nhánh (vùng)</div>' +
      '<button class="menu-item menu-item--group" role="menuitemradio" aria-checked="false" data-level="group" data-branch="Nhóm Miền Nam" data-show-roles="CH QV">' + ic('users') + 'Nhóm Miền Nam</button>' +
      '<div class="menu-sep" data-show-roles="CH QV"></div><div class="menu-label">Từng chi nhánh</div>' +
      '<button class="menu-item menu-item--indent" role="menuitemradio" aria-checked="false" data-level="branch" data-branch="Chi nhánh Quận 1" data-show-roles="CH QV">Chi nhánh Quận 1</button>' +
      '<button class="menu-item menu-item--indent" role="menuitemradio" aria-checked="false" data-level="branch" data-branch="Chi nhánh Quận 7" data-show-roles="CH QV QL KT">Chi nhánh Quận 7</button>' +
      '<button class="menu-item menu-item--indent" role="menuitemradio" aria-checked="false" data-level="branch" data-branch="Chi nhánh Thủ Đức" data-show-roles="CH QV QL KT">Chi nhánh Thủ Đức</button>' +
      '<button class="menu-item menu-item--indent" role="menuitemradio" aria-disabled="true" data-level="branch" data-show-roles="QL KT">' + ic('lock') + 'Chi nhánh Biên Hòa<span class="menu-item__hint">Chưa được cấp quyền</span></button>' +
      '<div class="menu-sep"></div><p class="t-body-sm text-secondary" style="padding:8px 12px" data-multi-note hidden>Tài khoản của bạn chỉ xem được các chi nhánh được gán. Xem hợp nhất dành cho Chủ garage và Quản lý vùng.</p></div></div>' +
      '<div class="topbar__search">' + ic('search') + '<input class="input" data-global-search type="search" placeholder="Tìm phiếu, biển số, khách, phụ tùng…" aria-label="Tìm kiếm toàn hệ thống"><span class="kbd" aria-hidden="true">Ctrl K</span></div>' +
      '<div class="topbar__spacer"></div><button class="btn-icon topbar__search-btn" aria-label="Tìm kiếm">' + ic('search') + '</button>' +
      '<div class="dropdown"><button class="btn-icon" aria-haspopup="menu" aria-expanded="false" aria-label="Thông báo, 2 chưa đọc">' + ic('bell') + '<span class="btn-icon__dot" aria-hidden="true">2</span></button>' +
      '<div class="dropdown__menu dropdown__menu--right notif-panel" role="menu" data-keep-open><div class="notif-panel__head"><strong>Thông báo</strong><button class="btn btn--ghost btn--sm">Đánh dấu đã đọc</button></div>' +
      '<a class="notif-item is-unread" href="g2-quo-03.html" style="color:inherit"><span class="notif-item__icon">' + ic('clock', 'icon--sm') + '</span><div><div style="font-weight:600">Báo giá BG-Q7-2610-00231-v2 được khách duyệt một phần</div><div class="t-body-sm text-secondary">Chi nhánh Quận 7 · 5 phút trước · Cần xử lý</div></div></a>' +
      '<a class="notif-item is-unread" href="g2-quo-07.html" style="color:inherit"><span class="notif-item__icon">' + ic('alert-triangle', 'icon--sm') + '</span><div><div style="font-weight:600">Thợ báo hạng mục phát sinh trên lệnh RO-Q7-2610-00128</div><div class="t-body-sm text-secondary">Chi nhánh Quận 7 · 12 phút trước · Cần xử lý</div></div></a>' +
      '<div style="padding:8px 16px"><a href="#">Xem tất cả thông báo</a></div></div></div>' +
      '<div class="dropdown"><button class="user-btn" aria-haspopup="menu" aria-expanded="false" aria-label="Menu tài khoản"><span class="avatar avatar--sm" data-g2q-avatar>' + u[2] + '</span>' +
      '<span class="user-btn__text"><strong class="t-body-sm" style="line-height:16px" data-g2q-user>' + u[1] + '</strong><span class="user-btn__role" data-role-label>' + u[0] + '</span></span>' + ic('chevron-down', 'icon--sm') + '</button>' +
      '<div class="dropdown__menu dropdown__menu--right" role="menu" style="min-width:280px"><div class="menu-label">Tài khoản</div>' +
      '<button class="menu-item" role="menuitem">' + ic('user') + 'Hồ sơ cá nhân</button><button class="menu-item" role="menuitem">' + ic('log-out') + 'Đăng xuất</button><div class="menu-sep"></div><div class="menu-label">Xem thử theo vai trò (chỉ prototype)</div>' +
      ['CH', 'QL', 'CV', 'QD', 'TH', 'TK', 'TN', 'KT', 'MH', 'NS'].map(function (k) { return '<button class="menu-item" role="menuitemradio" data-keep-open data-role-switch="' + k + '" data-role-name="' + USERS[k][0] + '" aria-checked="' + (k === role) + '">' + USERS[k][0] + '</button>'; }).join('') +
      '</div></div></header>' +
      '<main class="main" id="main"><div class="main__inner">' +
      '<div class="alert alert--warning alert--banner net-banner" role="alert">' + ic('wifi-off') + '<div class="alert__body"><span><strong>Mất kết nối.</strong> Bản nháp được lưu trên thiết bị (lúc 09:14). Chưa thể gửi báo giá, xuất phụ tùng, thu tiền, xuất hóa đơn. Mốc giờ làm việc vẫn được ghi và sẽ đồng bộ sau (đánh dấu “nhập bù”). Bản nháp chỉ lưu trên máy, chưa gửi tới ai.</span></div></div>');
    if (techMode) html = techShell(html, active);
    w(html);
  };

  g.header = function (o) {
    var c = '<a href="#">GARAGE OS</a>';
    (o.crumbs || []).forEach(function (x, i, a) { c += ic('chevron-right') + (i === a.length - 1 ? '<span aria-current="page">' + x[0] + '</span>' : '<a href="' + (x[1] || '#') + '">' + x[0] + '</a>'); });
    w('<div><nav class="breadcrumb" aria-label="Đường dẫn">' + c + '</nav></div><div class="page-header"><div class="page-header__text"><h1>' + o.title + '</h1>' +
      (o.desc ? '<p class="page-header__desc">' + o.desc + '</p>' : '') + '</div><div class="page-header__actions">' + (o.actions || '') +
      '<button class="btn btn--ghost" data-toggle-offline>' + ic('wifi-off') + 'Thử: mất kết nối</button></div></div>');
  };
  /* Thanh phạm vi (RULE-015): chi nhánh · thời gian · thời điểm cập nhật */
  g.scope = function (time, upd) {
    w('<div class="scope-banner" role="status">' + ic('map-pin', 'icon--sm') + '<span><strong>Phạm vi:</strong> <span data-scope-text>Chi nhánh Quận 7</span></span>' +
      '<span>· <strong>Thời gian:</strong> ' + (time || 'hôm nay 30/10/2026') + '</span><span>· Cập nhật lúc ' + (upd || '09:15') + '</span>' +
      '<button class="btn btn--ghost btn--sm" style="margin-left:auto" data-toast="info|Đang làm mới|Dữ liệu cập nhật lúc 09:16.">' + ic('refresh', 'icon--sm') + 'Làm mới</button></div>');
  };
  g.end = function () {
    if (techMode) {
      w('</div></main><nav class="bottom-nav" aria-label="Điều hướng nhanh"><a class="bottom-nav__item" href="g2-tec-01.html" data-menu="ro">' + ic('clipboard-list') + 'Việc của tôi</a><a class="bottom-nav__item" href="g2-tec-05.html" data-menu="hr">' + ic('id-card') + 'Công của tôi</a></nav></div>');
      return;
    }
    w('</div></main><nav class="bottom-nav" aria-label="Điều hướng nhanh">' +
      '<a class="bottom-nav__item" href="#" data-menu="dash">' + ic('layout-dashboard') + 'Tổng quan</a>' +
      '<a class="bottom-nav__item" href="g2-quo-01.html" data-menu="ro">' + ic('clipboard-list') + 'Phiếu</a>' +
      '<a class="bottom-nav__item" href="#" data-menu="appt">' + ic('calendar') + 'Lịch hẹn</a>' +
      '<a class="bottom-nav__item" href="g2-tec-05.html" data-menu="hr">' + ic('id-card') + 'Công</a>' +
      '<button class="bottom-nav__item" data-nav-open aria-label="Mở toàn bộ menu">' + ic('menu') + 'Thêm</button></nav></div>');
  };

  /* ---------------- Thanh xem thử + trạng thái dùng chung ---------------- */
  g.proto = function (items, def, label, forId) {
    w('<div class="g2q-proto"><span class="g2q-proto__label">' + (label || 'Xem thử trạng thái (chỉ prototype)') + '</span><div class="segmented" role="group" aria-label="' + (label || 'Xem thử trạng thái') + '">' +
      items.map(function (x) { return '<button type="button" class="segmented__item" data-set="' + x[0] + '"' + (forId ? ' data-for="' + forId + '"' : '') + ' aria-pressed="' + (x[0] === def) + '">' + x[1] + '</button>'; }).join('') + '</div></div>');
  };
  g.state = function (o) {
    var ico = { empty: 'inbox', filter: 'search', error: 'alert-triangle', noperm: 'lock', notfound: 'search', offline: 'wifi-off' }[o.kind] || 'info';
    var cls = { error: ' state__icon--danger', noperm: ' state__icon--warning', empty: ' state__icon--brand' }[o.kind] || '';
    w('<div class="state" role="' + (o.kind === 'error' ? 'alert' : 'status') + '"><div class="state__icon' + cls + '">' + ic(ico, 'icon--lg') + '</div><h2 class="state__title">' + o.title + '</h2><p class="state__text">' + o.text + '</p>' +
      (o.actions ? '<div class="state__actions">' + o.actions + '</div>' : '') + (o.ref ? '<div class="state__ref">' + o.ref + '</div>' : '') + '</div>');
  };
  g.skelRows = function (rows, cols) {
    var s = ''; for (var i = 0; i < rows; i++) { s += '<tr class="skeleton-row">'; for (var j = 0; j < cols; j++) s += '<td><span class="skeleton skeleton--text" style="width:' + (50 + ((i + j) * 13) % 45) + '%"></span></td>'; s += '</tr>'; }
    w(s);
  };
  g.skelCards = function (n) { var s = ''; for (var i = 0; i < n; i++) s += '<div class="card" style="padding:20px"><span class="skeleton skeleton--title"></span><br><span class="skeleton skeleton--text" style="width:70%"></span><br><span class="skeleton skeleton--text" style="width:50%"></span></div>'; w(s); };

  /* Hộp thoại dùng chung màn thợ: Tạm dừng (chọn lý do = 1 chạm) và Kết thúc (xác nhận nhanh) */
  g.techDialogs = function () {
    w('<div class="overlay" id="dlg-pause" role="dialog" aria-modal="true" aria-labelledby="dp-t"><div class="dialog g2q-dlg-sheet">' +
      '<div class="dialog__header"><div class="dialog__icon dialog__icon--warning">' + ic('clock') + '</div><div><h2 class="dialog__title" id="dp-t">Vì sao tạm dừng?</h2><div class="g2q-note">Thay má phanh trước · 51H-123.45. Giờ làm không tính trong lúc tạm dừng.</div></div></div>' +
      '<div class="dialog__body"><div class="g2q-reasons">' +
      '<button class="btn btn--secondary" data-close data-toast="warning|Đã tạm dừng: chờ phụ tùng|Đã báo thủ kho. Lệnh hiện lý do Chờ phụ tùng. Giờ làm dừng lúc 10:05.">' + ic('package') + 'Chờ phụ tùng</button>' +
      '<button class="btn btn--secondary" data-close data-toast="warning|Đã tạm dừng: chờ khách duyệt|Hạng mục phát sinh chờ khách duyệt. Giờ làm dừng lúc 10:05.">' + ic('clock') + 'Chờ khách duyệt phát sinh</button>' +
      '<button class="btn btn--secondary" data-close data-toast="warning|Đã tạm dừng: nghỉ|Bấm Tiếp tục khi quay lại làm. Giờ làm dừng lúc 10:05.">' + ic('user') + 'Nghỉ</button>' +
      '<button class="btn btn--secondary" data-close data-toast="warning|Đã tạm dừng: lý do khác|Bạn có thể ghi chú thêm ở chi tiết hạng mục.">' + ic('ellipsis') + 'Khác</button></div>' +
      '<p class="g2q-note">Chọn “Chờ phụ tùng” sẽ tự gửi yêu cầu cho thủ kho (G2-TEC-03).</p></div>' +
      '<div class="dialog__footer"><button class="btn btn--ghost" data-close style="min-height:var(--btn-height-xl)">Không tạm dừng nữa</button></div></div></div>' +
      '<div class="overlay" id="dlg-finish" role="alertdialog" aria-modal="true" aria-labelledby="df-t"><div class="dialog g2q-dlg-sheet">' +
      '<div class="dialog__header"><div class="dialog__icon" style="background:var(--color-success-bg);color:var(--color-success-text)">' + ic('check') + '</div><div><h2 class="dialog__title" id="df-t">Kết thúc hạng mục này?</h2></div></div>' +
      '<div class="dialog__body"><div class="g2q-kv" style="grid-template-columns:110px minmax(0,1fr)"><dt>Hạng mục</dt><dd>Thay má phanh trước</dd><dt>Xe</dt><dd>51H-123.45 · Toyota Vios</dd><dt>Giờ thực</dt><dd>0 giờ 40 phút (giờ chuẩn 1,5 giờ)</dd></div>' +
      '<p>Hạng mục chuyển <strong>Hoàn thành</strong> và bị khóa. Khi hạng mục cuối cùng xong, hệ thống <strong>nhắc quản đốc</strong> chuyển lệnh sang Chờ QC (lệnh không tự chuyển). Công chỉ được ghi sau khi QC đạt.</p></div>' +
      '<div class="dialog__footer"><button class="btn btn--secondary" data-close style="min-height:var(--btn-height-xl)">Chưa xong</button><button class="btn btn--primary" data-close style="min-height:var(--btn-height-xl)" data-toast="success|Đã kết thúc 10:05|Hạng mục Hoàn thành. Quản đốc được nhắc chuyển lệnh sang Chờ QC khi hết hạng mục.">Kết thúc hạng mục</button></div></div></div>');
  };

  /* ---------------- Khởi tạo sau app.js ---------------- */
  var PRESET = {};
  function owner(el) { return el.closest('[data-variants]'); }
  function apply(root, val) {
    root.setAttribute('data-cur', val);
    root.querySelectorAll('[data-v]').forEach(function (el) {
      if (owner(el) !== root) return;
      var l = (' ' + el.getAttribute('data-v') + ' ');
      el.hidden = !(l.indexOf(' ' + val + ' ') >= 0 || el.getAttribute('data-v') === '*');
    });
    root.querySelectorAll('[data-vx]').forEach(function (el) {
      if (owner(el) !== root) return;
      el.hidden = (' ' + el.getAttribute('data-vx') + ' ').indexOf(' ' + val + ' ') >= 0;
    });
    document.querySelectorAll('[data-set]').forEach(function (b) {
      var tgt = b.getAttribute('data-for') ? document.getElementById(b.getAttribute('data-for')) : owner(b);
      if (tgt === root && b.classList.contains('segmented__item')) b.setAttribute('aria-pressed', String(b.getAttribute('data-set') === val));
    });
    root.dispatchEvent(new CustomEvent('g2q:variant', { detail: val }));
  }
  g.setVariant = function (root, val) { apply(root, val); };
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-set]'); if (!b) return;
    var root = b.getAttribute('data-for') ? document.getElementById(b.getAttribute('data-for')) : owner(b);
    if (root) apply(root, b.getAttribute('data-set'));
  });
  /* Toast "Bắt đầu" có nút Hoàn tác 10 giây (F3-26): hoàn tác tạo mốc "hủy bắt đầu" có ghi vết, không xóa mốc, không tính giờ */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-g2q-undo]'); if (!b || !window.gmepToast) return;
    var p = b.getAttribute('data-g2q-undo').split('|');
    /* Thanh hoàn tác riêng (không dùng toast chung vì toast tự xóa sau 5 giây): sống đủ 10 giây, có đếm ngược */
    var old = document.getElementById('g2q-undo'); if (old) old.remove();
    var bar = document.createElement('div'); bar.id = 'g2q-undo'; bar.setAttribute('role', 'status'); bar.className = 'alert alert--success g2q-undo';
    var left = 10;
    bar.innerHTML = ic('circle-check') + '<div class="alert__body"><span class="alert__title"></span><span class="g2q-undo__t"></span></div><button type="button" class="btn btn--secondary btn--xl">' + ic('undo') + 'Hoàn tác (<span class="g2q-undo__n">10</span>)</button>';
    bar.querySelector('.alert__title').textContent = p[0]; bar.querySelector('.g2q-undo__t').textContent = p[1];
    document.body.appendChild(bar);
    /* F3R3-01: chừa chỗ đáy để thanh không che thẻ vừa bấm, cuộn thẻ vào vùng nhìn, thanh nằm trên bottom nav */
    document.body.classList.add('g2q-has-undo');
    try { b.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (x) {}
    function done() { bar.remove(); document.body.classList.remove('g2q-has-undo'); }
    var iv = setInterval(function () { left--; var n = bar.querySelector('.g2q-undo__n'); if (n) n.textContent = left; if (left <= 0) { clearInterval(iv); done(); } }, 1000);
    bar.querySelector('button').addEventListener('click', function () { clearInterval(iv); done(); window.gmepToast('info', 'Đã hủy bắt đầu', 'Mốc “hủy bắt đầu” được ghi vết, không tính giờ làm.'); });
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-print]')) window.print();
    var sw = e.target.closest('[data-role-switch]');
    if (sw) {
      var k = sw.getAttribute('data-role-switch'), u = USERS[k];
      var n = document.querySelector('[data-g2q-user]'), a = document.querySelector('[data-g2q-avatar]');
      if (u && n) { n.textContent = u[1]; a.textContent = u[2]; }
    }
  });
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-variants]').forEach(function (root) {
      var key = root.getAttribute('data-key') || 'v';
      apply(root, Q.get(key) || root.getAttribute('data-variants') || 'default');
    });
    /* Bảng → danh sách thẻ trên điện thoại (<640px): sinh từ chính bảng để dữ liệu một nguồn */
    document.querySelectorAll('table[data-cardify]').forEach(function (t) {
      var wrap = t.closest('.table-wrap'); if (!wrap) return; wrap.classList.add('table-wrap--responsive');
      var list = document.createElement('div'); list.className = 'record-list record-list--responsive'; list.setAttribute('aria-label', 'Danh sách dạng thẻ');
      t.querySelectorAll('tbody tr').forEach(function (tr) {
        if (tr.classList.contains('g2q-group')) return;
        var get = function (k) { var x = tr.querySelector('[data-card="' + k + '"]'); return x ? x.innerHTML : ''; };
        var meta = ''; tr.querySelectorAll('[data-label]').forEach(function (td) { meta += '<span>' + td.getAttribute('data-label') + ': <strong>' + td.innerHTML + '</strong></span>'; });
        var rec = document.createElement('div'); rec.className = 'record';
        var last = tr.lastElementChild, foot = get('foot') || (last && last.classList.contains('col-actions') ? last.innerHTML : '');
        var status = get('status') || tr.getAttribute('data-card-status') || tr.parentNode.getAttribute('data-card-status') || '';
        rec.innerHTML = '<div class="record__top"><span class="record__title">' + get('title') + '</span>' + status + '</div><div class="record__meta">' + meta + '</div>' + (foot ? '<div class="record__foot">' + foot + '</div>' : '');
        list.appendChild(rec);
      });
      wrap.parentNode.insertBefore(list, wrap.nextSibling);
    });
    document.querySelectorAll('[data-autoopen]').forEach(function (o) { if (window.gmepOpen && Q.get('dlg') !== '0') window.gmepOpen(o.id); });
    if (window.g2qReady) window.g2qReady();
  });
})();
