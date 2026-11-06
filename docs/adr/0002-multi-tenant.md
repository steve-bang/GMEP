# ADR 0002: Multi-tenant (mô hình cô lập, danh tính, cấp phát)

- **Trạng thái:** **Accepted for MT-0** (07/11/2026, dev, theo ủy quyền quyết định của chủ dự án). Phạm vi chấp nhận: nền tảng MT-0 (15 FR, Phase 1). Các phần phụ thuộc quyết định ngoài tầm (mục 8) được thiết kế thành hook và **không** coi là chốt. Mô hình vật lý (mục 3) được xem lại trước MT-1 hoặc khi có tenant đòi tách vật lý.
- **Ngày:** 05/11/2026 (bản nháp); viết lại 07/11/2026
- **Người quyết:** dev (senior full-stack); chủ dự án đã ủy quyền, chưa có phản hồi riêng cho ADR này
- **Liên quan:** [ADR 0001](0001-tech-stack.md) (§2.1, §6, §7.3) · `docs/dev/multi-tenant-requirements-for-dev.md` · `docs/multi-tenant-open-questions.md` · `docs/multi-tenant-analysis.md` mục 0A · `docs/dev/index-budget.md` · NFR-ISO-01

## 1. Bối cảnh

Chủ dự án quyết ngày 05/11/2026 (D1 đến D3) và 06/11/2026 (CD1 đến CD4): GMEP là SaaS dùng chung, multi-tenant thiết kế từ đầu, chủ garage khác tự đăng ký về sau, gói tính tiền làm sau (gói mặc định miễn phí, không trial), một email là một danh tính nhiều tư cách thành viên, không MFA cho vai trò nền tảng, tên sản phẩm GMEP. Phân cấp: Platform → Tenant → Company (pháp nhân) → Branch → Warehouse. Tin cậy giữa tenant là tin cậy giữa người lạ: một lỗi lọc là sự cố dữ liệu cá nhân của người ngoài.

Hiện trạng đo được (06/11/2026): mọi tài liệu nghiệp vụ đã mang `companyId`; **mọi** hình truy vấn trong `queries.ts` (194 hình, 193 chỉ mục tổng hợp) đã có `companyId` làm trường cân bằng đầu tiên; mọi khóa xác định (mã nhân viên, biển số, VIN, bộ đếm số chứng từ, khóa chống trùng hóa đơn, khóa idempotency của đánh số) đã chứa `companyId`; `Scope` đã có `companyId` ngoài cùng và `resolveScope` là nơi duy nhất quyết định cô lập; dữ liệu chỉ nằm ở Emulator. Nghĩa là trên thực tế `companyId` hiện nay **là** ranh giới tenant.

## 2. Quyết định

