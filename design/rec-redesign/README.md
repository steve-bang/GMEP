# Thiết kế lại nhóm "Tiếp nhận và báo giá" (prototype)

Prototype HTML cho 11 màn hình của nhóm sidebar Tiếp nhận và báo giá, dùng token trong `../assets/tokens.css` (không đổi giá trị token). Mở trực tiếp bằng trình duyệt; các trang liên kết với nhau, bắt đầu từ `intakes.html`.

| Mục sidebar | Màn hình | File |
| --- | --- | --- |
| Tiếp nhận xe | Danh sách hồ sơ | `intakes.html` |
| | Bắt đầu tiếp nhận (nhập biển số) | `intake-new.html` |
| | Nhập hồ sơ 5 bước | `intake-wizard.html` |
| | Chi tiết hồ sơ | `intake-detail.html` |
| Báo giá | Danh sách | `quotes.html` |
| | Chi tiết và soạn báo giá | `quote-detail.html` |
| Lệnh sửa chữa | Danh sách | `orders.html` |
| | Chi tiết lệnh | `order-detail.html` |
| Bảng điều phối | Bảng theo trạng thái lệnh | `board.html` |
| Việc của tôi | Màn hình tablet cho thợ | `work.html` |
| Yêu cầu phụ tùng | Danh sách và xuất kho | `part-requests.html` |

`common.css` dùng chung; `photos.js` sinh ảnh giả (SVG). Ảnh chụp ở `screenshots/` (`-d` = 1440px, `-m` = 390px).

## Ý tưởng chính
- Biển số là định danh chính của mọi dòng; mã chứng từ chỉ là thông tin phụ.
- Danh sách có tab theo việc cần làm, đếm số lượng, và một nút hành động cho từng dòng.
- Dải hành trình (hồ sơ, báo giá, lệnh, thanh toán) ở các trang chi tiết là điều hướng giữa các chứng từ. Mỗi chứng từ giữ huy hiệu trạng thái riêng, không có trạng thái chung (CLAUDE.md: năm đối tượng, năm bộ trạng thái).
- Chi tiết lệnh: hạng mục là nội dung chính, thanh toán và hóa đơn ở cột phụ, sửa lỗi chữ đè trong lịch sử trạng thái.
- Bảng điều phối cuộn ngang, đủ 5 trạng thái lệnh, thẻ có cảnh báo trễ hẹn và thợ phụ trách.

## Chưa xác nhận / chưa xây
- Dữ liệu là dữ liệu mẫu. "Trễ hẹn", số bước nháp, thợ phụ trách, số lượng trên tab và số có thể bán cần dữ liệu mà các trang hiện tại chưa lấy; có thể phát sinh query mới và tốn ngân sách index.
- Hạng mục tùy chọn tính lại tổng tiền ở `quote-detail.html` chỉ là demo; thuế 8% là mẫu theo cấu hình hiện có.
- Việc tạm dừng, hoàn tác và đồng hồ ở `work.html` chỉ là demo giao diện.
- "Yêu cầu chuyển kho" trong `part-requests.html` là đề xuất, chưa có trong luồng hiện tại.
- Font Be Vietnam Pro chưa có file trong `design/assets/fonts`, ảnh chụp dùng font dự phòng.
