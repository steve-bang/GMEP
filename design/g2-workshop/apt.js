/* G2-APT-01 (v2, 07/11/2026): logic MINH HỌA cho tab Lịch hẹn, thanh chọn ngày, hộp thoại Hủy / Dời / Vắng.
   Nạp SAU pack.js và ../assets/app.js. Không phải code production.
   HANDOFF: (1) "bây giờ", "hôm nay", nhãn Trễ hẹn, số phút trễ do MÁY CHỦ tính theo Asia/Ho_Chi_Minh (ở đây cố định 30/10/2026 09:16);
   (2) bộ đếm tab và danh sách dùng cùng một điều kiện lọc phía máy chủ; (3) danh mục lý do, giới hạn dời, ngưỡng sát giờ, châm chước là cấu hình có ngày hiệu lực;
   (4) mọi chuỗi từ dữ liệu được gắn bằng textContent (không ghép HTML), không bao giờ hiện ngày dạng yyyy-MM-dd cho người dùng.
   Trạng thái xem thử lấy từ địa chỉ trang, ví dụ g2-apt-01.html#tab=overdue&state=empty&dlg=resched&sc=limit (xem danh sách ở docs/ui-ux/STATUS.md). */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var body = document.body;

  /* ---------- tiện ích dựng DOM an toàn ---------- */
  function h(tag, cls, txt, attrs) {
    var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt;
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }
  function ic(name, cls) {
    var s = document.createElementNS(NS, 'svg'); s.setAttribute('class', 'icon ' + (cls || '')); s.setAttribute('aria-hidden', 'true');
    var u = document.createElementNS(NS, 'use'); u.setAttribute('href', '#' + name); s.appendChild(u); return s;
  }
  function add(p) { for (var i = 1; i < arguments.length; i++) { var c = arguments[i]; if (c == null) continue; p.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); } return p; }
  function clear(e) { while (e.firstChild) e.removeChild(e.firstChild); return e; }
  function toast(k, t, x) { if (window.gmepToast) window.gmepToast(k, t, x); }

  /* ---------- ngày giờ (định dạng dd/MM/yyyy, tuần bắt đầu Thứ Hai, ISO 8601) ---------- */
  var TODAY = new Date(2026, 9, 30), NOW = new Date(2026, 9, 30, 9, 16), NOW_LABEL = '09:16';
  var WD_FULL = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'], WD_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function fmt(d) { return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear(); }
  function fmtDM(d) { return p2(d.getDate()) + '/' + p2(d.getMonth() + 1); }
  function iso(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function fromIso(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function isoVi(s) { return fmt(fromIso(s)); }
  function parseVN(s) { var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((s || '').trim()); if (!m) return null; var d = new Date(+m[3], +m[2] - 1, +m[1]); return (d.getMonth() === +m[2] - 1 && d.getDate() === +m[1]) ? d : null; }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function dayDiff(a, b) { return Math.round((a - b) / 864e5); }
  function weekStart(d) { return addDays(d, -((d.getDay() + 6) % 7)); }
  function isoWeek(d) { var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / 864e5 + 1) / 7); }
  function dayFull(d) { return WD_FULL[d.getDay()] + ', ' + fmt(d); }
  function daysShort(d) { return WD_SHORT[d.getDay()] + ', ' + fmt(d); }
  function apptDate(a) { var p = a.time.split(':'), d = fromIso(a.date); d.setHours(+p[0], +p[1], 0, 0); return d; }
  function atLabel(a) { return fmt(fromIso(a.date)) + ' ' + a.time; }
  function minsLate(a) { return Math.floor((NOW - apptDate(a)) / 60000); }
  function lateText(m) { if (m < 60) return 'Trễ ' + m + ' phút'; if (m < 1440) return 'Trễ ' + Math.floor(m / 60) + ' giờ' + (m % 60 ? ' ' + (m % 60) + ' phút' : ''); return 'Trễ ' + Math.floor(m / 1440) + ' ngày'; }

  /* ---------- cấu hình mẫu (cấu hình thật có ngày hiệu lực, theo chi nhánh) ---------- */
  var CFG = { grace: 0, staleDays: 30, maxResch: 3, lateMin: 120, noteMin: 3, cap: 20, horizon: 60 };
  var CAPMAP = { '2026-10-26': 12, '2026-10-27': 22, '2026-10-28': 9, '2026-10-29': 15, '2026-10-30': 14, '2026-10-31': 6, '2026-11-01': 0, '2026-11-02': 12, '2026-11-03': 20, '2026-11-04': 12, '2026-11-05': 9, '2026-11-06': 14 };
  function capOf(i) { return CAPMAP.hasOwnProperty(i) ? CAPMAP[i] : 8; }
  var CANCEL = [
    { c: 'customer_request', n: 'Khách yêu cầu hủy', p: 'customer' }, { c: 'customer_busy', n: 'Khách bận hoặc đổi kế hoạch', p: 'customer' }, { c: 'fixed_elsewhere', n: 'Xe đã sửa ở nơi khác', p: 'customer' },
    { c: 'not_needed', n: 'Xe không còn cần dịch vụ', p: 'customer' }, { c: 'unreachable', n: 'Không liên lạc được với khách', p: 'customer' },
    { c: 'duplicate_or_mistake', n: 'Trùng lịch hoặc đặt nhầm', p: 'garage' }, { c: 'garage_unable', n: 'Xưởng không nhận được (hết công suất, thiếu thợ)', p: 'garage' },
    { c: 'other', n: 'Khác', p: 'other', note: true }];
  var RESCH = [
    { c: 'customer_busy', n: 'Khách bận', p: 'customer' }, { c: 'customer_late', n: 'Khách báo đến trễ', p: 'customer' }, { c: 'vehicle_not_ready', n: 'Xe chưa sẵn sàng', p: 'customer' },
    { c: 'garage_reschedule', n: 'Xưởng đổi lịch', p: 'garage' }, { c: 'weather_incident', n: 'Thời tiết hoặc sự cố', p: 'garage' }, { c: 'other', n: 'Khác', p: 'other', note: true }];
  var PARTY = { customer: 'Khách đề nghị', garage: 'Xưởng đề nghị' };
  var PARTY_GRP = { customer: 'Khách', garage: 'Xưởng', other: 'Khác' };

  /* ---------- dữ liệu mẫu, MINH HỌA ---------- */
  var DATA = [
    { id: 'a0', code: 'LH-Q7-2609-00012', date: '2026-09-20', time: '10:00', plate: '51B-777.12', cust: 'Lê Văn Phúc', svc: 'Bảo dưỡng 20.000 km', adv: 'Phan Thanh Tùng', st: 'pending', tel: '0905123987', resch: [] },
    { id: 'a8', code: 'LH-Q7-2610-00033', date: '2026-10-28', time: '15:00', plate: '51D-402.18', cust: 'Phạm Thị Ngân', svc: 'Thay lốp', adv: 'Nguyễn Hoàng Yến', st: 'pending', tel: '0938127874', resch: [] },
    { id: 'a9', code: 'LH-Q7-2610-00036', date: '2026-10-29', time: '09:00', plate: '51G-310.27', cust: 'Trần Minh Khoa', svc: 'Bảo dưỡng 10.000 km', adv: 'Nguyễn Hoàng Yến', st: 'pending', tel: '0977123733', resch: [] },
    { id: 'a10', code: 'LH-Q7-2610-00038', date: '2026-10-29', time: '14:00', plate: '51A-246.80', cust: 'Võ Thanh Sơn', svc: 'Bảo dưỡng 25.000 km', adv: 'Phan Thanh Tùng', st: 'no_show', by: 'Phan Thanh Tùng', at: '29/10/2026 15:10', resch: [] },
    { id: 'a15', code: 'LH-Q7-2610-00035', date: '2026-10-29', time: '08:00', plate: '51H-880.31', cust: 'Đinh Văn Lực', svc: 'Sửa chữa chung', adv: 'Phan Thanh Tùng', st: 'arrived', ro: 'RO-Q7-2610-00127', arrivedAt: '29/10/2026 07:52', resch: [] },
    { id: 'a1', code: 'LH-Q7-2610-00041', date: '2026-10-30', time: '08:00', plate: '51H-123.45', cust: 'Nguyễn Văn An', svc: 'Bảo dưỡng 50.000 km', adv: 'Nguyễn Hoàng Yến', st: 'arrived', ro: 'RO-Q7-2610-00128', arrivedAt: '30/10/2026 07:58', resch: [] },
    { id: 'a2', code: 'LH-Q7-2610-00042', date: '2026-10-30', time: '08:30', plate: '59-S1 4567', cust: 'Lý Thị Mỹ', svc: 'Xe máy Honda Wave, thay nhớt', adv: 'Nguyễn Hoàng Yến', st: 'pending', tel: '0933222444', resch: [] },
    { id: 'a3', code: 'LH-Q7-2610-00040', date: '2026-10-30', time: '09:00', plate: '51L-222.33', cust: 'Hoàng Văn Thái', svc: 'Sửa chữa chung (kêu gầm khi qua gờ)', adv: 'Phan Thanh Tùng', st: 'pending', tel: '0988246810', orig: { d: '2026-10-29', t: '14:00' },
      resch: [{ fd: '2026-10-29', ft: '14:00', td: '2026-10-30', tt: '09:00', reason: 'Khách bận', party: 'customer', by: 'Nguyễn Hoàng Yến', at: '28/10/2026 16:20', note: '', flags: [] }] },
    { id: 'a4', code: 'LH-Q7-2610-00043', date: '2026-10-30', time: '10:00', plate: '51C-909.09', cust: 'Mai Văn Lộc', svc: 'Bảo dưỡng định kỳ', adv: null, st: 'pending', tel: '0966777555', resch: [] },
    { id: 'a5', code: 'LH-Q7-2610-00039', date: '2026-10-30', time: '11:00', plate: '60A-123.45', cust: 'Bùi Thị Hạnh', svc: 'Lốp & mâm', adv: 'Nguyễn Hoàng Yến', st: 'cancelled', tel: '0909888111', cancel: { code: 'customer_busy', name: 'Khách bận hoặc đổi kế hoạch', note: '', by: 'Nguyễn Hoàng Yến', at: '30/10/2026 08:30' }, resch: [] },
    { id: 'a6', code: 'LH-Q7-2610-00031', date: '2026-10-30', time: '13:30', plate: '51K-987.65', cust: 'Công ty TNHH Vận tải Hòa Phát Đông Nam Bộ', svc: 'Kiểm tra trước đăng kiểm', adv: 'Phan Thanh Tùng', st: 'pending', tel: '0918765432', orig: { d: '2026-10-22', t: '09:00' },
      resch: [
        { fd: '2026-10-28', ft: '15:00', td: '2026-10-30', tt: '13:30', reason: 'Xe chưa sẵn sàng', party: 'customer', by: 'Nguyễn Hoàng Yến', at: '27/10/2026 10:05', note: 'Xe đang chạy tuyến, về muộn', flags: ['Dời sát giờ'] },
        { fd: '2026-10-25', ft: '09:00', td: '2026-10-28', tt: '15:00', reason: 'Khách bận', party: 'customer', by: 'Phan Thanh Tùng', at: '24/10/2026 14:40', note: '', flags: ['Vượt công suất'] },
        { fd: '2026-10-22', ft: '09:00', td: '2026-10-25', tt: '09:00', reason: 'Xưởng đổi lịch', party: 'garage', by: 'Nguyễn Hoàng Yến', at: '21/10/2026 17:00', note: 'Thiếu cầu nâng', flags: [] }] },
    { id: 'a7', code: 'LH-Q7-2610-00044', date: '2026-10-30', time: '15:00', plate: '51F-555.66', cust: 'Đặng Quốc Bảo', svc: 'Đồng sơn (khảo sát vết xước)', adv: 'Nguyễn Hoàng Yến', st: 'pending', tel: '0942001133', resch: [] },
    { id: 'a12', code: 'LH-Q7-2610-00045', date: '2026-10-31', time: '09:00', plate: '51M-210.45', cust: 'Phan Văn Hải', svc: 'Bảo dưỡng 40.000 km', adv: 'Phan Thanh Tùng', st: 'pending', tel: '0987654560', resch: [] },
    { id: 'a13', code: 'LH-Q7-2611-00001', date: '2026-11-02', time: '08:00', plate: '51N-678.90', cust: 'Ngô Thị Lan', svc: 'Thay má phanh', adv: 'Nguyễn Hoàng Yến', st: 'pending', tel: '0912345012', resch: [] },
    { id: 'a14', code: 'LH-Q7-2611-00002', date: '2026-11-03', time: '13:30', plate: '51P-135.79', cust: 'Vũ Đức Thịnh', svc: 'Sửa chữa chung', adv: 'Phan Thanh Tùng', st: 'pending', tel: '0903456321', resch: [] },
    { id: 'a16', code: 'LH-Q7-2610-00037', date: '2026-10-29', time: '16:00', plate: '51Q-246.13', cust: 'Hồ Thị Cúc', svc: 'Bảo dưỡng', adv: 'Phan Thanh Tùng', st: 'cancelled', tel: '0905123987', cancel: { code: 'legacy', name: 'Lý do nhập tự do', note: 'Khách báo bận, đổi sang tuần sau', by: 'Phan Thanh Tùng', at: '29/10/2026 09:10' }, resch: [] }
  ];
  function byId(id) { for (var i = 0; i < DATA.length; i++) if (DATA[i].id === id) return DATA[i]; return null; }
  function isOverdue(a) { return a.st === 'pending' && minsLate(a) > CFG.grace; }
  function tabOf(a) { if (a.st === 'pending') return isOverdue(a) ? 'overdue' : 'upcoming'; return a.st === 'no_show' ? 'no_show' : a.st; }
  function cmp(x, y) { return x < y ? -1 : x > y ? 1 : 0; }

  /* ---------- trạng thái màn ---------- */
  var S = { tab: 'upcoming', view: 'day', date: iso(TODAY), state: 'data', off: false, trunc: false, consent: true };
  var TABS = ['upcoming', 'overdue', 'arrived', 'cancelled', 'no_show'];
  var TAB_NAME = { upcoming: 'Sắp tới', overdue: 'Trễ hẹn', arrived: 'Đã đến', cancelled: 'Đã hủy', no_show: 'Vắng' };
  function role() { return body.getAttribute('data-role') || 'CV'; }
  function canAct() { return ['CV', 'QL', 'CH'].indexOf(role()) >= 0; }
  function canOverride() { return ['QL', 'CH'].indexOf(role()) >= 0; }
  var WHY_ACT = 'Chỉ Cố vấn, Quản lý chi nhánh và Chủ garage tạo, dời, hủy lịch. Vai trò hiện tại chỉ xem.';
  function range() { var d = fromIso(S.date); if (S.view === 'day') return [iso(d), iso(d)]; var w = weekStart(d); return [iso(w), iso(addDays(w, 6))]; }
  function listFor(tab) {
    var r = range(), l = DATA.filter(function (a) { return tabOf(a) === tab && (tab === 'overdue' || (a.date >= r[0] && a.date <= r[1])); });
    l.sort(function (a, b) {
      if (tab === 'overdue') return apptDate(a) - apptDate(b);
      if (tab === 'upcoming') return cmp(a.date + a.time, b.date + b.time);
      return cmp(b.date + b.time, a.date + a.time);
    });
    return l;
  }
  function countText(tab) {
    if (S.state === 'error' || S.state === 'denied') return '–';
    if (S.state === 'loading') return '…';
    if (S.trunc && tab === 'overdue') return '500+';
    return String(S.state === 'empty' ? 0 : listFor(tab).length);
  }

  /* ---------- địa chỉ trang (hash) ---------- */
  function readHash() {
    var p = new URLSearchParams(location.hash.replace(/^#/, ''));
    if (TABS.indexOf(p.get('tab')) >= 0) S.tab = p.get('tab');
    if (p.get('view') === 'week') S.view = 'week';
    var d = p.get('date'); if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) S.date = d;
    var st = p.get('state'); if (['data', 'loading', 'empty', 'error', 'denied', 'off'].indexOf(st) >= 0) S.state = st;
    if (p.get('trunc') === '1') S.trunc = true;
    if (p.get('consent') === '0') S.consent = false;
    return p;
  }
  function writeHash() {
    var p = new URLSearchParams(); p.set('tab', S.tab); if (S.view !== 'day') p.set('view', S.view); if (S.date !== iso(TODAY)) p.set('date', S.date);
    if (S.state !== 'data') p.set('state', S.state); if (S.trunc) p.set('trunc', '1'); if (!S.consent) p.set('consent', '0');
    try { history.replaceState(null, '', '#' + p.toString()); } catch (e) { /* file:// trên một số trình duyệt */ }
  }

  /* ---------- thanh chọn ngày ---------- */
  function dateLabels() {
    var d = fromIso(S.date), full, short, chip = null, chipCls = 'badge--neutral', aria;
    if (S.view === 'day') {
      full = dayFull(d); short = daysShort(d);
      var k = dayDiff(d, TODAY); if (k === 0) { chip = 'Hôm nay'; chipCls = 'badge--info'; } else if (k === 1) chip = 'Ngày mai'; else if (k === -1) chip = 'Hôm qua';
      aria = { prev: 'Ngày trước, ' + fmt(addDays(d, -1)), next: 'Ngày sau, ' + fmt(addDays(d, 1)) };
    } else {
      var w = weekStart(d), e = addDays(w, 6), same = w.getFullYear() === e.getFullYear();
      function wt(x) { var a = weekStart(x), b = addDays(a, 6); return 'Tuần ' + isoWeek(a) + ' (' + (a.getFullYear() === b.getFullYear() ? fmtDM(a) : fmt(a)) + ' – ' + fmt(b) + ')'; }
      full = short = wt(d);
      if (dayDiff(TODAY, w) >= 0 && dayDiff(TODAY, w) <= 6) { chip = 'Tuần này'; chipCls = 'badge--info'; }
      aria = { prev: 'Tuần trước, ' + wt(addDays(d, -7)), next: 'Tuần sau, ' + wt(addDays(d, 7)) };
      if (!same) full = short;
    }
    return { full: full, short: short, chip: chip, chipCls: chipCls, aria: aria };
  }
  function renderDateBar() {
    var L = dateLabels(), d = fromIso(S.date);
    var t = clear($('#d-title')); add(t, add(h('span', 'g2w-dt-full'), L.full), add(h('span', 'g2w-dt-short'), L.short));
    var ch = $('#d-chip'); ch.hidden = !L.chip; ch.className = 'badge badge--nodot ' + L.chipCls; ch.textContent = L.chip || '';
    $('#d-prev').setAttribute('aria-label', L.aria.prev); $('#d-next').setAttribute('aria-label', L.aria.next);
    var isNow = S.view === 'day' ? S.date === iso(TODAY) : dayDiff(TODAY, weekStart(d)) >= 0 && dayDiff(TODAY, weekStart(d)) <= 6;
    var tb = $('#d-today'); tb.setAttribute('aria-disabled', String(isNow)); tb.setAttribute('aria-label', isNow ? (S.view === 'day' ? 'Đang xem hôm nay' : 'Đang xem tuần này') : (S.view === 'day' ? 'Về hôm nay, ' + fmt(TODAY) : 'Về tuần này'));
    tb.classList.toggle('btn--secondary', !isNow); tb.classList.toggle('btn--ghost', isNow);
    var inp = $('#d-input'); inp.value = fmt(d); inp.classList.remove('is-error'); inp.removeAttribute('aria-invalid'); $('#d-err').hidden = true;
    var host = $('#d-dp'); host._dp = undefined;
    $$('[data-apt-view]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-apt-view') === S.view)); });
    $('#apt-scope-time').textContent = S.tab === 'overdue' ? 'mọi ngày (lịch trễ hẹn không phụ thuộc ngày đang xem)' : (S.view === 'day' ? dayFull(d) : L.full);
    renderCap();
  }
  function renderCap() {
    var box = clear($('#d-cap')), d = fromIso(S.date);
    if (S.view !== 'day') { box.hidden = true; return; }
    box.hidden = false;
    var n = capOf(S.date), N = CFG.cap, pct = Math.min(100, Math.round(n / N * 100)), label = S.date === iso(TODAY) ? 'Công suất hôm nay' : 'Công suất ' + dayFull(d);
    var cls = n > N ? 'danger' : n >= N * 0.8 ? 'warning' : 'info';
    var lab = h('span', 'field__label', label, { id: 'cap-l' });
    var pr = h('div', 'progress progress--' + cls), hd = h('div', 'progress__head');
    add(hd, add(h('span'), add(h('strong', null, n + '/' + N), ' xe')), h('span', null, pct + '%'));
    var tr = h('div', 'progress__track', null, { role: 'progressbar', 'aria-labelledby': 'cap-l', 'aria-valuenow': String(n), 'aria-valuemin': '0', 'aria-valuemax': String(N), 'aria-valuetext': n + ' trên ' + N + ' xe' });
    var bar = h('div', 'progress__bar'); bar.style.width = pct + '%'; add(tr, bar); add(pr, hd, tr);
    var st = n > N ? h('span', 'badge badge--danger', 'Vượt công suất') : n === N ? h('span', 'badge badge--warning', 'Đủ chỗ') : h('span', 'badge badge--success', 'Còn ' + (N - n) + ' chỗ');
    add(box, lab, pr, st);
  }

  /* ---------- nhãn trạng thái (năm đối tượng tách riêng: đây chỉ là lịch hẹn) ---------- */
  function stBadge(a) {
    var t = tabOf(a);
    if (t === 'overdue') return add(h('span', 'badge badge--warning badge--nodot'), ic('clock', 'icon--sm'), 'Trễ hẹn');
    if (t === 'upcoming') return h('span', 'badge badge--info', 'Đã hẹn');
    if (t === 'arrived') return h('span', 'badge badge--success', 'Đã đến');
    if (t === 'cancelled') return h('span', 'badge badge--danger', 'Đã hủy');
    return add(h('span', 'badge badge--neutral badge--nodot'), ic('circle-x', 'icon--sm'), 'Vắng');
  }
  function btn(label, cls, icon, act, id, extra) {
    var b = h('button', 'btn ' + cls, null, { type: 'button', 'data-apt-act': act, 'data-id': id });
    if (icon) add(b, ic(icon)); add(b, label); if (extra) Object.keys(extra).forEach(function (k) { b.setAttribute(k, extra[k]); }); return b;
  }
  function rowEl(a, tab) {
    var od = tab === 'overdue', li = h('li', 'g2w-arow' + (od ? ' is-overdue' : ''));
    var tm = h('div', 'g2w-arow__time', a.time); if (od || tab === 'arrived' || tab === 'cancelled' || tab === 'no_show') add(tm, h('small', null, fmt(fromIso(a.date)))); add(li, tm);
    var m = h('div', 'g2w-arow__main'), top = h('div', 'g2w-arow__top');
    add(top, add(h('strong', 'plate'), h('button', 'g2w-arow__open', a.plate, { type: 'button', 'data-apt-act': 'open', 'data-id': a.id, 'aria-label': 'Xem chi tiết lịch ' + a.time + ' ' + a.plate })), stBadge(a));
    if (od) { var lt = minsLate(a); add(top, h('span', 'tag tag--warning', lateText(lt))); if (lt >= CFG.staleDays * 1440) add(top, h('span', 'tag tag--neutral', 'Tồn đọng')); }
    add(m, top, h('div', null, a.cust + ' · ' + a.svc), h('div', 'g2w-muted', (a.adv ? 'Cố vấn ' + a.adv.split(' ').slice(-1)[0] : 'Chưa phân cố vấn') + ' · ' + a.code));
    if (a.resch.length) add(m, add(h('div', 'g2w-arow__chips'), h('span', 'tag tag--info', 'Đã dời ' + a.resch.length + ' lần'), h('span', 'g2w-muted', 'Hẹn ban đầu ' + isoVi(a.orig.d) + ' ' + a.orig.t)));
    if (a.st === 'cancelled') add(m, h('div', 'g2w-muted', 'Lý do: ' + a.cancel.name + (a.cancel.note ? ' (' + a.cancel.note + ')' : '') + ' · ' + a.cancel.by + ' · ' + a.cancel.at));
    if (a.st === 'no_show') add(m, h('div', 'g2w-muted', 'Đánh dấu vắng bởi ' + a.by + ' lúc ' + a.at));
    if (a.st === 'arrived') add(m, h('div', 'g2w-muted', 'Đến lúc ' + a.arrivedAt + ' · hồ sơ tiếp nhận ' + a.ro));
    add(li, m);
    if (!canAct()) return li;
    var ac = h('div', 'g2w-arow__actions');
    if (tab === 'upcoming') {
      var q = h('div', 'g2w-arow__quick');
      add(q, add(h('a', 'btn btn--primary btn--sm', null, { href: 'g2-rec-01.html' }), ic('check'), 'Đã đến'), btn('Dời lịch', 'btn--secondary btn--sm', 'calendar', 'resched', a.id), btn('Hủy', 'btn--ghost btn--sm', 'x', 'cancel', a.id));
      add(ac, q);
    } else if (tab === 'overdue') {
      var q2 = h('div', 'g2w-arow__quick'), call = h('a', 'btn btn--primary btn--sm', null, { href: 'tel:' + a.tel, 'aria-label': 'Gọi khách ' + a.cust, 'data-apt-act': 'call' });
      add(call, ic('phone'), 'Gọi khách'); add(q2, call, btn('Dời lịch', 'btn--secondary btn--sm', 'calendar', 'resched', a.id), btn('Đánh dấu vắng', 'btn--secondary btn--sm', 'circle-x', 'absent', a.id));
      var mo = h('div', 'g2w-arow__more'); add(mo, add(h('a', 'btn btn--ghost btn--sm', null, { href: 'g2-rec-01.html' }), 'Đã đến'), btn('Hủy', 'btn--ghost btn--sm', null, 'cancel', a.id));
      add(ac, q2, mo);
    } else return li;
    add(li, ac); return li;
  }

  /* ---------- nội dung từng tab ---------- */
  var EMPTY = {
    upcoming: ['Chưa có lịch hẹn trong khoảng này', 'Tạo lịch hẹn để giữ chỗ cho khách, hoặc tiếp nhận xe vãng lai ngay.', true],
    overdue: ['Không có lịch trễ hẹn', 'Tất cả lịch đã được xử lý.', false],
    arrived: ['Chưa có lịch nào được tiếp nhận trong khoảng này', 'Lịch chuyển sang đây khi khách đến và hồ sơ tiếp nhận được mở.', false],
    cancelled: ['Không có lịch bị hủy trong khoảng này', 'Lịch hủy kèm lý do sẽ hiện ở đây.', false],
    no_show: ['Không có khách vắng trong khoảng này', 'Lịch đánh dấu vắng sẽ hiện ở đây.', false]
  };
  function stateBox(kind, iconName, title, text, actions, role) {
    var box = h('div', 'table-wrap'), s = h('div', 'state'); if (role) s.setAttribute('role', role);
    add(s, add(h('div', 'state__icon state__icon--' + kind), ic(iconName, 'icon--lg')), h('div', 'state__title', title), h('p', 'state__text', text));
    if (actions) add(s, actions); return add(box, s);
  }
  function fillPanel(tab) {
    var pn = clear($('#pnl-' + tab)), act = tab === S.tab;
    pn.hidden = !act; if (!act) return;
    if (S.state === 'off') return;
    if (S.state === 'loading') { pn.setAttribute('aria-busy', 'true'); var c = h('div', 'card'), b = h('div', 'card__body stack'); for (var i = 0; i < 3; i++) { var sk = h('span', 'skeleton skeleton--block'); sk.style.height = '64px'; add(b, sk); } add(pn, add(c, b), h('p', 'g2w-muted', 'Đang tải ' + (tab === 'overdue' ? 'lịch trễ hẹn' : 'lịch hẹn') + '…', { role: 'status' })); return; }
    pn.removeAttribute('aria-busy');
    if (S.state === 'denied') { add(pn, stateBox('warning', 'lock', 'Bạn chưa có quyền xem tab “' + TAB_NAME[tab] + '”', 'Lịch hẹn dành cho Cố vấn, Quản lý và Chủ garage. Liên hệ Quản lý chi nhánh nếu bạn cần quyền xem.', add(h('div', 'state__actions'), add(h('a', 'btn btn--secondary', null, { href: 'index.html' }), 'Quay lại danh mục')))); return; }
    if (S.state === 'error') { var ac = h('div', 'state__actions'); add(ac, add(btn('Thử lại', 'btn--primary', 'refresh', 'retry', ''))); var bx = stateBox('danger', 'alert-triangle', 'Không tải được tab “' + TAB_NAME[tab] + '”', 'Kết nối tới máy chủ bị gián đoạn. Đây không phải là “chưa có lịch”. Các tab khác vẫn dùng được. Hãy thử lại.', ac, 'alert'); add($('.state', bx), h('span', 'state__ref', 'Mã lỗi: ERR-APT-5001 · ' + NOW_LABEL + ' 30/10/2026')); add(pn, bx); return; }
    var l = S.state === 'empty' ? [] : listFor(tab);
    if (tab === 'overdue') {
      add(pn, add(h('div', 'alert alert--info', null, { role: 'note' }), ic('info'), add(h('div', 'alert__body'), h('span', null, 'Không phụ thuộc ngày đang xem: hiện mọi lịch chờ đã qua giờ hẹn của chi nhánh, lâu nhất ở trên cùng. Ngưỡng châm chước hiện là ' + CFG.grace + ' phút (cấu hình theo chi nhánh).'))));
    } else {
      if (tab === 'upcoming' && S.view === 'week') add(pn, weekStrip());
    }
    if (S.trunc && tab === 'overdue') add(pn, add(h('div', 'alert alert--warning', null, { role: 'status' }), ic('alert-triangle'), add(h('div', 'alert__body'), h('span', null, 'Chỉ hiện 500 lịch trễ hẹn lâu nhất. Xử lý bớt rồi tải lại để thấy phần còn lại (bộ đếm “500+”).'))));
    if (!l.length) {
      var e = EMPTY[tab], ax = null; if (e[2]) { ax = h('div', 'state__actions'); add(ax, add(h('a', 'btn btn--primary', null, { href: 'g2-apt-02.html' }), ic('plus'), 'Tạo lịch hẹn'), add(h('a', 'btn btn--secondary', null, { href: 'g2-rec-01.html' }), 'Tiếp nhận xe vãng lai')); if (!canAct()) ax = null; }
      add(pn, stateBox(tab === 'overdue' ? 'success' : 'brand', tab === 'overdue' ? 'check' : 'calendar', e[0], e[1], ax)); return;
    }
    if (tab !== 'overdue' && S.view === 'week') {
      var groups = {}; l.forEach(function (a) { (groups[a.date] = groups[a.date] || []).push(a); });
      Object.keys(groups).sort(tab === 'upcoming' ? undefined : function (x, y) { return cmp(y, x); }).forEach(function (di) {
        var d = fromIso(di), hd = h('h3', 'g2w-agroup'); add(hd, dayFull(d));
        if (di === iso(TODAY)) add(hd, h('span', 'badge badge--info badge--nodot', 'Hôm nay'));
        if (tab === 'upcoming') add(hd, h('span', 'tag' + (capOf(di) >= CFG.cap ? ' tag--warning' : ''), capOf(di) + '/' + CFG.cap + ' xe' + (capOf(di) > CFG.cap ? ' · vượt công suất' : capOf(di) === CFG.cap ? ' · đủ chỗ' : '')));
        var ul = h('ul', 'g2w-alist'); groups[di].forEach(function (a) { add(ul, rowEl(a, tab)); }); add(pn, hd, ul);
      });
      return;
    }
    var ul2 = h('ul', 'g2w-alist', null, { 'aria-label': 'Danh sách lịch ' + TAB_NAME[tab] }); l.forEach(function (a) { add(ul2, rowEl(a, tab)); }); add(pn, ul2);
  }
  function weekStrip() {
    var w = weekStart(fromIso(S.date)), box = h('div', 'g2w-wk', null, { role: 'group', 'aria-label': 'Công suất từng ngày trong tuần, chọn để xem ngày' });
    for (var i = 0; i < 7; i++) {
      var d = addDays(w, i), di = iso(d), n = capOf(di), full = n >= CFG.cap;
      var b = h('button', 'g2w-wk__d' + (full ? ' is-full' : '') + (di === iso(TODAY) ? ' is-today' : ''), null, { type: 'button', 'data-apt-day': di, 'aria-label': dayFull(d) + ': ' + n + ' trên ' + CFG.cap + ' xe' + (n > CFG.cap ? ', vượt công suất' : n === CFG.cap ? ', đủ chỗ' : '') });
      add(b, h('span', null, WD_SHORT[d.getDay()] + ' ' + fmtDM(d)), h('strong', null, n + '/' + CFG.cap + ' xe'), full ? h('span', null, n > CFG.cap ? 'Vượt công suất' : 'Đủ chỗ') : null); add(box, b);
    }
    return box;
  }
  function renderTabs() {
    TABS.forEach(function (t) {
      var tb = $('#tab-' + t), on = t === S.tab; tb.setAttribute('aria-selected', String(on)); tb.tabIndex = on ? 0 : -1;
      var p = $('#tc-' + t), v = countText(t); p.textContent = v; p.setAttribute('aria-label', v + ' lịch'); p.className = 'count-pill' + (t === 'overdue' && v !== '0' && v !== '–' && v !== '…' ? ' count-pill--warning' : '');
    });
    var n = S.state === 'data' ? listFor('overdue').length : 0, al = clear($('#apt-od-alert'));
    if (S.state === 'data' && n > 0 || (S.trunc && S.state === 'data')) {
      var txt = S.trunc ? 'Có 500+ lịch trễ hẹn chưa xử lý' : 'Có ' + n + ' lịch trễ hẹn chưa xử lý';
      var a = h('div', 'alert alert--warning', null, { role: 'status' }), bd = h('div', 'alert__body'); add(bd, h('span', 'alert__title', txt), h('span', null, 'Khách đã quá giờ hẹn mà chưa đến. Gọi khách, dời lịch hoặc đánh dấu vắng.'));
      add(a, ic('clock'), bd); if (S.tab !== 'overdue') add(a, add(h('div', 'alert__actions'), btn('Xem lịch trễ hẹn', 'btn--secondary btn--sm', null, 'goto-overdue', ''))); add(al, a);
    }
    var ro = $('#apt-ro'); ro.hidden = canAct();
  }
  function renderAll() {
    var off = S.state === 'off';
    $('#apt-main').hidden = off; $('#apt-off').hidden = !off;
    $('#datebar').hidden = S.tab === 'overdue';
    renderDateBar(); renderTabs(); TABS.forEach(fillPanel);
    $$('[data-apt-state]').forEach(function (b) { var v = b.getAttribute('data-apt-state'); b.setAttribute('aria-pressed', String(v === S.state)); });
    $$('[data-apt-flag]').forEach(function (b) { var k = b.getAttribute('data-apt-flag'); b.setAttribute('aria-pressed', String(k === 'trunc' ? S.trunc : !S.consent)); });
    writeHash();
  }

  /* ---------- ngăn chi tiết ---------- */
  var cur = null;
  function kv(dl, k, v) { add(dl, h('dt', null, k), add(h('dd'), v)); }
  function openDrawer(id) {
    var a = byId(id); if (!a) return; cur = a;
    $('#ap-t').textContent = 'Lịch hẹn ' + a.time + ' · ' + a.plate; $('#ap-sub').textContent = a.cust + ' · ' + a.code;
    var bg = clear($('#ap-badges')); add(bg, stBadge(a), h('span', 'g2w-muted', atLabel(a)));
    if (isOverdue(a)) add(bg, h('span', 'tag tag--warning', lateText(minsLate(a))));
    if (a.resch.length) add(bg, h('span', 'tag tag--info', 'Đã dời ' + a.resch.length + ' lần'));
    var dl = clear($('#ap-kv')); kv(dl, 'Dịch vụ', a.svc); kv(dl, 'Ngày giờ hẹn', dayFull(fromIso(a.date)) + ' ' + a.time);
    if (a.orig) kv(dl, 'Hẹn ban đầu', isoVi(a.orig.d) + ' ' + a.orig.t);
    kv(dl, 'Cố vấn', a.adv || 'Chưa phân cố vấn');
    var phone = h('span', 'g2w-pii'); phone.textContent = a.tel ? (canAct() ? a.tel.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1 $2 $3') : a.tel.slice(0, 2) + '•• ••• ' + a.tel.slice(-3)) : '–'; kv(dl, 'Điện thoại', phone);
    if (a.st === 'cancelled') { kv(dl, 'Lý do hủy', a.cancel.name + (a.cancel.code === 'legacy' ? ' (dữ liệu cũ, chưa phân loại)' : '')); if (a.cancel.note) kv(dl, 'Ghi chú hủy', a.cancel.note); kv(dl, 'Người hủy', a.cancel.by + ' · ' + a.cancel.at); }
    if (a.st === 'no_show') kv(dl, 'Đánh dấu vắng', a.by + ' · ' + a.at);
    if (a.st === 'arrived') kv(dl, 'Hồ sơ tiếp nhận', a.ro + ' · khách đến ' + a.arrivedAt);
    var hs = clear($('#ap-hist')); hs.hidden = false;
    add(hs, h('h3', 'g2w-sec-title', 'Lịch sử dời' + (a.resch.length ? ' (' + a.resch.length + ')' : ''), { style: 'font-size:var(--font-size-md)' }));
    if (!a.resch.length) add(hs, h('p', 'g2w-muted', 'Lịch chưa dời lần nào.'));
    else { var ul = h('ul', 'g2w-rhist'); a.resch.forEach(function (r) {
      var li = h('li'); add(li, h('strong', 'num', isoVi(r.fd) + ' ' + r.ft + ' → ' + isoVi(r.td) + ' ' + r.tt), h('span', null, r.reason + ' · ' + PARTY[r.party] + ' · ' + r.by + ' · ' + r.at));
      if (r.note) add(li, h('span', 'g2w-muted', 'Ghi chú: ' + r.note));
      if (r.flags.length) { var fg = h('div', 'g2w-arow__chips'); r.flags.forEach(function (f) { add(fg, h('span', 'tag tag--warning', f)); }); add(li, fg); }
      add(ul, li); }); add(hs, ul); }
    var ft = clear($('#ap-foot'));
    if (a.st === 'pending') {
      var ok = canAct(), dis = ok ? null : { disabled: 'disabled', title: WHY_ACT, 'aria-describedby': 'ap-why' };
      add(ft, btn('Hủy lịch…', 'btn--danger-outline', 'x', 'cancel', a.id, dis), btn('Dời lịch…', 'btn--secondary', 'calendar', 'resched', a.id, dis));
      if (isOverdue(a)) add(ft, btn('Đánh dấu vắng…', 'btn--secondary', 'circle-x', 'absent', a.id, dis));
      var ed = h('a', 'btn btn--secondary', null, { href: 'g2-apt-02.html?v=edit' }); add(ed, 'Sửa cố vấn, dịch vụ, ghi chú'); if (!ok) { ed.setAttribute('aria-disabled', 'true'); ed.style.pointerEvents = 'none'; ed.style.opacity = '.5'; ed.title = WHY_ACT; } add(ft, ed);
      var go = h('a', 'btn btn--primary', null, { href: 'g2-rec-01.html' }); add(go, ic('check'), 'Đã đến, tiếp nhận'); if (!ok) { go.setAttribute('aria-disabled', 'true'); go.style.pointerEvents = 'none'; go.style.opacity = '.5'; go.title = WHY_ACT; } add(ft, go);
    } else add(ft, h('p', 'g2w-muted', 'Lịch đã kết thúc nên chỉ xem. Khách quay lại thì tạo lịch mới.'), add(h('a', 'btn btn--secondary', null, { href: 'g2-apt-02.html' }), ic('plus'), 'Tạo lịch hẹn mới'));
    $('#ap-why').hidden = canAct() || a.st !== 'pending'; clear($('#ap-why')); if (!canAct() && a.st === 'pending') add($('#ap-why'), ic('lock', 'icon--sm'), h('span', null, WHY_ACT));
    window.gmepOpen('drw-appt');
  }

  /* ---------- khối dùng chung trong hộp thoại ---------- */
  function checkEl(id, label, sub) {
    var l = h('label', 'check'), i = h('input', null, null, { type: 'checkbox', id: id }), tx = h('span');
    add(tx, label); if (sub) add(tx, ' ', h('span', 'g2w-muted', sub));
    return add(l, i, add(h('span', 'check__box'), ic('check')), tx);
  }
  function mkNotify(pre) {
    var box = clear($('#' + pre + '-notify')), ok = S.consent;
    var l = checkEl(pre + '-nt', 'Báo cho khách qua tin nhắn', '(chỉ kênh khách đã đồng ý; cổng thông báo đang ở chế độ thử, chưa gửi thật)');
    if (!ok) { var ni = $('input', l); ni.disabled = true; ni.setAttribute('data-keep-off', ''); }
    add(box, l);
    if (!ok) add(box, add(h('p', 'g2w-why', null, { role: 'status' }), ic('lock', 'icon--sm'), h('span', null, 'Không bật được: khách chưa đồng ý nhận tin hoặc kênh chưa kích hoạt. Hãy gọi điện cho khách rồi ghi nhận bên dưới.')));
    add(box, checkEl(pre + '-ph', 'Đã gọi điện báo khách'));
  }
  function radioEl(name, value, label, checked) {
    var l = h('label', 'radio'), i = h('input', null, null, { type: 'radio', name: name, value: value }); if (checked) i.checked = true;
    return add(l, i, h('span', 'radio__box'), h('span', null, label));
  }
  function fillReasons(boxId, name, list, grouped) {
    var box = clear($('#' + boxId)), last = null;
    list.forEach(function (r) {
      if (grouped && r.p !== last) { last = r.p; add(box, h('div', 'g2w-reasons__grp', PARTY_GRP[r.p])); }
      add(box, radioEl(name, r.c, r.n));
    });
  }
  function reasonObj(list, name) { var r = $('input[name="' + name + '"]:checked'); if (!r) return null; for (var i = 0; i < list.length; i++) if (list[i].c === r.value) return list[i]; return null; }
  function setWhy(id, txt) { var w = $('#' + id); clear(w); w.hidden = !txt; if (txt) add(w, ic('lock', 'icon--sm'), h('span', null, txt)); }
  function noteErr(id, on, txt) { var t = $('#' + id), e = $('#' + id + '-e'); t.classList.toggle('is-error', on); t.setAttribute('aria-invalid', String(on)); e.hidden = !on; if (on) { clear(e); add(e, ic('alert-triangle', 'icon--sm'), txt); } }
  function setDs(dlg, ds) {
    dlg.setAttribute('data-ds', ds);
    $$('[data-apt-show]', dlg).forEach(function (e) { e.hidden = e.getAttribute('data-apt-show').split(' ').indexOf(ds) < 0; });
    $$('[data-apt-ro]', dlg).forEach(function (e) { var ro = ds === 'saving' || ds === 'done'; $$('input,select,textarea,button', e).forEach(function (c) { c.disabled = ro || c.hasAttribute('data-keep-off'); }); });
    $$('[data-apt-ds]', dlg).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-apt-ds') === ds)); });
    if (dlg === DC && DC_READY) caCheck(false); else if (dlg === DR && rsTarget) rsCheck();
    $$('[data-apt-loadbtn]', dlg).forEach(function (b) { b.classList.toggle('is-loading', ds === 'saving'); if (ds === 'saving') { b.setAttribute('aria-busy', 'true'); b.disabled = true; } else b.removeAttribute('aria-busy'); });
  }
  var DC_READY = false;
  function protoBar(id, label, items, attr) {
    var box = clear($('#' + id)); add(box, h('span', 'g2w-proto__lbl', label)); var sg = h('div', 'segmented', null, { role: 'group', 'aria-label': label });
    items.forEach(function (it) { add(sg, h('button', 'segmented__item', it[1], { type: 'button', [attr]: it[0], 'aria-pressed': 'false' })); }); add(box, sg);
  }

  /* ---------- hộp thoại HỦY ---------- */
  var DC = $('#dlg-cancel');
  function openCancel(id, ds) {
    var a = byId(id); if (!a) return; cur = a;
    $('#ca-sub').textContent = a.plate + ' · ' + dayFull(fromIso(a.date)) + ' ' + a.time + ' · ' + a.code;
    fillReasons('ca-reasons', 'ca-reason', CANCEL, true); $('#ca-note').value = ''; mkNotify('ca');
    protoBar('ca-proto', 'Xem thử trạng thái:', [['default', 'Mặc định'], ['saving', 'Đang lưu'], ['error', 'Lỗi máy chủ'], ['conflict', 'Xung đột phiên bản']], 'data-apt-ds');
    $('#ca-impact').textContent = 'Lịch chuyển “Đã hủy” và nhả một chỗ trong công suất ngày ' + isoVi(a.date) + '. Không hoàn tác được: muốn khách quay lại thì tạo lịch mới.';
    DC_READY = true; setDs(DC, ds || 'default'); caCheck(false); window.gmepOpen('dlg-cancel');
  }
  function caCheck(touched) {
    var r = reasonObj(CANCEL, 'ca-reason'), note = $('#ca-note').value.trim(), need = !!(r && r.note), why = '', bad = false;
    $('#ca-req').hidden = !need; $('#ca-hint').hidden = !(r && r.c === 'customer_busy');
    $('#ca-note-h').textContent = (need ? 'Bắt buộc khi chọn “Khác”: tối thiểu ' + CFG.noteMin + ' ký tự, tối đa 300.' : 'Tùy chọn, tối đa 300 ký tự.') + ' Không ghi số điện thoại hay địa chỉ của khách vào ghi chú. (' + $('#ca-note').value.length + '/300)';
    if (!r) why = 'Chọn một lý do hủy để mở nút Hủy lịch.';
    else if (need && note.length < CFG.noteMin) { why = 'Lý do “Khác” cần ghi chú tối thiểu ' + CFG.noteMin + ' ký tự.'; bad = true; }
    noteErr('ca-note', bad && (touched || note.length > 0), 'Nhập ghi chú tối thiểu ' + CFG.noteMin + ' ký tự (hiện ' + note.length + ').');
    var b = $('#ca-ok'); b.disabled = !!why; b.setAttribute('aria-disabled', String(!!why)); setWhy('ca-why', why);
  }

  /* ---------- hộp thoại DỜI ---------- */
  var DR = $('#dlg-resched'), rsTarget = null, rsAuto = true;
  function timeOptions() { var s = clear($('#rs-time')); for (var m = 8 * 60; m <= 17 * 60 + 30; m += 30) add(s, h('option', null, p2(Math.floor(m / 60)) + ':' + p2(m % 60), { value: p2(Math.floor(m / 60)) + ':' + p2(m % 60) })); }
  function openResched(id, ds, sc) {
    var a = byId(id); if (!a) return; cur = a; rsTarget = a; rsAuto = true;
    $('#rs-sub').textContent = a.plate + ' · ' + a.cust + ' · ' + a.code;
    clear($('#rs-from')); add($('#rs-from'), dayFull(fromIso(a.date)) + ' ' + a.time);
    fillReasons('rs-reasons', 'rs-reason', RESCH, false); clear($('#rs-party'));
    add($('#rs-party'), radioEl('rs-pt', 'customer', 'Khách đề nghị'), radioEl('rs-pt', 'garage', 'Xưởng đề nghị'));
    $('#rs-note').value = ''; timeOptions();
    var d0 = sc === 'over' ? '2026-11-03' : (a.date > iso(TODAY) ? a.date : iso(addDays(TODAY, 1)));
    $('#rs-date').value = isoVi(d0); $('#rs-time').value = '09:00'; $('#rs-dp')._dp = undefined; $('#rs-date').classList.remove('is-error');
    mkNotify('rs');
    protoBar('rs-proto', 'Xem thử tình huống:', [['normal', 'Lịch trễ hẹn, dời 1 lần'], ['late', 'Dời sát giờ'], ['over', 'Ngày mới hết chỗ'], ['limit', 'Đã dời 3/3 lần']], 'data-apt-sc');
    protoBar('rs-proto2', 'Trạng thái:', [['default', 'Mặc định'], ['saving', 'Đang lưu'], ['conflict', 'Xung đột phiên bản'], ['done', 'Thành công']], 'data-apt-ds');
    var ov = $('#rs-ovr'); if (ov) ov.checked = false; var oc = $('#rs-ov-cap'); if (oc) oc.checked = false;
    setDs(DR, ds || 'default'); $$('[data-apt-sc]', DR).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-apt-sc') === (sc || (a.id === 'a4' ? 'late' : a.id === 'a6' ? 'limit' : 'normal')))); });
    rsCheck(); window.gmepOpen('dlg-resched');
  }
  function rsCheck() {
    var a = rsTarget; if (!a) return;
    var dStr = $('#rs-date').value, d = parseVN(dStr), time = $('#rs-time').value, why = '';
    var errD = '', needOver = false, capInfo = $('#rs-cap-info'), capWarn = $('#rs-cap-warn'); capInfo.hidden = true; capWarn.hidden = true;
    if (!d) errD = 'Ngày không có thật hoặc sai định dạng. Nhập theo dd/MM/yyyy, ví dụ 03/11/2026.';
    else if (dayDiff(d, TODAY) > CFG.horizon) errD = 'Chỉ đặt được trong ' + CFG.horizon + ' ngày tới (cấu hình).';
    var e1 = $('#rs-date-e'); e1.hidden = !errD; clear(e1); if (errD) add(e1, ic('alert-triangle', 'icon--sm'), errD); $('#rs-date').classList.toggle('is-error', !!errD); $('#rs-date').setAttribute('aria-invalid', String(!!errD));
    var nd = null; if (d) { nd = new Date(d); var tp = time.split(':'); nd.setHours(+tp[0], +tp[1], 0, 0); }
    clear($('#rs-to')); add($('#rs-to'), d ? dayFull(d) + ' ' + time : '–');
    var pastErr = '', same = d && iso(d) === a.date && time === a.time;
    if (nd && nd <= NOW) pastErr = 'Giờ mới phải sau thời điểm hiện tại (' + NOW_LABEL + ' ' + fmt(TODAY) + ').';
    var e2 = $('#rs-time-e'); e2.hidden = !pastErr; clear(e2); if (pastErr) add(e2, ic('alert-triangle', 'icon--sm'), pastErr);
    if (d && !errD) {
      var di = iso(d);
      if (di === a.date) { capInfo.hidden = false; capInfo.textContent = 'Dời trong cùng ngày ' + fmt(d) + ': công suất ngày không đổi.'; }
      else { var n = capOf(di), N = CFG.cap;
        if (n >= N) { needOver = true; capWarn.hidden = false; $('#rs-cap-warn-t').textContent = 'Ngày ' + fmt(d) + ' đã có ' + n + '/' + N + ' xe'; }
        else { capInfo.hidden = false; capInfo.textContent = 'Ngày ' + fmt(d) + ': ' + n + '/' + N + ' xe, còn ' + (N - n) + ' chỗ. Ngày cũ ' + isoVi(a.date) + ' được nhả một chỗ.'; } }
    }
    var capOk = !needOver || ($('#rs-ov-cap') && $('#rs-ov-cap').checked);
    var minsTo = Math.round((apptDate(a) - NOW) / 60000), late = a.st === 'pending' && minsTo > 0 && minsTo <= CFG.lateMin;
    $('#rs-late').hidden = !late; if (late) $('#rs-late-t').textContent = 'Lịch hẹn bắt đầu sau ' + minsTo + ' phút (trong ' + CFG.lateMin + ' phút trước giờ hẹn). Vẫn dời được; lịch sử dời sẽ gắn nhãn “Dời sát giờ” để thống kê.';
    var cnt = a.resch.length, atLimit = cnt >= CFG.maxResch, blocked = atLimit && !canOverride(), needOvr = atLimit && canOverride();
    $('#rs-limit-block').hidden = !blocked; $('#rs-limit-ovr').hidden = !needOvr;
    if (blocked) $('#rs-limit-block-t').textContent = 'Lịch đã dời ' + cnt + '/' + CFG.maxResch + ' lần. Cố vấn không dời thêm được; nhờ Quản lý chi nhánh hoặc Chủ garage xử lý, hoặc hủy và tạo lịch mới (mất lịch sử).';
    if (needOvr) $('#rs-limit-ovr-t').textContent = 'Lịch đã dời ' + cnt + '/' + CFG.maxResch + ' lần. Quản lý hoặc Chủ garage vẫn dời được khi chọn ghi đè và ghi chú; nhật ký đánh dấu “vượt giới hạn”.';
    var r = reasonObj(RESCH, 'rs-reason'), pt = $('input[name="rs-pt"]:checked'), note = $('#rs-note').value.trim();
    if (r && r.p !== 'other' && rsAuto) { var rb = $('input[name="rs-pt"][value="' + r.p + '"]'); if (rb) rb.checked = true; pt = rb; }
    $('#rs-pt-hint').hidden = !(r && r.p !== 'other' && pt && pt.value === r.p && rsAuto);
    var ovrOn = needOvr && $('#rs-ovr').checked, needNote = (r && r.note) || ovrOn;
    $('#rs-req').hidden = !needNote;
    $('#rs-note-h').textContent = (needNote ? 'Bắt buộc' + (r && r.note ? ' khi chọn “Khác”' : ' khi ghi đè giới hạn') + ': tối thiểu ' + CFG.noteMin + ' ký tự, tối đa 300.' : 'Tùy chọn, tối đa 300 ký tự.') + ' Không ghi số điện thoại hay địa chỉ của khách. (' + $('#rs-note').value.length + '/300)';
    var noteBad = needNote && note.length < CFG.noteMin; noteErr('rs-note', noteBad && note.length > 0, 'Nhập ghi chú tối thiểu ' + CFG.noteMin + ' ký tự (hiện ' + note.length + ').');
    if (blocked) why = 'Lịch đã dời đủ ' + CFG.maxResch + ' lần; cần Quản lý chi nhánh hoặc Chủ garage.';
    else if (errD) why = errD; else if (same) why = 'Ngày giờ mới trùng ngày giờ hiện tại.'; else if (pastErr) why = pastErr;
    else if (!capOk) why = 'Xác nhận vẫn dời sang ngày đã đủ công suất.'; else if (!r) why = 'Chọn lý do dời.'; else if (!pt) why = 'Chọn bên đề nghị dời (Khách hoặc Xưởng).';
    else if (needOvr && !ovrOn) why = 'Chọn ghi đè giới hạn số lần dời.'; else if (noteBad) why = 'Ghi chú tối thiểu ' + CFG.noteMin + ' ký tự.';
    var b = $('#rs-ok'); b.disabled = !!why; b.setAttribute('aria-disabled', String(!!why)); setWhy('rs-why', why);
  }
  function applyResched() {
    var a = rsTarget, d = parseVN($('#rs-date').value), time = $('#rs-time').value, r = reasonObj(RESCH, 'rs-reason'), pt = $('input[name="rs-pt"]:checked').value;
    var flags = []; var minsTo = Math.round((apptDate(a) - NOW) / 60000); if (minsTo > 0 && minsTo <= CFG.lateMin) flags.push('Dời sát giờ');
    if (iso(d) !== a.date && capOf(iso(d)) >= CFG.cap) flags.push('Vượt công suất'); if (a.resch.length >= CFG.maxResch) flags.push('Vượt giới hạn số lần');
    if (!a.orig) a.orig = { d: a.date, t: a.time };
    if (iso(d) !== a.date) { CAPMAP[a.date] = Math.max(0, capOf(a.date) - 1); CAPMAP[iso(d)] = capOf(iso(d)) + 1; }
    a.resch.unshift({ fd: a.date, ft: a.time, td: iso(d), tt: time, reason: r.n, party: pt, by: 'Nguyễn Hoàng Yến', at: fmt(TODAY) + ' ' + NOW_LABEL, note: $('#rs-note').value.trim(), flags: flags });
    a.date = iso(d); a.time = time;
    var ds = $('#rs-done-t'); ds.textContent = 'Lịch ' + a.code + ' đã dời sang ' + dayFull(d) + ' ' + time + ' (lần dời thứ ' + a.resch.length + ').';
    setDs(DR, 'done'); toast('success', 'Đã dời lịch hẹn', 'Mã lịch giữ nguyên, lịch sử dời đã ghi.'); renderAll();
  }
  function afterAction() { var tb = $('#tab-' + S.tab); if (tb) tb.focus(); }

  /* ---------- hộp thoại ĐÁNH DẤU VẮNG ---------- */
  var DA = $('#dlg-absent');
  function openAbsent(id) { var a = byId(id); if (!a) return; cur = a; $('#ab-sub').textContent = a.plate + ' · ' + dayFull(fromIso(a.date)) + ' ' + a.time + ' · ' + lateText(minsLate(a)); window.gmepOpen('dlg-absent'); }

  /* ---------- sự kiện (gom một chỗ) ---------- */
  function simulate(dlg, okFn) {
    var ds = dlg.getAttribute('data-ds') || 'default';
    if (ds === 'conflict') { setDs(dlg, 'conflict'); return; }
    var prev = ds; setDs(dlg, 'saving');
    setTimeout(function () { if (prev === 'error') { setDs(dlg, 'error'); } else okFn(); }, 700);
  }
  document.addEventListener('click', function (e) {
    var t;
    if ((t = e.target.closest('[data-apt-tab]'))) { S.tab = t.getAttribute('data-apt-tab'); renderAll(); return; }
    if ((t = e.target.closest('[data-apt-view]'))) { S.view = t.getAttribute('data-apt-view'); renderAll(); return; }
    if ((t = e.target.closest('[data-apt-state]'))) { S.state = t.getAttribute('data-apt-state'); renderAll(); return; }
    if ((t = e.target.closest('[data-apt-flag]'))) { var k = t.getAttribute('data-apt-flag'); if (k === 'trunc') S.trunc = !S.trunc; else S.consent = !S.consent; renderAll(); return; }
    if ((t = e.target.closest('[data-apt-day]'))) { S.date = t.getAttribute('data-apt-day'); S.view = 'day'; renderAll(); return; }
    if ((t = e.target.closest('#d-prev,#d-next'))) { var step = (S.view === 'day' ? 1 : 7) * (t.id === 'd-prev' ? -1 : 1); S.date = iso(addDays(fromIso(S.date), step)); renderAll(); return; }
    if ((t = e.target.closest('#d-today'))) { if (t.getAttribute('aria-disabled') !== 'true') { S.date = iso(TODAY); renderAll(); } return; }
    if ((t = e.target.closest('[data-apt-sc]'))) { var sc = t.getAttribute('data-apt-sc'); openResched(sc === 'late' ? 'a4' : sc === 'limit' ? 'a6' : 'a3', 'default', sc); return; }
    if ((t = e.target.closest('[data-apt-ds]'))) { var dlg = t.closest('.overlay'), ds = t.getAttribute('data-apt-ds'); if (dlg.id === 'dlg-resched') { if (ds === 'done') $('#rs-done-t').textContent = 'Lịch ' + rsTarget.code + ' đã dời sang Thứ Hai, 02/11/2026 09:00 (lần dời thứ ' + (rsTarget.resch.length + 1) + ').'; setDs(DR, ds); } else setDs(DC, ds); return; }
    if ((t = e.target.closest('[data-apt-act]'))) {
      var act = t.getAttribute('data-apt-act'), id = t.getAttribute('data-id');
      if (act === 'call') { if (!(window.matchMedia && matchMedia('(pointer: coarse)').matches)) { e.preventDefault(); toast('info', 'Gọi khách', 'Trên điện thoại, nút này mở ứng dụng gọi. Số hiện đầy đủ theo quyền của vai trò.'); } }
      else if (act === 'open') openDrawer(id);
      else if (act === 'goto-overdue') { S.tab = 'overdue'; renderAll(); $('#tab-overdue').focus(); }
      else if (act === 'retry') { S.state = 'loading'; renderAll(); setTimeout(function () { S.state = 'data'; renderAll(); }, 700); }
      else if (act === 'cancel' || act === 'resched' || act === 'absent') {
        var dr = $('#drw-appt'); if (dr.classList.contains('is-open')) window.gmepClose(dr);
        if (act === 'cancel') openCancel(id); else if (act === 'resched') openResched(id); else openAbsent(id);
      } else if (act === 'to-resched') { window.gmepClose($('#dlg-cancel')); openResched(cur.id); }
      else if (act === 'submit-cancel') simulate(DC, function () {
        var r = reasonObj(CANCEL, 'ca-reason'); cur.st = 'cancelled'; CAPMAP[cur.date] = Math.max(0, capOf(cur.date) - 1);
        cur.cancel = { code: r.c, name: r.n, note: $('#ca-note').value.trim(), by: 'Nguyễn Hoàng Yến', at: fmt(TODAY) + ' ' + NOW_LABEL };
        window.gmepClose($('#dlg-cancel')); toast('warning', 'Đã hủy lịch hẹn', 'Lý do “' + r.n + '” được lưu vào lịch sử.'); renderAll(); afterAction(); });
      else if (act === 'submit-resched') simulate(DR, applyResched);
      else if (act === 'submit-absent') { cur.st = 'no_show'; cur.by = 'Nguyễn Hoàng Yến'; cur.at = fmt(TODAY) + ' ' + NOW_LABEL; window.gmepClose($('#dlg-absent')); toast('info', 'Đã đánh dấu vắng', 'Lịch chuyển sang tab Vắng.'); renderAll(); afterAction(); }
      else if (act === 'reload') { var dd = $('#dlg-cancel').classList.contains('is-open') ? 'c' : 'r'; if (dd === 'c') setDs(DC, 'default'); else setDs(DR, 'default'); toast('info', 'Đã tải lại lịch', 'Dữ liệu bạn nhập được giữ nguyên.'); }
      else if (act === 'retry-save') { var dl = $('#dlg-cancel').classList.contains('is-open') ? DC : DR; setDs(dl, 'default'); }
      else if (act === 'open-demo') { var w = t.getAttribute('data-which'); if (w === 'cancel') openCancel('a6'); else if (w === 'resched') openResched('a3'); else openAbsent('a8'); }
    }
  });
  document.addEventListener('change', function (e) {
    if (e.target.name === 'rs-pt') rsAuto = false;
    if (e.target.closest('#dlg-cancel')) caCheck(true);
    if (e.target.closest('#dlg-resched')) { rsCheck(); }
    if (e.target.id === 'd-input') { var d = parseVN(e.target.value); if (d) { S.date = iso(d); renderAll(); } else { e.target.classList.add('is-error'); e.target.setAttribute('aria-invalid', 'true'); var er = $('#d-err'); er.hidden = false; clear(er); add(er, ic('alert-triangle', 'icon--sm'), 'Ngày không có thật hoặc sai định dạng. Nhập theo dd/MM/yyyy, ví dụ 03/11/2026.'); } }
  });
  document.addEventListener('input', function (e) { if (e.target.closest('#dlg-cancel')) caCheck(false); if (e.target.closest('#dlg-resched')) rsCheck(); });
  document.addEventListener('click', function (e) {
    var dayBtn = e.target.closest('#d-dp .datepicker__day'); if (dayBtn) setTimeout(function () { var d = parseVN($('#d-input').value); if (d) { S.date = iso(d); renderAll(); } }, 0);
    var rsDay = e.target.closest('#rs-dp .datepicker__day'); if (rsDay) setTimeout(rsCheck, 0);
  });
  document.addEventListener('keydown', function (e) {
    var tab = e.target.closest && e.target.closest('#apt-tabs [role="tab"]'); if (tab && (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End')) setTimeout(function () { var t = document.activeElement; if (t && t.getAttribute('data-apt-tab')) { S.tab = t.getAttribute('data-apt-tab'); renderAll(); t.focus(); } }, 0);
  });
  new MutationObserver(function () { renderAll(); }).observe(body, { attributes: true, attributeFilter: ['data-role'] });

  /* ---------- khởi động ---------- */
  var P = readHash(); renderAll();
  window.addEventListener('load', function () {
    var dl = P.get('dlg'), id = P.get('id'), ds = P.get('ds') || 'default', sc = P.get('sc');
    if (dl === 'cancel') openCancel(id || 'a6', ds);
    else if (dl === 'resched') openResched(id || (sc === 'late' ? 'a4' : sc === 'limit' ? 'a6' : 'a3'), ds, sc || undefined);
    else if (dl === 'absent') openAbsent(id || 'a8');
    else if (dl === 'drawer') openDrawer(id || 'a3');
  });
})();
