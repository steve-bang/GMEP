# Câu hỏi cho ba (từ lần dựng khung dự án, 31/10/2026)

> **Trạng thái 31/10/2026**: BA đã trả lời Q1 đến Q12 và hai mục BA-12, BA-13 trong [ba-answers-for-dev.md](ba-answers-for-dev.md) (mục Q1: §2, Q2: §3, Q3: §4, Q4: §5, Q5 và Q6 và Q7: §1, Q8: §7, Q9: §8, Q10: §9, Q11: §10, Q12: §11; BA-13: §6). Các câu trả lời là **đề xuất BA chờ xác nhận**, dùng được làm giá trị mặc định cấu hình; các điểm thuộc Chủ dự án, Khách, Kế toán khách, Luật sư khách nằm ở §12 của tệp đó.

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

## Câu hỏi mới từ lần dựng slice 1.1 và 1.2 (01/11/2026, dev)

Chủ dự án quyết định **MFA làm sau**: không dựng TOTP/PIN, không cờ `mfaRequired`; `StrongAuthPort` chỉ còn là điểm móc không làm gì. Các giá trị dưới đây là cấu hình mặc định trong mã, ghi rõ nơi sửa.

| # | Câu hỏi | Giá trị tạm trong mã | Nơi sửa |
| --- | --- | --- | --- |
| N1 | Người có phép gán toàn công ty (`*`) nhưng không phải CH/QV (AD, KT) có được xem hợp nhất khi cấu hình không? BA §4 chỉ nêu CH và QV là vai trò hợp nhất | Có: gán `*` được coi là phạm vi hợp nhất, không buộc chọn chi nhánh | `loadActor` (auth.ts), `resolveWorkingScope` |
| N2 | Danh sách người dùng/nhân sự: SĐT của nhân viên dùng đúng bảng che của khách (BA §7 nói "dùng cùng cơ chế"). AD hiện KHÔNG thấy SĐT nhân viên nếu không có bảng riêng cho nhân sự. Email nhân viên (định danh đăng nhập) không bị che với ai có `user:view` | Cùng bảng; email không che | `DEFAULT_PII_POLICY`, `toUserDto` |
| N3 | Gán vai trò quản lý (CH/QV/QL/KT/AD) cần CH duyệt: hiện chỉ CH tự thực hiện, AD nhận lỗi `approval_required` thay vì tạo yêu cầu chờ duyệt. Có cần luồng "AD đề xuất, CH duyệt" cho phép gán, khóa chi nhánh, ngừng kho, sửa vai trò? | Chưa có luồng duyệt riêng cho các thao tác này; chỉ cấu hình có ngày hiệu lực mới có đề xuất/duyệt | `users.ts`, `branches.ts`, `warehouses.ts`, `roles.ts` |
| N4 | Ai tạo bảng giá bán và giá từng mặt hàng (BA §2.3 để trống): hiện chỉ CH có `price-list:create/update` | CH | `domain/permissions.ts` |
| N5 | Mã MH, NS và "Quản trị trụ sở" chưa có trong ma trận vai trò (chờ Chủ dự án); chưa seed | 10 vai trò FRD | `ROLE_CODES` |
| N6 | Kho mặc định mỗi chi nhánh (đúng một): hiện `isDefault=false`, chưa có thao tác đặt mặc định | Chưa làm | `warehouses.ts` |
| N7 | Mã kho sửa được trước khi có phát sinh (BA §3): hiện mã kho không sửa được qua API (an toàn hơn); khi INV có sổ kho mới biết "đã phát sinh" | Không sửa mã | `updateWarehouse` |
| N8 | Mốc áp thuế 1/1/2027 (BA-03) vẫn mở: thuế suất là cấu hình `tax-rate` có `effectiveFrom`, dữ liệu trong test là MẪU, chưa kế toán ký | Không có số hay mốc nào trong mã | `domain/config.ts`, tests/integration/config-admin.test.ts |
| N9 | Hạn mức đăng nhập sai theo địa chỉ mạng (bộ đếm C): 60 lần/15 phút/địa chỉ làm chậm tới 30 giây | 60 / 15 phút | `DEFAULT_LOCKOUT` |
| N10 | Đăng nhập bằng mã nhân viên khi công ty có nhiều pháp nhân/công ty cùng mã: hiện coi là mơ hồ và yêu cầu dùng email | Mơ hồ thì từ chối | `DocUserRepository.findByLogin` |
| N11 | Nhật ký thao tác cho KT: chỉ xem một số loại bản ghi liên quan tiền và cấu hình (danh sách trong mã) | `AUDIT_RESTRICTED_TYPES` | `application/audit.ts` |
| N12 | Xuất nhật ký: AD và CH, tối đa 5.000 dòng, có lý do; không bắt nhập lại mật khẩu vì không xuất cột cá nhân | Không step-up | `exportAuditCsv` |
| N13 | Nội dung "quy định sử dụng và bảo mật dữ liệu" khi kích hoạt tài khoản do doanh nghiệp cung cấp; hiện chỉ lưu thời điểm đồng ý và chuỗi phiên bản giữ chỗ | `consentPolicyVersion` | `sysConfigFromEnv` |
| N14 | Đổi email, mật khẩu tạm cho nhân viên không email (thợ), đăng nhập bất thường (bộ đếm B báo AD và gửi email chủ tài khoản), lịch sử đăng nhập FR-SYS-014: chưa làm trong lần này | Chưa làm | slice sau |
