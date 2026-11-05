# Báo cáo đo tràn ngang và lỗi JS: phần công khai và quản trị nền tảng

Phạm vi: `design/tenant-signup/public/` (TSU-01..18) và `design/tenant-signup/platform-admin/` (TSU-60..68), độ rộng 360, 768, 1280 px.

## Trạng thái: CHƯA ĐO

Phiên làm việc dựng gói này chỉ có công cụ đọc, ghi và sửa tệp, không có quyền chạy lệnh (không có shell), nên không chạy được Playwright. Không có số đo nào ở dưới là kết quả thật; mục "Đã rà bằng đọc mã" chỉ là phân tích tĩnh, không thay thế đo.

## Cách đo (cần chạy một lần)

```
node design/tenant-signup/measure-overflow.js            # cả hai thư mục
node design/tenant-signup/measure-overflow.js public     # chỉ phần công khai
```

Tập lệnh mở từng trang ở 360, 768, 1280 px, bấm lần lượt từng nút "Xem thử trạng thái", đo `scrollWidth` so với `clientWidth` ở mỗi trạng thái, và gom `pageerror` cùng `console.error`. Đặt `PLAYWRIGHT_CHROMIUM_PATH` nếu Chromium cài ở chỗ khác. Dán bảng kết quả vào mục dưới.

## Kết quả đo

| Trang | Rộng (px) | Tràn ngang | Lỗi JS |
| --- | --- | --- | --- |
| (chưa chạy) | | | |

## Đã rà bằng đọc mã (không phải số đo)

- Mọi bảng dữ liệu nằm trong `.table-scroll` (cuộn nội bộ) và đổi sang danh sách thẻ ở dưới 640 px.
- Thanh điều hướng quản trị nền tảng dưới 1024 px chuyển thành hàng cuộn ngang nội bộ, không làm rộng trang.
- Chuỗi dài dùng `overflow-wrap: anywhere`; nhóm nút dùng `flex-wrap`; thanh "Xem thử trạng thái" cho phép xuống dòng.
- Điểm rủi ro nên kiểm tra đầu tiên khi chạy đo: TSU-04 (khối điều khoản kèm nút "Đọc"), TSU-62 (thanh nút quyết định và khối lọc), TSU-66 (lưới tham số và bảng danh mục lý do), TSU-61 ở 768 px (bảng 7 cột).


## Kết quả đo thật (05/11/2026, Playwright, Chromium)

Đo bằng `node design/tenant-signup/measure-overflow.js` ở 360/768/1280, mỗi trang ở trạng thái mặc định. Lỗi tải font (design/assets/fonts chỉ có README, lỗi có sẵn của toàn dự án) được bỏ qua. Chưa chạy axe, chưa đo tương phản dark mode, chưa đo hiệu năng.

