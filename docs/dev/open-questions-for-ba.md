# Câu hỏi cho ba (từ lần dựng khung dự án, 31/10/2026)

Dev không tự quyết các quy tắc dưới đây; khung dự án dùng giá trị tạm đánh dấu rõ trong mã. Mỗi mục: câu hỏi, giá trị tạm đang dùng, nơi cần sửa.

| # | Câu hỏi | Giá trị tạm trong mã | Liên quan |
| --- | --- | --- | --- |
| Q1 | Ma trận quyền theo vai trò và hành động (xem, tạo, sửa, lưu trữ, duyệt, từ chối, xuất, quản lý) cho từng tài nguyên; mã vai trò chính thức | Dữ liệu seed `CH`, `QL`, `TK` với quyền `warehouse:view/create/export` (`src/infrastructure/seed/demo.ts`). Vai trò là dữ liệu trong collection `roles`, không phải mã | FR-SYS-012, 013; FRD mục 2 |
| Q2 | "Kho" (warehouse) thuộc FR-SYS-005: mã kho duy nhất theo chi nhánh hay theo công ty? Được sửa tên, ngừng dùng, chuyển chi nhánh không? Có kho cấp công ty (kho tổng) không? | Mã duy nhất theo chi nhánh, bất biến; chưa có sửa hoặc ngừng dùng; kho luôn thuộc đúng một chi nhánh | FR-SYS-005, INV |
| Q3 | Người dùng nhiều chi nhánh: màn danh sách mặc định gộp mọi chi nhánh được giao hay buộc chọn một chi nhánh? Ai được đổi phạm vi? | Gộp tất cả chi nhánh được giao; chưa có bộ chọn phạm vi (chỉ hiển thị chỉ báo) | Design shell, FR-SYS-002 |
| Q4 | Chi nhánh bị khóa: tạo mới bị chặn (FR-SYS-011). Việc sửa bản ghi hiện có, thu tiền, xuất kho thì sao? | Chỉ chặn tạo kho mới; đọc luôn được | FR-SYS-011 |
| Q5 | Hết hạn phiên do rảnh và thời hạn tuyệt đối theo vai trò (D-05: 30 phút, KT/AD/CH 15 phút; tuyệt đối 12 giờ) | Một giá trị chung cấu hình bằng biến môi trường `SESSION_IDLE_MINUTES=30`, `SESSION_TTL_HOURS=12` | FR-SYS-001, D-05 |
| Q6 | Chính sách khóa đăng nhập sai nhiều lần (ADR đề xuất 5 lần khóa 15 phút), chính sách mật khẩu, giới hạn tốc độ | Chưa làm (slice 1.1); thông báo lỗi đăng nhập chung chung | FR-SYS-001 |
| Q7 | Đăng nhập bằng email hay mã nhân viên hay cả hai; mã nhân viên duy nhất theo công ty hay theo pháp nhân | Cả hai; mã nhân viên duy nhất trong cơ sở dữ liệu | FR-SYS-001 |
| Q8 | Chính sách che số điện thoại và địa chỉ theo vai trò (PiiPolicy), ai được bấm "Hiện", nội dung nhật ký truy cập | Chỉ có cổng và bộ che giả định che tất cả (`src/platform/pii/pii.ts`), chưa nơi nào gọi | NFR-SEC-03, PDPL 2025, FR-SYS-004 |
| Q9 | Thời hạn lưu nhật ký thao tác, nhật ký truy cập dữ liệu cá nhân và bản ghi khóa chống trùng; ai được xem nhật ký (màn chỉ đọc) | Khóa chống trùng giữ 24 giờ (`IDEMPOTENCY_TTL_HOURS`); nhật ký chưa có thời hạn xóa | FR-SYS-003, retention |
| Q10 | Xuất dữ liệu danh sách: có giới hạn số dòng, cần lý do, cần duyệt không? Cột nào được phép | Tối đa 5.000 dòng, không cần lý do, ghi nhật ký mỗi lần xuất | NFR-EXP-01 |
| Q11 | Ranh giới xuyên chi nhánh (BA-05): phần nào của khách và xe được thấy ngoài phạm vi, bằng phép chiếu nào | Chưa có; mọi thứ hiện cách ly cứng theo chi nhánh | NFR-ISO-01, CRM |
| Q12 | Kích thước trang mặc định và tối đa của danh sách | 25 mặc định, tối đa 100 (theo kế hoạch §2.3) | NFR-PERF-01 |
