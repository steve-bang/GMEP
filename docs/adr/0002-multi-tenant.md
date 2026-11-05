# ADR 0002: Multi-tenant (nháp)

- **Trạng thái:** Draft (chưa duyệt, chưa nằm trong phạm vi hiện tại; không triển khai trước khi chủ dự án duyệt)
- **Ngày:** 05/11/2026
- **Người đề xuất:** dev
- **Liên quan:** [ADR 0001](0001-tech-stack.md) (§2.1, §6) · `CLAUDE.md` (mục Domain model, Multi-tenant) · NFR-ISO-01, NFR-SCA-01

## 1. Bối cảnh

Chủ dự án dự định về sau phục vụ **nhiều công ty khách (tenant) độc lập trên cùng một nền tảng**. Hiện chỉ có một tenant (chuỗi garage của khách đầu tiên). Mô hình dữ liệu hiện tại: Company → Branch → Warehouse; cách ly theo chi nhánh do `resolveScope` và các repository thi hành (NFR-ISO-01). BRD còn mở câu hỏi một hay nhiều pháp nhân (`[Cần xác nhận]`); đó là chuyện **trong một tenant**, khác với multi-tenant.

Phân biệt:

| Khái niệm | Ý nghĩa |
| --- | --- |
| Tenant | Một khách hàng của nền tảng, dữ liệu tách hoàn toàn khỏi tenant khác |
| Company / pháp nhân | Đơn vị pháp lý trong một tenant (có thể nhiều) |
| Branch / Warehouse | Đơn vị vận hành trong một company |

## 2. Mục tiêu và không mục tiêu

**Mục tiêu (khi triển khai):** cách ly tuyệt đối dữ liệu giữa tenant (danh sách, tìm kiếm, báo cáo, xuất, API, media, nhật ký); cấu hình, đánh số, mẫu chứng từ, hóa đơn điện tử theo từng tenant; thêm tenant bằng quy trình cấp phát, không sửa mã.

**Không mục tiêu của ADR này:** triển khai ngay; billing; cổng tự đăng ký; tùy biến giao diện theo tenant; tên miền riêng (trừ khi chọn ở §6).

## 3. Phương án cách ly dữ liệu

| # | Phương án | Ưu | Nhược |
| --- | --- | --- | --- |
| A | **Dùng chung database và collection, mọi tài liệu có `tenantId`**; tenant là lớp `Scope` ngoài cùng | Rẻ, một hạ tầng, vận hành đơn giản, chia sẻ ngân sách chỉ mục | Một lỗi lọc là rò rỉ chéo tenant; chỉ mục phải thêm `tenantId` (đang 193/200 chỉ mục tổng hợp, xem `docs/dev/index-budget.md`); tenant lớn ảnh hưởng tenant khác; xóa/xuất dữ liệu một tenant khó |
| B | **Một database Firestore (named database) cho mỗi tenant** trong cùng dự án GCP | Cách ly mạnh, xuất/xóa theo tenant dễ, ngân sách chỉ mục tính riêng | Giới hạn số database mỗi dự án; Admin SDK phải chọn database theo tenant; quản lý rules, indexes, backup nhiều nơi |
| C | **Một dự án GCP/Firebase cho mỗi tenant** | Cách ly cao nhất, hóa đơn và vùng dữ liệu theo tenant | Vận hành và triển khai phức tạp nhất, chi phí nền cao |

**Nghiêng về:** B (hoặc A nếu số tenant dự kiến lớn và nhỏ). Chưa chốt: phụ thuộc số tenant dự kiến, yêu cầu pháp lý/hợp đồng về tách dữ liệu, ngân sách chỉ mục. `[Cần xác nhận]` chủ dự án.

## 4. Nguyên tắc để không chặn đường (áp dụng từ bây giờ)

Không xây tính năng tenant, nhưng khi viết mã mới:

1. Không hard-code một công ty; `Company` là đối tượng scope cao nhất hiện có.
2. Mọi quyết định cách ly nằm ở `resolveScope` và `src/infrastructure/repos`; tầng khác không tự lọc dữ liệu. Khi cần, `tenantId` được thêm làm thành phần ngoài cùng của `Scope`.
3. Đánh số chứng từ, cấu hình có hiệu lực theo ngày, mẫu tài liệu, đường dẫn Storage, nhật ký kiểm toán, khóa idempotency: tính **theo company**, không dùng bộ đếm hay khóa toàn cục.
4. Không để mã định danh hoặc đường dẫn dùng chung toàn nền tảng làm lộ dữ liệu (ví dụ ID tuần tự, tên tệp đoán được).
5. Cấu hình hạ tầng (vùng, bucket, nhà cung cấp hóa đơn điện tử, Zalo/SMS) đọc qua cổng/cấu hình, không nhúng cố định.
6. Dữ liệu seed và kiểm thử không giả định một tenant duy nhất; khi triển khai, ma trận kiểm thử cách ly (`docs/dev/uat-coverage.md`) mở rộng thêm trục tenant.

## 5. Các điểm cần quyết khi triển khai

| Chủ đề | Câu hỏi |
| --- | --- |
| Xác định tenant | Từ tên miền con, từ phiên đăng nhập, hay từ tài khoản? Người dùng thuộc một hay nhiều tenant? |
| Xác thực | Firebase Auth multi-tenancy (Identity Platform) hay tự quản tenant trong claims/session? Cookie `__Host-` và thu hồi phiên theo tenant |
| Phân quyền | Vai trò hệ thống (siêu quản trị nền tảng) tách khỏi 10 vai trò trong tenant |
| Cấu hình | Mặc định nền tảng → mặc định tenant → company/branch (kế thừa, có hiệu lực theo ngày) |
| Hóa đơn điện tử | Nhà cung cấp, chứng thư, mẫu số, ký hiệu theo tenant/pháp nhân |
| Lưu tệp | Bucket hoặc tiền tố theo tenant; URL ký phải kiểm tenant (A1 của ADR 0001) |
| Chỉ mục | Ảnh hưởng ngân sách 200 chỉ mục nếu chọn A |
| Sao lưu và xóa | Khôi phục, xuất và xóa dữ liệu riêng một tenant (Luật Bảo vệ dữ liệu cá nhân 2025) |
| Cấp phát | Quy trình tạo tenant, seed cấu hình mặc định, di chuyển dữ liệu Excel |
| Billing, hạn mức | Có hay không; theo chi nhánh, người dùng, hay gói |
| Di chuyển tenant đầu tiên | Dữ liệu hiện có được gán `tenantId` mặc định thế nào, có downtime không |

## 6. Hệ quả

- Chưa có thay đổi mã. Chi phí hiện tại chỉ là kỷ luật ở §4.
- Phương án nào cũng cần ADR chính thức (thay bản nháp này), spike kiểm chứng cách ly, và mở rộng bộ kiểm thử cách ly trước khi nhận tenant thứ hai.
- Ảnh hưởng đến: `Scope`/`resolveScope`, `DocStore`, `repos/queries.ts` và kiểm tra chỉ mục, Storage, xác thực/phiên, đánh số, cấu hình có hiệu lực, hóa đơn điện tử, dependency-cruiser (ranh giới không đổi).

## 7. Quyết định cần chủ dự án xác nhận

1. Số tenant dự kiến trong 2 năm và quy mô mỗi tenant.
2. Yêu cầu hợp đồng/pháp lý về tách dữ liệu (chung database có được không).
3. Người dùng có thuộc nhiều tenant không.
4. Mô hình thương mại (billing, gói, hạn mức).
5. Thời điểm dự kiến nhận tenant thứ hai.
