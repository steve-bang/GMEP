/* G1 – dựng Application Shell chuẩn (G1-SHL-01) cho mọi trang có <body data-g1-shell>.
   Chạy TRƯỚC ../assets/app.js để app.js áp dụng menu theo vai trò và phạm vi chi nhánh.
   Thuộc tính body: data-role (CH QV QL CV QD TH TK TN KT AD) · data-g1-menu (mục menu đang mở) · data-crumb ("A|B")
   · data-period (today|7d|month|none) · data-figure (nhãn số tạm/chính thức) · data-multirole ("QL,CV") · data-no-scope.
   Nội dung trang nằm trong <div id="g1-content" hidden>. Chỉ là prototype, không phải code production. */
(function () {
  'use strict';
  var b = document.body;
  var G1 = window.G1 = window.G1 || {};
  G1.PERIODS = { today: 'hôm nay 30/10/2026', '7d': '24–30/10/2026', month: '01–30/10/2026', none: '' };
  G1.PERIOD_NAMES = { today: 'Hôm nay', '7d': '7 ngày', month: 'Tháng này' };
  G1.HOME = { CH: 'g1-dsh-01.html', QV: 'g1-dsh-02.html', QL: 'g1-dsh-03.html', CV: 'g1-dsh-04.html', TK: 'g1-dsh-05.html', KT: 'g1-dsh-06.html', TH: 'g1-dsh-07.html', TN: 'g1-dsh-08.html', QD: 'g1-dsh-09.html', AD: 'g1-dsh-10.html' };
  var ROLES = {
    CH: ['Chủ garage', 'Trần Hoàng Anh'], QV: ['Quản lý vùng', 'Lê Minh Quân'], QL: ['Quản lý chi nhánh', 'Nguyễn Thị Thu Hà'],
    CV: ['Cố vấn dịch vụ', 'Phạm Quốc Bảo'], QD: ['Quản đốc', 'Võ Văn Thành'], TH: ['Thợ', 'Đỗ Văn Tùng'], TK: ['Thủ kho', 'Hoàng Thị Lan'],
    TN: ['Thu ngân', 'Bùi Ngọc Mai'], KT: ['Kế toán', 'Đặng Thu Trang'], AD: ['Quản trị hệ thống', 'Ngô Quang Huy']
  };
  G1.ROLES = ROLES;
  if (!b.hasAttribute('data-g1-shell')) return;

  var role = b.getAttribute('data-role') || 'CH';
  var info = ROLES[role] || ROLES.CH;
  var active = b.getAttribute('data-g1-menu') || 'dash';
  var period = b.getAttribute('data-period') || 'none';
  var initials = info[1].split(' ').slice(-2).map(function (w) { return w.charAt(0); }).join('');
  var content = document.getElementById('g1-content');
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };

  function ic(n, c) { return '<svg class="icon' + (c ? ' ' + c : '') + '" aria-hidden="true"><use href="#' + n + '"/></svg>'; }
  function nav(key, label, icon, extra) {
    var cur = key === active ? ' aria-current="page"' : '';
    var href = key === 'dash' ? G1.HOME[role] : '#';
    return '<a class="nav-item" href="' + href + '" data-menu="' + key + '"' + cur + ' title="' + label + '">' + ic(icon) + '<span class="nav-item__label">' + label + '</span>' + (extra || '') + '</a>';
  }
  var pillRo = ['CH', 'QV', 'QL', 'CV'].indexOf(role) >= 0 ? '<span class="count-pill count-pill--warning" aria-label="8 báo giá chờ khách duyệt" title="8 báo giá chờ khách duyệt">8</span><span class="nav-item__dot" aria-hidden="true"></span>' : '';
  var pillInv = ['CH', 'QV', 'QL', 'TK'].indexOf(role) >= 0 ? '<span class="count-pill count-pill--danger" aria-label="5 mặt hàng sắp hết" title="5 mặt hàng sắp hết">5</span><span class="nav-item__dot" aria-hidden="true"></span>' : '';

  var sidebar =
    '<aside class="sidebar" aria-label="Điều hướng chính"><div class="sidebar__brand"><span class="sidebar__logo" aria-hidden="true">' + ic('wrench') + '</span><span class="sidebar__brand-name">GARAGE OS</span>' +
    '<button class="btn-icon menu-btn" data-nav-close aria-label="Đóng menu" style="margin-left:auto">' + ic('x') + '</button></div><nav class="sidebar__nav">' +
    '<div class="sidebar__group">Workspace</div>' + nav('dash', 'Tổng quan', 'layout-dashboard') + nav('ro', 'Phiếu sửa chữa', 'clipboard-list', pillRo) + nav('appt', 'Lịch hẹn', 'calendar') + nav('cust', 'Khách hàng &amp; Xe', 'car-front') +
    '<div class="sidebar__group">Kho &amp; mua hàng</div>' + nav('inv', 'Kho phụ tùng', 'warehouse', pillInv) + nav('pur', 'Mua hàng', 'shopping-cart') +
    '<div class="sidebar__group">Nhân sự &amp; tài chính</div>' + nav('hr', 'Nhân sự &amp; Công thợ', 'id-card') + nav('fin', 'Tài chính', 'wallet') + nav('einv', 'Hóa đơn', 'receipt') +
    '<div class="sidebar__group">Phân tích</div>' + nav('rpt', 'Báo cáo', 'chart-no-axes-combined') +
    '</nav><div class="sidebar__footer">' + nav('set', 'Cài đặt', 'settings') +
    '<button class="nav-item collapse-btn" data-sidebar-toggle aria-expanded="true" aria-label="Thu gọn thanh bên" style="width:100%" title="Thu gọn / mở rộng">' + ic('panel-left') + '<span class="nav-item__label">Thu gọn</span></button></div></aside><div class="drawer-nav-backdrop" data-nav-close></div>';

  function bItem(level, name, roles, extra) {
    return '<button class="menu-item' + (level === 'group' ? ' menu-item--group' : level === 'branch' ? ' menu-item--indent' : '') + '" role="menuitemradio" aria-checked="false" data-level="' + level + '" data-branch="' + name + '" data-show-roles="' + roles + '"' + (extra || '') + '>' + (level === 'branch' ? '' : ic(level === 'all' ? 'layout-dashboard' : 'users')) + name + (level === 'all' && roles === 'CH' ? '<span class="menu-item__hint">toàn chuỗi</span>' : '') + '</button>';
  }
  var branchDd =
    '<div class="branch-static" data-branch-static hidden>' + ic('map-pin') + '<span class="branch-static__text"><span class="branch-btn__caption">Chi nhánh của bạn</span><span class="branch-btn__name" data-static-label>Chi nhánh Quận 7</span></span></div>' +
    '<div class="dropdown" data-branch-dropdown><button class="branch-btn is-all" aria-haspopup="menu" aria-expanded="false" aria-label="Chọn phạm vi chi nhánh">' + ic('map-pin') +
    '<span class="branch-btn__text"><span class="branch-btn__caption">Phạm vi dữ liệu</span><span class="branch-btn__name" data-branch-label>Tất cả chi nhánh</span></span>' + ic('chevron-down', 'icon--sm') + '</button>' +
    '<div class="dropdown__menu" role="menu" style="min-width:320px"><div class="menu-label" data-show-roles="CH QV">Hợp nhất</div>' +
    bItem('all', 'Tất cả chi nhánh', 'CH', ' data-branch-all') + bItem('all', 'Tất cả nhóm được giao', 'QV', ' data-branch-all hidden') +
    '<div class="menu-sep" data-show-roles="CH QV"></div><div class="menu-label" data-show-roles="CH QV">Nhóm chi nhánh (vùng)</div>' +
    bItem('group', 'Nhóm Miền Nam', 'CH QV') + bItem('group', 'Nhóm Miền Trung', 'CH') +
    '<div class="menu-sep" data-show-roles="CH QV"></div><div class="menu-label">Từng chi nhánh</div>' +
    bItem('branch', 'Chi nhánh Quận 1', 'CH QV') + bItem('branch', 'Chi nhánh Quận 7', 'CH QV QL KT') + bItem('branch', 'Chi nhánh Thủ Đức', 'CH QV QL KT') + bItem('branch', 'Chi nhánh Biên Hòa', 'CH QV') + bItem('branch', 'Chi nhánh Đà Nẵng', 'CH') +
    '<button class="menu-item menu-item--indent" role="menuitemradio" aria-checked="false" aria-disabled="true" data-level="branch" data-show-roles="QL KT">' + ic('lock') + 'Chi nhánh Biên Hòa<span class="menu-item__hint">Chưa được cấp quyền</span></button>' +
    '<div class="legal-filter" data-legal hidden><div class="field"><label class="field__label" for="legal">Pháp nhân</label><select id="legal" class="select"><option>Tất cả pháp nhân được xem</option><option>Công ty TNHH Garage A</option><option>Công ty TNHH Garage B</option></select><span class="field__hint">Báo cáo chính thức không cộng gộp số liệu giữa các pháp nhân.</span></div></div>' +
    '<div class="menu-sep"></div><p class="t-body-sm text-secondary" style="padding:8px 12px" data-multi-note hidden>Tài khoản của bạn chỉ xem được các chi nhánh được gán. Xem hợp nhất dành cho Chủ garage và Quản lý vùng. Đổi phạm vi khi đang soạn chứng từ sẽ hỏi lưu nháp trước.</p></div></div>';

  function notif(icon, title, meta, unread) {
    return '<a class="notif-item' + (unread ? ' is-unread' : '') + '" href="g1-ntf-01.html" style="color:inherit"><span class="notif-item__icon">' + ic(icon, 'icon--sm') + '</span><div><div style="font-weight:600">' + title + '</div><div class="t-body-sm text-secondary">' + meta + '</div></div></a>';
  }
  var notifDd =
    '<div class="dropdown"><button class="btn-icon" aria-haspopup="menu" aria-expanded="false" aria-label="Thông báo, 3 chưa đọc">' + ic('bell') + '<span class="btn-icon__dot" aria-hidden="true">3</span></button>' +
    '<div class="dropdown__menu dropdown__menu--right notif-panel" role="menu" data-keep-open><div class="notif-panel__head"><strong>Thông báo</strong><a class="btn btn--ghost btn--sm" href="g1-ntf-01.html">Mở trung tâm thông báo</a></div>' +
    '<div class="menu-label">Cần xử lý</div>' +
    notif('clock', 'Báo giá BG-Q7-2610-00225 được khách duyệt một phần', 'Chi nhánh Quận 7 · 5 phút trước', true) +
    notif('alert-triangle', 'Chênh lệch quỹ cuối ngày cần giải trình', 'Chi nhánh Thủ Đức · hôm qua', true) +
    '<div class="menu-label">Thông tin</div>' + notif('package', 'Má phanh trước Accent còn 3 khả dụng, dưới định mức', 'Kho Quận 7 · 20 phút trước', true) +
    '<div style="padding:8px 16px"><a href="g1-ntf-01.html">Xem tất cả thông báo</a></div></div></div>';

  var others = Object.keys(ROLES).map(function (k) {
    return '<a class="menu-item" role="menuitemradio" aria-checked="' + (k === role) + '" href="' + G1.HOME[k] + '">' + ROLES[k][0] + '</a>';
  }).join('');
  var multi = (b.getAttribute('data-multirole') || '').split(',').filter(Boolean);
  var multiHtml = multi.length > 1 ? '<div class="menu-label">Góc nhìn vai trò (tài khoản có nhiều vai trò)</div>' + multi.map(function (k) {
    return '<a class="menu-item" role="menuitemradio" aria-checked="' + (k === role) + '" href="' + G1.HOME[k] + '">' + ROLES[k][0] + (k === multi[0] ? '<span class="menu-item__hint">cao nhất, mặc định</span>' : '') + '</a>';
  }).join('') + '<div class="menu-sep"></div>' : '';
  var userDd =
    '<div class="dropdown"><button class="user-btn" aria-haspopup="menu" aria-expanded="false" aria-label="Menu tài khoản">' + '<span class="avatar avatar--sm">' + esc(initials) + '</span><span class="user-btn__text"><strong class="t-body-sm" style="line-height:16px">' + esc(info[1]) + '</strong><span class="user-btn__role" data-role-label>' + info[0] + '</span></span>' + ic('chevron-down', 'icon--sm') + '</button>' +
    '<div class="dropdown__menu dropdown__menu--right" role="menu" style="min-width:300px"><div class="menu-label">Tài khoản</div>' +
    '<a class="menu-item" role="menuitem" href="g1-prf-01.html">' + ic('user') + 'Hồ sơ cá nhân</a><a class="menu-item" role="menuitem" href="g1-prf-02.html">' + ic('lock') + 'Bảo mật tài khoản</a>' +
    '<a class="menu-item" role="menuitem" href="g1-prf-02.html#lich-su">' + ic('history') + 'Nhật ký đăng nhập của tôi</a>' +
    '<button class="menu-item" role="menuitem" data-open="dlg-logout">' + ic('log-out') + 'Đăng xuất</button><div class="menu-sep"></div>' + multiHtml +
    '<div class="menu-label">Xem thử dashboard theo vai trò (chỉ prototype)</div>' + others + '</div></div>';

  var topbar =
    '<header class="topbar"><button class="btn-icon menu-btn" data-nav-open aria-label="Mở menu">' + ic('menu') + '</button>' + branchDd +
    '<form class="topbar__search" action="g1-shl-02.html" role="search">' + ic('search') + '<input class="input" data-global-search name="q" type="search" placeholder="Tìm phiếu, biển số, khách, phụ tùng…" aria-label="Tìm kiếm toàn hệ thống"><span class="kbd" aria-hidden="true">Ctrl K</span></form>' +
    '<div class="topbar__spacer"></div><a class="btn-icon topbar__search-btn" href="g1-shl-02.html" aria-label="Tìm kiếm">' + ic('search') + '</a>' + notifDd + userDd + '</header>';

  var crumbs = (b.getAttribute('data-crumb') || 'Tổng quan').split('|');
  var crumbHtml = '<nav class="breadcrumb" aria-label="Đường dẫn"><a href="' + G1.HOME[role] + '">GARAGE OS</a>' + crumbs.map(function (c, i) {
    return ic('chevron-right') + (i === crumbs.length - 1 ? '<span aria-current="page">' + c + '</span>' : '<a href="#">' + c + '</a>');
  }).join('') + '</nav>';

  var net = '<div class="alert alert--warning alert--banner net-banner" role="alert">' + ic('wifi-off') + '<div class="alert__body"><span><strong>Mất kết nối.</strong> Bản nháp được lưu trên thiết bị (lúc 09:14). Chưa thể xuất kho, thu tiền, xuất hóa đơn. Đang thử kết nối lại…</span></div></div>';

  var figure = b.getAttribute('data-figure');
  var scope = '';
  if (!b.hasAttribute('data-no-scope')) {
    scope = '<div class="scope-banner" role="status">' + ic('map-pin', 'icon--sm') + '<span><strong>Phạm vi:</strong> <span data-scope-text>Tất cả chi nhánh – số liệu hợp nhất</span></span>' +
      '<span data-legal hidden>· <strong>Pháp nhân:</strong> Tất cả pháp nhân được xem (không cộng gộp trong báo cáo chính thức)</span>' +
      (period !== 'none' ? '<span>· <strong>Thời gian:</strong> <span data-g1-period-text>' + G1.PERIODS[period] + '</span></span>' : '') +
      '<span>· Cập nhật lúc <span data-g1-asof>09:15</span></span>' +
      (figure ? '<span class="badge badge--info badge--nodot" title="Số tạm có thể thay đổi cho đến khi chốt ngày (FR-RPT-010)">' + figure + '</span>' : '') +
      '<button class="btn btn--ghost btn--sm" style="margin-left:auto" data-g1-refresh>' + ic('refresh', 'icon--sm') + 'Làm mới</button></div>';
  }

  var bottom =
    '<nav class="bottom-nav" aria-label="Điều hướng nhanh"><a class="bottom-nav__item" href="' + G1.HOME[role] + '" data-menu="dash" aria-current="page">' + ic('layout-dashboard') + 'Tổng quan</a>' +
    '<a class="bottom-nav__item" href="#" data-menu="ro">' + ic('clipboard-list') + 'Phiếu</a><a class="bottom-nav__item" href="#" data-menu="appt">' + ic('calendar') + 'Lịch hẹn</a><a class="bottom-nav__item" href="#" data-menu="inv">' + ic('warehouse') + 'Kho</a>' +
    '<button class="bottom-nav__item" data-nav-open aria-label="Mở toàn bộ menu">' + ic('menu') + 'Thêm</button></nav>';

  var app = document.createElement('div');
  app.className = 'app'; app.id = 'app';
  app.innerHTML = sidebar + topbar + '<main class="main" id="main" tabindex="-1"><div class="main__inner" id="g1-inner">' + net + '<div>' + crumbHtml + '</div></div></main>' + bottom;
  var skip = document.createElement('a'); skip.className = 'skip-link'; skip.href = '#main'; skip.textContent = 'Bỏ qua điều hướng, tới nội dung chính';
  b.insertBefore(app, b.firstChild); b.insertBefore(skip, b.firstChild);

  var inner = document.getElementById('g1-inner');
  if (content) {
    while (content.firstChild) inner.appendChild(content.firstChild);
    content.remove();
  }
  var ph = inner.querySelector('.page-header');
  if (ph && scope) ph.insertAdjacentHTML('afterend', scope);

  /* Hộp thoại dùng chung (đặt trực tiếp dưới body để app.js đặt inert đúng) */
  var dlgs = document.createElement('div');
  dlgs.innerHTML =
    '<div class="overlay" id="dlg-logout" role="alertdialog" aria-modal="true" aria-labelledby="dl-t"><div class="dialog"><div class="dialog__header"><div class="dialog__icon dialog__icon--warning">' + ic('log-out') + '</div><div><h2 class="dialog__title" id="dl-t">Đăng xuất khỏi GARAGE OS?</h2></div></div>' +
    '<div class="dialog__body"><p>Phiên làm việc trên thiết bị này sẽ kết thúc.</p><p data-draft-only hidden><strong>Bạn đang soạn một chứng từ chưa lưu.</strong> Bản nháp được giữ trên thiết bị và hiện lại khi bạn đăng nhập lại bằng cùng tài khoản. Bạn nên chọn “Ở lại” rồi lưu nháp lên hệ thống trước.</p></div>' +
    '<div class="dialog__footer"><button class="btn btn--secondary" data-close>Ở lại</button><a class="btn btn--primary" href="g1-aut-01.html">Đăng xuất</a></div></div></div>' +
    '<div class="overlay" id="dlg-scope" role="alertdialog" aria-modal="true" aria-labelledby="ds-t"><div class="dialog"><div class="dialog__header"><div class="dialog__icon dialog__icon--warning">' + ic('pencil') + '</div><div><h2 class="dialog__title" id="ds-t">Lưu nháp trước khi đổi phạm vi?</h2></div></div>' +
    '<div class="dialog__body"><p>Bạn đang soạn một phiếu. Đổi phạm vi chi nhánh sẽ làm số liệu và danh mục khác đi. Phiếu được lưu thành bản nháp của chi nhánh hiện tại rồi mới đổi.</p></div>' +
    '<div class="dialog__footer"><button class="btn btn--secondary" data-close>Ở lại, tiếp tục soạn</button><button class="btn btn--primary" data-scope-confirm>Lưu nháp và đổi phạm vi</button></div></div></div>';
  var ref = null;
  Array.prototype.some.call(b.children, function (c) { if (c.tagName === 'SCRIPT') { ref = c; return true; } return false; });
  while (dlgs.firstChild) b.insertBefore(dlgs.firstChild, ref);
  Array.prototype.forEach.call(inner.querySelectorAll('.overlay'), function (o) { b.insertBefore(o, ref); });

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-open="dlg-logout"]')) {
      var p = document.querySelector('[data-draft-only]'); if (p) p.hidden = b.getAttribute('data-draft') !== '1';
    }
  });
})();
