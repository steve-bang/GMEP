# Thiết kế lại nhóm "Dashboard và báo cáo" (prototype)

Prototype HTML cho 5 màn hình, dùng token trong `../assets/tokens.css` (không đổi giá trị token), cùng cách làm với `../rec-redesign` (PR 20/21). Mở trực tiếp bằng trình duyệt; các trang liên kết với nhau, bắt đầu từ `branch-overview.html`. Dữ liệu là **dữ liệu mẫu**, chi nhánh và tên người là tên giả.

| Mục | Màn hình | File | Người dùng, FR |
| --- | --- | --- | --- |
| Dashboard | Tổng quan chi nhánh | `branch-overview.html` | Quản lý chi nhánh, điện thoại và máy tính. FR-RPT-001, 008, 010, 011, 012, 013 |
| Dashboard | Tổng quan chuỗi (chủ garage) | `group-overview.html` | Chủ garage. FR-RPT-001, 002, 008, 010, 013 |
| Báo cáo | Doanh thu | `revenue.html` | Quản lý, kế toán. FR-RPT-003, 009, 011, 013, 014 |
| Báo cáo | Công suất xưởng (tải việc hôm nay, năng suất tuần) | `capacity.html` | Quản lý, quản đốc. FR-HRM-011, 014, 018 (FR-RPT-006) |
| Báo cáo | Tồn kho | `inventory-report.html` | Quản lý, thủ kho. FR-RPT-005, 016; RULE-008 |

Tệp dùng chung: `common.css` (bản sao mở rộng của `../rec-redesign/common.css`, phần "RPT additions" ở cuối), `charts.js` (định dạng vi-VN, biểu đồ cột HTML, tooltip, trạng thái từng khối). Ảnh chụp ở `screenshots/` (`-d` = 1440px, `-m` = 390px), tạo bằng `node design/rpt-redesign/measure.js`.

## Ý tưởng chính
- **Phạm vi nằm ở đầu trang, không chỉ trong chú thích (RULE-015).** Thanh phạm vi ghi chi nhánh, kỳ, độ chính thức (số tạm hay đã chốt), thời điểm cập nhật. Chuyển giữa một chi nhánh và toàn chuỗi là một nút chọn rõ ràng; quản lý chi nhánh thấy nút "Toàn chuỗi" bị khóa kèm lý do. Mọi tệp xuất, thông báo xuất, chân bảng đều lặp lại phạm vi.
- **Việc cần xử lý trước con số.** Tổng quan chi nhánh mở bằng danh sách có tab và số đếm (trễ hẹn giao, chưa có hóa đơn, chờ phụ tùng, lịch hẹn trễ), mỗi dòng lấy biển số làm định danh và có đúng một nút hành động; nút bị chặn nêu thiếu gì ("khách doanh nghiệp thiếu mã số thuế").
- **KPI có ngữ cảnh.** Mỗi thẻ có so sánh kỳ trước kèm mũi tên và dấu (không chỉ màu), nút "i" giải thích cách tính, liên kết đi sâu tới chứng từ (FR-RPT-011). Tổng quan chuỗi có 6 thẻ; chi nhánh có 5.
- **Tổng quan chuỗi lấy chi nhánh làm định danh dòng.** Bảng xếp hạng có tab (Tất cả, Doanh thu giảm, Có xe trễ hẹn giao) với số đếm tính từ dữ liệu, chọn tiêu chí xếp hạng, một nút "Xem chi nhánh" mỗi dòng, chân bảng ghi tổng dòng đang lọc. Khối cảnh báo toàn chuỗi (lệch quỹ, chưa chốt ngày, lệnh chưa có hóa đơn) mỗi dòng một nút.
- **Biểu đồ theo skill dataviz.** Chỉ cột (một trục, bắt đầu từ 0, lưới nhạt 0/50/100%), không dual-axis, không pie. Màu lấy từ `--chart-series-*` (tối đa 3 loạt), khoảng hở 2px giữa các đoạn xếp chồng, đầu cột bo 4px. **Số tạm vẽ vằn** để không nhầm với số đã chốt. Có chú thích, tooltip bằng chuột và bàn phím (cột có `tabindex`), nút "Biểu đồ / Bảng" để xem số thô.
- **Trạng thái từng khối**: nút "Xem thử" chuyển Đang tải (khung xương), Lỗi một khối (có Thử lại) mà không che cả trang.
- **Công suất xưởng**: tab Quá tải và Còn trống để quản đốc phân lại việc; tab năng suất tuần hiện ba chỉ số của FR-HRM-018 kèm công thức, mẫu số 0 hiện "–", hiệu suất trên 100% hợp lệ.
- **Tồn kho**: bốn số (tồn thực, đã giữ, đang chuyển, có thể bán) trên mỗi dòng; cảnh báo so với có thể bán, có ví dụ "tồn thực đủ nhưng đã giữ cho lệnh". Tìm không cần gõ dấu.