| Trang | Rộng (px) | Tràn ngang | Lỗi JS |
| --- | --- | --- | --- |
| public/tsu-01.html | 360 | sạch | không |
| public/tsu-01.html | 768 | sạch | không |
| public/tsu-01.html | 1280 | sạch | không |
| public/tsu-02.html | 360 | sạch | không |
| public/tsu-02.html | 768 | sạch | không |
| public/tsu-02.html | 1280 | sạch | không |
| public/tsu-03.html | 360 | sạch | không |
| public/tsu-03.html | 768 | sạch | không |
| public/tsu-03.html | 1280 | sạch | không |
| public/tsu-04.html | 360 | sạch | không |
| public/tsu-04.html | 768 | sạch | không |
| public/tsu-04.html | 1280 | sạch | không |
| public/tsu-05.html | 360 | sạch | không |
| public/tsu-05.html | 768 | sạch | không |
| public/tsu-05.html | 1280 | sạch | không |
| public/tsu-06.html | 360 | sạch | không |
| public/tsu-06.html | 768 | sạch | không |
| public/tsu-06.html | 1280 | sạch | không |
| public/tsu-07.html | 360 | sạch | không |
| public/tsu-07.html | 768 | sạch | không |
| public/tsu-07.html | 1280 | sạch | không |
| public/tsu-08.html | 360 | sạch | không |
| public/tsu-08.html | 768 | sạch | không |
| public/tsu-08.html | 1280 | sạch | không |
| public/tsu-09.html | 360 | sạch | không |
| public/tsu-09.html | 768 | sạch | không |
| public/tsu-09.html | 1280 | sạch | không |
| public/tsu-10.html | 360 | sạch | không |
| public/tsu-10.html | 768 | sạch | không |
| public/tsu-10.html | 1280 | sạch | không |
| public/tsu-11.html | 360 | sạch | không |
| public/tsu-11.html | 768 | sạch | không |
| public/tsu-11.html | 1280 | sạch | không |
| public/tsu-12.html | 360 | sạch | không |
| public/tsu-12.html | 768 | sạch | không |
| public/tsu-12.html | 1280 | sạch | không |
| public/tsu-13.html | 360 | sạch | không |
| public/tsu-13.html | 768 | sạch | không |
| public/tsu-13.html | 1280 | sạch | không |
| public/tsu-14.html | 360 | sạch | không |
| public/tsu-14.html | 768 | sạch | không |
| public/tsu-14.html | 1280 | sạch | không |
| public/tsu-15.html | 360 | sạch | không |
| public/tsu-15.html | 768 | sạch | không |
| public/tsu-15.html | 1280 | sạch | không |
| public/tsu-16.html | 360 | sạch | không |
| public/tsu-16.html | 768 | sạch | không |
| public/tsu-16.html | 1280 | sạch | không |
| public/tsu-17.html | 360 | sạch | không |
| public/tsu-17.html | 768 | sạch | không |
| public/tsu-17.html | 1280 | sạch | không |
| public/tsu-18.html | 360 | sạch | không |
| public/tsu-18.html | 768 | sạch | không |
| public/tsu-18.html | 1280 | sạch | không |
| platform-admin/tsu-60.html | 360 | sạch | không |
| platform-admin/tsu-60.html | 768 | sạch | không |
| platform-admin/tsu-60.html | 1280 | sạch | không |
| platform-admin/tsu-61.html | 360 | sạch | không |
| platform-admin/tsu-61.html | 768 | sạch | không |
| platform-admin/tsu-61.html | 1280 | sạch | không |
| platform-admin/tsu-62.html | 360 | sạch | không |
| platform-admin/tsu-62.html | 768 | sạch | không |
| platform-admin/tsu-62.html | 1280 | sạch | không |
| platform-admin/tsu-63.html | 360 | sạch | không |
| platform-admin/tsu-63.html | 768 | sạch | không |
| platform-admin/tsu-63.html | 1280 | sạch | không |
| platform-admin/tsu-64.html | 360 | sạch | không |
| platform-admin/tsu-64.html | 768 | sạch | không |
| platform-admin/tsu-64.html | 1280 | sạch | không |
| platform-admin/tsu-65.html | 360 | sạch | không |
| platform-admin/tsu-65.html | 768 | sạch | không |
| platform-admin/tsu-65.html | 1280 | sạch | không |
| platform-admin/tsu-66.html | 360 | sạch | không |
| platform-admin/tsu-66.html | 768 | sạch | không |
| platform-admin/tsu-66.html | 1280 | sạch | không |
| platform-admin/tsu-67.html | 360 | sạch | không |
| platform-admin/tsu-67.html | 768 | sạch | không |
| platform-admin/tsu-67.html | 1280 | sạch | không |
| platform-admin/tsu-68.html | 360 | sạch | không |
| platform-admin/tsu-68.html | 768 | sạch | không |
| platform-admin/tsu-68.html | 1280 | sạch | không |

Tổng số tổ hợp có vấn đề: 0


## Đo lại sau khi áp dụng rà chéo BA (05/11/2026)

Phần A (`measure-overflow.js`): 0 tổ hợp có vấn đề. Phần B (`account/measure.js --states`): 615 lượt tải, 0 lượt có vấn đề. Lỗi tải font bỏ qua như trên. Hàm `avoids` chưa kiểm thử tự động (chỉ rà logic).