1. **Mô hình cô lập: phương án A có điểm đặt chỗ (placement hook).** Một database Firestore dùng chung; mọi tài liệu nghiệp vụ mang `tenantId`; mọi hình truy vấn có `tenantId` là trường cân bằng đầu; mọi khóa xác định và đường dẫn tệp chứa tenant. Hồ sơ tenant có trường `placement` (MT-0 chỉ chấp nhận `pooled`); một tenant đòi tách vật lý sau này được chuyển sang database/dự án riêng bằng cách đổi `placement` và một `DocStore` factory theo tenant, không đổi mã nghiệp vụ (tiêu chí 7).
2. **M1: `companyId` hiện có được đổi tên thành `tenantId`** (cả tên trường, kiểu, tham số, `Scope`, `Actor`), **giữ nguyên giá trị** của dữ liệu đang có, nên mọi khóa xác định cũ vẫn đúng (M7). `Company` (pháp nhân, FR-SYS-018) là khái niệm con của tenant, chưa build: hồ sơ tenant có `legalEntityIds`; `companyId` chỉ được dùng lại về sau cho pháp nhân và chỉ là thuộc tính bổ sung, không bao giờ là ranh giới cô lập.
3. **Danh tính một-nhiều (U2):** danh tính = một tài khoản ở nhà cung cấp danh tính (uid) + khe email chuẩn hóa duy nhất toàn nền tảng (`userKeys/email__<email>` mang `identityId`); MT-0 chưa có gì khác ở cấp danh tính cần lưu nên **không có bộ sưu tập `identities` riêng** (thêm khi MT-1 cần trạng thái cấp danh tính). `users` giữ nguyên là **tư cách thành viên** (membership) của một tenant (tenantId, identityId, mã nhân viên duy nhất trong tenant, vai trò qua `roleAssignments`, trạng thái, thời điểm mời/thu hồi). Quy ước cũ `user.id == uid` vẫn đúng cho tư cách đầu tiên (tenant số 1 không phải di chuyển id); tư cách thứ hai trở đi có id riêng.
4. **Phiên gắn đúng một tenant:** bản ghi phiên lưu `userId` (id tư cách) và `tenantId`; `Actor.tenantId` luôn lấy từ tư cách, không từ dữ liệu client. Sau mật khẩu đúng: 1 tư cách đang hoạt động thì vào thẳng; từ 2 thì phiên "chưa chọn tenant" (không đọc được dữ liệu nghiệp vụ nào) cho đến khi gọi `POST /api/v1/auth/tenant` (chọn/đổi tenant = tạo phiên mới, Scope tính lại, bỏ cache, thu hồi phiên cũ).
5. **Vai trò nền tảng tách vùng:** bộ sưu tập `platformIdentities` + `platformRoles` (CNT, QTN, HTN, VHB, ma trận FRD §2) tách hẳn `identities`; email không được trùng giữa hai vùng; không có đường nào từ phiên nền tảng tới `resolveScope` của tenant (chỉ có phiên hỗ trợ có đồng ý ở MT-1). Nhật ký nền tảng (`platformAuditLogs`) bất biến, không chứa dữ liệu cá nhân của khách tenant.
6. **Vòng đời tenant** là state machine riêng (13 trạng thái, FR-TEN-003), bảng chuyển trạng thái là dữ liệu trong `domain`, mọi chuyển có người làm, lý do, người duyệt (bước nhạy cảm, hai người khác nhau, RULE-027), ghi nhật ký nền tảng cùng giao dịch.
7. **Cấp phát (FR-TEN-002)** là lõi idempotent dùng chung cho thủ công (MT-0) và tự động (MT-1): `provisionTenant(requestKey)`; id tenant xác định từ khóa yêu cầu; checklist bước có sổ ghi từng bước đã xong trong hồ sơ tenant; chạy lại bỏ qua bước xong; không có bước cần người (MT-1 gọi được không cần người).
8. **Gói/thuê bao (B0):** hồ sơ tenant có `plan` (mặc định `free`) và `subscriptionStatus` (mặc định `none`), không có trường hạn dùng thử, không job hết hạn; một điểm kiểm tra `EntitlementPort.check(tenant, feature)` mặc định cho phép (hook MT-2).

## 3. Đánh giá bảy tiêu chí của BA

