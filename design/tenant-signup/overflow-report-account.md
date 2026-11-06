# Báo cáo đo tràn ngang và lỗi JS: nhóm D, E, F (onboarding và account)

Ngày: 05/11/2026 · Phạm vi: `design/tenant-signup/onboarding/*.html` (13 trang) và `design/tenant-signup/account/*.html` (14 trang).

## Trạng thái: CHƯA ĐO

Phiên làm việc của designer lần này **không có công cụ chạy lệnh (không có shell)**, nên chưa chạy Playwright và chưa có số đo thật ở 360, 768, 1280 px. Không có kết quả nào trong báo cáo này là kết quả đo; mọi nhận định bên dưới là rà tĩnh. Cần chạy lệnh dưới đây rồi dán kết quả vào cuối tệp này.

## Cách đo (đã viết sẵn)

```
node design/tenant-signup/account/measure.js            # trạng thái đầu của mỗi trang, 3 độ rộng
node design/tenant-signup/account/measure.js --states   # mọi trạng thái trên thanh "Xem thử trạng thái" kèm loading, error, offline, saving
```

Tập lệnh dùng `require('playwright')` (đặt `PLAYWRIGHT_CHROMIUM_PATH` nếu cần), mở từng trang với `#state=<tên>`, đo `scrollWidth > innerWidth` ở 360, 768, 1280, liệt kê tối đa 5 phần tử vượt biên (bỏ qua vùng `.table-scroll`), ghi `pageerror` và `console.error`, đánh dấu trang trống. Thoát mã 1 nếu có vấn đề.

## Rà tĩnh đã làm (thay cho số đo)

| Hạng mục | Cách xử lý trong mã |
| --- | --- |
| Bảng rộng trên điện thoại | Mọi bảng nằm trong `.table-scroll`; bảng dữ liệu ở TSU-25, 42, 44 ẩn dưới 768 px và thay bằng danh sách thẻ `.tsu-cards` |
| Hàng nút chân trang wizard | `flex-wrap`; dưới 640 px nút chính chiếm cả hàng, các nút còn lại chia đôi hàng, cao tối thiểu 44 px |
| Chuỗi dài (mã băm toàn vẹn, REQ, tên công ty) | `overflow-wrap:anywhere`, `word-break:break-all` cho chuỗi băm; mọi cột lưới có `min-width:0` |
| Lưới thẻ gói, hạn mức, tóm tắt | `repeat(auto-fit, minmax(min(100%, Npx), 1fr))`, không đặt độ rộng cố định |
| Stepper 9 bước | Dưới 1024 px thu thành nút "Bước n/9 · tên bước" mở danh sách; từ 1024 px là cột trái 296 px |
| Danh sách khóa/mở bước | Bước chưa mở là nút `aria-disabled` có chữ lý do, bấm mở hộp thoại giải thích |
| Cặp chữ và nền | Chữ phụ dùng `--color-text-secondary` trên nền wizard `--color-surface-sunken` (không dùng tertiary cho chữ nhỏ) |
| Mục tiêu chạm | Nút trạng thái xem thử, nút bước, nút chân trang đều ≥ 44 px khi `pointer: coarse` hoặc < 1024 px |

## Việc còn lại

1. Chạy `measure.js` (cả hai chế độ) ở môi trường có Chromium, sửa tới khi 0 tràn ngang, 0 lỗi JS, 0 trang trống.
2. Chạy axe cho từng trạng thái (chưa có kiểm tra tương phản, bàn phím, trình đọc màn hình tự động).
3. Thử tay trên tablet xưởng và điện thoại thật: stepper thu gọn, chân trang dính, hộp thoại có focus trap.


## Kết quả đo thật (05/11/2026, Playwright, Chromium)

Đo bằng `node design/tenant-signup/account/measure.js --states`: mọi trạng thái xem thử ở 360/768/1280. Lỗi tải font (design/assets/fonts chỉ có README, lỗi có sẵn của toàn dự án) được bỏ qua. Chưa chạy axe.

Kết quả: 600 lượt tải, 0 lượt có vấn đề (không tràn ngang, không lỗi JS, không trang trống).


## Đo lại sau khi áp dụng rà chéo BA (05/11/2026)

Phần A (`measure-overflow.js`): 0 tổ hợp có vấn đề. Phần B (`account/measure.js --states`): 615 lượt tải, 0 lượt có vấn đề. Lỗi tải font bỏ qua như trên. Hàm `avoids` chưa kiểm thử tự động (chỉ rà logic).


## Đo lại bản tối giản (05/11/2026, Playwright)

`account/measure.js --states` (onboarding + account còn dùng): 252 lượt tải, 0 lượt có vấn đề. Chưa chạy axe.


## Đo lại sau phản hồi client (06/11/2026, Playwright)

Phần công khai và platform admin: 0 tổ hợp có vấn đề sau khi sửa tràn 16px ở thanh đầu platform admin ở 360px (TSU-66, `.tsa-user` thêm `min-width:0; max-width:100%`). Phần onboarding và account (`account/measure.js --states`): 252 lượt tải, 0 lượt có vấn đề. Kiểm tra link: 687 liên kết, 4 báo nhầm (chuỗi mẫu JS). Chưa chạy axe.
