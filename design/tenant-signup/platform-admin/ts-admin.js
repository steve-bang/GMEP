/* Quản trị nền tảng (TSU-60..68) – hành vi giả lập cho prototype. Dữ liệu mẫu, không phải dữ liệu thật; mọi quyết định chỉ mô phỏng.
   Phụ thuộc: ../../assets/app.js (dialog, tab, toast) và ../ts-common.js (thanh xem thử, kiểm tra biểu mẫu, đếm lùi). */
(function () {
  'use strict';
  var page = document.body.getAttribute('data-tsa-page') || '';
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function ic(n, c) { return '<svg class="icon' + (c ? ' ' + c : '') + '" aria-hidden="true"><use href="#' + n + '"/></svg>'; }
  function toast(k, t, x) { if (window.gmepToast) window.gmepToast(k, t, x); }
  function norm(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase(); }
  var sel30 = null;  /* hồ sơ đang chọn ở TSX-30 */
  var LATE_H = 24;   /* ngưỡng "quá thời gian duyệt tay tối đa" (giờ), tham số cấu hình ở TSU-66 */
  var REASONS = { dup: ['MST trùng tenant đang hoạt động', 'warning'], disp: ['Email dùng một lần', 'warning'], rate: ['Vượt tần suất', 'warning'], block: ['Nguồn trong danh sách chặn', 'danger'], mismatch: ['Đối chiếu MST không khớp', 'warning'], other: ['Khác', 'neutral'] };
  var PII = { 'SGN-4F7K2Q': '0912345678', 'SGN-8C2M5T': '0987654321', 'SGN-1D9P6W': '0903456321', 'SGN-6H3N8R': '0938127874', 'SGN-2J7Q4V': '0977123456', 'SGN-9B5T3K': '0965432109', 'SGN-3L8W1Z': '0911222333', 'SGN-5X2R7N': '0902333444', 'SGN-7Q4Y8M': '0933444555' };

  /* ---------- Dữ liệu cá nhân che (mô phỏng gọi máy chủ, ghi nhật ký) ---------- */
  function maskPhone(p) { return p.slice(0, 2) + '•• ••• ' + p.slice(-3); }
  function fullPhone(p) { return p.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1 $2 $3'); }
  function renderPII(el) {
    var id = el.getAttribute('data-pii'), p = PII[id] || '0900000000';
    el.innerHTML = '<span class="tsa-mono">' + maskPhone(p) + '</span><button type="button" class="btn btn--ghost btn--sm" data-pii-show aria-label="Hiện số điện thoại của ' + id + '">' + ic('eye', 'icon--sm') + 'Hiện</button>';
    if (el._iv) { clearInterval(el._iv); el._iv = null; }
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pii-show]'); if (!b) return;
    var el = b.closest('[data-pii]'), id = el.getAttribute('data-pii'), p = PII[id] || '0900000000';
    b.disabled = true; b.textContent = 'Đang tải…';
    setTimeout(function () {
      el.innerHTML = '<span class="tsa-mono">' + fullPhone(p) + '</span><span class="tsa-note">Tự che sau <span class="num" data-left>30</span> giây</span>';
      toast('info', 'Đã ghi nhật ký truy cập', 'Ghi: người xem, thời điểm, hồ sơ ' + id + '.');
      var left = 30; el._iv = setInterval(function () { left--; var s = $('[data-left]', el); if (s) s.textContent = left; if (left <= 0) renderPII(el); }, 1000);
    }, 450);
  });
  $$('[data-pii]').forEach(renderPII);

  /* ---------- Xác nhận bằng cách gõ mã ---------- */
  document.addEventListener('input', function (e) {
    var g = e.target.closest && e.target.closest('[data-guard-input]'); if (!g) return;
    var root = g.closest('.dialog, .drawer'), btn = $('[data-guard-btn]', root), ok = g.value.trim().toLowerCase() === (g.getAttribute('data-word') || '').toLowerCase();
    if (btn) { btn.disabled = !ok; btn.setAttribute('aria-disabled', String(!ok)); }
  });

  /* ---------- Hộp thoại quyết định (TSU-63), dùng chung cho TSU-62 (lớp phủ) và TSU-63 (tĩnh) ---------- */
  var REC = { id: 'SGN-4F7K2Q', org: 'Công ty TNHH Ô tô Minh Phát', mail: 'p***@minhphat.vn' };
  var EXC = ['Nhượng quyền thương hiệu', 'Nhiều thương hiệu cùng pháp nhân', 'Khác (ghi rõ ở ghi chú nội bộ)'];
  var ITEMS = ['Giấy chứng nhận đăng ký kinh doanh', 'Xác nhận người đại diện', 'Giải thích mã số thuế đã có người đăng ký', 'Địa chỉ trụ sở khác với giấy đăng ký'];
  var TPL = [['', 'Không dùng mẫu'], ['gt', 'Mẫu: cần giấy tờ chứng minh'], ['dc', 'Mẫu: thông tin chưa khớp, cần giải thích']];
  var TPL_TXT = { gt: 'Chúng tôi cần thêm giấy tờ để xác minh doanh nghiệp. Vui lòng tải lên các tệp được yêu cầu trước hạn.', dc: 'Thông tin bạn khai chưa khớp với dữ liệu đăng ký. Vui lòng giải thích hoặc gửi giấy tờ chứng minh.' };
  var RJ = [['', 'Chọn lý do'], ['mst_khong_hop_le', 'Mã số thuế không hợp lệ'], ['thong_tin_khong_khop', 'Thông tin không khớp'], ['khong_thuoc_doi_tuong', 'Không thuộc đối tượng phục vụ'], ['het_han_xac_thuc', 'Hết hạn xác thực email'], ['khong_bo_sung_dung_han', 'Không bổ sung đúng hạn'], ['abuse', 'Chặn lạm dụng (không nêu chi tiết)'], ['khac', 'Khác']];
  function fieldErr(id) { return '<span class="field__error" id="' + id + '-err" hidden></span>'; }
  function head(icon, cls, title) { return '<div class="dialog__header"><span class="dialog__icon' + (cls ? ' dialog__icon--' + cls : '') + '">' + ic(icon) + '</span><div><h2 class="dialog__title" id="dc-title">' + title + '</h2></div><button type="button" class="btn-icon dialog__close" data-dc="cancel" aria-label="Đóng">' + ic('x') + '</button></div>'; }
  function buildDecision(kind, dup) {
    var h = '';
    if (kind === 'approve') {
      h = head('circle-check', '', 'Duyệt đăng ký và cấp phát tài khoản') + '<div class="dialog__body">' +
        '<p class="tsa-mono">' + REC.id + ' · ' + esc(REC.org) + '</p>' +
        (dup ? '<div class="alert alert--warning" role="alert">' + ic('alert-triangle') + '<div class="alert__body"><span class="alert__title">Mã số thuế này đang gắn với một tenant đang hoạt động</span><span>Duyệt có thể tạo hai tenant cùng MST. Chỉ làm khi thuộc ngoại lệ hợp lệ (nhượng quyền, nhiều thương hiệu cùng pháp nhân).</span></div></div>' +
          '<div class="field"><label class="field__label" for="dc-exc">Lý do ngoại lệ<span class="field__req" aria-hidden="true">*</span></label><select class="select" id="dc-exc" aria-required="true"><option value="">Chọn lý do ngoại lệ</option>' + EXC.map(function (x) { return '<option>' + x + '</option>'; }).join('') + '</select>' + fieldErr('dc-exc') + '</div>' : '') +
        '<div class="field"><label class="field__label" for="dc-note">Ghi chú nội bộ (không bắt buộc)</label><textarea class="textarea" id="dc-note" rows="2"></textarea><span class="tsa-note">Ghi chú không gửi cho người đăng ký.</span></div>' +
        '<ul class="impact-list"><li>Hệ thống sẽ tạo tài khoản và gửi email chào mừng cho ' + REC.mail + '.</li><li>Quyết định ghi nhật ký nền tảng và không thể sửa.</li></ul></div>' +
        '<div class="dialog__footer"><button type="button" class="btn btn--secondary" data-dc="cancel">Hủy</button><button type="button" class="btn btn--primary" data-dc="confirm"><span>Duyệt và cấp phát</span><span class="btn__spinner" aria-hidden="true"></span></button></div>';
    } else if (kind === 'supp') {
      h = head('file-text', '', 'Yêu cầu bổ sung thông tin') + '<div class="dialog__body">' +
        '<p class="tsa-mono">' + REC.id + ' · ' + esc(REC.org) + '</p>' +
        '<fieldset class="tsp-fs"><legend class="field__label">Mục cần bổ sung<span class="field__req" aria-hidden="true">*</span></legend><div class="tsa-checks" id="dc-items">' +
        ITEMS.map(function (x, i) { return '<label class="check"><input type="checkbox" name="dc-item" value="' + i + '"><span class="check__box">' + ic('check') + '</span><span>' + x + '</span></label>'; }).join('') + '</div>' + fieldErr('dc-items') + '</fieldset>' +
        '<div class="field"><label class="field__label" for="dc-tpl">Mẫu lời nhắn</label><select class="select" id="dc-tpl">' + TPL.map(function (x) { return '<option value="' + x[0] + '">' + x[1] + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label class="field__label" for="dc-msg">Lời nhắn gửi người đăng ký</label><textarea class="textarea" id="dc-msg" rows="3" maxlength="1000" aria-describedby="dc-msg-c"></textarea><span class="tsp-counter" id="dc-msg-c">0/1000</span></div>' +
        '<div class="field"><label class="field__label" for="dc-due">Hạn bổ sung (dd/MM/yyyy)<span class="field__req" aria-hidden="true">*</span></label><input class="input" id="dc-due" value="12/11/2026" inputmode="numeric" aria-required="true" aria-describedby="dc-due-h"><span class="field__hint" id="dc-due-h">Mặc định theo cấu hình (7 ngày, minh họa).</span>' + fieldErr('dc-due') + '</div>' +
        '</div><div class="dialog__footer"><button type="button" class="btn btn--secondary" data-dc="cancel">Hủy</button><button type="button" class="btn btn--primary" data-dc="confirm"><span>Gửi yêu cầu bổ sung</span><span class="btn__spinner" aria-hidden="true"></span></button></div>';
    } else if (kind === 'reject') {
      h = head('alert-triangle', 'danger', 'Từ chối đăng ký') + '<div class="dialog__body">' +
        '<p class="tsa-mono">' + REC.id + ' · ' + esc(REC.org) + '</p>' +
        '<div class="alert alert--danger" role="note">' + ic('alert-triangle') + '<div class="alert__body"><span>Quyết định này ghi nhật ký nền tảng và không thể sửa. Người đăng ký nhận email kèm lý do.</span></div></div>' +
        '<div class="field"><label class="field__label" for="dc-reason">Lý do từ chối<span class="field__req" aria-hidden="true">*</span></label><select class="select" id="dc-reason" aria-required="true">' + RJ.map(function (x) { return '<option value="' + x[0] + '">' + x[1] + '</option>'; }).join('') + '</select>' + fieldErr('dc-reason') + '</div>' +
        '<div class="field"><label class="field__label" for="dc-detail">Chi tiết hiển thị cho người đăng ký</label><textarea class="textarea" id="dc-detail" rows="2" maxlength="500" aria-describedby="dc-detail-h dc-detail-c"></textarea><span class="field__hint" id="dc-detail-h">Không ghi dữ liệu cá nhân hay chi tiết quy tắc chống lạm dụng.</span><span class="tsp-counter" id="dc-detail-c">0/500</span></div>' +
        '<div class="field"><label class="field__label" for="dc-int">Ghi chú nội bộ<span class="field__req" aria-hidden="true">*</span></label><textarea class="textarea" id="dc-int" rows="2" aria-required="true"></textarea>' + fieldErr('dc-int') + '</div>' +
        '<div class="tsa-checks"><label class="check"><input type="checkbox" id="dc-reapply"><span class="check__box">' + ic('check') + '</span><span>Cho phép đăng ký lại</span></label></div>' +
        '<p class="tsa-note">Khiếu nại đi qua hỗ trợ, không có biểu mẫu riêng. Khi cần xem xét lại, dùng “Chuyển lại xem xét”.</p>' +
        '</div>' +
        '<div class="dialog__footer"><button type="button" class="btn btn--secondary" data-dc="cancel">Hủy</button><button type="button" class="btn btn--danger" data-dc="confirm"><span>Từ chối đăng ký</span><span class="btn__spinner" aria-hidden="true"></span></button></div>';
    } else if (kind === 'reopen') {
      h = head('refresh', '', 'Chuyển lại xem xét') + '<div class="dialog__body">' +
        '<p class="tsa-mono">' + REC.id + ' · ' + esc(REC.org) + '</p>' +
        '<p class="tsa-note">Dùng khi người đăng ký khiếu nại qua hỗ trợ. Hồ sơ quay lại danh sách “Cần xử lý”.</p>' +
        '<div class="field"><label class="field__label" for="dc-ro">Ghi chú nội bộ<span class="field__req" aria-hidden="true">*</span></label><textarea class="textarea" id="dc-ro" rows="3" aria-required="true"></textarea>' + fieldErr('dc-ro') + '</div>' +
        '<ul class="impact-list"><li>Người đăng ký nhận email báo hồ sơ đang được xem xét lại.</li><li>Quyết định ghi nhật ký nền tảng và không thể sửa.</li></ul></div>' +
        '<div class="dialog__footer"><button type="button" class="btn btn--secondary" data-dc="cancel">Hủy</button><button type="button" class="btn btn--primary" data-dc="confirm"><span>Chuyển lại hàng chờ</span><span class="btn__spinner" aria-hidden="true"></span></button></div>';
    } else {
      h = head('alert-triangle', 'warning', 'Hồ sơ đã được xử lý') + '<div class="dialog__body"><div class="alert alert--warning" role="alert">' + ic('alert-triangle') + '<div class="alert__body"><span class="alert__title">Hồ sơ vừa được Lê Thu Hà xử lý lúc 10:12</span><span>Bạn chưa thể quyết định thêm. Tải lại để xem kết quả mới nhất.</span></div></div></div>' +
        '<div class="dialog__footer"><button type="button" class="btn btn--secondary" data-dc="cancel">Đóng</button><button type="button" class="btn btn--primary" data-dc="reload">Tải lại</button></div>';
    }
    return h;
  }
  function dcSet(root, id, msg) {
    var el = $('#' + id, root), er = $('#' + id + '-err', root); if (!el || !er) return;
    er.hidden = !msg; er.innerHTML = msg ? ic('alert-triangle') + '<span></span>' : '';
    if (msg) { $('span', er).textContent = msg; el.setAttribute('aria-invalid', 'true'); } else el.removeAttribute('aria-invalid');
  }
  function openDecision(kind) {
    var ov = $('#dlg-decision'); if (!ov) return;
    if (page === '30' && sel30) { REC.id = sel30.id; REC.org = sel30.org; REC.mail = sel30.mail; }
    var dup = document.body.getAttribute('data-view') === 'dupmst' || (page === '30' && !!sel30 && sel30.r.indexOf('dup') >= 0), d = $('.dialog', ov);
    d.setAttribute('data-dc-root', kind); d.setAttribute('data-dup', dup ? '1' : '0'); d.innerHTML = buildDecision(kind, dup);
    ov.setAttribute('aria-labelledby', 'dc-title'); window.gmepOpen('dlg-decision');
  }
  function mountStatic(kind) {
    var box = $('[data-dc-static]'); if (!box) return;
    var dup = kind === 'approve-dup', k = dup ? 'approve' : kind;
    box.innerHTML = '<div class="dialog dialog--md" role="dialog" aria-labelledby="dc-title" data-dc-root="' + k + '" data-dup="' + (dup ? '1' : '0') + '" data-static="1">' + buildDecision(k, dup) + '</div>';
  }
  document.addEventListener('click', function (e) {
    var o = e.target.closest('[data-dc-open]');
    if (o) {   /* nút khóa dùng aria-disabled: bấm chỉ đưa focus tới lý do */
      if (o.getAttribute('aria-disabled') === 'true') { var wy = document.getElementById(o.getAttribute('data-why') || ''); if (wy) wy.focus(); return; }
      openDecision(o.getAttribute('data-dc-open')); return;
    }
    var a = e.target.closest('[data-dc]'); if (!a) return;
    var root = a.closest('[data-dc-root]'), kind = root.getAttribute('data-dc-root'), act = a.getAttribute('data-dc'), isStatic = root.hasAttribute('data-static');
    if (act === 'cancel') { if (isStatic) toast('info', 'Mô phỏng', 'Hộp thoại đóng lại và về hồ sơ.'); else window.gmepClose(root.closest('.overlay')); return; }
    if (act === 'reload') { location.reload(); return; }
    var bad = null, done = '';
    if (kind === 'approve') {
      if (root.getAttribute('data-dup') === '1') { var ex = $('#dc-exc', root); dcSet(root, 'dc-exc', ex.value ? '' : 'Chọn lý do ngoại lệ.'); if (!ex.value) bad = ex; }
      done = 'Đã duyệt|Hệ thống đang tạo tài khoản và gửi email chào mừng.';
    } else if (kind === 'supp') {
      var n = $$('[name="dc-item"]:checked', root).length; dcSet(root, 'dc-items', n ? '' : 'Chọn ít nhất một mục cần bổ sung.'); if (!n) bad = $('[name="dc-item"]', root);
      var due = $('#dc-due', root), okd = /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/.test(due.value.trim()); dcSet(root, 'dc-due', okd ? '' : 'Nhập hạn bổ sung theo dạng dd/MM/yyyy.'); if (!okd && !bad) bad = due;
      done = 'Đã gửi yêu cầu bổ sung|Người đăng ký nhận email kèm hạn bổ sung.';
    } else if (kind === 'reject') {
      var rs = $('#dc-reason', root), it = $('#dc-int', root);
      dcSet(root, 'dc-reason', rs.value ? '' : 'Chọn lý do từ chối.'); if (!rs.value) bad = rs;
      var okn = it.value.trim().length >= 5; dcSet(root, 'dc-int', okn ? '' : 'Ghi chú nội bộ cần ít nhất 5 ký tự.'); if (!okn && !bad) bad = it;
      done = 'Đã từ chối đăng ký|Người đăng ký nhận email kèm lý do.';
    } else if (kind === 'reopen') {
      var ro = $('#dc-ro', root), okr = ro.value.trim().length >= 5; dcSet(root, 'dc-ro', okr ? '' : 'Ghi chú nội bộ cần ít nhất 5 ký tự.'); if (!okr) bad = ro;
      done = 'Đã chuyển lại hàng chờ|Hồ sơ quay lại danh sách Cần xử lý, người đăng ký nhận email.';
    }
    if (bad) { bad.focus(); return; }
    a.classList.add('is-loading'); a.setAttribute('aria-busy', 'true');
    setTimeout(function () {
      a.classList.remove('is-loading'); a.removeAttribute('aria-busy');
      var p = done.split('|'); toast('success', p[0], p[1]);
      if (!isStatic) { window.gmepClose(root.closest('.overlay')); setTimeout(function () { location.href = 'tsx-30.html'; }, 900); }
    }, 700);
  });
  document.addEventListener('change', function (e) {
    if (e.target.id === 'dc-tpl') { var m = $('#dc-msg'); m.value = TPL_TXT[e.target.value] || ''; m.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t.id) return;
    if (t.id === 'dc-msg' || t.id === 'dc-detail') { var c = $('#' + t.id + '-c'); if (c) c.textContent = t.value.length + '/' + t.getAttribute('maxlength'); }
  });

  /* ---------- Bảng + thẻ (điện thoại) ---------- */
  function fillList(tb, cards, rows, trFn, cardFn) {
    tb.innerHTML = rows.map(trFn).join(''); cards.innerHTML = rows.map(cardFn).join('');
    $$('[data-pii]', tb).forEach(renderPII);
  }
  function badge(txt, kind) { return '<span class="badge badge--' + kind + '">' + esc(txt) + '</span>'; }

  /* ---------- TSU-61 Hàng đợi đăng ký ---------- */
  var S = [
    { id: 'SGN-4F7K2Q', org: 'Công ty TNHH Ô tô Minh Phát', mst: '03******12', mail: 'p***@minhphat.vn', r: ['dup'], sent: '05/11/2026 09:42', w: 3, own: '', tab: 'wait' },
    { id: 'SGN-8C2M5T', org: 'Hộ kinh doanh Garage Hải Âu', mst: '0123*****789', mail: 'h***@mailinator.com', r: ['disp'], sent: '05/11/2026 08:05', w: 5, own: 'Phạm Quốc Bảo', tab: 'wait' },
    { id: 'SGN-1D9P6W', org: 'Công ty CP Gara Đông Dương', mst: '03******45', mail: 'd***@dongduong.vn', r: ['mismatch'], sent: '04/11/2026 08:10', w: 26, own: 'Lê Thu Hà', tab: 'wait' },
    { id: 'SGN-6H3N8R', org: 'Garage Tân Cảng', mst: '01******77', mail: 't***@tancang.vn', r: ['rate', 'block'], sent: '04/11/2026 16:30', w: 18, own: '', tab: 'wait' },
    { id: 'SGN-2J7Q4V', org: 'Công ty TNHH Lốp Việt', mst: '03******90', mail: 'l***@lopviet.vn', r: ['other'], sent: '03/11/2026 14:00', w: 0, own: 'Phạm Quốc Bảo', tab: 'supp', note: 'Chờ người đăng ký, hạn 12/11/2026' },
    { id: 'SGN-9B5T3K', org: 'Công ty TNHH Bảo dưỡng An Khang', mst: '03******63', mail: 'a***@ankhang.vn', r: ['mismatch'], sent: '02/11/2026 10:30', w: 2, own: 'Phạm Quốc Bảo', tab: 'resub' },
    { id: 'SGN-3L8W1Z', org: 'Garage Phương Nam', mst: '0987*****321', mail: 'p***@phuongnam.vn', r: ['rate'], sent: '05/11/2026 08:00', w: 5, own: '', tab: 'queue' },
    { id: 'SGN-5X2R7N', org: 'Công ty TNHH Ô tô Việt Hưng', mst: '03******28', mail: 'v***@viethung.vn', r: ['other'], sent: '04/11/2026 13:00', w: 0, own: 'Lê Thu Hà', tab: 'done', dec: ['Đã duyệt', 'success', '04/11/2026 15:20'] },
    { id: 'SGN-7Q4Y8M', org: 'Garage Sao Mai', mst: '0912*****456', mail: 's***@saomai.vn', r: ['dup'], sent: '03/11/2026 09:00', w: 0, own: 'Lê Thu Hà', tab: 'done', dec: ['Đã từ chối', 'danger', '03/11/2026 11:45'] }
  ];
  var TABS = [['wait', 'Chờ duyệt tay'], ['supp', 'Cần bổ sung (chờ người đăng ký)'], ['resub', 'Đã bổ sung, chờ xem lại'], ['queue', 'Đang xếp hàng (vượt trần)'], ['done', 'Đã quyết định gần đây']];
  var cur = { tab: 'wait', q: '', view: 'cases' };
  function waitCell(r) {
    if (r.dec) return badge(r.dec[0], r.dec[1]) + '<span class="cell-sub">' + r.dec[2] + '</span>';
    if (r.note) return '<span class="cell-sub">' + esc(r.note) + '</span>';
    var late = r.w > LATE_H;
    return '<span class="' + (late ? 'tsa-wait--late' : '') + '">Chờ ' + r.w + ' giờ</span>' + (late ? ' ' + badge('Quá hạn xử lý', 'danger') : '');
  }
  function reasonsHtml(r) { return '<div class="tsa-reasons">' + r.r.map(function (k) { return badge(REASONS[k][0], REASONS[k][1]); }).join('') + '</div>'; }
  function render61() {
    var tb = $('#tb61'); if (!tb) return;
    var all = cur.view === 'empty' ? [] : S;
    var tabs = $('#tabs61');
    tabs.innerHTML = TABS.map(function (t) {
      var n = all.filter(function (r) { return r.tab === t[0]; }).length;
      return '<button type="button" class="tab" data-tab61="' + t[0] + '"' + (cur.tab === t[0] ? ' aria-current="true"' : '') + '>' + t[1] + ' <span class="count-pill">' + n + '</span></button>';
    }).join('');
    var q = norm(cur.q.trim()), rows = all.filter(function (r) { return r.tab === cur.tab && (!q || norm(r.id + ' ' + r.org + ' ' + r.mst.replace(/\*/g, '')).indexOf(q) >= 0); });
    rows.sort(function (a, b) { return b.w - a.w; });
    fillList(tb, $('#cards61'), rows, function (r) {
      return '<tr><td class="col-nowrap tsa-mono"><a href="tsu-62.html">' + r.id + '</a></td><td><span class="cell-primary">' + esc(r.org) + '</span><span class="cell-sub tsa-mono">MST ' + r.mst + '</span><span class="cell-sub">' + r.mail + '</span><span class="cell-sub" data-pii="' + r.id + '"></span></td><td>' + reasonsHtml(r) + '</td><td class="col-nowrap num">' + r.sent + '</td><td>' + waitCell(r) + '</td><td>' + (r.own ? esc(r.own) : '<span class="text-secondary">Chưa gán</span>') + '</td><td class="col-actions"><a class="btn btn--secondary btn--sm" href="tsu-62.html">Mở<span class="sr-only"> hồ sơ ' + r.id + '</span></a></td></tr>';
    }, function (r) {
      return '<article class="record"><div class="record__top"><a class="record__title tsa-mono" href="tsu-62.html">' + r.id + '</a>' + (r.dec ? badge(r.dec[0], r.dec[1]) : '') + '</div><span class="cell-primary">' + esc(r.org) + '</span>' + reasonsHtml(r) + '<div class="record__meta"><span>MST ' + r.mst + '</span><span>' + r.sent + '</span></div><div class="record__foot"><span>' + waitCell(r) + '</span><a class="btn btn--secondary btn--sm" href="tsu-62.html">Mở<span class="sr-only"> hồ sơ ' + r.id + '</span></a></div></article>';
    });
    var empty = $('#empty61'), wrap = $('#wrap61'), cardsEl = $('#cards61');
    var none = !rows.length;
    wrap.hidden = none; cardsEl.hidden = none; empty.hidden = !none;
    if (none) {
      var f = !!cur.q.trim();
      $('.state__title', empty).textContent = f ? 'Không có đăng ký khớp bộ lọc' : 'Không có đăng ký nào chờ xử lý';
      $('.state__text', empty).textContent = f ? 'Thử đổi từ khóa hoặc xóa bộ lọc để xem toàn bộ.' : 'Các đăng ký cần duyệt tay sẽ hiện ở đây.';
      $('[data-clear61]', empty).hidden = !f;
    }
    $('#meta61').textContent = rows.length + ' trong ' + all.filter(function (r) { return r.tab === cur.tab; }).length + ' hồ sơ' + (cur.q.trim() ? ' · lọc theo “' + cur.q.trim() + '”' : '');
    var chip = $('#chip61'); if (chip) { chip.hidden = !cur.q.trim(); $('[data-chip-text]', chip).textContent = 'Từ khóa: ' + cur.q.trim(); }
    var td = $('[data-today]'); if (td) td.textContent = cur.view === 'cap' ? '46' : '41';
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-tab61]'); if (t) { cur.tab = t.getAttribute('data-tab61'); render61(); var nt = $('[data-tab61="' + cur.tab + '"]'); if (nt) nt.focus(); return; }
    if (e.target.closest('[data-clear61]') || e.target.closest('#chip61 .chip__x')) { cur.q = ''; $('#q61').value = ''; render61(); $('#q61').focus(); }
  });
  document.addEventListener('input', function (e) { if (e.target.id === 'q61') { cur.q = e.target.value; render61(); } });

  /* ---------- TSU-64 Khiếu nại ---------- */
  var AP = [
    { id: 'KN-4H8M2P', sgn: 'SGN-3D6K9R', org: 'Công ty TNHH Lốp Sài Gòn', why: 'Không đối chiếu được mã số thuế', date: '05/11/2026 08:40', own: '', st: ['Mới', 'info'], text: 'Mã số thuế đã đăng ký đúng, tôi gửi kèm giấy chứng nhận đăng ký doanh nghiệp bản mới nhất. Đề nghị xem xét lại.', files: ['gcn-dang-ky-doanh-nghiep.pdf'] },
    { id: 'KN-7T2N5C', sgn: 'SGN-8M1Q4X', org: 'Garage Bình Minh', why: 'Thông tin không khớp', date: '04/11/2026 15:12', own: 'Lê Thu Hà', st: ['Đang xem', 'warning'], text: 'Tên hộ kinh doanh viết khác do đổi tên năm ngoái. Tôi đính kèm thông báo thay đổi.', files: ['thong-bao-doi-ten.jpg', 'cmnd-chu-ho.jpg'] },
    { id: 'KN-2R9W6B', sgn: 'SGN-5P3V7L', org: 'Công ty CP Ô tô Xanh', why: 'Không thuộc đối tượng phục vụ', date: '02/11/2026 09:05', own: 'Lê Thu Hà', st: ['Đã trả lời', 'success'], text: 'Công ty có mã số thuế tại Việt Nam, đề nghị xem xét lại.', files: [], reply: 'Chúng tôi đã xem xét. Công ty thuộc đối tượng phục vụ, hồ sơ được chuyển lại hàng chờ duyệt.' }
  ];
  function render64() {
    var tb = $('#tb64'); if (!tb) return;
    var empty = document.body.getAttribute('data-view') === 'empty', rows = empty ? [] : AP;
    fillList(tb, $('#cards64'), rows, function (r, i) {
      return '<tr><td class="col-nowrap tsa-mono">' + r.id + '</td><td class="col-nowrap tsa-mono">' + r.sgn + '</td><td><span class="cell-primary">' + esc(r.org) + '</span></td><td>' + esc(r.why) + '</td><td class="col-nowrap num">' + r.date + '</td><td>' + (r.own ? esc(r.own) : '<span class="text-secondary">Chưa gán</span>') + '</td><td>' + badge(r.st[0], r.st[1]) + '</td><td class="col-actions"><button type="button" class="btn btn--secondary btn--sm" data-ap="' + AP.indexOf(r) + '">Xem<span class="sr-only"> khiếu nại ' + r.id + '</span></button></td></tr>';
    }, function (r) {
      return '<article class="record"><div class="record__top"><span class="record__title tsa-mono">' + r.id + '</span>' + badge(r.st[0], r.st[1]) + '</div><span class="cell-primary">' + esc(r.org) + '</span><div class="record__meta"><span>' + r.sgn + '</span><span>' + r.date + '</span></div><div class="record__foot"><span class="text-secondary">' + esc(r.why) + '</span><button type="button" class="btn btn--secondary btn--sm" data-ap="' + AP.indexOf(r) + '">Xem<span class="sr-only"> khiếu nại ' + r.id + '</span></button></div></article>';
    });
    $('#wrap64').hidden = !rows.length; $('#cards64').hidden = !rows.length; $('#empty64').hidden = !!rows.length;
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ap]'); if (!b) return;
    var r = AP[+b.getAttribute('data-ap')], ro = document.body.getAttribute('data-view') === 'readonly', answered = !!r.reply || document.body.getAttribute('data-view') === 'answered';
    $('#ap-title').textContent = 'Khiếu nại ' + r.id;
    $('#ap-body').innerHTML =
      '<dl class="tsa-kv"><dt>Mã theo dõi</dt><dd class="tsa-mono">' + r.sgn + '</dd><dt>Doanh nghiệp</dt><dd>' + esc(r.org) + '</dd><dt>Quyết định ban đầu</dt><dd>' + badge('Từ chối', 'danger') + ' ' + esc(r.why) + '</dd><dt>Gửi lúc</dt><dd class="num">' + r.date + '</dd></dl>' +
      '<div><h3 class="tsa-note"><strong>Nội dung giải trình</strong></h3><p class="tsa-m0">' + esc(r.text) + '</p></div>' +
      '<div><h3 class="tsa-note"><strong>Tệp minh chứng</strong></h3>' + (r.files.length ? '<ul class="tsp-files">' + r.files.map(function (f) { return '<li class="tsp-file"><div class="tsp-file__main"><span class="tsp-file__name">' + esc(f) + '</span><span class="tsp-file__meta">Mỗi lần xem được ghi nhật ký</span></div><button type="button" class="btn btn--secondary btn--sm" data-toast="info|Đã ghi nhật ký truy cập|Việc xem tệp ' + esc(f) + ' được ghi lại.">Xem<span class="sr-only"> tệp ' + esc(f) + '</span></button></li>'; }).join('') + '</ul>' : '<p class="tsa-note">Không có tệp.</p>') + '</div>' +
      '<div><h3 class="tsa-note"><strong>Lịch sử</strong></h3><ol class="timeline"><li class="timeline__item timeline__item--danger"><span class="timeline__dot">' + ic('x') + '</span><div><div class="timeline__title">Từ chối đăng ký</div><div class="timeline__meta">03/11/2026 11:45 · Lê Thu Hà</div></div></li><li class="timeline__item timeline__item--info"><span class="timeline__dot">' + ic('send') + '</span><div><div class="timeline__title">Gửi khiếu nại</div><div class="timeline__meta">' + r.date + '</div></div></li></ol></div>' +
      (answered ? '<div class="alert alert--success" role="status">' + ic('circle-check') + '<div class="alert__body"><span class="alert__title">Đã trả lời người đăng ký</span><span>' + esc(r.reply || 'Chúng tôi đã xem xét và phản hồi qua email.') + '</span></div></div>' :
        '<div class="field"><label class="field__label" for="ap-reply">Câu trả lời gửi người đăng ký<span class="field__req" aria-hidden="true">*</span></label><textarea class="textarea" id="ap-reply" rows="3" aria-required="true" aria-describedby="ap-reply-err"></textarea><span class="field__error" id="ap-reply-err" hidden></span></div>' +
        (ro ? '<p class="tsa-fix">' + ic('lock') + '<span>Chỉ Chủ nền tảng quyết định khiếu nại. Bạn đang xem với quyền Quản trị nền tảng.</span></p>' : ''));
    $('#ap-foot').innerHTML = answered ? '<button type="button" class="btn btn--primary" data-close>Đóng</button>' :
      '<button type="button" class="btn btn--secondary" data-close>Đóng</button><button type="button" class="btn btn--secondary" data-ap-act="keep"' + (ro ? ' disabled aria-disabled="true"' : '') + '>Giữ nguyên từ chối</button><button type="button" class="btn btn--primary" data-ap-act="reopen"' + (ro ? ' disabled aria-disabled="true"' : '') + '>Chuyển lại xem xét</button>';
    window.gmepOpen('dlg-appeal');
  });
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-ap-act]'); if (!a) return;
    var t = $('#ap-reply'), er = $('#ap-reply-err');
    if (!t.value.trim()) { er.hidden = false; er.innerHTML = ic('alert-triangle') + '<span>Nhập câu trả lời gửi người đăng ký.</span>'; t.setAttribute('aria-invalid', 'true'); t.focus(); return; }
    t.removeAttribute('aria-invalid'); er.hidden = true;
    var keep = a.getAttribute('data-ap-act') === 'keep';
    window.gmepClose($('#dlg-appeal'));
    toast('success', keep ? 'Đã giữ nguyên quyết định từ chối' : 'Đã chuyển lại hàng chờ duyệt', 'Người đăng ký nhận email kèm câu trả lời.');
  });

  /* ---------- TSU-65 Lỗi cấp phát ---------- */
  var PV = [
    { id: 'SGN-7M2P9X', org: 'Công ty TNHH Cơ khí Đại Phát', step: 'Cấu hình mặc định', n: '5/5', last: '05/11/2026 10:02', st: ['Quá số lần, cần nhân sự', 'danger'], staff: true, data: false },
    { id: 'SGN-4C8V1D', org: 'Garage Hoàng Gia', step: 'Tạo tài khoản', n: '2/5', last: '05/11/2026 10:11', st: ['Đang tự thử lại', 'warning'], staff: false, data: false },
    { id: 'SGN-9Z5K3F', org: 'Công ty TNHH Phụ tùng Hưng Thịnh', step: 'Tạo không gian', n: '5/5', last: '05/11/2026 09:30', st: ['Quá số lần, cần nhân sự', 'danger'], staff: true, data: true }
  ];
  function act65(r, i) {
    var retry = r.staff ? '<button type="button" class="btn btn--secondary btn--sm" data-pv="retry" data-i="' + i + '">Thử lại từng bước<span class="sr-only"> ' + r.id + '</span></button>' : '<button type="button" class="btn btn--secondary btn--sm" disabled aria-disabled="true" aria-describedby="pv-why-' + i + '">Thử lại từng bước<span class="sr-only"> ' + r.id + '</span></button><span class="tsa-note" id="pv-why-' + i + '">Hệ thống đang tự thử lại.</span>';
    var clean = r.staff && !r.data ? '<button type="button" class="btn btn--danger-outline btn--sm" data-pv="clean" data-i="' + i + '">Hủy và dọn<span class="sr-only"> ' + r.id + '</span></button>' : '<button type="button" class="btn btn--danger-outline btn--sm" disabled aria-disabled="true" aria-describedby="pv-why2-' + i + '">Hủy và dọn<span class="sr-only"> ' + r.id + '</span></button><span class="tsa-note" id="pv-why2-' + i + '">' + (r.data ? 'Đã có dữ liệu thật, không thể hủy.' : 'Chỉ hủy được khi ở trạng thái cần nhân sự.') + '</span>';
    return '<div class="tsp-row">' + retry + clean + '</div>';
  }
  function render65() {
    var tb = $('#tb65'); if (!tb) return;
    var v = document.body.getAttribute('data-view'), rows = v === 'empty' ? [] : v === 'staff' ? PV.filter(function (r) { return r.staff; }) : PV;
    fillList(tb, $('#cards65'), rows, function (r) {
      return '<tr><td class="col-nowrap tsa-mono">' + r.id + '</td><td><span class="cell-primary">' + esc(r.org) + '</span></td><td>' + r.step + '</td><td class="col-num">' + r.n + '</td><td class="col-nowrap num">' + r.last + '</td><td>' + badge(r.st[0], r.st[1]) + '</td><td>' + act65(r, PV.indexOf(r)) + '</td></tr>';
    }, function (r) {
      return '<article class="record"><div class="record__top"><span class="record__title tsa-mono">' + r.id + '</span>' + badge(r.st[0], r.st[1]) + '</div><span class="cell-primary">' + esc(r.org) + '</span><div class="record__meta"><span>Bước lỗi: ' + r.step + '</span><span>Tự thử lại: ' + r.n + '</span><span>' + r.last + '</span></div>' + act65(r, PV.indexOf(r)) + '</article>';
    });
    $('#wrap65').hidden = !rows.length; $('#cards65').hidden = !rows.length; $('#empty65').hidden = !!rows.length;
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pv]'); if (!b) return;
    var r = PV[+b.getAttribute('data-i')], kind = b.getAttribute('data-pv');
    if (kind === 'retry') { $('#pv-retry-t').textContent = r.id + ' · ' + r.step; window.gmepOpen('dlg-retry'); }
    else { $('#pv-clean-code').textContent = r.id; var g = $('#pv-guard'); g.setAttribute('data-word', r.id); g.value = ''; var gb = $('#dlg-clean [data-guard-btn]'); gb.disabled = true; gb.setAttribute('aria-disabled', 'true'); window.gmepOpen('dlg-clean'); }
  });
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-pv-confirm]'); if (!a) return;
    var k = a.getAttribute('data-pv-confirm'); window.gmepClose(a.closest('.overlay'));
    toast('success', k === 'retry' ? 'Đã yêu cầu thử lại bước' : 'Đã hủy và dọn hồ sơ', k === 'retry' ? 'Thao tác idempotent: bấm lại không tạo trùng.' : 'Hồ sơ cấp phát đã được dọn, người đăng ký nhận email.');
  });

  /* ---------- TSU-66 Cấu hình đăng ký ---------- */
  function cfgDirty() {
    var f = $('#cfg-form'); if (!f) return;
    var n = $$('[data-cfg]', f).filter(function (el) { return el.type === 'checkbox' ? el.checked !== el.defaultChecked : el.value !== el.defaultValue; }).length;
    $('#cfg-count').textContent = n ? n + ' thay đổi chưa lưu' : 'Chưa có thay đổi';
    var sv = $('#cfg-save'); if (sv) { sv.disabled = !n || document.body.getAttribute('data-view') === 'view'; sv.setAttribute('aria-disabled', String(sv.disabled)); }
    $('#cfg-reset').disabled = !n;
  }
  document.addEventListener('input', function (e) { if (e.target.hasAttribute && e.target.hasAttribute('data-cfg')) cfgDirty(); });
  document.addEventListener('change', function (e) { if (e.target.hasAttribute && e.target.hasAttribute('data-cfg')) cfgDirty(); });
  document.addEventListener('click', function (e) {
    if (e.target.closest('#cfg-reset')) { var f = $('#cfg-form'); f.reset(); window.TS.setView(document.body.getAttribute('data-view')); cfgDirty(); toast('info', 'Đã hủy thay đổi', 'Các giá trị quay về giá trị đang áp dụng.'); }
    var rg = e.target.closest('[data-reg-toggle]');
    if (rg) {
      var sw = $('#cfg-open'), want = !sw.checked; e.preventDefault();
      $('#reg-t').textContent = want ? 'Mở đăng ký công khai' : 'Đóng đăng ký công khai';
      $('#reg-impact').innerHTML = want ? '<li>Người dùng mới đăng ký được ngay từ trang giới thiệu.</li><li>Trần đăng ký ngày vẫn áp dụng.</li>' : '<li>Trang giới thiệu hiện “Hiện chưa mở đăng ký mới”.</li><li>Đăng ký đang chờ xử lý không bị ảnh hưởng.</li>';
      $('#reg-ok').setAttribute('data-want', want ? '1' : '0'); var g = $('#reg-guard'); g.value = ''; var gb = $('#reg-ok'); gb.disabled = true; gb.setAttribute('aria-disabled', 'true');
      window.gmepOpen('dlg-reg');
    }
    var ok = e.target.closest('#reg-ok');
    if (ok) { var on = ok.getAttribute('data-want') === '1'; $('#cfg-open').checked = on; $('#cfg-open-txt').textContent = on ? 'Đang mở' : 'Đang đóng'; window.gmepClose($('#dlg-reg')); cfgDirty(); toast('success', on ? 'Đã mở đăng ký công khai' : 'Đã đóng đăng ký công khai', 'Có hiệu lực ngay và được ghi nhật ký nền tảng.'); }
  });
  document.addEventListener('submit', function (e) {
    if (e.target.id !== 'cfg-form') return; e.preventDefault();
    if (document.body.getAttribute('data-view') === 'offline') { toast('warning', 'Chưa có kết nối', 'Chưa lưu được cấu hình. Thay đổi của bạn vẫn còn trên màn hình.'); return; }
    if (validateAll66()) { toast('success', 'Đã lưu cấu hình', 'Giá trị mới có hiệu lực từ ngày hiệu lực đã chọn, giá trị cũ vẫn được giữ trong lịch sử.'); }
  });

  /* ---------- TSU-67 Điều khoản ---------- */
  var TV = [
    { t: 'Điều khoản dịch vụ', v: 'v1.1', eff: '01/01/2027', st: ['Nháp', 'neutral'], by: 'Lê Thu Hà', acc: '0/12', draft: true },
    { t: 'Điều khoản dịch vụ', v: 'v1.0', eff: '01/10/2026', st: ['Đang hiệu lực', 'success'], by: 'Lê Thu Hà', acc: '12/12' },
    { t: 'DPA', v: 'v1.0', eff: '01/10/2026', st: ['Đang hiệu lực', 'success'], by: 'Phạm Quốc Bảo', acc: '12/12' },
    { t: 'DPA', v: 'v0.9', eff: '01/09/2026', st: ['Hết hiệu lực', 'neutral'], by: 'Phạm Quốc Bảo', acc: '3/3' }
  ];
  function act67(r, i) {
    if (r.draft) return '<div class="tsp-row"><button type="button" class="btn btn--secondary btn--sm" data-open="dlg-tver">Sửa<span class="sr-only"> ' + r.t + ' ' + r.v + '</span></button><button type="button" class="btn btn--primary btn--sm" data-tv-eff="' + i + '">Đặt hiệu lực<span class="sr-only"> ' + r.t + ' ' + r.v + '</span></button></div>';
    return '<div class="tsp-row"><button type="button" class="btn btn--secondary btn--sm" data-open="dlg-accepted">Xem tenant đã chấp nhận<span class="sr-only"> ' + r.t + ' ' + r.v + '</span></button><button type="button" class="btn btn--secondary btn--sm" data-open="dlg-tver">Tạo bản mới từ bản này<span class="sr-only"> ' + r.t + ' ' + r.v + '</span></button></div><span class="tsa-note">Đã có tenant chấp nhận, không sửa hoặc xóa.</span>';
  }
  function render67() {
    var tb = $('#tb67'); if (!tb) return;
    var empty = document.body.getAttribute('data-view') === 'empty', rows = empty ? [] : TV;
    fillList(tb, $('#cards67'), rows, function (r) {
      return '<tr><td>' + r.t + '</td><td class="col-nowrap tsa-mono">' + r.v + '</td><td class="col-nowrap num">' + r.eff + '</td><td>' + badge(r.st[0], r.st[1]) + '</td><td>' + r.by + '</td><td class="col-num">' + r.acc + '</td><td>' + act67(r, TV.indexOf(r)) + '</td></tr>';
    }, function (r) {
      return '<article class="record"><div class="record__top"><span class="record__title">' + r.t + ' ' + r.v + '</span>' + badge(r.st[0], r.st[1]) + '</div><div class="record__meta"><span>Hiệu lực ' + r.eff + '</span><span>Đã chấp nhận ' + r.acc + ' tenant</span><span>Đăng bởi ' + r.by + '</span></div>' + act67(r, TV.indexOf(r)) + '</article>';
    });
    $('#wrap67').hidden = !rows.length; $('#cards67').hidden = !rows.length; $('#empty67').hidden = !!rows.length;
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-tv-eff]'); if (!b) return;
    var r = TV[+b.getAttribute('data-tv-eff')]; $('#tv-eff-t').textContent = r.t + ' ' + r.v; var g = $('#tv-guard'); g.value = ''; var gb = $('#tv-eff-ok'); gb.disabled = true; gb.setAttribute('aria-disabled', 'true'); window.gmepOpen('dlg-teff');
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest('#tv-eff-ok')) { window.gmepClose($('#dlg-teff')); toast('success', 'Đã đặt hiệu lực', 'Mọi tenant sẽ được yêu cầu chấp nhận lại trong thời gian ân hạn.'); }
  });

  /* ---------- TSU-68 Danh mục gói ---------- */
  var PL = [
    { n: 'Gói khởi đầu', d: 'Đủ để chạy thử một garage từ nhận xe đến hóa đơn.', lim: 'Chi nhánh và người dùng: sẽ công bố', price: 'Chưa công bố giá', start: 'Dùng thử', dur: '30 ngày', st: ['Hiển thị', 'success'], eff: '05/11/2026', b1: false },
    { n: 'Gói chuẩn', d: 'Cho chuỗi vài chi nhánh.', lim: '5 chi nhánh · 25 người dùng (minh họa)', price: '1.990.000 đ/tháng, chưa gồm VAT (minh họa)', start: 'Dùng thử', dur: '30 ngày', st: ['Hiển thị', 'success'], eff: '01/03/2027', b1: true },
    { n: 'Gói chuỗi', d: 'Cho chuỗi nhiều chi nhánh.', lim: '20 chi nhánh · 150 người dùng (minh họa)', price: 'Liên hệ (minh họa)', start: 'Truy cập sớm, chưa thu phí', dur: '—', st: ['Ẩn', 'neutral'], eff: '01/03/2027', b1: true }
  ];
  function act68(r, i) { return '<div class="tsp-row"><button type="button" class="btn btn--secondary btn--sm" data-open="dlg-plan">Sửa<span class="sr-only"> ' + r.n + '</span></button><button type="button" class="btn btn--danger-outline btn--sm" data-pl-retire="' + i + '">Ngừng cung cấp<span class="sr-only"> ' + r.n + '</span></button></div>'; }
  function render68() {
    var tb = $('#tb68'); if (!tb) return;
    var v = document.body.getAttribute('data-view'), rows = v === 'b1' ? PL : PL.filter(function (r) { return !r.b1; });
    $$('[data-b1]').forEach(function (el) { el.hidden = v !== 'b1'; });
    fillList(tb, $('#cards68'), rows, function (r) {
      return '<tr><td><span class="cell-primary">' + r.n + '</span><span class="cell-sub">' + esc(r.d) + '</span></td><td>' + esc(r.lim) + '</td><td data-b1' + (v === 'b1' ? '' : ' hidden') + '>' + esc(r.price) + '</td><td>' + r.start + '</td><td class="col-nowrap">' + r.dur + '</td><td>' + badge(r.st[0], r.st[1]) + '</td><td class="col-nowrap num">' + r.eff + '</td><td>' + act68(r, PL.indexOf(r)) + '</td></tr>';
    }, function (r) {
      return '<article class="record"><div class="record__top"><span class="record__title">' + r.n + '</span>' + badge(r.st[0], r.st[1]) + '</div><span>' + esc(r.d) + '</span><div class="record__meta"><span>' + esc(r.lim) + '</span>' + (v === 'b1' ? '<span>' + esc(r.price) + '</span>' : '') + '<span>' + r.start + ' · ' + r.dur + '</span><span>Hiệu lực ' + r.eff + '</span></div>' + act68(r, PL.indexOf(r)) + '</article>';
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pl-retire]'); if (!b) return;
    var r = PL[+b.getAttribute('data-pl-retire')]; $('#pl-ret-t').textContent = r.n; window.gmepOpen('dlg-pret');
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest('#pl-ret-ok')) { window.gmepClose($('#dlg-pret')); toast('success', 'Đã ngừng cung cấp gói', 'Gói không còn hiện cho người đăng ký mới. Tenant đang dùng gói này không bị ảnh hưởng.'); }
  });
  document.addEventListener('change', function (e) {
    if (e.target.id === 'pl-start') { var d = $('#pl-dur'); var none = e.target.value === 'none'; d.disabled = none; if (none) { d.removeAttribute('aria-invalid'); } }
  });

  /* ---------- TSX-30 Hàng đợi và hồ sơ (master-detail: danh sách bên trái, hồ sơ bên phải; dưới 1280 px chuyển qua lại giữa hai ngăn) ---------- */
  REASONS.resub = ['Đã bổ sung, chờ xem lại', 'info'];
  var Q30 = [
    { id: 'SGN-4F7K2Q', org: 'Công ty TNHH Ô tô Minh Phát', mst: '03******12', mail: 'p***@minhphat.vn', r: ['dup'], sent: '05/11/2026 09:42', w: 3, own: '', tab: 'todo' },
    { id: 'SGN-8C2M5T', org: 'Hộ kinh doanh Garage Hải Âu', mst: '0123*****789', mail: 'h***@mailinator.com', r: ['disp'], sent: '05/11/2026 08:05', w: 5, own: 'Phạm Quốc Bảo', tab: 'todo' },
    { id: 'SGN-1D9P6W', org: 'Công ty CP Gara Đông Dương', mst: '03******45', mail: 'd***@dongduong.vn', r: ['mismatch'], sent: '04/11/2026 08:10', w: 26, own: 'Lê Thu Hà', tab: 'todo' },
    { id: 'SGN-6H3N8R', org: 'Garage Tân Cảng', mst: '01******77', mail: 't***@tancang.vn', r: ['rate', 'block'], sent: '04/11/2026 16:30', w: 18, own: '', tab: 'todo' },
    { id: 'SGN-9B5T3K', org: 'Công ty TNHH Bảo dưỡng An Khang', mst: '03******63', mail: 'a***@ankhang.vn', r: ['resub', 'mismatch'], sent: '02/11/2026 10:30', w: 2, own: 'Phạm Quốc Bảo', tab: 'todo' },
    { id: 'SGN-7M2P9X', org: 'Công ty TNHH Cơ khí Đại Phát', mst: '03******31', mail: 'c***@daiphat.vn', r: [], sent: '05/11/2026 09:30', w: 0, own: '', tab: 'prov', step: 'Cấu hình mặc định', n: '5/5', st: ['Cần nhân sự', 'danger'], staff: true, data: false },
    { id: 'SGN-4C8V1D', org: 'Garage Hoàng Gia', mst: '0912*****654', mail: 'h***@hoanggia.vn', r: [], sent: '05/11/2026 10:09', w: 0, own: '', tab: 'prov', step: 'Tạo tài khoản', n: '2/5', st: ['Đang tự thử lại', 'warning'], staff: false, data: false },
    { id: 'SGN-9Z5K3F', org: 'Công ty TNHH Phụ tùng Hưng Thịnh', mst: '03******08', mail: 'p***@hungthinh.vn', r: [], sent: '05/11/2026 08:50', w: 0, own: '', tab: 'prov', step: 'Tạo không gian làm việc', n: '5/5', st: ['Cần nhân sự', 'danger'], staff: true, data: true },
    { id: 'SGN-5X2R7N', org: 'Công ty TNHH Ô tô Việt Hưng', mst: '03******28', mail: 'v***@viethung.vn', r: ['other'], sent: '04/11/2026 13:00', w: 0, own: 'Lê Thu Hà', tab: 'done', dec: ['Đã duyệt', 'success', '04/11/2026 15:20'] },
    { id: 'SGN-7Q4Y8M', org: 'Garage Sao Mai', mst: '0912*****456', mail: 's***@saomai.vn', r: ['dup'], sent: '03/11/2026 09:00', w: 0, own: 'Lê Thu Hà', tab: 'done', dec: ['Đã từ chối', 'danger', '03/11/2026 11:45'] },
    { id: 'SGN-2J7Q4V', org: 'Công ty TNHH Lốp Việt', mst: '03******90', mail: 'l***@lopviet.vn', r: ['other'], sent: '03/11/2026 14:00', w: 0, own: 'Phạm Quốc Bảo', tab: 'done', dec: ['Đã yêu cầu bổ sung', 'warning', '03/11/2026 14:30'] }
  ];
  var T30 = [['todo', 'Cần xử lý'], ['prov', 'Lỗi cấp phát'], ['done', 'Đã xử lý 7 ngày']];
  var c30 = { tab: 'todo', q: '', pane: 'list', view: 'cases' };
  var DETAIL_VIEWS = { detail: 1, dupmst: 1, mismatch: 1, r409: 1, qtn: 1, htn: 1 };
  var KEEP_VIEWS = { skel: 1, error: 1, offline: 1, r429: 1 };
  function find30(id) { for (var i = 0; i < Q30.length; i++) if (Q30[i].id === id) return Q30[i]; return null; }
  function badge30(r) {
    if (r.tab === 'prov') return badge(r.st[0], r.st[1]);
    if (r.tab === 'done') return badge(r.dec[0], r.dec[1]);
    return r.w > LATE_H ? badge('Quá hạn xử lý', 'danger') : '';
  }
  function meta30(r) {
    if (r.tab === 'prov') return 'Bước lỗi: ' + r.step + ' · Tự thử lại ' + r.n;
    if (r.tab === 'done') return r.dec[2];
    return 'Chờ ' + r.w + ' giờ · Gửi ' + r.sent;
  }
  function setOff(btn, off, why) {
    if (!btn) return;
    if (off) btn.setAttribute('aria-disabled', 'true'); else btn.removeAttribute('aria-disabled');
    btn.setAttribute('data-why', why); btn.setAttribute('aria-describedby', why);
  }
  function renderDetail30() {
    var r = sel30, v = document.body.getAttribute('data-view') || '';
    $('#d30-empty').hidden = !!r; $('#d30-body').hidden = !r;
    if (!r) return;
    var prov = r.tab === 'prov', done = r.tab === 'done', dup = r.r.indexOf('dup') >= 0, mm = r.r.indexOf('mismatch') >= 0;
    $('#d30-id').textContent = r.id; $('#d30-org').textContent = r.org;
    $('#d30-badge').innerHTML = (v === 'r409' ? badge('Đã duyệt', 'success') : prov || done ? badge30(r) : badge('Chờ duyệt tay', 'warning'));
    $('#d30-meta').textContent = 'Gửi ' + r.sent + (r.tab === 'todo' ? ' · Chờ ' + r.w + ' giờ' : '') + ' · Người phụ trách: ' + (r.own || 'Chưa gán');
    $('#d30-flags').innerHTML = prov ? badge('Lỗi ở bước: ' + r.step, r.st[1]) : r.r.length ? reasonsHtml(r) : '<span class="tsa-note">Không có cờ</span>';
    $('#d30-mst').textContent = r.mst; $('#d30-mail').textContent = r.mail; $('#d30-org2').textContent = r.org;
    var pii = $('#d30-pii'); pii.setAttribute('data-pii', r.id); renderPII(pii);
    $('#d30-dup').hidden = !dup || done || prov;
    $('#d30-cmp-ok').hidden = mm; $('#d30-cmp-bad').hidden = !mm;
    $('#d30-dup-ok').hidden = dup; $('#d30-dup-bad').hidden = !dup;
    $$('[data-block="case"]').forEach(function (e) { e.hidden = prov; });
    $$('[data-block="prov"]').forEach(function (e) { e.hidden = !prov; });
    var rej = done && r.dec[0] === 'Đã từ chối', todo = r.tab === 'todo';
    $('#a-approve').hidden = !todo; $('#a-supp').hidden = !todo; $('#a-reject').hidden = !todo; $('#a-reopen').hidden = !rej;
    var roleOff = v === 'htn' || v === 'r409', cntOnly = roleOff || v === 'qtn';
    setOff($('#a-approve'), cntOnly, 'why30'); setOff($('#a-reject'), cntOnly, 'why30'); setOff($('#a-reopen'), cntOnly, 'why30'); setOff($('#a-supp'), roleOff, 'why30');
    setOff($('#a-retry'), v === 'htn' || !r.staff, 'why30p');
    setOff($('#a-clean'), v === 'htn' || !r.staff || r.data, 'why30p');
    var wp = $('#why30p');
    wp.innerHTML = ic('lock') + '<span>' + (v === 'htn' ? 'Hỗ trợ nền tảng chỉ xem, hai nút đang khóa vì vai trò của bạn không có quyền này.' : !r.staff ? 'Hệ thống đang tự thử lại. Nút “Thử lại bước lỗi” và “Hủy và dọn” mở khi vượt số lần tự thử.' : r.data ? 'Đã có dữ liệu thật, không thể hủy và dọn. Chỉ thử lại được từng bước.' : 'Thử lại là thao tác idempotent, bấm lại không tạo trùng. “Hủy và dọn” chỉ khi chưa có dữ liệu thật.') + '</span>';
    $('#a-reopen-note').hidden = !rej;
  }
  function render30() {
    var tb = $('#list30'); if (!tb) return;
    var v = document.body.getAttribute('data-view') || '', all = v === 'empty' ? [] : Q30;
    $('#tabs30').innerHTML = T30.map(function (t) {
      var n = all.filter(function (r) { return r.tab === t[0]; }).length;
      return '<button type="button" class="tab" data-tab30="' + t[0] + '"' + (c30.tab === t[0] ? ' aria-current="true"' : '') + '>' + t[1] + ' <span class="count-pill">' + n + '</span></button>';
    }).join('');
    var q = norm(c30.q.trim()), rows = all.filter(function (r) { return r.tab === c30.tab && (!q || norm(r.id + ' ' + r.org + ' ' + r.mst.replace(/\*/g, '')).indexOf(q) >= 0); });
    if (c30.tab === 'todo') rows.sort(function (a, b) { return b.w - a.w; });
    tb.innerHTML = rows.map(function (r) {
      var on = sel30 && sel30.id === r.id;
      return '<li><button type="button" class="tsx-item" data-q30="' + r.id + '"' + (on ? ' aria-current="true"' : '') + '><span class="tsx-item__top"><span class="tsa-mono">' + r.id + '</span>' + badge30(r) + '</span><span class="cell-primary">' + esc(r.org) + '</span><span class="cell-sub">MST ' + r.mst + ' · ' + meta30(r) + '</span>' + (r.tab === 'todo' ? reasonsHtml(r) : '') + '</button></li>';
    }).join('');
    var none = !rows.length, empty = $('#empty30');
    tb.hidden = none; empty.hidden = !none;
    if (none) {
      var f = !!c30.q.trim();
      $('.state__title', empty).textContent = f ? 'Không có hồ sơ khớp bộ lọc' : c30.tab === 'todo' ? 'Không có ca nào cần xử lý' : c30.tab === 'prov' ? 'Không có lỗi cấp phát' : 'Chưa có hồ sơ nào được xử lý trong 7 ngày';
      $('.state__text', empty).textContent = f ? 'Thử đổi từ khóa hoặc xóa bộ lọc để xem toàn bộ.' : 'Chỉ ca bị cờ mới vào đây. Ca đạt tiêu chí tự duyệt đi thẳng tới cấp phát.';
      $('[data-clear30]', empty).hidden = !f;
    }
    $('#meta30').textContent = rows.length + ' trong ' + all.filter(function (r) { return r.tab === c30.tab; }).length + ' hồ sơ' + (c30.q.trim() ? ' · lọc theo “' + c30.q.trim() + '”' : '');
    var chip = $('#chip30'); chip.hidden = !c30.q.trim(); $('[data-chip-text]', chip).textContent = 'Từ khóa: ' + c30.q.trim();
    var todo = all.filter(function (r) { return r.tab === 'todo'; });
    $('#k30-todo').textContent = todo.length; $('#k30-late').textContent = todo.filter(function (r) { return r.w > LATE_H; }).length;
    $('#k30-today').textContent = v === 'cap' ? '50' : '41';
    $('#md30').setAttribute('data-pane', c30.pane);
    renderDetail30();
  }
  if (page === '30') {
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-tab30]'); if (t) { c30.tab = t.getAttribute('data-tab30'); render30(); var nt = $('[data-tab30="' + c30.tab + '"]'); if (nt) nt.focus(); return; }
      var it = e.target.closest('[data-q30]');
      if (it) { sel30 = find30(it.getAttribute('data-q30')); c30.pane = 'detail'; render30(); var h = $('#d30-h'); if (h) h.focus(); return; }
      if (e.target.closest('#back30')) { c30.pane = 'list'; render30(); var cur30 = $('.tsx-item[aria-current="true"]') || $('#q30'); if (cur30) cur30.focus(); return; }
      if (e.target.closest('[data-clear30]') || e.target.closest('#chip30 .chip__x')) { c30.q = ''; $('#q30').value = ''; render30(); $('#q30').focus(); return; }
      var rt = e.target.closest('#a-retry');
      if (rt) { if (rt.getAttribute('aria-disabled') === 'true') { $('#why30p').focus(); return; } toast('success', 'Đã yêu cầu thử lại bước', 'Thao tác idempotent: bấm lại không tạo trùng.'); return; }
      var cl = e.target.closest('#a-clean');
      if (cl) { if (cl.getAttribute('aria-disabled') === 'true') { $('#why30p').focus(); return; } window.gmepOpen('dlg-clean30'); return; }
      if (e.target.closest('#clean30-ok')) { window.gmepClose($('#dlg-clean30')); toast('success', 'Đã hủy và dọn hồ sơ', 'Hồ sơ cấp phát đã được dọn, người đăng ký nhận email.'); }
    });
    document.addEventListener('input', function (e) { if (e.target.id === 'q30') { c30.q = e.target.value; render30(); } });
  }

  /* ---------- TSU-66: xem tất cả các thẻ khi kiểm tra giá trị, rồi hiện lại thẻ có lỗi đầu tiên ---------- */
  function selectTab66(panelId) {
    var tab = $('[role="tab"][aria-controls="' + panelId + '"]'); if (tab) tab.click();
  }
  function validateAll66() {
    var form = $('#cfg-form'), panels = $$('[role="tabpanel"]', form), prev = panels.filter(function (p) { return !p.hidden; })[0];
    panels.forEach(function (p) { p.hidden = false; });
    var ok = window.TS.validateForm(form), bad = $('[aria-invalid="true"]', form);
    panels.forEach(function (p) { p.hidden = true; });
    var keep = bad ? bad.closest('[role="tabpanel"]') : prev;
    if (keep) { selectTab66(keep.id); if (bad) bad.focus(); }
    return ok;
  }
  document.addEventListener('click', function (e) {   /* liên kết trong tóm tắt lỗi: mở đúng thẻ trước khi chuyển focus */
    var a = e.target.closest('[data-jump]'); if (!a || page !== '66') return;
    var el = document.getElementById(a.getAttribute('data-jump')), p = el && el.closest('[role="tabpanel"]');
    if (p && p.hidden) selectTab66(p.id);
  }, true);

  /* ---------- Điểm vào theo trạng thái xem thử ---------- */
  window.tsOnView = function (v) {
    if (page === '30') {
      if (!KEEP_VIEWS[v]) {
        if (v === 'filtered') c30.q = 'khong co ket qua'; else if (c30.view === 'filtered') c30.q = '';
        c30.view = v; c30.tab = 'todo';
        sel30 = v === 'dupmst' ? find30('SGN-4F7K2Q') : v === 'mismatch' ? find30('SGN-1D9P6W') : DETAIL_VIEWS[v] ? find30('SGN-8C2M5T') : null;
        c30.pane = DETAIL_VIEWS[v] ? 'detail' : 'list'; $('#q30').value = c30.q;
      }
      render30();
    }
    if (page === '61') { if (v === 'filtered') cur.q = 'khong co ket qua'; else if (cur.view === 'filtered') cur.q = ''; cur.view = v; var q = $('#q61'); if (q) q.value = cur.q; render61(); }
    if (page === '64') render64();
    if (page === '65') render65();
    if (page === '66') {
      $$('#cfg-form fieldset[data-cfg-fs]').forEach(function (f) { f.disabled = v === 'view'; });
      cfgDirty();
      if (v === 'errval') validateAll66();
      else { var sm = $('#cfg-form [data-summary]'); if (sm) sm.hidden = true; $$('#cfg-form [aria-invalid="true"]').forEach(function (x) { x.removeAttribute('aria-invalid'); }); $$('#cfg-form .field__error').forEach(function (x) { x.hidden = true; }); }
      if (v === 'confirm') { selectTab66('cp1'); var t = $('[data-reg-toggle]'); if (t && !$('#dlg-reg.is-open')) t.click(); }
    }
    if (page === '67') { render67(); if (v === 'confirm') { var tv = $('[data-tv-eff]'); if (tv && !$('.overlay.is-open')) tv.click(); } if (v === 'create' && !$('.overlay.is-open')) window.gmepOpen('dlg-tver'); }
    if (page === '68') { render68(); if (v === 'edit' && !$('.overlay.is-open')) window.gmepOpen('dlg-plan'); if (v === 'retire' && !$('.overlay.is-open')) { var rt = $('[data-pl-retire]'); if (rt) rt.click(); } }
    if (page === '63') mountStatic(v === 'conflict' ? 'conflict' : v);
  };
  if (window.TS) { var cv = window.TS.getView(); window.tsOnView(cv); }
  if (page === '66') cfgDirty();
})();
