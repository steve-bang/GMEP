# Thiết kế lại màn hình Khách hàng và Xe (prototype)

Prototype HTML cho 6 màn hình CRM, dùng token trong `../assets/tokens.css` (không đổi giá trị token).
Mở trực tiếp bằng trình duyệt; các trang liên kết với nhau.

| Màn hình | File |
| --- | --- |
| Danh sách khách | `customers.html` |
| Thêm khách | `customer-new.html` |
| Chi tiết khách | `customer-detail.html` |
| Danh sách xe (có ảnh đại diện) | `vehicles.html` |
| Thêm xe (tải ảnh, xem trước biển số) | `vehicle-new.html` |
| Chi tiết xe (thư viện ảnh, hộp thoại chuyển chủ/đổi biển số) | `vehicle-detail.html` |

`common.css` dùng chung (trừ `customers.html` còn CSS nội tuyến); `photos.js` sinh ảnh giả (SVG) cho prototype. Ảnh chụp ở `screenshots/` (`-d` = 1440px, `-m` = 390px).

## Chưa xác nhận / chưa xây
- Dữ liệu là dữ liệu mẫu; "lệnh sửa chữa đang mở", "lần ghé gần nhất", số lần sửa cần mở rộng dữ liệu và có thể tốn ngân sách index.
- Kiểm tra trùng khách/biển số khi nhập chỉ là demo JS; chuẩn hóa biển số trong prototype là bản đơn giản.
- Hình ảnh xe: đọc ảnh qua signed URL chưa xây (CLAUDE.md). Giới hạn 8 ảnh, 10 MB, bốn nhóm ảnh do designer tự đặt; vai trò được xem ảnh giấy tờ và thời hạn lưu ảnh chưa chốt.
- Font Be Vietnam Pro chưa có file trong `design/assets/fonts`, ảnh chụp dùng font dự phòng.
