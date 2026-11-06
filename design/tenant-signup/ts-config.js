/* Cấu hình dùng chung của gói "Đăng ký tenant và onboarding" (chỉ prototype). Nạp TRƯỚC ts-common.js và tsu-app.js.
   - brand: tên sản phẩm, một chỗ duy nhất. Đổi ở đây là mọi màn đổi theo (thẻ có data-brand, tiêu đề tab, khung wizard).
     [Cần xác nhận] tên sản phẩm "GMEP" chưa được chủ dự án chốt.
   - support: kênh hỗ trợ (hotline, Zalo, giờ làm việc). Giá trị minh họa [Cần xác nhận], thật ra lấy từ cấu hình support.phone, support.zalo.
   Cách dùng trong HTML:
     <span data-brand>GMEP</span>              chữ thay bằng brand
     <p class="ts-help" data-support="line"></p>    một dòng "Cần giúp? Gọi ... hoặc nhắn Zalo ..."
     <div class="ts-help ts-help--card" data-support="card"></div>   thẻ "Cần giúp?" có hotline, Zalo, giờ làm việc
     <a href="#" data-support-call>Gọi hỗ trợ</a>   href thành tel:<hotline> */
(function () {
  'use strict';
  var CFG = window.TS_CONFIG = {
    brand: 'GMEP',
    support: { phone: '1900 0000', zalo: '0900 000 000', hours: '8:00 đến 17:30, thứ Hai đến thứ Bảy' }
  };
  function digits(s) { return String(s).replace(/\D/g, ''); }
  function tel() { return '<a class="num" href="tel:' + digits(CFG.support.phone) + '">' + CFG.support.phone + '</a>'; }
  function lineHtml() {
    return 'Cần giúp? Gọi ' + tel() + ' hoặc nhắn Zalo <span class="num">' + CFG.support.zalo + '</span>. Giờ làm việc: ' + CFG.support.hours + '.';
  }
  function cardHtml() {
    return '<strong class="ts-help__t">Cần giúp?</strong><span>Gọi ' + tel() + '</span><span>Nhắn Zalo <span class="num">' + CFG.support.zalo + '</span></span><span class="ts-help__h">Giờ làm việc: ' + CFG.support.hours + '</span>';
  }
  function apply(root) {
    var r = root || document;
    Array.prototype.forEach.call(r.querySelectorAll('[data-brand]'), function (e) { e.textContent = CFG.brand; });
    Array.prototype.forEach.call(r.querySelectorAll('[data-support]'), function (e) { e.innerHTML = e.getAttribute('data-support') === 'card' ? cardHtml() : lineHtml(); });
    Array.prototype.forEach.call(r.querySelectorAll('[data-support-call]'), function (e) { e.setAttribute('href', 'tel:' + digits(CFG.support.phone)); });
    if (document.title.indexOf('GMEP') >= 0 && CFG.brand !== 'GMEP') document.title = document.title.split('GMEP').join(CFG.brand);
  }
  CFG.apply = apply;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { apply(); }); else apply();
})();
