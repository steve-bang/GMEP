/* GMEP – Gói G3 (Kho, Mua hàng, Nhân sự): JS prototype dùng chung.
   Việc của file này (không phải code production):
   1) G3.shell/top/tail : dựng Application Shell chuẩn (cùng markup với design/foundation/shell.html) để mỗi màn hình không phải lặp ~100 dòng.
   2) Phân quyền demo theo vai trò (đổi vai trò ở menu tài khoản): data-g3-roles, data-g3-hide, data-g3-need, data-g3-edit, data-g3-cost.
   3) Bộ chuyển trạng thái xem thử (loading/empty/filtered/error/denied...) và ?state=, ?role=.
   4) Ô tồn kho bốn con số (Khả dụng = Thực tế - Giữ chỗ, hàng đang vận chuyển không cộng), bảng -> card list trên mobile, giả lập quét mã bằng camera. */
(function () {
  'use strict';
  var ROLE_NAME = { CH: 'Chủ garage', QV: 'Quản lý vùng', QL: 'Quản lý chi nhánh', CV: 'Cố vấn dịch vụ', QD: 'Quản đốc', TH: 'Thợ', TK: 'Thủ kho', TN: 'Thu ngân', KT: 'Kế toán', MH: 'Nhân viên mua hàng', NS: 'Nhân sự', AD: 'Quản trị hệ thống' };
  /* Hai nhóm giá (ba-answers-04 câu 2): giá vốn/giá trị tồn/giá nhập theo lô tồn -> COST_ROLES; giá đơn mua, giá nhập phiếu đang nhận, bảng giá NCC -> BUY_ROLES */
  var COST_ROLES = 'CH QV QL KT';
  var BUY_ROLES = 'CH QV QL KT TK MH';
  var MOD = {
    inv: { label: 'Kho phụ tùng', tabs: ['01', '04', '05', '06', '08', '12', '15', '19'] },
    pur: { label: 'Mua hàng', tabs: ['01', '04', '07', '08', '09'] },
    hrm: { label: 'Nhân sự & Công thợ', tabs: ['01', '04', '05', '07', '09', '10', '08', '06'] }
  };
  var A = 'CH QV QL TK KT';
  /* [mã, tên, tab cha, ưu tiên, FR, vai trò mở được] */
  var R = [
    ['INV-01', 'Danh mục phụ tùng', '', 'P1', 'FR-INV-001, 002', A],
    ['INV-02', 'Tạo / sửa phụ tùng', '01', 'P1', 'FR-INV-001, 002, 013, 024', A],
    ['INV-03', 'Chi tiết phụ tùng và thẻ kho', '01', 'P1', 'FR-INV-003, 013, 020, 021, 027', A],
    ['INV-04', 'Tồn kho – bốn con số', '', 'P1', 'FR-INV-003, 013, 020; FR-RPT-005', A],
    ['INV-05', 'Hàng dưới định mức và gợi ý đặt hàng', '', 'P1 / P2', 'FR-INV-013, 014; FR-PUR-001', 'CH QV QL TK'],
    ['INV-06', 'Yêu cầu cấp phụ tùng', '', 'P1', 'FR-INV-007, 020', 'CH QV QL TK'],
    ['INV-07', 'Phiếu xuất kho (PX)', '06', 'P1', 'FR-INV-006, 007, 019, 020, 021', A],
    ['INV-08', 'Danh sách chứng từ kho', '', 'P1', 'FR-INV-021; FR-RPT-005', A],
    ['INV-09', 'Phiếu nhập kho (PN)', '08', 'P1', 'FR-INV-005, 003, 021; FR-PUR-005', A],
    ['INV-10', 'Hoàn kho / khách trả phụ tùng', '08', 'P1 / P2+', 'FR-INV-008, 022', A],
    ['INV-11', 'Xuất dùng nội bộ và vật tư tiêu hao', '08', 'P2+', 'FR-INV-017, 023', A],
    ['INV-12', 'Danh sách phiếu chuyển kho', '', 'P2', 'FR-INV-010, 026', A],
    ['INV-13', 'Tạo / gửi phiếu chuyển kho', '12', 'P2', 'FR-INV-010, 014, 026', 'CH QV QL TK'],
    ['INV-14', 'Nhận hàng chuyển kho và biên bản chênh lệch', '12', 'P2', 'FR-INV-010', A],
    ['INV-15', 'Danh sách đợt kiểm kê', '', 'P2', 'FR-INV-011, 012', A],
    ['INV-16', 'Thực hiện kiểm kê (quét mã vạch)', '15', 'P2', 'FR-INV-011', 'QL TK'],
    ['INV-17', 'Duyệt chênh lệch kiểm kê (ADJ)', '15', 'P2', 'FR-INV-012, 021; FR-SYS-004', A],
    ['INV-18', 'Bán lẻ phụ tùng tại quầy', '08', 'P2+', 'FR-INV-018, 028', 'CH QL TK CV TN'],
    ['INV-19', 'Bảng giá phụ tùng (giá niêm yết)', '', 'P1', 'FR-INV-025, 027; FR-SYS-006', A],
    ['PUR-01', 'Danh sách yêu cầu mua hàng', '', 'P2', 'FR-PUR-001, 002', A],
    ['PUR-02', 'Tạo yêu cầu mua hàng', '01', 'P2', 'FR-PUR-001; FR-INV-013, 014', 'CH QV QL TK'],
    ['PUR-03', 'Chi tiết và phê duyệt yêu cầu mua', '01', 'P2', 'FR-PUR-002; FR-SYS-004, 015', A],
    ['PUR-04', 'Danh sách đơn mua', '', 'P2', 'FR-PUR-003, 005; FR-INV-004', A],
    ['PUR-05', 'Lập / điều chỉnh đơn mua', '04', 'P2', 'FR-PUR-003, 004; FR-INV-015', 'CH QV QL TK'],
    ['PUR-06', 'Chi tiết đơn mua', '04', 'P2', 'FR-PUR-003–006', A],
    ['PUR-07', 'Hóa đơn nhà cung cấp và đối chiếu ba bên', '', 'P2', 'FR-PUR-006; FR-ACC-007', A],
    ['PUR-08', 'Phiếu trả hàng cho nhà cung cấp', '', 'P2', 'FR-PUR-007; FR-INV-021', A],
    ['PUR-09', 'Danh sách nhà cung cấp', '', 'P2', 'FR-INV-015', A],
    ['PUR-10', 'Chi tiết / sửa nhà cung cấp', '09', 'P2', 'FR-INV-015; FR-PUR-008', A],
    ['HRM-01', 'Danh sách nhân sự', '', 'P2', 'FR-HRM-001', 'CH QV QL KT'],
    ['HRM-02', 'Hồ sơ nhân sự', '01', 'P2', 'FR-HRM-001, 002, 012, 013', 'CH QL'],
    ['HRM-03', 'Điều chuyển nhân sự', '01', 'P2', 'FR-HRM-002', 'CH QL'],
    ['HRM-04', 'Ca làm việc và chấm công', '', 'P2', 'FR-HRM-003', 'CH QV QL TH'],
    ['HRM-05', 'Lịch làm việc và tải việc thợ', '', 'P2', 'FR-HRM-014; FR-REC-012', 'CH QV QL QD CV'],
    ['HRM-06', 'Quy tắc tính công và hoa hồng (cấu hình)', '', 'P2', 'FR-HRM-004, 006, 015; NFR-MNT-01', 'CH QL KT'],
    ['HRM-07', 'Công thợ theo lệnh và hạng mục', '', 'P2', 'FR-HRM-005, 007, 008, 016', 'CH QV QL KT TH CV'],
    ['HRM-08', 'Bảng công theo kỳ', '', 'P2', 'FR-HRM-010', 'CH QV QL KT'],
    ['HRM-09', 'Hoa hồng cố vấn và thợ', '', 'P2', 'FR-HRM-009', 'CH QV QL KT TH CV'],
    ['HRM-10', 'Năng suất kỹ thuật viên', '', 'P2', 'FR-HRM-011, 016; FR-RPT-006', 'CH QV QL QD KT TH']
  ];
  var REG = {};
  R.forEach(function (r) { REG[r[0]] = { code: 'G3-' + r[0], id: r[0], mod: r[0].slice(0, 3).toLowerCase(), num: r[0].slice(4), title: r[1], tab: r[2] || r[0].slice(4), prio: r[3], fr: r[4], roles: r[5] }; });
  /* Vai trò bổ sung theo ba-answers-04 Phụ lục C (MH, NS là vai trò riêng; CV xem danh mục và bảng giá, không xem INV-04) */
  (function () {
    var ADD = { 'INV-01': 'CV MH', 'INV-04': 'MH', 'INV-05': 'MH', 'INV-19': 'CV MH',
      'PUR-01': 'MH', 'PUR-02': 'MH', 'PUR-03': 'MH', 'PUR-04': 'MH', 'PUR-05': 'MH', 'PUR-06': 'MH', 'PUR-07': 'MH', 'PUR-08': 'MH', 'PUR-09': 'MH', 'PUR-10': 'MH',
      'HRM-01': 'NS', 'HRM-02': 'NS', 'HRM-03': 'NS', 'HRM-04': 'NS', 'HRM-05': 'NS', 'HRM-06': 'NS', 'HRM-07': 'NS', 'HRM-08': 'NS', 'HRM-09': 'NS', 'HRM-10': 'NS' };
    Object.keys(ADD).forEach(function (k) { REG[k].roles += ' ' + ADD[k]; });
    REG['HRM-07'].roles = REG['HRM-07'].roles.replace(' CV', '');   /* CV xem hoa hồng ở HRM-09, không có công thợ */
  })();
  function file(id) { return 'g3-' + id.toLowerCase() + '.html'; }
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function role() { return document.body.getAttribute('data-role') || 'CH'; }
  function has(list, r) { return (' ' + list + ' ').indexOf(' ' + r + ' ') >= 0; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function ic(n, c) { return '<svg class="icon' + (c ? ' ' + c : '') + '" aria-hidden="true"><use href="#' + n + '"/></svg>'; }
  var cur = null;       /* mã màn hình hiện tại, ví dụ INV-01 */

  /* ---------- 1. Application Shell ---------- */
  function shell(menu) {
    function nav(key, icon, label, href, extra) {
      return '<a class="nav-item" href="' + href + '" data-menu="' + key + '" title="' + label + '"' + (menu === key ? ' aria-current="page"' : '') + '>' + ic(icon) + '<span class="nav-item__label">' + label + '</span>' + (extra || '') + '</a>';
    }
    var h = '';
    h += '<aside class="sidebar" aria-label="Điều hướng chính"><div class="sidebar__brand"><span class="sidebar__logo" aria-hidden="true">' + ic('wrench') + '</span><span class="sidebar__brand-name">GARAGE OS</span><button class="btn-icon menu-btn" data-nav-close aria-label="Đóng menu" style="margin-left:auto">' + ic('x') + '</button></div><nav class="sidebar__nav">';
    h += '<div class="sidebar__group">Workspace</div>';
    h += nav('dash', 'layout-dashboard', 'Tổng quan', '#') + nav('ro', 'clipboard-list', 'Phiếu sửa chữa', '#', '<span class="count-pill count-pill--warning" aria-label="8 báo giá chờ khách duyệt" title="8 báo giá chờ khách duyệt">8</span>') + nav('appt', 'calendar', 'Lịch hẹn', '#') + nav('cust', 'car-front', 'Khách hàng &amp; Xe', '#');
    h += '<div class="sidebar__group">Kho &amp; mua hàng</div>';
    h += nav('inv', 'warehouse', 'Kho phụ tùng', 'g3-inv-01.html', '<span class="count-pill count-pill--danger" aria-label="5 mặt hàng sắp hết hoặc hết">5</span><span class="nav-item__dot" aria-hidden="true"></span>') + nav('pur', 'shopping-cart', 'Mua hàng', 'g3-pur-01.html');
    h += '<div class="sidebar__group">Nhân sự &amp; tài chính</div>';
    h += nav('hr', 'id-card', 'Nhân sự &amp; Công thợ', 'g3-hrm-01.html') + nav('fin', 'wallet', 'Tài chính', '#') + nav('einv', 'receipt', 'Hóa đơn', '#');
    h += '<div class="sidebar__group">Phân tích</div>' + nav('rpt', 'chart-no-axes-combined', 'Báo cáo', '#');
    h += '</nav><div class="sidebar__footer">' + nav('set', 'settings', 'Cài đặt', '#') + '<button class="nav-item collapse-btn" data-sidebar-toggle aria-expanded="true" aria-label="Thu gọn thanh bên" style="width:100%" title="Thu gọn / mở rộng">' + ic('panel-left') + '<span class="nav-item__label">Thu gọn</span></button></div></aside><div class="drawer-nav-backdrop" data-nav-close></div>';
    /* Topbar + Branch selector 3 cấp (cùng markup shell chuẩn) */
    h += '<header class="topbar"><button class="btn-icon menu-btn" data-nav-open aria-label="Mở menu">' + ic('menu') + '</button>';
    h += '<div class="branch-static" data-branch-static hidden>' + ic('map-pin') + '<span class="branch-static__text"><span class="branch-btn__caption">Chi nhánh của bạn</span><span class="branch-btn__name" data-static-label>Chi nhánh Quận 7</span></span></div>';
    h += '<div class="dropdown" data-branch-dropdown><button class="branch-btn is-all" aria-haspopup="menu" aria-expanded="false" aria-label="Chọn phạm vi chi nhánh">' + ic('map-pin') + '<span class="branch-btn__text"><span class="branch-btn__caption">Phạm vi dữ liệu</span><span class="branch-btn__name" data-branch-label>Tất cả chi nhánh</span></span>' + ic('chevron-down', 'icon--sm') + '</button><div class="dropdown__menu" role="menu" style="min-width:320px">';
    h += '<div class="menu-label" data-show-roles="CH QV">Hợp nhất</div>';
    h += '<button class="menu-item" role="menuitemradio" aria-checked="true" data-level="all" data-branch="Tất cả chi nhánh" data-branch-all data-show-roles="CH">' + ic('layout-dashboard') + 'Tất cả chi nhánh<span class="menu-item__hint">toàn chuỗi</span></button>';
    h += '<button class="menu-item" role="menuitemradio" aria-checked="false" data-level="all" data-branch="Tất cả nhóm được giao" data-branch-all data-show-roles="QV" hidden>' + ic('layout-dashboard') + 'Tất cả nhóm được giao</button>';
    h += '<div class="menu-sep" data-show-roles="CH QV"></div><div class="menu-label" data-show-roles="CH QV">Nhóm chi nhánh (vùng)</div>';
    h += '<button class="menu-item menu-item--group" role="menuitemradio" aria-checked="false" data-level="group" data-branch="Nhóm Miền Nam" data-show-roles="CH QV">' + ic('users') + 'Nhóm Miền Nam</button><button class="menu-item menu-item--group" role="menuitemradio" aria-checked="false" data-level="group" data-branch="Nhóm Miền Trung" data-show-roles="CH">' + ic('users') + 'Nhóm Miền Trung</button>';
    h += '<div class="menu-sep" data-show-roles="CH QV"></div><div class="menu-label">Từng chi nhánh</div>';
    [['Quận 1', 'CH QV'], ['Quận 7', 'CH QV QL KT MH NS'], ['Thủ Đức', 'CH QV QL KT MH NS'], ['Biên Hòa', 'CH QV'], ['Đà Nẵng', 'CH']].forEach(function (b) {
      h += '<button class="menu-item menu-item--indent" role="menuitemradio" aria-checked="false" data-level="branch" data-branch="Chi nhánh ' + b[0] + '" data-show-roles="' + b[1] + '">Chi nhánh ' + b[0] + '</button>';
    });
    h += '<button class="menu-item menu-item--indent" role="menuitemradio" aria-disabled="true" data-level="branch" data-show-roles="QL KT MH NS">' + ic('lock') + 'Chi nhánh Biên Hòa<span class="menu-item__hint">Chưa được cấp quyền</span></button>';
    h += '<div class="legal-filter" data-legal hidden><div class="field"><label class="field__label" for="legal">Pháp nhân</label><select id="legal" class="select"><option>Tất cả pháp nhân được xem</option><option>Công ty TNHH Garage A</option><option>Công ty TNHH Garage B</option></select><span class="field__hint">Báo cáo chính thức không cộng gộp số liệu giữa các pháp nhân.</span></div></div>';
    h += '<div class="menu-sep"></div><p class="t-body-sm text-secondary" style="padding:8px 12px" data-multi-note hidden>Tài khoản của bạn chỉ xem được các chi nhánh được gán. Xem hợp nhất dành cho Chủ garage và Quản lý vùng. Đổi phạm vi khi đang soạn chứng từ sẽ hỏi lưu nháp trước.</p></div></div>';
    h += '<div class="topbar__search">' + ic('search') + '<input class="input" data-global-search type="search" placeholder="Tìm phụ tùng, mã vạch, chứng từ, nhà cung cấp…" aria-label="Tìm kiếm toàn hệ thống"><span class="kbd" aria-hidden="true">Ctrl K</span></div><div class="topbar__spacer"></div>';
    h += '<button class="btn-icon topbar__search-btn" aria-label="Tìm kiếm">' + ic('search') + '</button><button class="btn-icon" data-theme-toggle aria-label="Đổi giao diện sáng/tối (bản nháp, không thuộc phạm vi phát hành)" title="Dark mode: bản nháp, chưa phát hành">' + ic('moon') + '</button>';
    h += '<div class="dropdown"><button class="btn-icon" aria-haspopup="menu" aria-expanded="false" aria-label="Thông báo, 3 chưa đọc">' + ic('bell') + '<span class="btn-icon__dot" aria-hidden="true">3</span></button><div class="dropdown__menu dropdown__menu--right notif-panel" role="menu" data-keep-open><div class="notif-panel__head"><strong>Thông báo</strong><button class="btn btn--ghost btn--sm">Đánh dấu đã đọc</button></div>';
    h += '<a class="notif-item is-unread" href="g3-inv-05.html" style="color:inherit"><span class="notif-item__icon">' + ic('package', 'icon--sm') + '</span><div><div style="font-weight:600">Má phanh trước Accent chỉ còn 3 khả dụng</div><div class="t-body-sm text-secondary">Kho Quận 7 · Cần xử lý · 20 phút trước</div></div></a>';
    h += '<a class="notif-item is-unread" href="g3-pur-03.html" style="color:inherit"><span class="notif-item__icon">' + ic('clock', 'icon--sm') + '</span><div><div style="font-weight:600">Yêu cầu mua YM-Q7-2610-00004 chờ duyệt</div><div class="t-body-sm text-secondary">Cần xử lý · 1 giờ trước</div></div></a>';
    h += '<a class="notif-item is-unread" href="g3-inv-17.html" style="color:inherit"><span class="notif-item__icon">' + ic('alert-triangle', 'icon--sm') + '</span><div><div style="font-weight:600">Kiểm kê KK-Q7-2610-00003 có chênh lệch chờ duyệt</div><div class="t-body-sm text-secondary">Cần xử lý · hôm qua</div></div></a>';
    h += '<div style="padding:8px 16px"><a href="#">Xem tất cả thông báo</a></div></div></div>';
    h += '<div class="dropdown"><button class="user-btn" aria-haspopup="menu" aria-expanded="false" aria-label="Menu tài khoản"><span class="avatar avatar--sm">TA</span><span class="user-btn__text"><strong class="t-body-sm" style="line-height:16px">Trần Thị Mai Anh</strong><span class="user-btn__role" data-role-label>Thủ kho</span></span>' + ic('chevron-down', 'icon--sm') + '</button><div class="dropdown__menu dropdown__menu--right" role="menu" style="min-width:280px"><div class="menu-label">Tài khoản</div><button class="menu-item" role="menuitem">' + ic('user') + 'Hồ sơ cá nhân</button><button class="menu-item" role="menuitem">' + ic('history') + 'Nhật ký truy cập của tôi</button><button class="menu-item" role="menuitem">' + ic('log-out') + 'Đăng xuất</button><div class="menu-sep"></div><div class="menu-label">Giả lập (chỉ prototype)</div><button class="menu-item" role="menuitemcheckbox" data-keep-open data-legal-toggle aria-checked="false">' + ic('settings') + 'Nhiều pháp nhân (hiện bộ lọc Pháp nhân)</button><div class="menu-label">Xem thử theo vai trò</div>';
    Object.keys(ROLE_NAME).forEach(function (k) { h += '<button class="menu-item" role="menuitemradio" data-keep-open data-role-switch="' + k + '" data-role-name="' + ROLE_NAME[k] + '" aria-checked="false">' + ROLE_NAME[k] + '</button>'; });
    h += '</div></div></header>';
    document.write(h);
  }

  /* Banner mất mạng + breadcrumb + dòng mã màn hình + thanh tab của phân hệ */
  function top(id) {
    var s = REG[id]; cur = id; if (!s) return;
    var parent = s.tab !== s.num ? REG[s.id.slice(0, 3) + '-' + s.tab] : null;
    var offMsg = { inv: 'Chưa thể ghi sổ kho, gửi duyệt hay chốt số đếm cho đến khi có mạng.', pur: 'Chưa thể gửi duyệt, gửi đơn mua hay ghi nhận hóa đơn cho đến khi có mạng.', hrm: 'Chưa thể ghi giờ vào/ra ca, duyệt hay khóa kỳ công cho đến khi có mạng; không ghi giờ giả.' }[s.mod];
    var h = '<div class="alert alert--warning alert--banner net-banner" role="alert">' + ic('wifi-off') + '<div class="alert__body"><span><strong>Mất kết nối.</strong> Bản nháp được lưu trên thiết bị (lúc 09:14). ' + offMsg + '</span></div></div>';
    h += '<nav class="breadcrumb" aria-label="Đường dẫn"><a href="index.html">GARAGE OS</a>' + ic('chevron-right') + '<a href="' + file(s.mod.toUpperCase() + '-' + MOD[s.mod].tabs[0]) + '">' + MOD[s.mod].label + '</a>';
    if (parent) h += ic('chevron-right') + '<a href="' + file(parent.id) + '">' + parent.title + '</a>';
    h += ic('chevron-right') + '<span aria-current="page">' + s.title + '</span></nav>';
    h += '<div class="g3-meta"><span class="code">' + s.code + '</span><span>Ưu tiên ' + s.prio + '</span><span>' + s.fr + '</span></div>';
    h += '<nav class="tabs g3-subnav" id="g3-subnav" aria-label="Các màn hình trong ' + MOD[s.mod].label + '"></nav>';
    document.write(h);
  }
  function tail() {
    document.write('<nav class="bottom-nav" aria-label="Điều hướng nhanh"><a class="bottom-nav__item" href="#" data-menu="dash">' + ic('layout-dashboard') + 'Tổng quan</a><a class="bottom-nav__item" href="g3-inv-01.html" data-menu="inv"' + (cur && cur.slice(0, 3) === 'INV' ? ' aria-current="page"' : '') + '>' + ic('warehouse') + 'Kho</a><a class="bottom-nav__item" href="g3-pur-01.html" data-menu="pur"' + (cur && cur.slice(0, 3) === 'PUR' ? ' aria-current="page"' : '') + '>' + ic('shopping-cart') + 'Mua hàng</a><a class="bottom-nav__item" href="g3-hrm-01.html" data-menu="hr"' + (cur && cur.slice(0, 3) === 'HRM' ? ' aria-current="page"' : '') + '>' + ic('id-card') + 'Nhân sự</a><button class="bottom-nav__item" data-nav-open aria-label="Mở toàn bộ menu">' + ic('menu') + 'Thêm</button></nav>');
  }

  /* ---------- 2. Tab phân hệ theo vai trò ---------- */
  function renderSubnav() {
    var nav = $('#g3-subnav'); if (!nav || !cur) return;
    var s = REG[cur], r = role(), h = '';
    MOD[s.mod].tabs.forEach(function (n) {
      var t = REG[s.mod.toUpperCase() + '-' + n]; if (!t || !has(t.roles, r)) return;
      var label = { '01': { inv: 'Danh mục', pur: 'Yêu cầu mua', hrm: 'Nhân sự' }[s.mod], '04': { inv: 'Tồn kho', pur: 'Đơn mua', hrm: 'Ca &amp; chấm công' }[s.mod], '05': { inv: 'Dưới định mức', hrm: 'Tải việc' }[s.mod], '06': { inv: 'Yêu cầu cấp', hrm: 'Quy tắc công' }[s.mod], '07': { pur: 'Hóa đơn NCC', hrm: 'Công thợ' }[s.mod], '08': { inv: 'Chứng từ', pur: 'Trả hàng NCC', hrm: 'Bảng công' }[s.mod], '09': { pur: 'Nhà cung cấp', hrm: 'Hoa hồng' }[s.mod], '10': 'Năng suất', '12': 'Chuyển kho', '15': 'Kiểm kê', '19': 'Bảng giá' }[n];
      h += '<a class="tab" href="' + file(t.id) + '"' + (s.tab === n ? ' aria-current="page"' : '') + '>' + label + '</a>';
    });
    nav.innerHTML = h; nav.hidden = !h;
  }

  /* ---------- 3. Trạng thái xem thử ---------- */
  var STATE_LABEL = { data: 'Có dữ liệu', loading: 'Đang tải', empty: 'Trống lần đầu', filtered: 'Trống do lọc', notfound: 'Không tìm thấy', error: 'Lỗi tải', denied: 'Không có quyền' };
  var state = 'data', stateKeys = [];
  function stateHTML(k, b) {
    var noun = b.getAttribute('data-noun') || 'dữ liệu', r = ROLE_NAME[role()];
    function st(icn, kind, title, text, actions, ref) { return '<div class="table-wrap"><div class="state"><div class="state__icon' + (kind ? ' state__icon--' + kind : '') + '">' + ic(icn, 'icon--lg') + '</div><div class="state__title">' + title + '</div><p class="state__text">' + text + '</p>' + (actions ? '<div class="state__actions">' + actions + '</div>' : '') + (ref ? '<span class="state__ref">' + ref + '</span>' : '') + '</div></div>'; }
    if (k === 'loading') {
      var kind = b.getAttribute('data-skel') || 'table', cols = +(b.getAttribute('data-cols') || 5), x = '';
      if (kind === 'table') {
        x = '<div class="table-wrap" aria-busy="true"><div class="table-scroll"><table class="table"><thead><tr>';
        for (var i = 0; i < cols; i++) x += '<th><span class="skeleton skeleton--text" style="width:' + (60 + (i * 17) % 50) + 'px"></span></th>';
        x += '</tr></thead><tbody>';
        for (var j = 0; j < 5; j++) { x += '<tr class="skeleton-row">'; for (i = 0; i < cols; i++) x += '<td><span class="skeleton skeleton--text" style="width:' + (50 + ((i + j) * 23) % 70) + 'px"></span></td>'; x += '</tr>'; }
        x += '</tbody></table></div></div>';
      } else {
        x = '<div class="stack" aria-busy="true"><span class="skeleton skeleton--title"></span><div class="grid grid--4"><span class="skeleton skeleton--block"></span><span class="skeleton skeleton--block"></span><span class="skeleton skeleton--block"></span><span class="skeleton skeleton--block"></span></div><span class="skeleton skeleton--block" style="height:220px"></span></div>';
      }
      return x + '<p class="sr-only" role="status">Đang tải ' + noun + '…</p>';
    }
    if (k === 'empty') return st(b.getAttribute('data-empty-icon') || 'package', 'brand', 'Chưa có ' + noun, b.getAttribute('data-empty-text') || 'Tạo mới để bắt đầu.', b.getAttribute('data-empty-cta') ? '<button class="btn btn--primary">' + ic('plus') + b.getAttribute('data-empty-cta') + '</button>' : '');
    if (k === 'filtered') return st('search', '', 'Không tìm thấy ' + noun + ' phù hợp', 'Không có kết quả khớp bộ lọc hiện tại (tìm được cả khi gõ không dấu). Thử bỏ bớt bộ lọc hoặc đổi từ khóa.', '<button class="btn btn--secondary">Xóa tất cả bộ lọc</button>');
    if (k === 'error') return st('alert-triangle', 'danger', 'Không tải được ' + noun, 'Đây là lỗi kết nối, không phải “không có dữ liệu”. Dữ liệu bạn đã nhập vẫn được giữ. Hãy thử lại sau ít phút.', '<button class="btn btn--primary" data-demo-loading>' + ic('refresh') + 'Thử lại</button><button class="btn btn--ghost">Báo sự cố</button>', 'Mã lỗi: ERR-' + (cur || 'G3').replace('-', '') + '-5003 · 09:15 30/10/2026');
    if (k === 'notfound') return st('search', '', 'Không tìm thấy ' + noun, 'Chứng từ hoặc bản ghi này không tồn tại, đã bị chuyển sang chi nhánh khác hoặc nằm ngoài phạm vi bạn được xem. Kiểm tra lại mã hoặc quay về danh sách.', '<a class="btn btn--secondary" href="' + (b.getAttribute('data-back') || 'index.html') + '">Về danh sách</a>', 'Mã lỗi: 404');
    if (k === 'denied') return st('lock', 'warning', 'Bạn chưa có quyền xem ' + noun, b.getAttribute('data-denied-text') || ('Vai trò ' + r + ' không được mở mục này (theo ma trận quyền FRD §2). Liên hệ Quản lý chi nhánh nếu bạn cần quyền này.'), '<a class="btn btn--secondary" href="index.html">Quay lại danh mục màn hình</a><button class="btn btn--ghost" data-toast="info|Đã gửi yêu cầu|Quản lý chi nhánh sẽ xem xét yêu cầu cấp quyền.">Gửi yêu cầu cấp quyền</button>');
    return '';
  }
  function initStates() {
    var b = $('#g3-body'); if (!b) return;
    var spec = (b.getAttribute('data-g3-states') || 'data;loading;empty;filtered;error;denied').split(';');
    var bar = '<span class="g3-statebar__label">Xem thử trạng thái:</span><div class="segmented" role="group" aria-label="Chọn trạng thái màn hình để xem thử">';
    spec.forEach(function (p) {
      var kv = p.split(':'), k = kv[0].trim(); if (!k) return;
      stateKeys.push(k);
      bar += '<button class="segmented__item" data-g3-set="' + k + '" aria-pressed="false">' + (kv[1] || STATE_LABEL[k] || k) + '</button>';
      if (!$('[data-g3-state="' + k + '"]', b) && STATE_LABEL[k]) {
        var d = document.createElement('div'); d.setAttribute('data-g3-state', k); d.hidden = true; d.innerHTML = stateHTML(k, b); b.appendChild(d);
      }
    });
    if (!$('[data-g3-state="denied"]', b)) { var dn = document.createElement('div'); dn.setAttribute('data-g3-state', 'denied'); dn.hidden = true; dn.innerHTML = stateHTML('denied', b); b.appendChild(dn); }   /* luôn có panel “không có quyền” để vai trò không được mở màn hình vẫn thấy lý do */
    bar += '</div><button class="btn btn--secondary btn--sm" data-toggle-offline>' + ic('wifi-off', 'icon--sm') + 'Mất kết nối</button>';
    var sb = document.createElement('div'); sb.className = 'g3-statebar'; sb.id = 'g3-statebar'; sb.innerHTML = bar;
    b.parentNode.insertBefore(sb, b);
    var q = (location.search.match(/[?&]state=([a-z]+)/) || [])[1];
    state = q && stateKeys.indexOf(q) >= 0 ? q : 'data';
  }
  function applyState() {
    var b = $('#g3-body'); if (!b) return;
    var s = cur && REG[cur], r = role(), ok = !s || has(s.roles, r), show = ok ? state : 'denied';
    if (!ok) { var d = $('[data-g3-state="denied"]', b); if (d) d.innerHTML = stateHTML('denied', b); }
    $$('[data-g3-state]', b).forEach(function (p) { p.hidden = p.getAttribute('data-g3-state') !== show; });
    $$('[data-g3-set]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-g3-set') === show)); x.setAttribute('aria-disabled', String(!ok)); });
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-g3-set]');
    if (t && t.getAttribute('aria-disabled') !== 'true') { state = t.getAttribute('data-g3-set'); applyState(); }
  });

  /* Bật/tắt khối minh họa (lỗi trường, đang lưu, xung đột...): <button data-g3-toggle="id1 id2" aria-pressed="false"> */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-g3-toggle]'); if (!t) return;
    var on = t.getAttribute('aria-pressed') !== 'true'; t.setAttribute('aria-pressed', String(on));
    t.getAttribute('data-g3-toggle').split(' ').forEach(function (id) { var el = document.getElementById(id); if (el) el.hidden = !on; });
    var bs = t.getAttribute('data-g3-busy'); if (bs) { var b = document.getElementById(bs); if (b) { b.classList.toggle('is-loading', on); b.setAttribute('aria-busy', String(on)); } }
  });

  /* ---------- 4. Quyền theo vai trò ---------- */
  function applyRoleBits() {
    var r = role();
    $$('[data-g3-roles]').forEach(function (x) { x.hidden = !has(x.getAttribute('data-g3-roles'), r); });
    $$('[data-g3-hide]').forEach(function (x) { x.hidden = has(x.getAttribute('data-g3-hide'), r); });
    $$('[data-g3-need]').forEach(function (x) {
      var ok = has(x.getAttribute('data-g3-need'), r), why = x.getAttribute('data-g3-why') || 'Bạn không có quyền thực hiện thao tác này.';
      /* aria-disabled (không dùng disabled thật) để nút vẫn nhận focus bàn phím và đọc được lý do; click bị chặn ở bộ lọc capture bên dưới (F4-21) */
      x.setAttribute('aria-disabled', String(!ok));
      if (x.tagName === 'A') {   /* liên kết không có thuộc tính disabled: gỡ href khi không có quyền */
        if (!ok && x.hasAttribute('href')) { x.setAttribute('data-href0', x.getAttribute('href')); x.removeAttribute('href'); x.setAttribute('tabindex', '0'); }
        if (ok && x.hasAttribute('data-href0')) { x.setAttribute('href', x.getAttribute('data-href0')); x.removeAttribute('data-href0'); x.removeAttribute('tabindex'); }
      }
      var id = x.getAttribute('data-g3-whyid');
      if (!id) { id = 'why-' + Math.random().toString(36).slice(2, 7); x.setAttribute('data-g3-whyid', id); var sp = document.createElement('span'); sp.className = 'sr-only'; sp.id = id; sp.textContent = why; x.insertAdjacentElement('afterend', sp); }
      if (ok) { x.removeAttribute('aria-describedby'); x.removeAttribute('title'); } else { x.setAttribute('aria-describedby', id); x.setAttribute('title', why); }
    });
    $$('[data-g3-edit]').forEach(function (f) {
      var ok = has(f.getAttribute('data-g3-edit'), r);
      $$('input,select,textarea,button:not([data-g3-keep])', f).forEach(function (i) { if (!i.closest('[data-g3-keep]')) { if (!ok) { if (!i.hasAttribute('data-was')) i.setAttribute('data-was', i.disabled ? '1' : '0'); i.disabled = true; } else if (i.getAttribute('data-was') === '0') { i.disabled = false; } } });
      $$('.g3-ro-flag').forEach(function (x) { if (x.getAttribute('data-for') === f.id) x.hidden = ok; });
    });
    $$('[data-g3-cost],[data-g3-buy]').forEach(function (x) {
      var buy = x.hasAttribute('data-g3-buy'), v = x.getAttribute(buy ? 'data-g3-buy' : 'data-g3-cost');
      if (has(buy ? BUY_ROLES : COST_ROLES, r)) { x.className = 'num'; x.removeAttribute('title'); x.textContent = v; }
      else { var what = buy ? 'giá mua' : 'giá vốn'; x.className = 'g3-masked'; x.title = 'Bạn chưa có quyền xem ' + what; x.innerHTML = '•••••<span class="sr-only">Không có quyền xem ' + what + '</span>'; }
    });
    $$('[data-g3-block]').forEach(function (x) { x.setAttribute('aria-disabled', 'true'); x.setAttribute('title', x.getAttribute('data-g3-block')); });   /* khóa theo trạng thái nghiệp vụ, kèm lý do */
    $$('[data-g3-needs-net]').forEach(function (x) {   /* thao tác cần mạng (ghi giờ vào/ra ca): khóa khi mất kết nối, không ghi giờ giả */
      var off = !!$('.net-banner.is-visible'); x.setAttribute('aria-disabled', String(off));
      if (off) x.setAttribute('title', 'Cần kết nối mạng để ghi giờ'); else x.removeAttribute('title');
    });
  }

  /* ---------- 5. Ô tồn kho 4 số + trạng thái đủ/sắp hết/hết (RULE-008) ---------- */
  /* "Đang về N" = đang vận chuyển đến kho này (phiếu CK); "Đã đặt N" = đã đặt NCC chưa giao, NẰM NGOÀI bốn số, không vào Khả dụng */
  function stockBadge(avail, min, transit, ordered) {
    var b;
    if (avail <= 0) b = '<span class="badge badge--danger">Hết hàng</span>';
    else if (min === null) b = '<span class="badge badge--neutral">Chưa đặt định mức</span>';
    else if (avail <= min) b = '<span class="badge badge--warning">Sắp hết</span>';
    else b = '<span class="badge badge--success">Đủ hàng</span>';
    if (avail < 0) b += ' <span class="tag tag--danger">Dữ liệu tồn lệch, báo Quản lý</span>';
    if (transit > 0) b += ' <span class="tag tag--info">Đang về ' + transit + '</span>';
    if (ordered > 0) b += ' <span class="tag tag--neutral">Đã đặt ' + ordered + '</span>';
    return b;
  }
  function parseS(v, minAttr, ordAttr) { var p = v.split(',').map(Number); var m = minAttr === null || minAttr === '' || minAttr === undefined || minAttr === '-' ? null : +minAttr; return { real: p[0], res: p[1], tr: p[2], avail: p[0] - p[1], min: m, ord: +ordAttr || 0 }; }
  function stock4HTML(s) {
    var k = s.avail <= 0 ? ' stock4__cell--out' : (s.min !== null && s.avail <= s.min ? ' stock4__cell--low' : ' stock4__cell--available');
    return '<div class="stock4" role="group" aria-label="Tồn kho: thực tế ' + s.real + ', giữ chỗ ' + s.res + ', đang vận chuyển ' + s.tr + ', khả dụng ' + s.avail + '"><div class="stock4__cell" data-g3-hide="CV MH"><div class="stock4__label">Thực tế</div><div class="stock4__value">' + s.real + '</div></div><div class="stock4__cell" data-g3-hide="CV MH"><div class="stock4__label">Giữ chỗ</div><div class="stock4__value">' + s.res + '</div></div><div class="stock4__cell"><div class="stock4__label">Đang vận chuyển</div><div class="stock4__value">' + s.tr + '</div></div><div class="stock4__cell' + k + '"><div class="stock4__label">Khả dụng</div><div class="stock4__value">' + s.avail + '</div></div></div>';
  }
  function expandStock() {
    $$('td[data-g3-s4]').forEach(function (td) {
      var tr = td.closest('tr'), s = parseS(tr.getAttribute('data-s'), tr.getAttribute('data-min'), tr.getAttribute('data-ordered'));
      var cls = s.avail <= 0 ? ' g3-var--over' : (s.min !== null && s.avail <= s.min ? ' g3-var--short' : '');
      td.outerHTML = '<td class="col-num" data-g3-hide="CV MH">' + s.real + '</td><td class="col-num" data-g3-hide="CV MH">' + s.res + '</td><td class="col-num" data-g3-hide="CV">' + s.tr + '</td><td class="col-num"><strong class="g3-var' + cls + '">' + s.avail + '</strong></td><td>' + stockBadge(s.avail, s.min, s.tr, s.ord) + '</td>';
    });
    $$('[data-g3-stock4]').forEach(function (d) {
      var s = parseS(d.getAttribute('data-g3-stock4'), d.getAttribute('data-min')), k = s.avail <= 0 ? ' stock4__cell--out' : (s.min !== null && s.avail <= s.min ? ' stock4__cell--low' : ' stock4__cell--available');
      d.className = 'stock4';
      d.setAttribute('role', 'group'); d.setAttribute('aria-label', 'Tồn kho: thực tế ' + s.real + ', giữ chỗ ' + s.res + ', đang vận chuyển ' + s.tr + ', khả dụng ' + s.avail);
      d.innerHTML = '<div class="stock4__cell"><div class="stock4__label">Thực tế</div><div class="stock4__value">' + s.real + '</div></div><div class="stock4__cell"><div class="stock4__label">Giữ chỗ</div><div class="stock4__value">' + s.res + '</div></div><div class="stock4__cell"><div class="stock4__label">Đang vận chuyển</div><div class="stock4__value">' + s.tr + '</div></div><div class="stock4__cell' + k + '"><div class="stock4__label">Khả dụng</div><div class="stock4__value">' + s.avail + '</div></div>';
    });
  }

  /* ---------- 6. Bảng -> card list trên mobile (đọc data-card trên <th>) ---------- */
  function cards() {
    $$('table[data-g3-cards]').forEach(function (t) {
      var ths = $$('thead th', t), map = ths.map(function (th) { return th.getAttribute('data-card') || ''; });
      var list = document.createElement('div'); list.className = 'record-list record-list--responsive';
      $$('tbody tr', t).forEach(function (tr) {
        var tds = $$('td', tr), top = '', sub = '', badge = '', meta = '', foot = '', s4 = '', href = tr.getAttribute('data-href');
        /* Thẻ là <a> khi dòng có data-href: bỏ <a> lồng bên trong (HTML không hợp lệ, hai điểm dừng Tab) */
        function inner(td) { var c = td.cloneNode(true); if (href) $$('a', c).forEach(function (a) { a.replaceWith.apply(a, Array.prototype.slice.call(a.childNodes)); }); return c.innerHTML; }
        function gate(td) { return (td.hasAttribute('data-g3-hide') ? ' data-g3-hide="' + td.getAttribute('data-g3-hide') + '"' : '') + (td.hasAttribute('data-g3-roles') ? ' data-g3-roles="' + td.getAttribute('data-g3-roles') + '"' : ''); }
        tds.forEach(function (td, i) {
          var c = map[i], label = ths[i] ? ths[i].textContent.replace(/\s+/g, ' ').trim() : '';
          if (ths[i] && ths[i].querySelector('.cell-sub')) label = ths[i].childNodes[0].textContent.trim() || label;
          if (c === 'title') top = '<div class="record__title code">' + inner(td) + '</div>';
          else if (c === 'sub') sub = '<div>' + inner(td) + '</div>';
          else if (c === 'badge') badge = '<div class="g3-chip-badges">' + inner(td) + '</div>';
          else if (c === 'meta') meta += '<span' + gate(td) + '>' + (label ? label + ': ' : '') + inner(td) + '</span>';
          else if (c === 'foot') foot += '<span class="num"' + gate(td) + '>' + inner(td) + '</span>';
          else if (c === 'stock4' && tr.hasAttribute('data-s')) s4 = stock4HTML(parseS(tr.getAttribute('data-s'), tr.getAttribute('data-min'), tr.getAttribute('data-ordered')));   /* ô Thực tế, Giữ chỗ tự ẩn theo vai trò (MH chỉ còn Đang vận chuyển và Khả dụng) */   /* đủ bốn số tồn trên thẻ (F4-02) */
        });
        var el = document.createElement(href ? 'a' : 'div');
        el.className = 'record'; if (href) { el.href = href; el.style.color = 'inherit'; el.style.textDecoration = 'none'; }
        el.innerHTML = '<div class="record__top"><div>' + top + sub + '</div>' + badge + '</div>' + s4 + (meta ? '<div class="record__meta">' + meta + '</div>' : '') + (foot ? '<div class="record__foot">' + foot + '</div>' : '') + (t.getAttribute('data-g3-card-actions') ? '<div class="g3-card-actions">' + t.getAttribute('data-g3-card-actions') + '</div>' : '');
        ['data-g3-roles', 'data-g3-hide'].forEach(function (a) { if (tr.hasAttribute(a)) el.setAttribute(a, tr.getAttribute(a)); });
        list.appendChild(el);
      });
      var wrap = t.closest('.table-wrap'); if (!wrap) return;
      wrap.classList.add('table-wrap--responsive');
      var holder = document.createElement('div'); holder.className = 'g3-cards-holder'; holder.appendChild(list);
      wrap.insertAdjacentElement('afterend', holder);
    });
  }

  /* ---------- 7. Quét mã vạch bằng camera (giả lập) ---------- */
  function buildScan() {
    $$('[data-g3-scan]').forEach(function (box, n) {
      box.innerHTML = '<div class="g3-scan" data-cam="ok"><div class="g3-scan__view" role="img" aria-label="Khung xem camera để quét mã vạch"><div class="g3-scan__frame"></div><div class="g3-scan__line"></div><span class="g3-scan__hint">Đưa mã vạch vào khung</span></div>' +
        '<div class="alert alert--warning g3-scan__denied" role="alert">' + ic('camera') + '<div class="alert__body"><span class="alert__title">Chưa được phép dùng camera</span><span>Cho phép camera cho trang này trong cài đặt trình duyệt, hoặc nhập mã tay ở ô bên dưới. Số đã đếm vẫn được giữ.</span></div></div>' +
        '<div class="g3-scan__msg" role="status" aria-live="polite"></div>' +
        '<div class="g3-scan__tools"><div class="field" style="min-width:200px;flex:1 1 200px"><label class="field__label" for="g3-man-' + n + '">Nhập mã vạch bằng tay</label><input class="input" id="g3-man-' + n + '" inputmode="numeric" autocomplete="off" placeholder="Ví dụ 8935001230012"></div><button class="btn btn--secondary" data-g3-manual>Thêm</button></div>' +
        '<div class="row g3-scan__sim"><span class="t-body-sm text-secondary">Giả lập (chỉ prototype):</span><button class="btn btn--ghost btn--sm" data-g3-sim="next">Quét mã kế tiếp</button><button class="btn btn--ghost btn--sm" data-g3-sim="unknown">Quét mã lạ</button></div>' +
        '<button class="btn btn--ghost btn--sm" data-g3-cam="toggle" style="align-self:flex-start">Giả lập: camera bị chặn / bật lại</button></div>';
    });
  }
  var simIdx = 0;
  function scanHit(code, box) {
    var tbl = $('[data-g3-scan-target]'), msg = $('.g3-scan__msg', box || document), row = tbl && $('tr[data-barcode="' + code + '"]', tbl);
    if (!msg) return;
    if (!row) { msg.innerHTML = '<div class="alert alert--danger">' + ic('circle-x') + '<div class="alert__body"><span class="alert__title">Mã ' + esc(code) + ' không có trong danh mục</span><span>Kiểm tra lại mã hoặc báo Thủ kho tạo phụ tùng mới. Mã này chưa được cộng vào số đếm.</span></div></div>'; return; }
    var q = $('.qty__input', row), name = $('[data-name]', row);
    if (q) q.value = (parseInt(q.value || '0', 10) || 0) + 1;
    $$('.g3-hit', tbl).forEach(function (x) { x.classList.remove('g3-hit'); }); row.classList.add('g3-hit'); row.scrollIntoView({ block: 'nearest' });
    msg.innerHTML = '<div class="alert alert--success">' + ic('circle-check') + '<div class="alert__body"><span><strong>Đã quét:</strong> ' + (name ? name.textContent : code) + (q ? '· số đếm ' + q.value : '') + '</span></div></div>';
    document.dispatchEvent(new CustomEvent('g3:scan', { detail: { code: code } }));
  }
  document.addEventListener('click', function (e) {
    var sim = e.target.closest('[data-g3-sim]');
    if (sim) {
      var box = sim.closest('.g3-scan'), rows = $$('[data-g3-scan-target] tr[data-barcode]');
      if (sim.getAttribute('data-g3-sim') === 'unknown') scanHit('8930000000000', box); else if (rows.length) { scanHit(rows[simIdx % rows.length].getAttribute('data-barcode'), box); simIdx++; }
    }
    var man = e.target.closest('[data-g3-manual]');
    if (man) { var b2 = man.closest('.g3-scan'), inp = $('input', b2); if (inp.value.trim()) { scanHit(inp.value.trim(), b2); inp.value = ''; } }
    var cam = e.target.closest('[data-g3-cam]');
    if (cam) { var b3 = cam.closest('.g3-scan'); b3.setAttribute('data-cam', b3.getAttribute('data-cam') === 'ok' ? 'denied' : 'ok'); }
  });

  /* ---------- 8. Dữ liệu cá nhân của nhân sự / liên hệ nhà cung cấp (mô phỏng API, theo ba-decisions câu 8) ----------
     Giá trị đầy đủ chỉ nằm trong hàm mô phỏng này, không nằm trong DOM; production gọi API thật và ghi nhật ký truy cập. */
  var PIID = {
    s1: { phone: '0903456789', cccd: '079201001234', area: 'Quận 7, TP.HCM', addr: '25 Huỳnh Tấn Phát, P. Tân Thuận Đông' },
    s2: { phone: '0938123456', cccd: '079198004455', area: 'Quận 7, TP.HCM', addr: '112 Lê Văn Lương, P. Tân Hưng' },
    s3: { phone: '0977456123', cccd: '079202007788', area: 'Thủ Đức, TP.HCM', addr: '9 Đường số 4, P. Linh Chiểu' },
    n1: { phone: '0912345456', area: 'Biên Hòa, Đồng Nai' }, n2: { phone: '0908555218', area: 'Quận 5, TP.HCM' }, n3: { phone: '0987123904', area: 'Quận 10, TP.HCM' }
  };
  function piiMask(k, r) { return k === 'phone' ? r.phone.slice(0, 2) + '•• ••• ' + r.phone.slice(-3) : k === 'cccd' ? '•••••••• ' + r.cccd.slice(-3) : '••••, ' + r.area; }
  function piiFull(k, r) { return k === 'phone' ? r.phone.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1 $2 $3') : k === 'cccd' ? r.cccd : r.addr + ', ' + r.area; }
  /* Ma trận che dữ liệu (ba-answers-04 Phụ lục D cho nhân sự; câu 19 cho liên hệ NCC) */
  function piiPolicy(group, kind, role, own) {
    if (own) return 'full';
    if (group === 'supplier') return has('TK MH QL', role) ? 'full' : has('CH QV KT', role) ? 'reveal' : 'hidden';
    if (role === 'NS') return 'full';
    if (role === 'QL') return kind === 'cccd' ? 'reveal' : 'full';
    if (has('CH QV', role)) return 'reveal';
    if (role === 'KT') return kind === 'phone' ? 'masked' : 'hidden';
    return 'hidden';
  }
  var piiTimers = [];
  function renderPII() {
    piiTimers.forEach(clearInterval); piiTimers = []; var role = role_();
    $$('[data-g3-pii]').forEach(function (el) {
      var r = PIID[el.getAttribute('data-g3-pii')], k = el.getAttribute('data-kind') || 'phone', pol = piiPolicy(el.getAttribute('data-group') || 'staff', k, role, has(el.getAttribute('data-own') || '', role));
      el.className = 'pii'; el.innerHTML = ''; if (!r) return;
      var lab = k === 'phone' ? 'số điện thoại' : k === 'cccd' ? 'số căn cước' : 'địa chỉ';
      if (pol === 'hidden') { el.classList.add('pii--denied'); el.innerHTML = ic('lock', 'icon--sm') + '<span>Bạn không có quyền xem ' + lab + '</span>'; return; }
      var v = document.createElement('span'); v.className = 'pii__value'; v.textContent = pol === 'full' ? piiFull(k, r) : piiMask(k, r); el.appendChild(v);
      if (pol === 'full') { el.title = 'Việc mở hồ sơ được ghi nhật ký truy cập'; return; }
      el.classList.add('is-masked');
      if (pol === 'reveal') { var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn--ghost btn--sm'; b.innerHTML = ic('eye', 'icon--sm') + 'Hiện'; b.setAttribute('aria-label', 'Hiện ' + lab + ' đầy đủ'); b.addEventListener('click', function () {
        b.disabled = true; b.textContent = 'Đang tải…';
        setTimeout(function () { v.textContent = piiFull(k, r); el.classList.remove('is-masked'); b.remove(); var t = document.createElement('span'); t.className = 'pii__timer'; var left = 30; t.textContent = 'Tự che sau 30 giây'; el.appendChild(t);
          var iv = setInterval(function () { left--; if (left <= 0) { clearInterval(iv); renderPII(); } else t.textContent = 'Tự che sau ' + left + ' giây'; }, 1000); piiTimers.push(iv);
          if (window.gmepToast) window.gmepToast('info', 'Đã ghi nhật ký truy cập', 'Ghi: người xem, thời điểm, bản ghi.'); }, 450); }); el.appendChild(b); }
    });
  }
  function role_() { return role(); }

  /* Menu và phạm vi chi nhánh của MH, NS do design/assets/app.js xử lý (đã vá); pack.js chỉ giữ tên vai trò và quyền theo màn */

  /* Chặn click lên nút/liên kết bị khóa (giữ focus để đọc lý do), hiện lý do bằng toast để dùng được cả trên cảm ứng */
  document.addEventListener('click', function (e) {
    var n = e.target.closest('[data-g3-need][aria-disabled="true"],[data-g3-needs-net][aria-disabled="true"],[data-g3-block]'); if (!n) return;
    e.preventDefault(); e.stopImmediatePropagation();
    var why = n.hasAttribute('data-g3-block') ? n.getAttribute('data-g3-block') : n.hasAttribute('data-g3-needs-net') ? 'Cần kết nối mạng để ghi giờ vào/ra ca. Hệ thống không ghi giờ giả khi mất mạng.' : (n.getAttribute('data-g3-why') || 'Bạn không có quyền thực hiện thao tác này.');
    if (window.gmepToast) window.gmepToast('warning', 'Chưa thực hiện được', why);
  }, true);

  /* ---------- Khởi tạo ---------- */
  function apply() { renderSubnav(); applyRoleBits(); renderPII(); applyState(); }
  function init() {
    expandStock(); buildScan(); initStates(); cards();
    var rq = (location.search.match(/[?&]role=([A-Z]{2})/) || [])[1];
    if (rq && ROLE_NAME[rq]) { var sw = $('[data-role-switch="' + rq + '"]'); document.body.setAttribute('data-role', rq); if (sw) sw.click(); }
    apply();
    new MutationObserver(apply).observe(document.body, { attributes: true, attributeFilter: ['data-role'] });
    var nb = $('.net-banner'); if (nb) new MutationObserver(applyRoleBits).observe(nb, { attributes: true, attributeFilter: ['class'] });
  }
  window.G3 = { shell: shell, top: top, tail: tail, init: init, REG: REG, apply: apply };
})();