## Đã kiểm tra gì (trung thực)
- **Chưa chạy Playwright.** Phiên làm việc tạo các file này không có công cụ shell, nên **chưa có ảnh chụp trong `screenshots/`, chưa đo tràn ngang và lỗi JS**. Cần chạy `node design/rpt-redesign/measure.js` (in bảng tràn ngang theo từng trang ở 1440px và 390px, và lỗi JS) rồi sửa nếu có. Mọi tuyên bố "không tràn ngang 390px" chỉ là chủ đích thiết kế (lưới thu về một cột, bảng cuộn trong khung riêng), chưa được đo.
- Chưa kiểm tra bàn phím đầy đủ, chưa đo tương phản, chưa xem chế độ tối. Màu biểu đồ dùng token có sẵn (`--chart-series-1/2/4`), chưa chạy `validate_palette.js` của skill dataviz cho bộ này.
- Chưa kiểm tra bằng trình đọc màn hình.

## Chưa xác nhận / chưa xây
- **Toàn bộ số liệu là mẫu** (doanh thu, xe, tồn kho, thợ, giờ). Tổng giữa các màn khớp nội bộ (ví dụ 8 chi nhánh cộng đúng 681.020.000 ₫) nhưng không phải số thật. Tên chi nhánh (Quận 7, Thủ Đức, Cầu Giấy, Đà Nẵng...) là giả.
- **Định nghĩa doanh thu**: "đã thu cộng ghi nợ phát sinh" theo FR-RPT-003; có hay không có VAT là **[Cần xác nhận]**. Tỷ lệ chia nhóm doanh thu (công 38%, phụ tùng 55%) và tỷ lệ đã thu 82% chỉ minh họa. Danh mục "nhóm doanh thu" (Tiền công, Phụ tùng, Dịch vụ khác) là đề xuất, FR-RPT-014 nêu "nhóm doanh thu" nhưng chưa định nghĩa. Đồng sơn **[Cần xác nhận]**: luồng chưa khảo sát.
- **Lợi nhuận gộp quản trị**: chỉ hiện nhãn và công thức mô tả của FR-RPT-013; giá vốn "bình quân gia quyền" là hướng chọn, chờ kế toán khách.
- **Ngưỡng cảnh báo là đề xuất, không có trong FR**: "Doanh thu giảm so kỳ trước" (mọi mức giảm), "Có xe trễ hẹn giao" (từ 1 xe), "Còn trống từ 3 giờ", giờ khả dụng 8,0 giờ mỗi ngày, "Chậm luân chuyển" 90 ngày, "Định mức tối thiểu" của từng mã. **[Cần xác nhận]**.
- **Công thức "Có thể bán" = Tồn thực trừ Đã giữ, không tính hàng đang chuyển**: suy từ RULE-008 và CLAUDE.md, cần BA/kế toán xác nhận.
- **"Công suất xưởng" theo giờ thợ**, không theo khoang sửa (FR không có khoang/bay). Nếu khách muốn công suất theo khoang cần yêu cầu mới **[Cần xác nhận]**.
- **Chưa có trong hệ thống** (đề xuất mới): số đếm theo tab "Việc cần xử lý" gộp từ bốn nguồn; cảnh báo toàn chuỗi "chưa chốt ngày"; tab Chậm luân chuyển (cần ngày xuất gần nhất theo mã); danh sách tải việc theo thợ trong ngày (FR-HRM-014 chưa dựng); công thức ba chỉ số (FR-HRM-018 chưa dựng, phụ thuộc chấm công FR-HRM-003 chưa dựng). Nút "Đề nghị mua", "Xem phiếu chuyển", "Xuất hóa đơn", "Mở phiếu kiểm kê" chỉ là điểm vào sang màn khác, PUR thuộc phase 2 chưa xây.
- **Xuất Excel/PDF** (FR-RPT-009, mức Could) chỉ có thông báo mẫu ghi phạm vi, chưa có tệp.
- **Ngân sách index (hiện 172/200, ngưỡng thất bại 195)**: chưa đo được. Các màn trên cần truy vấn mà trang hiện tại chưa có: lệnh đã giao chưa có hóa đơn theo chi nhánh, tồn dưới định mức theo có thể bán, ngày xuất gần nhất theo mã (chậm luân chuyển), tải việc theo thợ theo ngày, số đếm theo tab. **Ước lượng thô 2 đến 5 chỉ mục**, nhưng khuyến nghị dev ưu tiên bộ đếm tổng hợp (aggregate) theo ngày và chi nhánh thay vì chỉ mục mới cho các thẻ KPI và số đếm tab; dev đo bằng `pnpm check:indexes`.
- Font Be Vietnam Pro chưa có file trong `design/assets/fonts`, ảnh chụp dùng font dự phòng.
