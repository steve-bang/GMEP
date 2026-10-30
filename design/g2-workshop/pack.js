/* LƯU Ý HANDOFF (F2-25, F2-26): đây là mã minh họa. Khi làm thật: (1) shell render ở máy chủ/framework, có khung tĩnh trước khi hydrate;
   (2) ẩn/khóa theo vai trò và theo chi nhánh do DỮ LIỆU MÁY CHỦ quyết định: API chỉ trả phần được phép (giá, SĐT, thanh toán không được gửi xuống thiết bị thợ);
   (3) tham số ?role= và bảng PHONES chỉ có ở bản demo. Dùng ủy quyền sự kiện gom một chỗ thay cho nhiều document.addEventListener rải rác.
   Gói G2 (phần 1): JS prototype dùng chung. Nạp TRƯỚC ../assets/app.js.
   Việc làm: (1) dựng Application Shell (sidebar, topbar, bottom nav) để mọi trang dùng đúng một khung;
   (2) thanh phạm vi RULE-015; (3) bộ chuyển trạng thái demo + mẫu loading/empty/lỗi/không quyền;
   (4) khóa/ẩn theo vai trò; (5) wizard tiếp nhận; (6) kéo thả kanban có kiểm tra điều kiện; (7) lối tắt ?state= ?role=.
   Đây là code minh họa prototype, không phải code production. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var qs = new URLSearchParams(location.search);
  var body = document.body;
  if (qs.get('role')) body.setAttribute('data-role', qs.get('role').toUpperCase());

  /* ---------- 1. Application Shell ---------- */
  var HREF = { dash: '#', ro: 'g2-rec-02.html', appt: 'g2-apt-01.html', cust: 'g2-crm-01.html', inv: '#', pur: '#', hr: '#', fin: '#', einv: '#', rpt: '#', set: '#' };
  function nav(key, icon, label, extra) {
    return '<a class="nav-item" href="' + HREF[key] + '" data-menu="' + key + '" title="' + label + '"><svg class="icon"><use href="#' + icon + '"/></svg><span class="nav-item__label">' + label + '</span>' + (extra || '') + '</a>';
  }
  var SIDEBAR =
    '<aside class="sidebar" aria-label="Điều hướng chính"><div class="sidebar__brand"><span class="sidebar__logo" aria-hidden="true"><svg class="icon"><use href="#wrench"/></svg></span><span class="sidebar__brand-name">GARAGE OS</span>' +
    '<button class="btn-icon menu-btn" data-nav-close aria-label="Đóng menu" style="margin-left:auto"><svg class="icon"><use href="#x"/></svg></button></div>' +
    '<nav class="sidebar__nav"><div class="sidebar__group">Workspace</div>' +
    nav('dash', 'layout-dashboard', 'Tổng quan') +
    nav('ro', 'clipboard-list', 'Phiếu sửa chữa', '<span class="count-pill count-pill--warning" aria-label="8 báo giá chờ khách duyệt" title="8 báo giá chờ khách duyệt">8</span><span class="nav-item__dot" aria-hidden="true"></span>') +
    nav('appt', 'calendar', 'Lịch hẹn') +
    nav('cust', 'car-front', 'Khách hàng &amp; Xe') +
    '<div class="sidebar__group">Kho &amp; mua hàng</div>' +
    nav('inv', 'warehouse', 'Kho phụ tùng', '<span class="count-pill count-pill--danger" aria-label="5 mặt hàng sắp hết">5</span><span class="nav-item__dot" aria-hidden="true"></span>') +
    nav('pur', 'shopping-cart', 'Mua hàng') +
    '<div class="sidebar__group">Nhân sự &amp; tài chính</div>' +
    nav('hr', 'id-card', 'Nhân sự &amp; Công thợ') + nav('fin', 'wallet', 'Tài chính') + nav('einv', 'receipt', 'Hóa đơn') +
    '<div class="sidebar__group">Phân tích</div>' + nav('rpt', 'chart-no-axes-combined', 'Báo cáo') + '</nav>' +
    '<div class="sidebar__footer">' + nav('set', 'settings', 'Cài đặt') +
    '<button class="nav-item collapse-btn" data-sidebar-toggle aria-expanded="true" aria-label="Thu gọn thanh bên" style="width:100%" title="Thu gọn / mở rộng"><svg class="icon"><use href="#panel-left"/></svg><span class="nav-item__label">Thu gọn</span></button></div></aside>' +
    '<div class="drawer-nav-backdrop" data-nav-close></div>';

  function bItem(key, icon, label) { return '<a class="bottom-nav__item" href="' + HREF[key] + '" data-menu="' + key + '"><svg class="icon"><use href="#' + icon + '"/></svg>' + label + '</a>'; }
  var BOTTOM = '<nav class="bottom-nav" aria-label="Điều hướng nhanh">' + bItem('dash', 'layout-dashboard', 'Tổng quan') + bItem('ro', 'clipboard-list', 'Phiếu') + bItem('appt', 'calendar', 'Lịch hẹn') + bItem('cust', 'car-front', 'Khách &amp; Xe') +
    '<button class="bottom-nav__item" data-nav-open aria-label="Mở toàn bộ menu"><svg class="icon"><use href="#menu"/></svg>Thêm</button></nav>';

  function roleBtn(k, n, on) { return '<button class="menu-item" role="menuitemradio" data-keep-open data-role-switch="' + k + '" data-role-name="' + n + '" aria-checked="' + (on ? 'true' : 'false') + '">' + n + '</button>'; }
  function br(level, name, roles, extra) { return '<button class="menu-item ' + (level === 'branch' ? 'menu-item--indent' : level === 'group' ? 'menu-item--group' : '') + '" role="menuitemradio" aria-checked="false" data-level="' + level + '" data-branch="' + name + '" data-show-roles="' + roles + '"' + (extra || '') + '>' + name + '</button>'; }
  var TOPBAR =
    '<header class="topbar"><button class="btn-icon menu-btn" data-nav-open aria-label="Mở menu"><svg class="icon"><use href="#menu"/></svg></button>' +
    '<div class="branch-static" data-branch-static hidden><svg class="icon" aria-hidden="true"><use href="#map-pin"/></svg><span class="branch-static__text"><span class="branch-btn__caption">Chi nhánh của bạn</span><span class="branch-btn__name" data-static-label>Chi nhánh Quận 7</span></span></div>' +
    '<div class="dropdown" data-branch-dropdown><button class="branch-btn is-all" aria-haspopup="menu" aria-expanded="false" aria-label="Chọn phạm vi chi nhánh"><svg class="icon"><use href="#map-pin"/></svg><span class="branch-btn__text"><span class="branch-btn__caption">Phạm vi dữ liệu</span><span class="branch-btn__name" data-branch-label>Tất cả chi nhánh</span></span><svg class="icon icon--sm"><use href="#chevron-down"/></svg></button>' +
    '<div class="dropdown__menu" role="menu" style="min-width:320px"><div class="menu-label" data-show-roles="CH QV">Hợp nhất</div>' +
    '<button class="menu-item" role="menuitemradio" aria-checked="true" data-level="all" data-branch="Tất cả chi nhánh" data-branch-all data-show-roles="CH"><svg class="icon"><use href="#layout-dashboard"/></svg>Tất cả chi nhánh<span class="menu-item__hint">toàn chuỗi</span></button>' +
    '<button class="menu-item" role="menuitemradio" aria-checked="false" data-level="all" data-branch="Tất cả nhóm được giao" data-branch-all data-show-roles="QV" hidden><svg class="icon"><use href="#layout-dashboard"/></svg>Tất cả nhóm được giao</button>' +
    '<div class="menu-sep" data-show-roles="CH QV"></div><div class="menu-label" data-show-roles="CH QV">Nhóm chi nhánh (vùng)</div>' +
    br('group', 'Nhóm Miền Nam', 'CH QV') + br('group', 'Nhóm Miền Trung', 'CH') +
    '<div class="menu-sep" data-show-roles="CH QV"></div><div class="menu-label">Từng chi nhánh</div>' +
    br('branch', 'Chi nhánh Quận 1', 'CH QV') + br('branch', 'Chi nhánh Quận 7', 'CH QV QL KT') + br('branch', 'Chi nhánh Thủ Đức', 'CH QV QL KT') + br('branch', 'Chi nhánh Biên Hòa', 'CH QV') + br('branch', 'Chi nhánh Đà Nẵng', 'CH') +
    '<button class="menu-item menu-item--indent" role="menuitemradio" aria-checked="false" aria-disabled="true" data-level="branch" data-show-roles="QL KT"><svg class="icon"><use href="#lock"/></svg>Chi nhánh Biên Hòa<span class="menu-item__hint">Chưa được cấp quyền</span></button>' +
    '<div class="menu-sep"></div><p class="t-body-sm text-secondary" style="padding:8px 12px" data-multi-note hidden>Tài khoản của bạn chỉ xem được các chi nhánh được gán. Xem hợp nhất dành cho Chủ garage và Quản lý vùng. Đổi phạm vi khi đang soạn chứng từ sẽ hỏi lưu nháp trước.</p></div></div>' +
    '<div class="topbar__search"><svg class="icon"><use href="#search"/></svg><input class="input" data-global-search type="search" placeholder="Tìm phiếu, biển số, khách, phụ tùng…" aria-label="Tìm kiếm toàn hệ thống"><span class="kbd" aria-hidden="true">Ctrl K</span></div>' +
    '<div class="topbar__spacer"></div><button class="btn-icon topbar__search-btn" aria-label="Tìm kiếm"><svg class="icon"><use href="#search"/></svg></button>' +
    '<button class="btn-icon" data-theme-toggle aria-label="Đổi giao diện sáng/tối (bản nháp, không thuộc phạm vi phát hành)" title="Dark mode: bản nháp, chưa phát hành"><svg class="icon"><use href="#moon"/></svg></button>' +
    '<div class="dropdown"><button class="btn-icon" aria-haspopup="menu" aria-expanded="false" aria-label="Thông báo, 3 chưa đọc"><svg class="icon"><use href="#bell"/></svg><span class="btn-icon__dot" aria-hidden="true">3</span></button>' +
    '<div class="dropdown__menu dropdown__menu--right notif-panel" role="menu" data-keep-open><div class="notif-panel__head"><strong>Thông báo</strong><button class="btn btn--ghost btn--sm">Đánh dấu đã đọc</button></div>' +
    '<a class="notif-item is-unread" href="g2-rec-04.html" style="color:inherit"><span class="notif-item__icon"><svg class="icon icon--sm"><use href="#clock"/></svg></span><div><div style="font-weight:600">Báo giá BG-Q7-2610-00231-v2 được khách duyệt một phần</div><div class="t-body-sm text-secondary">Chi nhánh Quận 7 · 5 phút trước</div></div></a>' +
    '<a class="notif-item is-unread" href="g2-rec-03.html" style="color:inherit"><span class="notif-item__icon"><svg class="icon icon--sm"><use href="#package"/></svg></span><div><div style="font-weight:600">Lệnh RO-Q7-2610-00126 tạm dừng, chờ phụ tùng</div><div class="t-body-sm text-secondary">Chi nhánh Quận 7 · 20 phút trước</div></div></a>' +
    '<div style="padding:8px 16px"><a href="#">Xem tất cả thông báo</a></div></div></div>' +
    '<div class="dropdown"><button class="user-btn" aria-haspopup="menu" aria-expanded="false" aria-label="Menu tài khoản"><span class="avatar avatar--sm">NY</span><span class="user-btn__text"><strong class="t-body-sm" style="line-height:16px">Nguyễn Hoàng Yến</strong><span class="user-btn__role" data-role-label>Cố vấn dịch vụ</span></span><svg class="icon icon--sm"><use href="#chevron-down"/></svg></button>' +
    '<div class="dropdown__menu dropdown__menu--right" role="menu" style="min-width:280px"><div class="menu-label">Tài khoản</div>' +
    '<button class="menu-item" role="menuitem"><svg class="icon"><use href="#user"/></svg>Hồ sơ cá nhân</button><button class="menu-item" role="menuitem"><svg class="icon"><use href="#history"/></svg>Nhật ký truy cập của tôi</button><button class="menu-item" role="menuitem"><svg class="icon"><use href="#log-out"/></svg>Đăng xuất</button>' +
    '<div class="menu-sep"></div><div class="menu-label">Xem thử theo vai trò (chỉ prototype)</div>' +
    roleBtn('CH', 'Chủ garage') + roleBtn('QV', 'Quản lý vùng') + roleBtn('QL', 'Quản lý chi nhánh') + roleBtn('CV', 'Cố vấn dịch vụ', true) + roleBtn('QD', 'Quản đốc') + roleBtn('TH', 'Thợ') + roleBtn('TK', 'Thủ kho') + roleBtn('TN', 'Thu ngân') + roleBtn('KT', 'Kế toán') + roleBtn('AD', 'Quản trị hệ thống') +
    '</div></div></header>';

  var OVERLAYS =
    '<div class="overlay" id="dlg-scope" role="alertdialog" aria-modal="true" aria-labelledby="ds-t"><div class="dialog"><div class="dialog__header"><div class="dialog__icon dialog__icon--warning"><svg class="icon"><use href="#pencil"/></svg></div><div><h2 class="dialog__title" id="ds-t">Lưu nháp trước khi đổi phạm vi?</h2></div></div>' +
    '<div class="dialog__body"><p>Bạn đang soạn một chứng từ. Đổi phạm vi chi nhánh sẽ làm số liệu và danh mục khác đi. Bản đang soạn được lưu thành nháp của chi nhánh hiện tại rồi mới đổi.</p></div>' +
    '<div class="dialog__footer"><button class="btn btn--secondary" data-close>Ở lại, tiếp tục soạn</button><button class="btn btn--primary" data-scope-confirm>Lưu nháp và đổi phạm vi</button></div></div></div>' +
    '<div class="overlay" id="dlg-reveal" role="alertdialog" aria-modal="true" aria-labelledby="rv-t"><div class="dialog"><div class="dialog__header"><div class="dialog__icon dialog__icon--warning"><svg class="icon"><use href="#eye"/></svg></div><div><h2 class="dialog__title" id="rv-t">Hiện thông tin cá nhân của khách</h2></div><button class="btn-icon dialog__close" data-close aria-label="Đóng"><svg class="icon"><use href="#x"/></svg></button></div>' +
    '<div class="dialog__body"><p>Chọn lý do. Việc xem được ghi nhật ký (người xem, thời điểm, bản ghi, lý do) và tự che lại sau 30 giây.</p><fieldset style="border:0;padding:0;margin:0" class="reason-list"><legend class="sr-only">Lý do xem</legend>' +
    '<label class="radio"><input type="radio" name="rv"><span class="radio__box"></span><span>Đối chiếu hóa đơn</span></label><label class="radio"><input type="radio" name="rv"><span class="radio__box"></span><span>Thu hồi công nợ</span></label><label class="radio"><input type="radio" name="rv"><span class="radio__box"></span><span>Lý do khác</span></label></fieldset></div>' +
    '<div class="dialog__footer"><button class="btn btn--secondary" data-close>Hủy</button><button class="btn btn--primary" data-reveal-confirm disabled>Hiện và ghi nhật ký</button></div></div></div>';

  var app = $('.app');
  if (app) {
    app.insertAdjacentHTML('afterbegin', SIDEBAR + TOPBAR);
    app.insertAdjacentHTML('beforeend', BOTTOM);
    body.insertAdjacentHTML('beforeend', OVERLAYS);
    var cur = body.getAttribute('data-nav');
    $$('[data-menu]').forEach(function (m) { if (m.getAttribute('data-menu') === cur) m.setAttribute('aria-current', 'page'); });
    var inner = $('.main__inner');
    if (inner) inner.insertAdjacentHTML('afterbegin', '<div class="alert alert--warning alert--banner net-banner" role="alert"><svg class="icon"><use href="#wifi-off"/></svg><div class="alert__body"><span><strong>Mất kết nối.</strong> Bản nháp được lưu trên thiết bị (lúc 09:14). Chưa thể xuất kho, thu tiền, xuất hóa đơn; vẫn xem được dữ liệu đã tải.</span></div></div>');
    if (inner) inner.insertAdjacentHTML('beforeend', '<div class="g2w-denied" data-g2w-denied hidden><div class="state" role="alert"><div class="state__icon state__icon--warning"><svg class="icon icon--lg"><use href="#lock"/></svg></div><div class="state__title">Bạn chưa có quyền xem màn hình này</div><p class="state__text">Vai trò hiện tại không nằm trong ma trận quyền của mục này (FRD §2). Mục đã được ẩn khỏi menu của bạn; bạn chỉ thấy trang này khi mở trực tiếp bằng đường dẫn.</p><div class="state__actions"><a class="btn btn--secondary" href="index.html">Quay lại danh mục màn hình</a><button class="btn btn--ghost">Gửi yêu cầu cấp quyền</button></div></div></div>');
  }

  /* ---------- 2. Thanh phạm vi (RULE-015) và công cụ prototype ---------- */
  $$('[data-g2w-scope]').forEach(function (el) {
    var time = el.getAttribute('data-time') || 'Hôm nay 30/10/2026', asof = el.getAttribute('data-asof') || '09:15';
    el.outerHTML = '<div class="scope-banner" role="status"><svg class="icon icon--sm"><use href="#map-pin"/></svg><span><strong>Phạm vi:</strong> <span data-scope-text>Tất cả chi nhánh</span></span><span>· <strong>Thời gian:</strong> ' + time + '</span><span>· Cập nhật lúc ' + asof + '</span>' +
      '<button class="btn btn--ghost btn--sm" style="margin-left:auto" data-toast="info|Đang làm mới|Dữ liệu cập nhật lúc ' + asof + '."><svg class="icon icon--sm"><use href="#refresh"/></svg>Làm mới</button></div>';
  });
  $$('[data-g2w-proto]').forEach(function (el) {
    var opts = (el.getAttribute('data-g2w-proto') || '').split(' ');
    var h = '<span class="g2w-proto__lbl">Công cụ prototype:</span>';
    if (opts.indexOf('offline') >= 0) h += '<button class="btn btn--secondary btn--sm" data-toggle-offline><svg class="icon icon--sm"><use href="#wifi-off"/></svg>Thử: mất kết nối</button>';
    if (opts.indexOf('draft') >= 0) h += '<button class="btn btn--secondary btn--sm" data-toggle-draft aria-pressed="false"><svg class="icon icon--sm"><use href="#pencil"/></svg><span>Thử: đang soạn</span></button>';
    h += '<span>Đổi vai trò ở menu tài khoản (góc phải trên) để xem phần ẩn/khóa theo quyền.</span>';
    el.className = 'g2w-proto'; el.innerHTML = h;
  });

  /* ---------- 3. Bộ chuyển trạng thái + mẫu trạng thái ---------- */
  $$('[data-g2w-states]').forEach(function (el) {
    var h = '<span class="g2w-proto__lbl">Trạng thái demo:</span><div class="segmented" role="group" aria-label="Chọn trạng thái màn hình">';
    el.getAttribute('data-g2w-states').split('|').forEach(function (p, i) { var kv = p.split(':'); h += '<button class="segmented__item" data-state-switch="' + kv[0] + '" aria-pressed="' + (i === 0 ? 'true' : 'false') + '">' + kv[1] + '</button>'; });
    el.className = 'g2w-states'; el.innerHTML = h + '</div>';
  });
  function svg(n, c) { return '<svg class="icon ' + (c || 'icon--lg') + '"><use href="#' + n + '"/></svg>'; }
  $$('[data-g2w-tpl]').forEach(function (el) {
    var t = el.getAttribute('data-g2w-tpl'), a = function (k, d) { return el.getAttribute('data-' + k) || d || ''; }, h = '';
    if (t === 'loading') {
      var n = +a('rows', 4), cols = +a('cols', 5), rows = '';
      for (var i = 0; i < n; i++) { rows += '<tr class="skeleton-row">'; for (var j = 0; j < cols; j++) rows += '<td><span class="skeleton skeleton--text" style="width:' + (60 + ((i + j) * 17) % 40) + '%"></span></td>'; rows += '</tr>'; }
      h = '<div class="table-wrap" aria-busy="true"><div class="table-scroll"><table class="table"><caption class="sr-only">Đang tải dữ liệu</caption><tbody>' + rows + '</tbody></table></div></div><p class="g2w-muted" role="status">Đang tải dữ liệu…</p>';
    } else if (t === 'empty') {
      h = '<div class="table-wrap"><div class="state"><div class="state__icon state__icon--brand">' + svg(a('icon', 'inbox')) + '</div><div class="state__title">' + a('title') + '</div><p class="state__text">' + a('text') + '</p>' + (a('cta') ? '<div class="state__actions"><a class="btn btn--primary" href="' + a('href', '#') + '"><svg class="icon"><use href="#plus"/></svg>' + a('cta') + '</a></div>' : '') + '</div></div>';
    } else if (t === 'filtered') {
      h = '<div class="table-wrap"><div class="state"><div class="state__icon">' + svg('search') + '</div><div class="state__title">' + a('title', 'Không tìm thấy kết quả phù hợp') + '</div><p class="state__text">' + a('text', 'Thử bỏ bớt bộ lọc hoặc kiểm tra lại từ khóa (tìm được cả khi gõ không dấu).') + '</p><div class="state__actions"><button class="btn btn--secondary">Xóa tất cả bộ lọc</button></div></div></div>';
    } else if (t === 'error') {
      h = '<div class="table-wrap"><div class="state" role="alert"><div class="state__icon state__icon--danger">' + svg('alert-triangle') + '</div><div class="state__title">' + a('title', 'Không tải được dữ liệu') + '</div><p class="state__text">' + a('text', 'Kết nối tới máy chủ bị gián đoạn. Đây không phải là “chưa có dữ liệu”. Dữ liệu bạn đã nhập vẫn được giữ. Hãy thử lại.') + '</p><div class="state__actions"><button class="btn btn--primary" data-demo-loading><svg class="icon"><use href="#refresh"/></svg>Thử lại</button><button class="btn btn--ghost">Báo sự cố</button></div><span class="state__ref">Mã lỗi: ' + a('ref', 'ERR-G2-5003') + ' · 09:15 30/10/2026</span></div></div>';
    } else if (t === 'denied') {
      h = '<div class="table-wrap"><div class="state"><div class="state__icon state__icon--warning">' + svg('lock') + '</div><div class="state__title">' + a('title', 'Bạn chưa có quyền xem mục này') + '</div><p class="state__text">' + a('text', 'Vai trò hiện tại không được xem nội dung này. Liên hệ Quản lý chi nhánh nếu bạn cần quyền.') + '</p><div class="state__actions"><a class="btn btn--secondary" href="index.html">Quay lại danh mục</a><button class="btn btn--ghost">Gửi yêu cầu cấp quyền</button></div></div></div>';
    }
    el.innerHTML = h;
  });

  /* ---------- 3b. Biến thể nội dung (cảnh báo trùng, xung đột phiên bản, chỉ đọc, đang lưu…) ----------
     <div data-g2w-variants="default:Mặc định|dup:Trùng"></div> sinh nút; phần tử data-g2w-vshow="a b" hiện khi biến thể thuộc danh sách;
     data-g2w-vro="a b" khóa mọi control bên trong; data-g2w-vload="a" thêm .is-loading. Mặc định dùng biến thể đầu tiên. */
  function applyVar(g, k) {
    $$('[data-g2w-var]', g).forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-g2w-var') === k)); });
    $$('[data-g2w-vshow]').forEach(function (el) { el.hidden = el.getAttribute('data-g2w-vshow').split(' ').indexOf(k) < 0; });
    $$('[data-g2w-vro]').forEach(function (el) {
      var ro = el.getAttribute('data-g2w-vro').split(' ').indexOf(k) >= 0;
      $$('input,select,textarea,button', el).forEach(function (c) { if (c.hasAttribute('data-g2w-keep')) return; c.disabled = ro; });
      el.classList.toggle('g2w-readonly', ro);
    });
    $$('[data-g2w-verr]').forEach(function (el) { var on = el.getAttribute('data-g2w-verr').split(' ').indexOf(k) >= 0; el.classList.toggle('is-error', on); el.setAttribute('aria-invalid', String(on)); });
    $$('[data-g2w-vload]').forEach(function (el) { var on = el.getAttribute('data-g2w-vload').split(' ').indexOf(k) >= 0; el.classList.toggle('is-loading', on); if (on) el.setAttribute('aria-busy', 'true'); else el.removeAttribute('aria-busy'); });
    if (window.g2wApply) window.g2wApply();
  }
  $$('[data-g2w-variants]').forEach(function (el) {
    var h = '<span class="g2w-proto__lbl">' + (el.getAttribute('data-g2w-vlabel') || 'Biến thể màn hình:') + '</span><div class="segmented" role="group" aria-label="Chọn biến thể màn hình" data-g2w-vgroup>', first = null;
    el.getAttribute('data-g2w-variants').split('|').forEach(function (p, i) { var kv = p.split(':'); if (i === 0) first = kv[0]; h += '<button class="segmented__item" data-g2w-var="' + kv[0] + '" aria-pressed="' + (i === 0 ? 'true' : 'false') + '">' + kv[1] + '</button>'; });
    el.className = 'g2w-states'; el.innerHTML = h + '</div>'; el.__first = first;
  });
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-g2w-var]'); if (b) applyVar(b.closest('.g2w-states') || document, b.getAttribute('data-g2w-var')); });
  window.addEventListener('DOMContentLoaded', function () {});
  var firstVar = $('[data-g2w-variants]'); if (firstVar) setTimeout(function () { applyVar(firstVar, qs.get('v') || firstVar.__first); }, 0);

  /* ---------- 4. Ẩn/khóa theo vai trò ---------- */
  var PHONES = { c1: '0903456321', c2: '0938127874', c3: '0912345012', c4: '0987654560', c5: '0977123733', c6: '0909888111', c7: '0933222444', c8: '0966777555', c9: '0918765432', c10: '0942001133', c11: '0905123987', c12: '0988246810' };
  function role() { return body.getAttribute('data-role') || 'CV'; }
  function applyG2W() {
    var r = role();
    var inn = $('.main__inner'), deny = (body.getAttribute('data-g2w-deny') || '').split(' ').indexOf(r) >= 0;
    if (inn) Array.prototype.forEach.call(inn.children, function (c) {
      if (c.classList.contains('net-banner')) return;
      c.hidden = c.hasAttribute('data-g2w-denied') ? !deny : deny;
    });
    $$('[data-g2w-roles]').forEach(function (e) { e.hidden = e.getAttribute('data-g2w-roles').split(' ').indexOf(r) < 0; });
    $$('[data-g2w-hide-for]').forEach(function (e) { e.hidden = e.getAttribute('data-g2w-hide-for').split(' ').indexOf(r) >= 0; });
    /* Khóa theo quyền (data-g2w-lock) và khóa theo điều kiện nghiệp vụ (data-g2w-force-disabled + data-g2w-force-why). Luôn kèm lý do. */
    $$('[data-g2w-lock],[data-g2w-force-disabled]').forEach(function (e) {
      var ok = !e.hasAttribute('data-g2w-lock') || e.getAttribute('data-g2w-lock').split(' ').indexOf(r) >= 0, forced = e.hasAttribute('data-g2w-force-disabled');
      if (e.__lbl === undefined) e.__lbl = e.getAttribute('title') || '';
      var off = !ok || forced, why = !ok ? (e.getAttribute('data-g2w-why') || 'Vai trò hiện tại không có quyền thao tác này.') : (e.getAttribute('data-g2w-force-why') || 'Chưa đủ điều kiện nghiệp vụ.');
      if (e.tagName === 'A') { e.setAttribute('aria-disabled', String(off)); e.style.pointerEvents = off ? 'none' : ''; e.style.opacity = off ? '.5' : ''; }
      else { e.disabled = off; e.setAttribute('aria-disabled', String(off)); }
      e.title = off ? why : e.__lbl;
    });
    $$('a[data-g2w-lock-link]').forEach(function (e) {
      var ok = e.getAttribute('data-g2w-lock-link').split(' ').indexOf(r) >= 0, forced = e.hasAttribute('data-g2w-force-disabled'), off = !ok || forced;
      e.setAttribute('aria-disabled', String(off)); e.style.pointerEvents = off ? 'none' : ''; e.style.opacity = off ? '.5' : '';
      e.title = !ok ? 'Vai trò hiện tại không có quyền thao tác này.' : (forced ? (e.getAttribute('data-g2w-force-why') || '') : '');
    });
    $$('[data-g2w-why-box]').forEach(function (e) { e.hidden = e.getAttribute('data-g2w-why-box').split(' ').indexOf(r) >= 0; });
    $$('[data-g2w-money]').forEach(function (e) {
      if (e.__v === undefined) e.__v = e.textContent;
      var deny = r === 'TH';
      e.textContent = deny ? '••• ₫' : e.__v; if (deny) e.setAttribute('aria-label', 'Giá bị ẩn với vai trò Thợ'); else e.removeAttribute('aria-label');
    });
    $$('[data-g2w-drag]').forEach(function (e) {
      var ok = e.getAttribute('data-g2w-drag').split(' ').indexOf(r) >= 0, m = $('[data-g2w-move]', e);
      e.setAttribute('draggable', String(ok));
      if (m) { m.disabled = !ok; m.title = ok ? '' : 'Chỉ Cố vấn, Quản đốc và Quản lý chi nhánh chuyển trạng thái lệnh.'; }
    });
    $$('.g2w-pii').forEach(function (e) {
      var p = PHONES[e.getAttribute('data-id')] || '', full = ['CV', 'QL', 'TN', 'QD'].indexOf(r) >= 0;
      e.classList.remove('is-denied');
      if (r === 'TH' || r === 'AD') { e.classList.add('is-denied'); e.innerHTML = '<svg class="icon icon--sm" aria-hidden="true"><use href="#lock"/></svg>Không có quyền xem'; return; }
      e.textContent = full ? p.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1 $2 $3') : p.slice(0, 2) + '•• ••• ' + p.slice(-3);
      e.title = full ? 'Việc mở hồ sơ khách được ghi nhật ký' : 'Đã che. Mở hồ sơ khách để bấm Hiện (ghi nhật ký).';
    });
    var rb = $('[data-g2w-role-badge]'); if (rb) rb.textContent = r;
  }
  window.g2wApply = applyG2W;
  new MutationObserver(applyG2W).observe(body, { attributes: true, attributeFilter: ['data-role'] });
  applyG2W();

  /* ---------- 5. Wizard (G2-REC-01) ---------- */
  var wiz = $('[data-g2w-wizard]');
  if (wiz) {
    var panels = $$('[data-g2w-step]', wiz), steps = $$('.stepper__step'), curStep = 1, maxStep = panels.length;
    var lastKm = +(($('[data-g2w-km]') || {}).getAttribute ? $('[data-g2w-km]').getAttribute('data-last-km') : 0) || 0;
    var render = function (errStep) {
      panels.forEach(function (p) { p.hidden = +p.getAttribute('data-g2w-step') !== curStep; });
      steps.forEach(function (s, i) {
        var n = i + 1, num = $('.stepper__num', s);
        s.classList.toggle('is-done', n < curStep); s.classList.toggle('is-current', n === curStep); s.classList.toggle('is-error', errStep === n);
        if (n === curStep) s.setAttribute('aria-current', 'step'); else s.removeAttribute('aria-current');
        num.innerHTML = n < curStep ? '<svg class="icon icon--sm" style="width:14px;height:14px"><use href="#check"/></svg>' : String(n);
      });
      var pb = $('[data-g2w-prev]'), nb = $('[data-g2w-next]'), fb = $('[data-g2w-finish]');
      if (pb) pb.hidden = curStep === 1; if (nb) nb.hidden = curStep === maxStep; if (fb) fb.hidden = curStep !== maxStep;
      var t = $('[data-g2w-step-title]'); if (t) t.textContent = 'Bước ' + curStep + '/' + maxStep;
      window.scrollTo({ top: 0, behavior: 'auto' });
    };
    var validate = function () {
      var ok = true, panel = $('[data-g2w-step="' + curStep + '"]', wiz);
      $$('[data-g2w-req]', panel).forEach(function (inp) {
        var bad = !inp.value.trim(), err = $('[data-g2w-err-for="' + inp.id + '"]');
        inp.classList.toggle('is-error', bad); inp.setAttribute('aria-invalid', String(bad)); if (err) err.hidden = !bad; if (bad) ok = false;
      });
      var km = $('[data-g2w-km]', panel);
      if (km) {
        var v = +km.value.replace(/\./g, ''), low = km.value.trim() && v < lastKm, w = $('[data-g2w-km-warn]'), rs = $('#km-reason');
        if (w) w.hidden = !low;
        if (low && rs && !rs.value.trim()) { rs.classList.add('is-error'); rs.setAttribute('aria-invalid', 'true'); var e2 = $('[data-g2w-err-for="km-reason"]'); if (e2) e2.hidden = false; ok = false; }
      }
      return ok;
    };
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-g2w-next]')) { if (validate()) { curStep = Math.min(maxStep, curStep + 1); render(); } else { render(curStep); var f = $('[aria-invalid="true"]', wiz); if (f) f.focus(); if (window.gmepToast) window.gmepToast('warning', 'Chưa đủ thông tin', 'Điền các ô bắt buộc được đánh dấu rồi tiếp tục.'); } }
      if (e.target.closest('[data-g2w-prev]')) { curStep = Math.max(1, curStep - 1); render(); }
      var g = e.target.closest('[data-g2w-goto]'); if (g) { curStep = +g.getAttribute('data-g2w-goto'); render(); }
    });
    document.addEventListener('input', function (e) {
      if (e.target.matches('[data-g2w-km]')) { var v = +e.target.value.replace(/\D/g, ''), w = $('[data-g2w-km-warn]'); if (w) w.hidden = !(e.target.value.trim() && v < lastKm); }
      if (e.target.matches('[data-g2w-req]') && e.target.value.trim()) { e.target.classList.remove('is-error'); e.target.setAttribute('aria-invalid', 'false'); var er = $('[data-g2w-err-for="' + e.target.id + '"]'); if (er) er.hidden = true; }
    });
    var st = +qs.get('step'); if (st >= 1 && st <= maxStep) curStep = st;
    render();
  }

  /* ---------- 6. Kanban kéo thả có kiểm tra điều kiện (G2-REC-03) ---------- */
  var COLNAME = { approved: 'Đã duyệt', working: 'Đang sửa chữa', paused: 'Tạm dừng', qc: 'Chờ QC', ready: 'Sẵn sàng bàn giao', done: 'Hoàn tất' };
  /* Chỉ 3 bước được chuyển thủ công trên bảng (ba-answers-02 A.1). Các bước còn lại có màn riêng hoặc tự động. */
  var ALLOWED = { approved: [], working: ['paused', 'qc'], paused: ['working'], qc: [], ready: [], done: [] };
  var WHY = {
    'approved>working': 'Tự động: lệnh sang “Đang sửa chữa” khi thợ bắt đầu hạng mục đầu tiên trên tablet. Không chuyển thủ công.',
    'qc>ready': 'Chấm checklist QC ở màn QC (G2-DLV-02). Không chuyển ở bảng này.',
    'qc>working': 'Trả lại thợ cần chọn hạng mục và ghi lỗi QC ở màn QC (G2-DLV-02).',
    'ready>done': 'Hoàn tất ở màn giao xe (G2-DLV-03/04): cần biên bản giao xe, thanh toán hoặc công nợ hợp lệ, hóa đơn.'
  };
  var ROLES_MOVE = ['CV', 'QD', 'QL'];
  function toastMsg(k, t, x) { if (window.gmepToast) window.gmepToast(k, t, x); }
  function tryMove(card, to) {
    var from = card.closest('[data-col]').getAttribute('data-col');
    if (from === to) return false;
    if (ROLES_MOVE.indexOf(body.getAttribute('data-role') || 'CV') < 0) { toastMsg('danger', 'Không có quyền', 'Chỉ Cố vấn, Quản đốc và Quản lý chi nhánh chuyển trạng thái lệnh.'); return false; }
    if (ALLOWED[from].indexOf(to) < 0) { toastMsg('danger', 'Không chuyển được ở bảng này', WHY[from + '>' + to] || 'Từ “' + COLNAME[from] + '” không chuyển trực tiếp sang “' + COLNAME[to] + '”. Lệnh đi đúng trình tự (FR-REC-015).'); return false; }
    var why = card.getAttribute('data-block-' + to) || card.getAttribute('data-block'); if (why) { toastMsg('danger', 'Chưa đủ điều kiện', why); return false; }
    if (to === 'paused') { if (window.gmepOpen && document.getElementById('dlg-pause')) { window.__pauseCard = card; window.gmepOpen('dlg-pause'); } else toastMsg('warning', 'Cần chọn lý do', 'Tạm dừng phải chọn lý do.'); return false; }
    var col = $('[data-col="' + to + '"] .kanban__cards'); if (!col) return false;
    var emp = $('.kanban__empty', col); if (emp) emp.remove();
    col.appendChild(card);
    $$('[data-col]').forEach(function (c) { var n = $$('.kanban__card', c).length, p = $('.count-pill', c); if (p) p.textContent = n; });
    toastMsg('success', 'Đã chuyển sang “' + COLNAME[to] + '”', 'Ghi nhật ký: người chuyển, thời điểm 09:16 30/10/2026.');
    return true;
  }
  var dragged = null;
  document.addEventListener('dragstart', function (e) { var c = e.target.closest && e.target.closest('.kanban__card[draggable]'); if (c) { dragged = c; e.dataTransfer.setData('text/plain', c.id || 'card'); } });
  document.addEventListener('dragover', function (e) { var col = e.target.closest && e.target.closest('[data-col]'); if (col && dragged) e.preventDefault(); });
  document.addEventListener('drop', function (e) { var col = e.target.closest && e.target.closest('[data-col]'); if (col && dragged) { e.preventDefault(); tryMove(dragged, col.getAttribute('data-col')); dragged = null; } });
  var pendingCard = null;
  document.addEventListener('click', function (e) {
    var mv = e.target.closest('[data-g2w-move]');
    if (mv) { pendingCard = mv.closest('.kanban__card'); var from = pendingCard.closest('[data-col]').getAttribute('data-col'); var lab = $('[data-g2w-move-title]'); if (lab) lab.textContent = pendingCard.getAttribute('data-code') + ' · đang ở “' + COLNAME[from] + '”';
      $$('#dlg-move [data-to]').forEach(function (b) { var t = b.getAttribute('data-to'), ok = ALLOWED[from].indexOf(t) >= 0, w = $('.g2w-why', b.parentElement.querySelector('[data-why-for="' + t + '"]') || b); b.disabled = !ok; b.setAttribute('aria-disabled', String(!ok)); var r = $('[data-why-for="' + t + '"]'); if (r) { r.textContent = ok ? '' : (WHY[from + '>' + t] || 'Không chuyển trực tiếp từ bước hiện tại.'); r.hidden = ok; } }); window.gmepOpen('dlg-move'); }
    var to = e.target.closest('#dlg-move [data-to]');
    if (to && pendingCard && !to.disabled) { var ok = tryMove(pendingCard, to.getAttribute('data-to')); if (ok || true) window.gmepClose($('#dlg-move')); pendingCard = null; }
  });

  /* ---------- 7. Lối tắt: auto-open, quay lại, ?state= ---------- */
  document.addEventListener('click', function (e) { var d = e.target.closest('a[aria-disabled="true"]'); if (d) e.preventDefault(); });
  document.addEventListener('click', function (e) { if (e.target.closest('[data-g2w-back]')) { e.preventDefault(); var h = e.target.closest('[data-g2w-back]').getAttribute('href'); if (history.length > 1 && !h) history.back(); else location.href = h || 'index.html'; } });
  window.addEventListener('load', function () {
    var s = qs.get('state'); if (s) { var b = $('[data-state-switch="' + s + '"]'); if (b) b.click(); }
    var ao = $('[data-g2w-autoopen]'); if (ao && window.gmepOpen && qs.get('open') !== '0') window.gmepOpen(ao.id);
    if (qs.get('offline') === '1') { var nb = $('.net-banner'); if (nb) nb.classList.add('is-visible'); }
  });
})();
