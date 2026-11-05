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