| # | Tiêu chí | A (chọn) | B (database/tenant) | C (dự án/tenant) |
| --- | --- | --- | --- | --- |
| 1 | Không rò rỉ, chứng minh được | Chứng minh bằng **kiểm thử và bất biến tĩnh**, không bằng cấu trúc: `Scope` có nhãn kiểu, mọi đọc theo id so khớp `tenantId`, một test đơn vị buộc **mọi hình truy vấn** có `tenantId` (trừ danh sách trắng nền tảng/danh tính), ma trận cô lập có trục tenant (mục 6). Rủi ro còn lại: một lỗi lọc ở mã mới | Mạnh hơn: sai lọc không vượt database | Mạnh nhất |
| 2 | Xuất/xóa/khôi phục riêng một tenant | Làm được bằng quét `where tenantId ==` từng collection (chỉ mục đơn trường tự động, không tốn chỉ mục tổng hợp); danh sách collection có cờ `tenantScoped` trong `COL`; khôi phục riêng tenant là việc MT-1 (FR-TEN-006/007/034) và khó hơn B | Dễ nhất (export/delete database) | Dễ nhất |
| 3 | Chi phí cố định/tenant ~0 | Đạt (không tài nguyên mới) | Gần 0 nhưng mỗi database có bộ chỉ mục riêng phải triển khai | Không đạt |
| 4 | Cấp phát tự động vài phút | Đạt (ghi vài tài liệu, giây) | Cần GCP Admin API và triển khai chỉ mục theo database (phút đến chục phút, **chưa kiểm chứng**, phụ thuộc Q26) | Chậm nhất |
| 5 | Công bằng hiệu năng | Chưa tự bảo đảm; bù bằng giới hạn tốc độ theo tenant (đã có `RateLimiter`, thêm khóa tenant ở MT-2) và truy vấn luôn có giới hạn trang; **đo ở perf-nfr có hai tenant** | Tốt hơn | Tốt nhất |
| 6 | Trong ngân sách chỉ mục | **Đạt, 193 không đổi**: `tenantId` thay `companyId` trong từng chỉ mục (đo bằng `pnpm check:indexes`) | Ngân sách tính riêng từng database nhưng nhân bản việc triển khai | n/a |
| 7 | Tách ra riêng sau này | Đạt nhờ `placement` + `DocStore` factory theo tenant; chi phí di chuyển là sao chép theo `tenantId` | Sẵn | Sẵn |

Vì sao không B ngay: (a) trần database mỗi dự án mặc định là hạn mức cần xác minh với tài liệu GCP và chưa biết Q2 (số tenant); (b) cấp phát tự động cần quyền Admin trên dự án GCP, chưa có dự án (CLAUDE.md: "no GCP project yet"); (c) Emulator và bộ kiểm thử hiện chạy một database, nhân đôi hạ tầng kiểm thử; (d) chi phí retrofit của A gần như bằng 0 vì `companyId` đã là ranh giới. Vì sao không giữ nhãn `companyId` cho tenant: nhầm với pháp nhân (FR-SYS-018) và với `Company` ở FR-TEN-018, 021; đổi tên bây giờ rẻ nhất (dữ liệu chỉ ở Emulator).

Điều kiện xem lại sang B (cho tenant, không cho toàn nền tảng): hợp đồng đòi tách vật lý (Q3); một tenant vượt ngưỡng tải chung; số tenant nhỏ và cần cách ly mạnh hơn (Q2).

## 4. Tác động chỉ mục

`pnpm check:indexes` đo trước khi làm: **193 chỉ mục tổng hợp, 194 hình truy vấn**. Phương án A thay `companyId` bằng `tenantId` trong từng hình/chỉ mục: số lượng **không đổi (193)**, ngưỡng fail 195 giữ. Hình truy vấn mới của MT-0 không thêm chỉ mục: hồ sơ tenant, danh tính, tư cách thành viên, nhật ký nền tảng đều đọc theo khóa; danh sách tenant dùng một hình chỉ có sắp theo một trường (chỉ mục đơn trường tự động); tư cách theo email dùng lại hình `users.byEmail` sẵn có (một hình đổi lấy một hình: bỏ `users.byEmployeeCode` vì mã nhân viên không còn là tên đăng nhập, nên số chỉ mục còn **192**); phiên lưu danh sách id tư cách tại lúc đăng nhập nên không truy vấn thêm. Ghi trong `docs/dev/index-budget.md`.

## 5. Trả lời DEV-1 đến DEV-10

| Mã | Trả lời |
| --- | --- |
| DEV-1 | Phương án A + `placement` (mục 2, 3); bằng chứng: ma trận cô lập chéo tenant, test bất biến mọi hình truy vấn có `tenantId`, đo chỉ mục không đổi. **Chưa spike B/C** (chờ dự án GCP) |
| DEV-2 | Mục 4: 193 không đổi |
| DEV-3 (M1) | `companyId` → `tenantId`, giữ giá trị; `Company` pháp nhân là con của tenant, thêm sau |
| DEV-4 | Mục 2.3, 2.4: `identities` + `users` là membership; `POST /api/v1/auth/tenant` chọn/đổi; thu hồi theo tư cách: `revokeAllSessions` đổi từ "theo user" sang "theo tư cách" (id tư cách), không đụng tư cách khác; đổi mật khẩu thu hồi mọi phiên của danh tính (đề xuất Q41a); tenant A không đọc được danh tính ở tenant khác (API chỉ trả tư cách của chính tenant) |
| DEV-5 | Mục 2.7. Spike cấp phát trên Firebase/GCP **không làm được ở đây** (không có dự án, Q26): MT-0 cấp phát = ghi tài liệu trong Firestore, không tạo tài nguyên GCP; bước tài nguyên GCP (nếu chọn B/C) là một `ProvisioningStep` cắm thêm sau |
| DEV-6 (M7) | Giữ giá trị id tenant cũ nên khóa bộ đếm, khóa chống trùng hóa đơn (FR-EIN-013), khóa idempotency không đổi; công cụ di chuyển `scripts/migrate-to-tenant.ts` đổi tên trường `companyId` → `tenantId`, đổi id vai trò và phiên bản cấu hình (thêm tiền tố tenant), **dry-run mặc định**, idempotent, chỉ chạy trên Emulator, in đối chiếu số bản ghi và tổng tiền trước/sau; kế hoạch quay lui = chụp snapshot/export trước khi chạy (id vai trò và cấu hình đổi nên không quay từng trường được; chưa có dữ liệu thật) |
| DEV-7 (M8) | Đường dẫn tệp `<area>/<tenantId>/<branchId>/<name>` (đã server-chọn); URL ký (khi build) kiểm tenant trước khi cấp; thêm test đường dẫn |
| DEV-8 (M9) | Cron chạy **lần lượt theo tenant** trong trạng thái cho phép (`active`, `onboarding`, `restricted`, `suspended` cho tác vụ đồng bộ hóa đơn), lỗi tenant này không chặn tenant khác; `CRON_COMPANY_ID` bỏ, thay bằng `CRON_TENANT_ID` tùy chọn (giới hạn một tenant) |
| DEV-9 (C-15) | Hồ sơ tenant có `environment: 'demo' \| 'live'`; hóa đơn `fake` bị từ chối khi `live` (FR-TEN-021); seed tạo tenant `demo` |
| DEV-9b (C-17, C-S16) | Chống bot, tra MST, liên kết một lần là **MT-1**; chỉ có cổng/hook (`SignupGuardPort` sẽ đặt tên khi build), không build ở đây |
| DEV-10 | Ước lượng MT-0 (một dev, đã gồm test): nền tên + Scope + khóa **2 ngày** (đã làm, thực tế gồm cả sửa bốn lỗ cô lập); tenant record + vòng đời + nhật ký nền tảng + cấp phát **3 ngày**; danh tính một-nhiều + phiên chọn/đổi tenant + thu hồi theo tư cách + migration tài khoản **4 ngày**; vai trò nền tảng tách vùng **1 ngày**; cấu hình/tích hợp theo tenant (FR-TEN-018, 021) **2 ngày**; ma trận cô lập trục tenant + seed hai tenant + migration tool + UAT-TEN **3 ngày**; màn hình (chọn công ty, UI nền tảng) **không tính** (chờ designer, MT-1). Tổng ~15 ngày người cho phần không giao diện. Đầu vào cho Q37: MT-0 chậm go-live pilot tối đa ~3 tuần lịch nếu một dev làm tuần tự |

## 6. Cô lập: các điểm thi hành

- `Scope.tenantId` do `resolveScope` đặt từ `Actor.tenantId`; `Actor` chỉ được tạo trong `loadActor` từ tư cách trong phiên; không có tham số/tiêu đề/đường dẫn nào đưa `tenantId` vào `Scope` (FR-TEN-010).
- Đọc theo id: bản ghi có `tenantId` khác `scope.tenantId` trả "không tìm thấy" cùng dạng như bản ghi không tồn tại (kiểm tra ở `scopeAllows` và các repository đang gọi nó).
- Bất biến tĩnh: test đơn vị duyệt `registeredQueries()` và buộc `eq` chứa `tenantId`, ngoại lệ là danh sách trắng ghi rõ lý do (collection nền tảng/danh tính). RULE-017: không truy vấn nghiệp vụ toàn nền tảng.
- Khóa xác định: `tenantId` là thành phần đầu; hai tenant được trùng số (RULE-018). Khóa idempotency chung băm theo (id tư cách, tuyến, khóa); id tư cách duy nhất toàn nền tảng nên hai tenant không đụng nhau (có test), chưa thêm tenant vào băm; khóa chống trùng hóa đơn đã chứa tenant và không hết hạn (không đổi). Khi rà soát tìm ra bốn khóa/ID không có tenant (vai trò, phiên bản cấu hình, id chi nhánh tạo qua API, tra người dùng theo id): đã sửa, xem `docs/dev/status.md` MT-0.
- Ma trận `isolation-matrix.test.ts`: thêm trục tenant (tenant B có dữ liệu riêng, tài khoản tenant A không thấy qua danh sách, chi tiết theo id, xuất, tìm kiếm; dùng khóa idempotency của tenant khác).

## 7. Kế hoạch retrofit (M13) và tiến độ

Làm theo lát cắt nhỏ, mỗi lát qua `pnpm check:fast`: (1) đổi tên `companyId` → `tenantId`, `Company` → `Tenant`, cron theo tenant; (2) hồ sơ tenant, vòng đời, nhật ký nền tảng, cấp phát; (3) danh tính một-nhiều, phiên chọn/đổi tenant; (4) vai trò nền tảng tách vùng; (5) seed hai tenant, ma trận cô lập trục tenant, công cụ di chuyển. Tiến độ thực tế ghi ở `docs/dev/status.md` (mục MT-0): các lát (1) đến (5) đã xong ở mức dữ liệu, Scope, repository, phiên và test; chưa có giao diện, chưa có đăng nhập HTTP của nhân sự nền tảng, chưa có tầng cấu hình nền tảng.

## 8. Phụ thuộc quyết định ngoài tầm (không chặn, có hook)

| Chủ đề | Hook trong MT-0 | Khi có quyết định |
| --- | --- | --- |
| Q14 (khách đầu tiên đồng ý dùng chung nền tảng, sở hữu hạ tầng) | `placement` + factory theo tenant | Nếu khách đòi hạ tầng riêng: tenant số 1 `placement` riêng, không đổi mã |
| Q26 (cấp phát trên GCP) | `ProvisioningStep` cắm thêm | Thêm bước tạo database/dự án nếu chọn B/C |
| Q12, Q27, billing | `plan`/`subscriptionStatus` + `EntitlementPort` mặc định cho phép; không số liệu tiền nền tảng | MT-2/MT-3 |
| Q24 (vai trò nền tảng) | Ma trận FRD §2 là dữ liệu cấu hình có thể đổi | Điều chỉnh bảng quyền |
| Q37, Q38 | Không chặn | Chủ dự án quyết |
| Q40 (giới hạn tenant miễn phí) | Chưa có giới hạn; điểm kiểm tra mặc định cho phép | Tham số cấu hình |
| Q41 (quy tắc danh tính một-nhiều) | Theo đề xuất BA: đổi mật khẩu áp cho danh tính; tenant không thấy tenant khác | Đổi tại một chỗ nếu khác |

## 9. Hệ quả

- Một lần đổi tên lớn trong mã, dữ liệu và kiểm thử (`companyId` → `tenantId`); dữ liệu Emulator cũ phải qua công cụ di chuyển hoặc làm lại seed.
- Không tenant nào được nhận (kể cả tenant số 2) trước khi ma trận cô lập chéo tenant xanh (FR-TEN-014).
- Giới hạn đã biết của A: cô lập là bất biến của mã (ngăn bằng kiểu, test, lint tĩnh), không phải của hạ tầng; vì vậy `placement` được giữ để nâng cấp cho tenant cần cách ly mạnh.
